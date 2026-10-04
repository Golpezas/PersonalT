/**
 * Servicio de Metas — CRUD real sobre SQLite.
 *
 * La app es offline-first: el store de Zustand solo guarda las metas en memoria
 * como caché de la sesión. La fuente de verdad es la tabla `metas`.
 */

import { getDatabase } from '@/db/database';
import { generateId } from '@/utils/helpers';
import type { Meta } from '@/types';
import type { EstadoMeta, TipoMeta } from '@/db/schema';

type Row = any;

function filaAMeta(r: Row): Meta {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    tipo: r.tipo,
    descripcion: r.descripcion,
    valorObjetivo: r.valor_objetivo,
    unidad: r.unidad,
    fechaObjetivo: r.fecha_objetivo,
    valorInicial: r.valor_inicial,
    fechaInicio: r.fecha_inicio,
    estado: r.estado,
    creadoEn: r.creado_en };
}

/** Todas las metas de un cliente, ordenadas por fecha objetivo. */
export function leerMetas(clienteId: string): Meta[] {
  try {
    const db = getDatabase();
    const r = db.executeSync(
      'SELECT * FROM metas WHERE cliente_id = ? ORDER BY estado = \'pausada\', fecha_objetivo ASC',
      [clienteId]
    );
    return (r.rows as Row[]).map(filaAMeta);
  } catch (error) {
    console.error('[metas] error al leer:', error);
    return [];
  }
}

/** Una meta por id. */
export function leerMeta(id: string): Meta | null {
  try {
    const db = getDatabase();
    const r = db.executeSync('SELECT * FROM metas WHERE id = ?', [id]).rows[0] as Row;
    return r ? filaAMeta(r) : null;
  } catch {
    return null;
  }
}

/** Inserta o reemplaza una meta. */
export function guardarMeta(meta: Meta): void {
  const db = getDatabase();
  db.executeSync(
    `INSERT OR REPLACE INTO metas
       (id, cliente_id, tipo, descripcion, valor_objetivo, unidad,
        fecha_objetivo, valor_inicial, fecha_inicio, estado, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meta.id,
      meta.clienteId,
      meta.tipo,
      meta.descripcion,
      meta.valorObjetivo,
      meta.unidad,
      meta.fechaObjetivo,
      meta.valorInicial,
      meta.fechaInicio,
      meta.estado,
      meta.creadoEn,
    ]
  );
}

/** Crea una meta nueva con valores por defecto sensatos. */
export function nuevaMeta(clienteId: string, parcial: Partial<Meta> = {}): Meta {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    id: generateId(),
    clienteId,
    tipo: (parcial.tipo ?? 'peso') as TipoMeta,
    descripcion: parcial.descripcion ?? '',
    valorObjetivo: parcial.valorObjetivo ?? 0,
    unidad: (parcial.unidad ?? 'kg') as Meta['unidad'],
    fechaObjetivo: parcial.fechaObjetivo ?? sumarMeses(hoy, 12),
    valorInicial: parcial.valorInicial ?? 0,
    fechaInicio: parcial.fechaInicio ?? hoy,
    estado: (parcial.estado ?? 'activa') as EstadoMeta,
    creadoEn: parcial.creadoEn ?? new Date().toISOString() };
}

/** Cambia solo el estado de la meta. */
export function cambiarEstadoMeta(meta: Meta, estado: EstadoMeta): Meta {
  const actualizada: Meta = { ...meta, estado };
  guardarMeta(actualizada);
  return actualizada;
}

/** Elimina la meta (borrado duro). */
export function eliminarMeta(id: string): void {
  const db = getDatabase();
  db.executeSync('DELETE FROM metas WHERE id = ?', [id]);
}

// ============================================
// Progreso de la meta
// ============================================

export interface ContextoProgreso {
  peso?: number;
  grasaCorporal?: number;
  musculatura?: number;
  /** mejor 1RM estimado del cliente, si hay logs */
  fuerza?: number;
  /** perímetros promediados por lado (promedio izq/der) */
  perimetros?: Record<string, number>;
}

/**
 * Valor actual observado para el tipo de la meta, según ficha + último check-in
 * + logs. Devuelve `null` si no hay nada comparable.
 */
export function valorActualMeta(meta: Meta, ctx: ContextoProgreso): number | null {
  switch (meta.tipo) {
    case 'peso':
      return ctx.peso ?? null;
    case 'grasa':
      return ctx.grasaCorporal ?? null;
    case 'musculo':
      return ctx.musculatura ?? null;
    case 'fuerza':
      return ctx.fuerza ?? null;
    case 'perimetro': {
      const clave = detectarClavePerimetro(meta.descripcion);
      if (!clave || !ctx.perimetros) return null;
      const v = ctx.perimetros[clave];
      return typeof v === 'number' ? v : null;
    }
    case 'habito':
      return null;
    default:
      return null;
  }
}

export interface ProgresoMeta {
  valorActual: number | null;
  /** 0..100 */
  porcentaje: number;
  lograda: boolean;
}

/** Calcula el avance de la meta (0..100 %) y si ya está lograda. */
export function calcularProgresoMeta(meta: Meta, ctx: ContextoProgreso): ProgresoMeta {
  const actual = valorActualMeta(meta, ctx);

  // "Hábito" (dias/semana) o sin valor comparable → 0 % salvo que esté lograda.
  if (actual == null) {
    return { valorActual: null, porcentaje: meta.estado === 'lograda' ? 100 : 0, lograda: meta.estado === 'lograda' };
  }

  const inicio = Number(meta.valorInicial) || 0;
  const objetivo = Number(meta.valorObjetivo);
  const distancia = objetivo - inicio;

  if (Math.abs(distancia) < 1e-9) {
    return { valorActual: actual, porcentaje: 100, lograda: true };
  }

  const avance = ((actual - inicio) / distancia) * 100;
  // Girolama en el tipo de meta, pero no se puede superar el rango visible.
  const porcentaje = Math.max(0, Math.min(100, avance));
  const lograda = meta.unidad === '%' || distancia < 0 ? actual <= objetivo : actual >= objetivo;

  return { valorActual: actual, porcentaje, lograda };
}

/** Detecta qué perímetro menciona la descripción de la meta. */
function detectarClavePerimetro(descripcion: string): string | null {
  const d = descripcion.toLowerCase();
  const mapa: [string, string[]][] = [
    ['cintura', ['cintura']],
    ['cadera', ['cadera']],
    ['pecho', ['pecho']],
    ['brazo', ['brazo']],
    ['antebrazo', ['antebrazo', 'antecodo']],
    ['pierna', ['pierna']],
    ['pantorrilla', ['pantorrilla']],
  ];
  for (const [clave, palabras] of mapa) {
    if (palabras.some((p) => d.includes(p))) return clave;
  }
  return null;
}

/** Etiqueta legible del tipo de meta. */
export function labelTipoMeta(tipo: TipoMeta): string {
  const mapa: Record<TipoMeta, string> = {
    peso: 'Peso corporal',
    grasa: '% Grasa',
    musculo: 'Masa muscular',
    fuerza: 'Fuerza (1RM)',
    perimetro: 'Perímetro',
    habito: 'Hábito' };
  return mapa[tipo];
}

/** Unidad sugerida por defecto según el tipo. */
export function unidadPorTipo(tipo: TipoMeta): Meta['unidad'] {
  const mapa: Record<TipoMeta, Meta['unidad']> = {
    peso: 'kg',
    grasa: '%',
    musculo: 'kg',
    fuerza: 'kg',
    perimetro: 'cm',
    habito: 'dias' };
  return mapa[tipo];
}

function sumarMeses(iso: string, meses: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}