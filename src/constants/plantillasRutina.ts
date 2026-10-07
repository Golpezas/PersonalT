/**
 * Plantillas de rutina de 5 días por morfología.
 *
 * - La silueta decide QUÉ se entrena (reparto de días y ejercicios a priorizar).
 * - El somatotipo decide CÓMO (series, repeticiones, RPE, descansos y cardio).
 *
 * Los `id` de ejercicio son los del catálogo base (`ex-N`, ver db/database.ts).
 */

export type Somatotipo = 'ectomorfo' | 'mesomorfo' | 'endomorfo';
export type Silueta = 'pera' | 'manzana' | 'reloj' | 'rectangulo' | 'triangulo_invertido';

export const SOMATOTIPOS: { key: Somatotipo; label: string; descripcion: string }[] = [
  { key: 'ectomorfo', label: 'Ectomorfo', descripcion: 'Delgado, le cuesta ganar peso y músculo' },
  { key: 'mesomorfo', label: 'Mesomorfo', descripcion: 'Atlético, gana músculo con facilidad' },
  { key: 'endomorfo', label: 'Endomorfo', descripcion: 'Estructura ancha, acumula grasa con facilidad' },
];

export const SILUETAS: { key: Silueta; label: string; descripcion: string }[] = [
  { key: 'pera', label: 'Pera', descripcion: 'Cadera más ancha que hombros' },
  { key: 'manzana', label: 'Manzana', descripcion: 'Acumula en abdomen y cintura' },
  { key: 'reloj', label: 'Reloj de arena', descripcion: 'Hombros y cadera parejos, cintura marcada' },
  { key: 'rectangulo', label: 'Rectángulo', descripcion: 'Hombros, cintura y cadera similares' },
  { key: 'triangulo_invertido', label: 'Triángulo invertido', descripcion: 'Hombros más anchos que cadera' },
];

type Prioridad = 'alta' | 'media';

interface EjercicioPlantilla {
  id: string;
  prioridad: Prioridad;
  compuesto?: boolean;
  /** Isométricos: las "repeticiones" son segundos */
  segundos?: boolean;
}

interface DiaPlantilla {
  enfoque: string;
  ejercicios: EjercicioPlantilla[];
}

interface Split {
  objetivo: string;
  dias: [DiaPlantilla, DiaPlantilla, DiaPlantilla, DiaPlantilla, DiaPlantilla];
}

const A = (id: string, compuesto = false): EjercicioPlantilla => ({ id, prioridad: 'alta', compuesto });
const M = (id: string, compuesto = false): EjercicioPlantilla => ({ id, prioridad: 'media', compuesto });
const ISO = (id: string): EjercicioPlantilla => ({ id, prioridad: 'media', segundos: true });

