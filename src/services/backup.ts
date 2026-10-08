/**
 * Backup Service — Export / Import JSON completo
 * Offline-first: todo vive en SQLite local, el backup es un snapshot en JSON.
 *
 * Formato: { version, exportDate, app, data: { <tabla>: rows[] } }
 * Se exportan filas crudas (snake_case; las columnas JSON quedan como string)
 * para que el import sea un upsert sin necesidad de mapear nombres de campo.
 */

import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Scalar } from '@op-engineering/op-sqlite';
import { getDatabase, runTransaction, ensureSeedData } from '@/db/database';
import { DATABASE_VERSION } from '@/db/schema';
import { STORAGE_KEYS } from '@/constants';
import {
  useClientesStore,
  useProgresoStore,
  useRutinasStore,
  useEntrenamientosStore,
} from '@/stores';

export const BACKUP_VERSION = 1;

const TABLES = [
  'clientes',
  'fichas_iniciales',
  'checkins_semanales',
  'ejercicios',
  'rutinas_semanales',
  'entrenamientos_realizados',
  'metas',
] as const;

export type TableName = (typeof TABLES)[number];

export interface BackupFile {
  version: number;
  exportDate: string;
  app: { nombre: string; dbVersion: number };
  conteos: Record<string, number>;
  data: Record<string, Record<string, any>[]>;
}

// ============================================
// EXPORT
// ============================================
export function collectBackup(): BackupFile {
  const db = getDatabase();
  const data: Record<string, Record<string, any>[]> = {};
  const conteos: Record<string, number> = {};

  for (const table of TABLES) {
    const result = db.executeSync(`SELECT * FROM ${table}`);
    data[table] = result.rows as Record<string, any>[];
    conteos[table] = result.rows.length;
  }

  return {
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    app: { nombre: 'PersonalTrainer', dbVersion: DATABASE_VERSION },
    conteos,
    data };
}

function serialize(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/** Hora local: con toISOString el nombre saldría en UTC y no coincidiría con el reloj del usuario. */
function timestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
}

function writeJsonFile(file: File, json: string) {
  file.create({ overwrite: true });
  file.write(json);
}

/** Guarda el backup en el directorio de documento del dispositivo. Devuelve el path. */
export function saveBackupFile(): { uri: string; bytes: number } {
  const json = serialize(collectBackup());
  const file = new File(Paths.document, `personaltrainer-backup-${timestamp()}.json`);
  writeJsonFile(file, json);
  return { uri: file.uri, bytes: file.size };
}

/** Guarda el backup en caché y abre el share sheet para enviarlo (WhatsApp, Drive, mail...). */
export async function exportAndShare(): Promise<{ uri: string; total: number; shared: boolean }> {
  const backup = collectBackup();
  const json = serialize(backup);
  const file = new File(Paths.cache, `personaltrainer-backup-${timestamp()}.json`);
  writeJsonFile(file, json);

  const total = Object.values(backup.conteos).reduce((a, b) => a + b, 0);

  if (!(await Sharing.isAvailableAsync())) {
    return { uri: file.uri, total, shared: false };
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Exportar datos',
    UTI: 'public.json' });

  return { uri: file.uri, total, shared: true };
}

// ============================================
// BACKUP AUTOMÁTICO
// ============================================
const AUTO_DIR_NAME = 'backups';

