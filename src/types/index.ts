/**
 * TypeScript Types for the Personal Trainer App
 * Mirrors the database schema with proper TypeScript types
 */

import type { GrupoMuscular, PatronMovimiento, Equipo, TipoProgresion, EstadoMeta, TipoMeta, Sexo } from '@/db/schema';

export interface Cliente {
  id: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  fechaNacimiento: string; // ISO date
  sexo: Sexo;
  altura: number; // cm
  fotoUri?: string;
  creadoEn: string; // ISO datetime
  actualizadoEn: string;
}

export interface Perimetros {
  brazoIzq: number;
  brazoDer: number;
  antebrazoIzq: number;
  antebrazoDer: number;
  pecho: number;
  cintura: number;
  cadera: number;
  piernaIzq: number;
  piernaDer: number;
  pantorrillaIzq: number;
  pantorrillaDer: number;
}

export interface FotosProgreso {
  frontal: string;
  lateral: string;
  posterior: string;
}

export interface FichaInicial {
  id: string;
  clienteId: string;
  fecha: string;
  peso: number;
  grasaCorporal?: number;
  musculatura?: number;
  perimetros: Perimetros;
  pliegues?: Record<string, number>;
  fotos: FotosProgreso;
  observaciones: string;
  lesionLimitaciones: string;
  creadoEn: string;
}

export interface CheckinSemanal {
  id: string;
  clienteId: string;
  semana: number;
  fecha: string;
  peso: number;
  grasaCorporal?: number;
  musculatura?: number;
  perimetros: Perimetros;
  fotos: FotosProgreso;
  energia: 1 | 2 | 3 | 4 | 5;
  sueno: 1 | 2 | 3 | 4 | 5;
  estres: 1 | 2 | 3 | 4 | 5;
  adherencia: 1 | 2 | 3 | 4 | 5;
  notas: string;
  creadoEn: string;
}

export interface Ejercicio {
  id: string;
  nombre: string;
  grupoMuscular: GrupoMuscular;
  patron: PatronMovimiento;
  equipo: Equipo[];
  descripcion: string;
  videoUri?: string;
  imagenUri?: string;
  esCompuesto: boolean;
  creadoEn: string;
}

export interface ProgresionLineal {
  tipo: 'lineal';
  incrementoPeso: number;
  frecuenciaSemanas: number;
}

export interface ProgresionDoubleProgression {
  tipo: 'double_progression';
  repObjetivoMax: number;
  incrementoPeso: number;
}

export interface ProgresionRPEBased {
  tipo: 'rpe_based';
  rpeMeta: number;
  ajustePeso: number;
}

export interface ProgresionPersonalizada {
  tipo: 'personalizada';
  descripcion: string;
}

export type ProgresionPlan =
  | ProgresionLineal
  | ProgresionDoubleProgression
  | ProgresionRPEBased
  | ProgresionPersonalizada;

export interface EjercicioRutina {
  id: string;
  ejercicioId: string;
  orden: number;
  series: number;
  repeticiones: string; // "8-12", "10,8,6", "AMRAP",
  rpeObjetivo: number; // 6-10,
  tempo: string; // "3-0-1-0",
  descansoSeg: number; // 60-180,
  notas: string;
  progresion: ProgresionPlan;
}

export interface DiaRutina {
  id: string;
  orden: number; // 1-7,
  nombre: string;
  esDescanso: boolean;
  ejercicios: EjercicioRutina[];
}

export interface RutinaSemanal {
  id: string;
  clienteId: string;
  nombre: string;
  mesociclo: number;
  semanaInicio: number;
  semanaFin: number;
  dias: DiaRutina[];
  notasGenerales: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface SerieReal {
  numero: number;
  peso: number;
  repeticiones: number;
  rpe: number;
  completada: boolean;
}

export interface EjercicioRealizado {
  ejercicioRutinaId: string;
  series: SerieReal[];
}

export interface EntrenamientoRealizado {
  id: string;
  clienteId: string;
  rutinaSemanalId: string;
  diaRutinaId: string;
  fecha: string;
  duracionMin: number;
  ejercicios: EjercicioRealizado[];
  rpeGlobal?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  notas: string;
}

export interface Meta {
  id: string;
  clienteId: string;
  tipo: TipoMeta;
  descripcion: string;
  valorObjetivo: number;
  unidad: 'kg' | '%' | 'cm' | 'reps' | 'dias';
  fechaObjetivo: string;
  valorInicial: number;
  fechaInicio: string;
  estado: EstadoMeta;
  creadoEn: string;
}

// UI State Types
export interface ClienteConProgreso extends Cliente {
  ultimaFicha?: FichaInicial;
  ultimoCheckin?: CheckinSemanal;
  rutinaActiva?: RutinaSemanal;
  metasActivas: number;
}

export interface DeltaCheckin {
  peso: number;
  grasaCorporal?: number;
  musculatura?: number;
  perimetros: Partial<Record<keyof Perimetros, number>>;
}

export interface ProgresoCliente {
  clienteId: string;
  pesoHistory: { fecha: string; valor: number }[];
  grasaHistory: { fecha: string; valor: number }[];
  musculoHistory: { fecha: string; valor: number }[];
  perimetrosHistory: { fecha: string; valor: Perimetros }[];
  volumenSemanal: { semana: number; volumen: number; grupo: string }[];
  unoRMHistory: { fecha: string; ejercicio: string; valor: number }[];
  adherenciaHistory: { fecha: string; valor: number }[];
}

// Form Types
export interface ClienteFormData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  sexo: Sexo;
  altura: number;
}

export interface FichaInicialFormData {
  peso: number;
  grasaCorporal?: number;
  musculatura?: number;
  perimetros: Perimetros;
  pliegues?: Record<string, number>;
  fotos: FotosProgreso;
  observaciones: string;
  lesionLimitaciones: string;
}

export interface CheckinFormData {
  semana: number;
  fecha: string;
  peso: number;
  grasaCorporal?: number;
  musculatura?: number;
  perimetros: Perimetros;
  fotos: FotosProgreso;
  energia: 1 | 2 | 3 | 4 | 5;
  sueno: 1 | 2 | 3 | 4 | 5;
  estres: 1 | 2 | 3 | 4 | 5;
  adherencia: 1 | 2 | 3 | 4 | 5;
  notas: string;
}

export interface EjercicioFormData {
  nombre: string;
  grupoMuscular: GrupoMuscular;
  patron: PatronMovimiento;
  equipo: Equipo[];
  descripcion: string;
  videoUri?: string;
  imagenUri?: string;
  esCompuesto: boolean;
}

export interface MetaFormData {
  tipo: TipoMeta;
  descripcion: string;
  valorObjetivo: number;
  unidad: 'kg' | '%' | 'cm' | 'reps' | 'dias';
  fechaObjetivo: string;
  valorInicial: number;
}

// Export/Import Types
export interface BackupData {
  version: number;
  exportDate: string;
  clientes: Cliente[];
  fichasIniciales: FichaInicial[];
  checkinsSemanales: CheckinSemanal[];
  ejercicios: Ejercicio[];
  rutinasSemanales: RutinaSemanal[];
  entrenamientosRealizados: EntrenamientoRealizado[];
  metas: Meta[];
}