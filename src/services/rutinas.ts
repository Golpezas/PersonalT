/**
 * Servicio de Rutinas — lectura y borrado sobre SQLite.
 *
 * La tabla `rutinas_semanales` es la fuente de verdad. Los días se guardan como
 * JSON y cada ejercicio solo referencia `ejercicioId`, así que al leer se
 * completan nombre y grupo muscular desde el catálogo `ejercicios`.
 */

import { getDatabase } from '@/db/database';
import type { DiaRutina, EjercicioRutina, RutinaSemanal } from '@/types';

type Row = any;

export interface EjercicioRutinaDetalle extends EjercicioRutina {
  nombre: string;
  grupoMuscular: string;
}

export interface DiaRutinaDetalle extends Omit<DiaRutina, 'ejercicios'> {
  ejercicios: EjercicioRutinaDetalle[];
}

export interface RutinaDetalle extends Omit<RutinaSemanal, 'dias'> {
  dias: DiaRutinaDetalle[];
}

function leerCatalogo(): Map<string, { nombre: string; grupoMuscular: string }> {
  const mapa = new Map<string, { nombre: string; grupoMuscular: string }>();
  try {
    const rows = getDatabase().executeSync('SELECT id, nombre, grupo_muscular FROM ejercicios').rows as Row[];
    for (const r of rows) mapa.set(r.id, { nombre: r.nombre, grupoMuscular: r.grupo_muscular });
  } catch (error) {
    console.error('[rutinas] error al leer catálogo:', error);
  }
  return mapa;
}

function filaARutina(r: Row, catalogo: ReturnType<typeof leerCatalogo>): RutinaDetalle {
  let dias: DiaRutina[] = [];
  try {
    dias = JSON.parse(r.dias ?? '[]');
  } catch {
    dias = [];
  }
  return {
    id: r.id,
    clienteId: r.cliente_id,
    nombre: r.nombre,
    mesociclo: r.mesociclo,
    semanaInicio: r.semana_inicio,
    semanaFin: r.semana_fin,
    notasGenerales: r.notas_generales ?? '',
    creadoEn: r.creado_en,
    actualizadoEn: r.actualizado_en,
    dias: dias
      .slice()
      .sort((a, b) => a.orden - b.orden)
      .map((d) => ({
        ...d,
        ejercicios: (d.ejercicios ?? [])
          .slice()
          .sort((a, b) => a.orden - b.orden)
          .map((e) => {
            const meta = catalogo.get(e.ejercicioId);
            return { ...e, nombre: meta?.nombre ?? 'Ejercicio', grupoMuscular: meta?.grupoMuscular ?? '' };
          }),
      })),
  };
}

/** Todas las rutinas de un cliente, la más reciente primero. */
export function leerRutinas(clienteId: string): RutinaDetalle[] {
  try {
    const rows = getDatabase().executeSync(
      'SELECT * FROM rutinas_semanales WHERE cliente_id = ? ORDER BY mesociclo DESC, semana_inicio DESC',
      [clienteId]
    ).rows as Row[];
    const catalogo = leerCatalogo();
    return rows.map((r) => filaARutina(r, catalogo));
  } catch (error) {
    console.error('[rutinas] error al leer:', error);
    return [];
  }
}

/** Una rutina por id. */
export function leerRutina(id: string): RutinaDetalle | null {
  try {
    const r = getDatabase().executeSync('SELECT * FROM rutinas_semanales WHERE id = ?', [id]).rows[0] as Row;
    return r ? filaARutina(r, leerCatalogo()) : null;
  } catch (error) {
    console.error('[rutinas] error al leer rutina:', error);
    return null;
  }
}

/** Elimina la rutina. Los entrenamientos registrados con ella se borran en cascada. */
export function eliminarRutina(id: string): void {
  getDatabase().executeSync('DELETE FROM rutinas_semanales WHERE id = ?', [id]);
}