const SPLITS: Record<Silueta, Split> = {
  pera: {
    objetivo: 'Equilibrar la figura: más volumen en hombros y espalda, glúteo y femoral firmes sin sobrecargar cuádriceps.',
    dias: [
      { enfoque: 'Espalda + hombros', ejercicios: [A('ex-10', true), A('ex-13', true), A('ex-19', true), A('ex-21'), M('ex-16'), ISO('ex-60')] },
      { enfoque: 'Glúteo + femoral', ejercicios: [A('ex-50', true), A('ex-46', true), M('ex-48'), M('ex-52'), M('ex-53'), M('ex-67')] },
      { enfoque: 'Tren superior completo', ejercicios: [A('ex-14', true), M('ex-7', true), A('ex-20', true), A('ex-21'), M('ex-33'), M('ex-27')] },
      { enfoque: 'Pierna completa', ejercicios: [M('ex-41', true), M('ex-40', true), M('ex-49'), M('ex-51'), M('ex-57'), ISO('ex-61')] },
      { enfoque: 'Espalda + hombros + core', ejercicios: [A('ex-12', true), A('ex-10', true), M('ex-23'), A('ex-21'), M('ex-65'), M('ex-68')] },
    ],
  },
  manzana: {
    objetivo: 'Bajar grasa abdominal: cuerpo completo con ejercicios multiarticulares (más gasto) y core profundo.',
    dias: [
      { enfoque: 'Cuerpo completo A', ejercicios: [A('ex-41', true), A('ex-10', true), M('ex-7', true), M('ex-50', true), M('ex-65'), M('ex-67')] },
      { enfoque: 'Cuerpo completo B', ejercicios: [A('ex-44', true), A('ex-13', true), M('ex-19', true), A('ex-46', true), ISO('ex-60'), M('ex-68')] },
      { enfoque: 'Cuerpo completo C', ejercicios: [A('ex-43', true), A('ex-14', true), M('ex-2', true), M('ex-51'), M('ex-71', true), ISO('ex-61')] },
      { enfoque: 'Cuerpo completo A (variante)', ejercicios: [A('ex-41', true), A('ex-12', true), M('ex-3', true), M('ex-49'), M('ex-16'), M('ex-67')] },
      { enfoque: 'Cuerpo completo B (variante)', ejercicios: [A('ex-40', true), A('ex-10', true), M('ex-20', true), A('ex-50', true), M('ex-71', true), M('ex-65')] },
    ],
  },
  reloj: {
    objetivo: 'Mantener las proporciones: trabajo equilibrado de tren superior e inferior con buen foco en glúteo.',
    dias: [
      { enfoque: 'Pierna (cuádriceps + glúteo)', ejercicios: [A('ex-41', true), A('ex-40', true), A('ex-50', true), M('ex-42'), M('ex-53'), M('ex-58')] },
      { enfoque: 'Tren superior A', ejercicios: [A('ex-10', true), A('ex-13', true), M('ex-7', true), M('ex-19', true), M('ex-21'), M('ex-67')] },
      { enfoque: 'Glúteo + femoral', ejercicios: [A('ex-50', true), A('ex-46', true), M('ex-49'), M('ex-52'), M('ex-53'), ISO('ex-60')] },
      { enfoque: 'Tren superior B', ejercicios: [A('ex-14', true), M('ex-3', true), M('ex-16'), M('ex-27'), M('ex-33'), M('ex-65')] },
      { enfoque: 'Pierna completa', ejercicios: [A('ex-45', true), M('ex-44', true), M('ex-48'), M('ex-51'), M('ex-57'), M('ex-68')] },
    ],
  },
  rectangulo: {
    objetivo: 'Crear curvas: más glúteo y hombros/dorsales para que la cintura se vea más marcada. Core sin engrosar oblicuos.',
    dias: [
      { enfoque: 'Glúteo', ejercicios: [A('ex-50', true), A('ex-40', true), A('ex-52'), A('ex-53'), M('ex-49'), M('ex-67')] },
      { enfoque: 'Hombros + espalda', ejercicios: [A('ex-19', true), A('ex-21'), A('ex-10', true), M('ex-13', true), M('ex-23'), ISO('ex-60')] },
      { enfoque: 'Pierna + glúteo', ejercicios: [M('ex-41', true), A('ex-46', true), A('ex-51'), M('ex-44', true), M('ex-56'), M('ex-65')] },
      { enfoque: 'Tren superior completo', ejercicios: [A('ex-20', true), A('ex-14', true), M('ex-7', true), A('ex-21'), M('ex-28'), M('ex-33')] },
      { enfoque: 'Glúteo + femoral', ejercicios: [A('ex-50', true), M('ex-47', true), M('ex-48'), A('ex-53'), A('ex-52'), M('ex-68')] },
    ],
  },
  triangulo_invertido: {
    objetivo: 'Equilibrar la figura: prioridad a glúteo y piernas; tren superior en mantenimiento, sin hombro lateral extra.',
    dias: [
      { enfoque: 'Pierna (cuádriceps + glúteo)', ejercicios: [A('ex-38', true), A('ex-41', true), A('ex-40', true), M('ex-42'), A('ex-53'), M('ex-56')] },
      { enfoque: 'Tren superior (mantenimiento)', ejercicios: [M('ex-13', true), M('ex-7', true), M('ex-10', true), M('ex-27'), M('ex-33'), M('ex-67')] },
      { enfoque: 'Glúteo + femoral', ejercicios: [A('ex-50', true), A('ex-46', true), A('ex-49'), A('ex-52'), M('ex-51'), ISO('ex-60')] },
      { enfoque: 'Pierna completa', ejercicios: [A('ex-45', true), A('ex-43', true), M('ex-48'), A('ex-53'), M('ex-57'), M('ex-65')] },
      { enfoque: 'Glúteo + espalda + core', ejercicios: [A('ex-50', true), A('ex-44', true), M('ex-14', true), M('ex-16'), ISO('ex-61'), M('ex-68')] },
    ],
  },
};