function ensureAutoDir(): Directory {
  const dir = new Directory(Paths.document, AUTO_DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Backup automático: guarda un snapshot y conserva solo los últimos N. */
export function runAutoBackup(keep = 7): string | null {
  try {
    const json = serialize(collectBackup());
    const stamp = timestamp();
    const dir = ensureAutoDir();
    const file = new File(dir, `auto-${stamp}.json`);
    writeJsonFile(file, json);

    // Limpieza: mantener solo los `keep` más recientes
    const archivos = dir
      .list()
      .filter((f) => f instanceof File && f.name.startsWith('auto-'))
      .sort((a, b) => (b as File).name.localeCompare((a as File).name));
    for (const viejo of archivos.slice(keep)) {
      try {
        (viejo as File).delete();
      } catch {}
    }

    await_setLastBackup(stamp);
    return file.uri;
  } catch (e) {
    console.warn('[backup] auto-backup falló:', e);
    return null;
  }
}

function await_setLastBackup(stamp: string) {
  AsyncStorage.setItem(STORAGE_KEYS.lastBackupAt, stamp).catch(() => {});
}

export async function getLastBackupAt(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEYS.lastBackupAt);
}

export function listAutoBackups(): File[] {
  try {
    const dir = ensureAutoDir();
    return dir
      .list()
      .filter((f) => f instanceof File && f.name.startsWith('auto-'))
      .sort((a, b) => (b as File).name.localeCompare((a as File).name)) as File[];
  } catch {
    return [];
  }
}

// ============================================
// IMPORT
// ============================================
export interface ImportResult {
  ok: boolean;
  modo: 'replace' | 'merge';
  conteos: Record<string, number>;
  error?: string;
}

function tableColumns(table: TableName): Set<string> {
  const info = getDatabase().executeSync(`PRAGMA table_info(${table})`).rows as { name?: unknown }[];
  return new Set(info.map((c) => String(c.name)));
}

function toScalar(value: unknown): Scalar {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string') return value;
  // Columnas JSON editadas a mano como objeto/array: se guardan como texto.
  return JSON.stringify(value);
}

/**
 * Inserta las filas del backup. `replace` borra todo antes (modo Restaurar);
 * `merge` actualiza por id sin borrar lo que no esté en el archivo.
 *
 * Se usa `ON CONFLICT(id) DO UPDATE` y no `INSERT OR REPLACE`: REPLACE borra la
 * fila existente, lo que con `foreign_keys = ON` dispara los `ON DELETE CASCADE`
 * y en modo merge eliminaría fichas/check-ins/rutinas locales del cliente.
 */
export function importBackup(backup: BackupFile, modo: 'replace' | 'merge' = 'replace'): ImportResult {
  if (!backup || typeof backup !== 'object' || backup.version !== BACKUP_VERSION) {
    return { ok: false, modo, conteos: {}, error: `Versión de backup no soportada (${backup?.version})` };
  }
  if (!backup.data || typeof backup.data !== 'object') {
    return { ok: false, modo, conteos: {}, error: 'El archivo no contiene datos' };
  }

  const conteos: Record<string, number> = {};

  try {
    runTransaction((tx) => {
      if (modo === 'replace') {
        // Orden inverso (hijas antes que padres) para no violar FKs
        for (const table of [...TABLES].reverse()) {
          tx.executeSync(`DELETE FROM ${table}`);
        }
      }

      // TABLES está en orden padres → hijas, así las FKs ya existen al insertar.
      for (const table of TABLES) {
        const rows = backup.data[table];
        if (!Array.isArray(rows)) {
          conteos[table] = 0;
          continue;
        }
        const permitidas = tableColumns(table);
        let inserted = 0;
        for (const row of rows) {
          if (!row || typeof row !== 'object' || row.id == null) continue;
          // Solo columnas reales de la tabla: evita SQL inyectado vía nombres de clave.
          const cols = Object.keys(row).filter((c) => permitidas.has(c));
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          const updates = cols.filter((c) => c !== 'id').map((c) => `${c} = excluded.${c}`);
          const onConflict = updates.length > 0 ? `DO UPDATE SET ${updates.join(', ')}` : 'DO NOTHING';
          try {
            tx.executeSync(
              `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) ${onConflict}`,
              cols.map((c) => toScalar(row[c]))
            );
          } catch (e: any) {
            throw new Error(`${table} (id ${String(row.id)}): ${e?.message ?? e}`);
          }
          inserted++;
        }
        conteos[table] = inserted;
      }
    });
  } catch (e: any) {
    return { ok: false, modo, conteos: {}, error: e?.message || 'Error al importar' };
  }

  ensureSeedData();
  return { ok: true, modo, conteos };
}

/** Abre el selector de documentos y aplica el backup encontrado. */
export async function pickAndImport(
  modo: 'replace' | 'merge'
): Promise<{ cancelado: boolean; resultado?: ImportResult }> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ['application/json', 'text/json', '*/*'] });

  if (picked.canceled || !picked.assets?.[0]) {
    return { cancelado: true };
  }

  const file = new File(picked.assets[0].uri);
  let texto: string;
  try {
    texto = await file.text();
  } finally {
    // Es la copia en caché del picker: no hace falta conservarla.
    try {
      if (file.exists) file.delete();
    } catch {}
  }

  let parsed: BackupFile;
  try {
    parsed = JSON.parse(texto);
  } catch {
    return { cancelado: false, resultado: { ok: false, modo, conteos: {}, error: 'El archivo no es JSON válido' } };
  }

  return { cancelado: false, resultado: importBackup(parsed, modo) };
}

// ============================================
// CLEAR
// ============================================
/** Borra todos los datos del usuario y re-siembra el catálogo base de ejercicios. */
export function clearAllData(): void {
  runTransaction((tx) => {
    for (const table of [...TABLES].reverse()) {
      tx.executeSync(`DELETE FROM ${table}`);
    }
  });
  ensureSeedData();
}

// ============================================
// SINCRONIZAR STORES
// ============================================
/**
 * Tras limpiar o importar, descarta las cachés de Zustand (algunas persistidas
 * en AsyncStorage) y recarga la lista de clientes desde SQLite, para que
 * ninguna pantalla muestre datos viejos.
 */
export function resyncStoresFromDatabase(): void {
  useProgresoStore.setState({ fichas: {}, checkins: {}, metas: {} });
  useRutinasStore.setState({ ejercicios: [], rutinasPorCliente: {}, rutinaActual: null });
  useEntrenamientosStore.setState({ entrenamientos: {}, entrenamientoActivo: null });

  const rows = getDatabase().executeSync('SELECT * FROM clientes ORDER BY actualizado_en DESC').rows as any[];
  const clientes = rows.map((row) => ({
    id: row.id,
    nombre: row.nombre,
    apellido: row.apellido,
    email: row.email ?? undefined,
    telefono: row.telefono ?? undefined,
    fechaNacimiento: row.fecha_nacimiento,
    sexo: row.sexo,
    altura: Number(row.altura),
    fotoUri: row.foto_uri ?? undefined,
    creadoEn: row.creado_en,
    actualizadoEn: row.actualizado_en,
  }));
  const { selectedClienteId } = useClientesStore.getState();
  useClientesStore.setState({
    clientes,
    searchQuery: '',
    selectedClienteId: clientes.some((c) => c.id === selectedClienteId) ? selectedClienteId : null,
  });
}

export function getCounts(): Record<string, number> {
  const db = getDatabase();
  const conteos: Record<string, number> = {};
  for (const table of TABLES) {
    const r = db.executeSync(`SELECT COUNT(*) as n FROM ${table}`);
    conteos[table] = Number((r.rows[0] as any)?.n ?? 0) || 0;
  }
  return conteos;
}
