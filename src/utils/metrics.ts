/**
 * Métricas de rendimiento derivadas de los logs de entrenamiento.
 * Todo es cálculo puro sobre datos ya leídos de SQLite (sin I/O aquí).
 */

import { calculateVolume, estimate1RM, getWeekNumber } from './helpers';
import type { EntrenamientoRealizado } from '@/types';

/** Semana ISO-ISO del año de una fecha (para agrupar el volumen). */
export function semanaDe(fecha: string): number {
  return getWeekNumber(new Date(fecha));
}

/**
 * Volumen total (kg) por semana, ordenado cronológicamente.
 * Ideal para un BarChart: [{ semana, volumen }]
 */
export function volumenPorSemana(entrenamientos: EntrenamientoRealizado[]): { semana: number; volumen: number }[] {
  const porSemana = new Map<number, number>();
  for (const e of entrenamientos) {
    const sem = semanaDe(e.fecha);
    const vol = e.ejercicios.reduce((acc, ej) => acc + calculateVolume(ej.series), 0);
    porSemana.set(sem, (porSemana.get(sem) ?? 0) + vol);
  }
  return [...porSemana.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semana, volumen]) => ({ semana, volumen: Math.round(volumen) }));
}

/** Duración total (min) por semana. */
export function duracionPorSemana(entrenamientos: EntrenamientoRealizado[]): { semana: number; minutos: number }[] {
  const porSemana = new Map<number, number>();
  for (const e of entrenamientos) {
    const sem = semanaDe(e.fecha);
    porSemana.set(sem, (porSemana.get(sem) ?? 0) + (e.duracionMin || 0));
  }
  return [...porSemana.entries()].sort((a, b) => a[0] - b[0]).map(([semana, minutos]) => ({ semana, minutos }));
}

export interface Punto1RM {
  etiqueta: string;
  r1rm: number;
  /** Peso y reps de la mejor serie */
  peso: number;
  reps: number;
  fecha: string;
}

/**
 * Mejor 1RM estimado por ejercicio, según el mapeo ejercicioRutinaId → nombre.
 * `nombrePorEjercicioRutina` se construye con `mapaEjerciciosRutina`.
 */
export function mejores1RM(
  entrenamientos: EntrenamientoRealizado[],
  nombrePorEjercicioRutina: Record<string, string>
): Punto1RM[] {
  const mejor = new Map<string, Punto1RM>();
  for (const e of entrenamientos) {
    for (const ej of e.ejercicios) {
      const etiqueta = nombrePorEjercicioRutina[ej.ejercicioRutinaId];
      if (!etiqueta) continue;
      for (const s of ej.series) {
        if (!s.completada || s.peso <= 0 || s.repeticiones <= 0) continue;
        const r1rm = estimate1RM(s.peso, s.repeticiones);
        const actual = mejor.get(etiqueta);
        if (!actual || r1rm > actual.r1rm) {
          mejor.set(etiqueta, { etiqueta, r1rm: Math.round(r1rm), peso: s.peso, reps: s.repeticiones, fecha: e.fecha });
        }
      }
    }
  }
  return [...mejor.values()].sort((a, b) => b.r1rm - a.r1rm);
}

/** 1RM de un ejercicio a lo largo del tiempo (para el LineChart de 1RM). */
export function evolucion1RM(
  entrenamientos: EntrenamientoRealizado[],
  nombrePorEjercicioRutina: Record<string, string>,
  etiqueta: string
): { punto: string; r1rm: number }[] {
  const porPunto = new Map<string, number>();
  for (const e of [...entrenamientos].sort((a, b) => a.fecha.localeCompare(b.fecha))) {
    const dia = e.fecha.slice(5, 10); // MM-DD
    for (const ej of e.ejercicios) {
      if (nombrePorEjercicioRutina[ej.ejercicioRutinaId] !== etiqueta) continue;
      const r = Math.max(
        0,
        ...ej.series.filter((s) => s.completada && s.peso > 0).map((s) => estimate1RM(s.peso, s.repeticiones))
      );
      if (r > 0) porPunto.set(dia, Math.max(porPunto.get(dia) ?? 0, Math.round(r)));
    }
  }
  return [...porPunto.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([punto, r1rm]) => ({ punto, r1rm }));
}

/**
 * Mapa ejercicioRutinaId → nombre de ejercicio, construido desde las rutinas
 * del cliente y el catálogo de ejercicios.
 */
export function mapaEjerciciosRutina(
  rutinas: { dias: { ejercicios: { id: string; ejercicioId: string }[] }[] }[],
  catalogo: { id: string; nombre: string }[]
): Record<string, string> {
  const porId = new Map(catalogo.map((e) => [e.id, e.nombre]));
  const mapa: Record<string, string> = {};
  for (const r of rutinas) {
    for (const dia of r.dias ?? []) {
      for (const ej of dia.ejercicios ?? []) {
        mapa[ej.id] = porId.get(ej.ejercicioId) ?? 'Ejercicio';
      }
    }
  }
  return mapa;
}

/** Resumen global de adherencia para las quick stats. */
export function resumenEntrenamientos(entrenamientos: EntrenamientoRealizado[]) {
  const total = entrenamientos.length;
  if (total === 0) return { total: 0, volumen: 0, duracion: 0, rpe: 0, r1rmMax: 0 };
  const volumen = entrenamientos.reduce((a, e) => a + e.ejercicios.reduce((b, ej) => b + calculateVolume(ej.series), 0), 0);
  const duracion = entrenamientos.reduce((a, e) => a + (e.duracionMin || 0), 0);
  const rpe = entrenamientos.reduce((a, e) => a + (e.rpeGlobal || 0), 0) / total;
  const r1rmMax = entrenamientos.reduce((max, e) => {
    for (const ej of e.ejercicios) {
      for (const s of ej.series) {
        if (s.completada && s.peso > 0) max = Math.max(max, estimate1RM(s.peso, s.repeticiones));
      }
    }
    return max;
  }, 0);
  return { total, volumen: Math.round(volumen), duracion, rpe: Math.round(rpe * 10) / 10, r1rmMax: Math.round(r1rmMax) };
}

/**
 * Normaliza perímetros a 0..1 para el radar, usando el valor inicial del cliente
 * como línea base (100%) y el rango hasta el máximo observado como techo.
 */
export function normalizarPerimetros(
  inicial: Record<string, any>,
  actual: Record<string, any>,
  claves: string[]
): { inicial: number[]; actual: number[] } {
  const norm = (v: number, base: number, techo: number) => {
    if (!Number.isFinite(v)) return 0;
    if (techo <= base) return 1;
    return Math.max(0, Math.min(1, (v - base) / (techo - base) * 0.85 + 0.15));
  };

  const p0: number[] = [];
  const p1: number[] = [];
  for (const k of claves) {
    const base = Number(inicial[k]);
    const fin = Number(actual[k]);
    const techo = Math.max(base || 0, fin || 0);
    p0.push(norm(base, 0, techo || 1));
    p1.push(norm(fin, 0, techo || 1));
  }
  return { inicial: p0, actual: p1 };
}