interface ParametrosSomatotipo {
  series: Record<Prioridad, number>;
  reps: { compuesto: string; aislado: string };
  rpe: number;
  descanso: { compuesto: number; aislado: number };
  segundos: string;
  enfoque: string;
  cardio: string;
}

const PARAMETROS: Record<Somatotipo, ParametrosSomatotipo> = {
  ectomorfo: {
    series: { alta: 3, media: 2 },
    reps: { compuesto: '6-10', aislado: '8-12' },
    rpe: 8,
    descanso: { compuesto: 120, aislado: 75 },
    segundos: '20-30',
    enfoque: 'Poco volumen y cargas más pesadas, descansos largos. Comer en superávit leve.',
    cardio: '10–15 min suave, 2–3 veces por semana (no más, para no frenar la ganancia de músculo).',
  },
  mesomorfo: {
    series: { alta: 4, media: 3 },
    reps: { compuesto: '8-12', aislado: '10-12' },
    rpe: 8,
    descanso: { compuesto: 90, aislado: 60 },
    segundos: '30-40',
    enfoque: 'Volumen moderado-alto, responde rápido: subir carga cuando se completen todas las repeticiones.',
    cardio: '15–20 min a ritmo moderado, 3–4 veces por semana.',
  },
  endomorfo: {
    series: { alta: 4, media: 3 },
    reps: { compuesto: '10-12', aislado: '12-15' },
    rpe: 7,
    descanso: { compuesto: 75, aislado: 45 },
    segundos: '30-45',
    enfoque: 'Más repeticiones y descansos cortos para mayor gasto. Déficit calórico suave.',
    cardio: '20–30 min después de la fuerza los 5 días (caminata inclinada, elíptica o bici) + 8.000–10.000 pasos diarios.',
  },
};

const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface EjercicioGenerado {
  ejercicioId: string;
  series: number;
  repeticiones: string;
  rpe: number;
  descanso: number;
  notas: string;
}

export interface DiaGenerado {
  orden: number;
  nombre: string;
  enfoque: string;
  esDescanso: boolean;
  ejercicios: EjercicioGenerado[];
}

export interface PlantillaGenerada {
  nombre: string;
  notas: string;
  dias: DiaGenerado[];
}

export const getSomatotipoLabel = (s: Somatotipo) => SOMATOTIPOS.find((x) => x.key === s)?.label ?? s;
export const getSiluetaLabel = (s: Silueta) => SILUETAS.find((x) => x.key === s)?.label ?? s;

/** Enfoque de cada día de entrenamiento, para la vista previa. */
export const getEnfoquesSilueta = (silueta: Silueta): string[] => SPLITS[silueta].dias.map((d) => d.enfoque);

export function generarPlantilla(somatotipo: Somatotipo, silueta: Silueta): PlantillaGenerada {
  const split = SPLITS[silueta];
  const p = PARAMETROS[somatotipo];

  const dias: DiaGenerado[] = DIAS_SEMANA.map((nombre, i) => {
    const dia = split.dias[i];
    if (!dia) return { orden: i + 1, nombre, enfoque: 'Descanso activo', esDescanso: true, ejercicios: [] };
    return {
      orden: i + 1,
      nombre,
      enfoque: dia.enfoque,
      esDescanso: false,
      ejercicios: dia.ejercicios.map((e) => ({
        ejercicioId: e.id,
        series: p.series[e.prioridad],
        repeticiones: e.segundos ? p.segundos : e.compuesto ? p.reps.compuesto : p.reps.aislado,
        rpe: p.rpe,
        descanso: e.compuesto ? p.descanso.compuesto : p.descanso.aislado,
        notas: e.segundos ? 'Repeticiones = segundos de sostén' : '',
      })),
    };
  });

  const enfoques = dias
    .filter((d) => !d.esDescanso)
    .map((d) => `${d.nombre}: ${d.enfoque}`)
    .join('\n');

  const notas = [
    `Plantilla ${getSiluetaLabel(silueta)} · ${getSomatotipoLabel(somatotipo)}`,
    `Objetivo: ${split.objetivo}`,
    `Enfoque: ${p.enfoque}`,
    `Cardio: ${p.cardio}`,
    `Días:\n${enfoques}`,
    'Sábado y domingo: descanso activo (caminar 30–45 min, estirar).',
  ].join('\n\n');

  return {
    nombre: `${getSiluetaLabel(silueta)} · ${getSomatotipoLabel(somatotipo)}`,
    notas,
    dias,
  };
}
