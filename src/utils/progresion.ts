/**
 * Progresión por rendimiento: qué precargar en la próxima sesión de un ejercicio
 * a partir de lo que se hizo la última vez.
 *
 * - Sube el peso solo si se completaron todas las series prescritas en el tope
 *   del rango de reps y con RPE dentro del objetivo (hasta +10 % por vez).
 * - Si no, repite el peso y parte de las reps logradas (nunca por debajo del mínimo).
 * - Peso corporal (0 kg) se queda en 0; los isométricos suman segundos.
 */

import { EJERCICIOS_ISOMETRICOS } from '@/constants/plantillasRutina';
import { calculateNextWeight, formatNumero, parseRepRange } from './helpers';
import type { EjercicioRutina, SerieReal } from '@/types';

export const SEGUNDOS_POR_SEMANA = 5;
const INCREMENTO_POR_DEFECTO = 2.5;
/** Con mancuernas chicas +2,5 kg es un salto enorme (3 → 5,5 kg): se limita al 10 %, mínimo 1 kg. */
const SUBIDA_MAXIMA = 0.1;

const incrementoSeguro = (peso: number, configurado: number): number =>
  Math.min(configurado, Math.max(1, Math.round(peso * SUBIDA_MAXIMA)));

export interface Prescripcion {
  peso: number;
  /** Reps (o segundos en isométricos), una por serie prescrita. */
  reps: number[];
  /** Explicación para el entrenador. Vacío si no hay sesión anterior. */
  motivo: string;
}

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));
const kg = (n: number): string => `${formatNumero(n)} kg`;

export function prescribirSiguiente(ej: EjercicioRutina, ultima: SerieReal[], pesoInicial: number): Prescripcion {
  const nSeries = clamp(Math.round(Number(ej.series)) || 1, 1, 20);
  const rango = parseRepRange(ej.repeticiones);
  const progresion = ej.progresion;
  const tope = progresion?.tipo === 'double_progression' ? progresion.repObjetivoMax : rango.max;
  const hechas = ultima.filter((s) => s.completada);

  if (hechas.length === 0) {
    return { peso: pesoInicial, reps: Array.from({ length: nSeries }, () => rango.min), motivo: '' };
  }

  const peso = Math.max(...hechas.map((s) => Number(s.peso) || 0));
  const logradas = hechas.map((s) => Math.round(Number(s.repeticiones) || 0));
  const ultimaVez = logradas.join('/');
  /** Reps de la serie i la vez anterior (si hizo menos series, repite la última). */
  const repsDe = (i: number): number => logradas[Math.min(i, logradas.length - 1)];
  const repetirReps = () => Array.from({ length: nSeries }, (_, i) => clamp(repsDe(i), rango.min, tope));

  if (EJERCICIOS_ISOMETRICOS.includes(ej.ejercicioId)) {
    return {
      peso,
      reps: Array.from({ length: nSeries }, (_, i) => repsDe(i) + SEGUNDOS_POR_SEMANA),
      motivo: `+${SEGUNDOS_POR_SEMANA} s · última vez ${ultimaVez} s`,
    };
  }

  if (progresion?.tipo === 'rpe_based') {
    const rpeMedio = hechas.reduce((acc, s) => acc + (Number(s.rpe) || 0), 0) / hechas.length;
    const siguiente = calculateNextWeight(peso, progresion, undefined, rpeMedio);
    const cambio = siguiente > peso ? 'Sube' : siguiente < peso ? 'Baja' : 'Mismo peso';
    return {
      peso: siguiente,
      reps: repetirReps(),
      motivo: `${cambio}: ${kg(siguiente)} · RPE medio ${formatNumero(rpeMedio)} (meta ${progresion.rpeMeta})`,
    };
  }

  if (progresion?.tipo === 'personalizada') {
    return { peso, reps: repetirReps(), motivo: `Mismo peso · última vez ${kg(peso)} × ${ultimaVez}` };
  }

  const rpeObjetivo = Number(ej.rpeObjetivo) || 10;
  const completo =
    hechas.length >= nSeries && hechas.every((s) => s.repeticiones >= tope && (Number(s.rpe) || 0) <= rpeObjetivo);

  if (peso <= 0) {
    return {
      peso: 0,
      reps: repetirReps(),
      motivo: completo
        ? `Peso corporal · completó ${hechas.length}×${tope}: subí la dificultad`
        : `Peso corporal · buscá ${tope} reps (última vez ${ultimaVez})`,
    };
  }

  if (completo) {
    const configurado = progresion && 'incrementoPeso' in progresion ? progresion.incrementoPeso : INCREMENTO_POR_DEFECTO;
    const siguiente = peso + incrementoSeguro(peso, configurado);
    return {
      peso: siguiente,
      reps: Array.from({ length: nSeries }, () => rango.min),
      motivo: `Sube a ${kg(siguiente)}: completó ${hechas.length}×${tope} con ${kg(peso)}`,
    };
  }

  return {
    peso,
    reps: repetirReps(),
    motivo: `Mismo peso: buscá ${tope} reps en todas · última vez ${ultimaVez}`,
  };
}
