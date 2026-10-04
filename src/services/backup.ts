/**
 * Backup Service — Export / Import JSON completo
 * Offline-first: todo vive en SQLite local, el backup es un snapshot en JSON.
 *
 * Formato: { version, exportDate, app, data: { <tabla>: rows[] } }
 * Se exportan filas crudas (snake_case) para que el import sea un INSERT OR REPLACE
 * sin necesidad de mapear nombres de campo.
 */

import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDatabase, runTransaction } from '@/db/database';
import { DATABASE_VERSION } from '@/db/schema';
import { STORAGE_KEYS } from '@/constants';

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

/** Guarda el backup en el directorio de documento del dispositivo. Devuelve el path. */
export function saveBackupFile(): { uri: string; bytes: number } {
  const backup = collectBackup();
  const json = serialize(backup);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = new File(Paths.document, `personaltrainer-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(json);
  return { uri: file.uri, bytes: json.length };
}

/** Guarda el backup en caché y abre el share sheet para enviarlo (WhatsApp, Drive, mail...). */
export async function exportAndShare(): Promise<{ uri: string; total: number }> {
  const backup = collectBackup();
  const json = serialize(backup);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = new File(Paths.cache, `personaltrainer-backup-${stamp}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  const total = Object.values(backup.conteos).reduce((a, b) => a + b, 0);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Exportar datos',
      UTI: 'public.json' });
  }

  return { uri: file.uri, total };
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
    const backup = collectBackup();
    const json = serialize(backup);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const dir = ensureAutoDir();
    const file = new File(dir, `auto-${stamp}.json`);
    file.create();
    file.write(json);

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

/** Inserta las filas del backup. `replace` borra todo antes (modo Restaurar). */
export function importBackup(backup: BackupFile, modo: 'replace' | 'merge' = 'replace'): ImportResult {
  if (!backup || backup.version !== BACKUP_VERSION) {
    return { ok: false, modo, conteos: {}, error: `Versión de backup no soportada (${backup?.version})` };
  }
  if (!backup.data) {
    return { ok: false, modo, conteos: {}, error: 'El archivo no contiene datos' };
  }

  const db = getDatabase();
  const conteos: Record<string, number> = {};

  try {
    runTransaction((tx) => {
      if (modo === 'replace') {
        // Orden inverso para no violar FKs
        for (const table of [...TABLES].reverse()) {
          tx.executeSync(`DELETE FROM ${table}`);
        }
      }

      for (const table of TABLES) {
        const rows = backup.data[table];
        if (!Array.isArray(rows)) {
          conteos[table] = 0;
          continue;
        }
        let inserted = 0;
        for (const row of rows) {
          const cols = Object.keys(row);
          if (cols.length === 0) continue;
          const placeholders = cols.map(() => '?').join(', ');
          tx.executeSync(
            `INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`,
            cols.map((c) => row[c])
          );
          inserted++;
        }
        conteos[table] = inserted;
      }
    });
  } catch (e: any) {
    return { ok: false, modo, conteos, error: e?.message || 'Error al importar' };
  }

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
  const texto = await file.text();

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
export function clearAllData(): void {
  const db = getDatabase();
  runTransaction((tx) => {
    for (const table of [...TABLES].reverse()) {
      tx.executeSync(`DELETE FROM ${table}`);
    }
  });
}

export function getCounts(): Record<string, number> {
  const db = getDatabase();
  const conteos: Record<string, number> = {};
  for (const table of TABLES) {
    const r = db.executeSync(`SELECT COUNT(*) as n FROM ${table}`);
    conteos[table] = (r.rows[0] as any)?.n ?? 0;
  }
  return conteos;
}
