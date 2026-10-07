/**
 * Zod Validation Schemas
 * Single source of truth for validation (forms + database)
 */

import { z } from 'zod';
import type { Sexo, GrupoMuscular, PatronMovimiento, Equipo, TipoProgresion, TipoMeta, EstadoMeta } from '@/db/schema';

// Reusable primitives
// Los IDs del catálogo ("ex-1") y de días ("d1") no son UUID: solo se exige que existan.
const uuidSchema = z.string().min(1, 'ID inválido');
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');
const isoDateTimeSchema = z.string().datetime({ offset: true });
const positiveNumber = z.number().positive('Debe ser un número positivo');
const nonNegativeNumber = z.number({ message: 'Número requerido' }).min(0, 'No puede ser negativo');
const rpeSchema = z.number().int().min(1).max(10, 'RPE debe ser entre 1 y 10');
const rpeObjetivoSchema = z.number().int().min(6).max(10, 'RPE objetivo entre 6 y 10');
const seriesSchema = z.number().int().min(1).max(20, 'Series entre 1 y 20');
const descansoSchema = z.number().int().min(30).max(600, 'Descanso entre 30 y 600 segundos');
const porcentajeSchema = z.number().min(0).max(100, 'Porcentaje entre 0 y 100');
const rating1a5Schema = z.number().int().min(1).max(5, 'Valor entre 1 y 5');

// JSON schemas for complex fields
const perimetrosSchema = z.object({
  brazoIzq: nonNegativeNumber,
  brazoDer: nonNegativeNumber,
  antebrazoIzq: nonNegativeNumber,
  antebrazoDer: nonNegativeNumber,
  pecho: nonNegativeNumber,
  cintura: nonNegativeNumber,
  cadera: nonNegativeNumber,
  piernaIzq: nonNegativeNumber,
  piernaDer: nonNegativeNumber,
  pantorrillaIzq: nonNegativeNumber,
  pantorrillaDer: nonNegativeNumber });

const fotosProgresoSchema = z.object({
  frontal: z.string(),
  lateral: z.string(),
  posterior: z.string() });

const plieguesSchema = z.record(z.string(), nonNegativeNumber).optional();

const equipoArraySchema = z.array(z.enum([
  'barra', 'mancuernas', 'maquina', 'polea', 'bandas', 'peso_corporal', 'kettlebell', 'otro'
])).min(1, 'Al menos un equipo requerido');

const progresionLinealSchema = z.object({
  tipo: z.literal('lineal'),
  incrementoPeso: z.number().positive('Incremento debe ser positivo'),
  frecuenciaSemanas: z.number().int().min(1).max(12, 'Frecuencia 1-12 semanas') });

const progresionDoubleSchema = z.object({
  tipo: z.literal('double_progression'),
  repObjetivoMax: z.number().int().min(1).max(50, 'Reps objetivo 1-50'),
  incrementoPeso: z.number().positive('Incremento debe ser positivo') });

const progresionRPESchema = z.object({
  tipo: z.literal('rpe_based'),
  rpeMeta: z.number().int().min(6).max(10, 'RPE meta 6-10'),
  ajustePeso: z.number().min(0).max(10, 'Ajuste peso 0-10kg') });

const progresionPersonalizadaSchema = z.object({
  tipo: z.literal('personalizada'),
  descripcion: z.string().min(5, 'Descripción mínima 5 caracteres').max(500) });

const progresionSchema = z.discriminatedUnion('tipo', [
  progresionLinealSchema,
  progresionDoubleSchema,
  progresionRPESchema,
  progresionPersonalizadaSchema,
]);

// ============================================
// CLIENTE
// ============================================
export const clienteSchema = z.object({
  id: uuidSchema.optional(),
  nombre: z.string().min(1, 'Nombre requerido').max(50, 'Máx 50 caracteres'),
  apellido: z.string().min(1, 'Apellido requerido').max(50, 'Máx 50 caracteres'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().max(20).optional().or(z.literal('')),
  fechaNacimiento: isoDateSchema,
  sexo: z.enum(['M', 'F', 'Otro']),
  altura: z.number({ error: 'Altura requerida' }).int('Altura en cm, sin decimales').min(100, 'Altura 100-250 cm').max(250, 'Altura 100-250 cm'),
  fotoUri: z.string().optional(),
  creadoEn: isoDateTimeSchema.optional(),
  actualizadoEn: isoDateTimeSchema.optional() });

export type ClienteFormData = z.infer<typeof clienteSchema>;

// ============================================
// FICHA INICIAL
// ============================================
export const fichaInicialSchema = z.object({
  id: uuidSchema.optional(),
  clienteId: uuidSchema,
  fecha: isoDateSchema,
  peso: z.number({ message: 'Peso requerido' }).min(30, 'Peso 30-300 kg').max(300, 'Peso 30-300 kg'),
  grasaCorporal: z.number().min(3, 'Grasa 3-50%').max(50, 'Grasa 3-50%').optional(),
  musculatura: z.number().min(10, 'Musculatura 10-150 kg').max(150, 'Musculatura 10-150 kg').optional(),
  perimetros: perimetrosSchema,
  pliegues: plieguesSchema,
  fotos: fotosProgresoSchema,
  observaciones: z.string().max(2000).optional().default(''),
  lesionLimitaciones: z.string().max(2000).optional().default(''),
  creadoEn: isoDateTimeSchema.optional() });

export type FichaInicialFormData = z.infer<typeof fichaInicialSchema>;

// ============================================
// CHECK-IN SEMANAL
// ============================================
export const checkinSemanalSchema = z.object({
  id: uuidSchema.optional(),
  clienteId: uuidSchema,
  semana: z.number().int().min(1, 'Semana mínima 1'),
  fecha: isoDateSchema,
  peso: z.number({ message: 'Peso requerido' }).min(30, 'Peso 30-300 kg').max(300, 'Peso 30-300 kg'),
  grasaCorporal: z.number().min(3, 'Grasa 3-50%').max(50, 'Grasa 3-50%').optional(),
  musculatura: z.number().min(10, 'Musculatura 10-150 kg').max(150, 'Musculatura 10-150 kg').optional(),
  perimetros: perimetrosSchema,
  fotos: fotosProgresoSchema,
  energia: rating1a5Schema,
  sueno: rating1a5Schema,
  estres: rating1a5Schema,
  adherencia: rating1a5Schema,
  notas: z.string().max(2000).optional().default(''),
  creadoEn: isoDateTimeSchema.optional() }).refine(
  (data) => {
    // Validar que la semana sea secuencial (se valida en lógica de negocio)
    return true;
  },
  { message: 'La semana debe ser consecutiva a la anterior' }
);

export type CheckinFormData = z.infer<typeof checkinSemanalSchema>;

// ============================================
// EJERCICIO (CATÁLOGO)
// ============================================
export const ejercicioSchema = z.object({
  id: uuidSchema.optional(),
  nombre: z.string().min(2, 'Nombre muy corto').max(100, 'Máx 100 caracteres'),
  grupoMuscular: z.enum([
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps',
    'cuadriceps', 'isquios', 'gluteos', 'pantorrillas', 'abdominales',
    'antebrazos', 'trapecio', 'lumbares',
  ]),
  patron: z.enum([
    'empuje_horizontal', 'empuje_vertical', 'traccion_horizontal', 'traccion_vertical',
    'knee_dominant', 'hip_dominant', 'carry', 'core_anti_extension', 'core_rotacion',
  ]),
  equipo: equipoArraySchema,
  descripcion: z.string().max(1000).optional().default(''),
  videoUri: z.string().optional(),
  imagenUri: z.string().optional(),
  esCompuesto: z.boolean().default(false),
  creadoEn: isoDateTimeSchema.optional() });

export type EjercicioFormData = z.infer<typeof ejercicioSchema>;

// ============================================
// EJERCICIO EN RUTINA
// ============================================
export const ejercicioRutinaSchema = z.object({
  id: uuidSchema.optional(),
  ejercicioId: uuidSchema,
  orden: z.number().int().min(1).max(50),
  series: seriesSchema,
  repeticiones: z.string().min(1, 'Repeticiones requeridas').max(20).regex(
    /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$|^AMRAP$/i,
    'Formato: "8-12", "10,8,6", "AMRAP"'
  ),
  rpeObjetivo: rpeObjetivoSchema,
  tempo: z.string().max(10).regex(/^\d-\d-\d-\d$/, 'Formato tempo: "3-0-1-0"').default('3-0-1-0'),
  descansoSeg: descansoSchema,
  notas: z.string().max(500).optional().default(''),
  progresion: progresionSchema });

export type EjercicioRutinaFormData = z.infer<typeof ejercicioRutinaSchema>;

// ============================================
// DÍA RUTINA
// ============================================
export const diaRutinaSchema = z.object({
  id: uuidSchema.optional(),
  orden: z.number().int().min(1).max(7),
  nombre: z.string().min(1, 'Nombre del día requerido').max(50),
  esDescanso: z.boolean().default(false),
  ejercicios: z.array(ejercicioRutinaSchema).default([]) });

export type DiaRutinaFormData = z.infer<typeof diaRutinaSchema>;

// ============================================
// RUTINA SEMANAL
// ============================================
export const rutinaSemanalSchema = z.object({
  id: uuidSchema.optional(),
  clienteId: uuidSchema,
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  mesociclo: z.number().int().min(1, 'Mesociclo mínimo 1'),
  semanaInicio: z.number().int().min(1, 'Semana inicio mínima 1'),
  semanaFin: z.number().int().min(1, 'Semana fin mínima 1'),
  dias: z.array(diaRutinaSchema).min(1, 'Al menos un día').max(7, 'Máx 7 días'),
  notasGenerales: z.string().max(2000).optional().default(''),
  creadoEn: isoDateTimeSchema.optional(),
  actualizadoEn: isoDateTimeSchema.optional() }).refine(
  (data) => data.semanaFin >= data.semanaInicio,
  { message: 'Semana fin debe ser >= semana inicio', path: ['semanaFin'] }
).refine(
  (data) => {
    // Verificar que los días tengan orden único 1-7
    const ordenes = data.dias.map(d => d.orden).sort((a, b) => a - b);
    return ordenes.every((v, i) => v === i + 1);
  },
  { message: 'Los días deben tener orden 1-7 sin huecos', path: ['dias'] }
);

export type RutinaSemanalFormData = z.infer<typeof rutinaSemanalSchema>;

// ============================================
// ENTRENAMIENTO REALIZADO
// ============================================
export const serieRealSchema = z.object({
  numero: z.number().int().min(1),
  peso: z.number().min(0).max(500, 'Peso 0-500 kg'),
  repeticiones: z.number().int().min(0).max(100, 'Reps 0-100'),
  rpe: rpeSchema,
  completada: z.boolean() });

export const ejercicioRealizadoSchema = z.object({
  ejercicioRutinaId: uuidSchema,
  series: z.array(serieRealSchema).min(1, 'Al menos una serie') });

export const entrenamientoRealizadoSchema = z.object({
  id: uuidSchema.optional(),
  clienteId: uuidSchema,
  rutinaSemanalId: uuidSchema,
  diaRutinaId: uuidSchema,
  fecha: isoDateTimeSchema,
  duracionMin: z.number().int().min(1).max(300, 'Duración 1-300 min'),
  ejercicios: z.array(ejercicioRealizadoSchema).min(1, 'Al menos un ejercicio'),
  rpeGlobal: rpeSchema.optional(),
  notas: z.string().max(2000).optional().default('') });

export type EntrenamientoFormData = z.infer<typeof entrenamientoRealizadoSchema>;

// ============================================
// META
// ============================================
export const metaSchema = z.object({
  id: uuidSchema.optional(),
  clienteId: uuidSchema,
  tipo: z.enum(['peso', 'grasa', 'musculo', 'fuerza', 'perimetro', 'habito']),
  descripcion: z.string().min(5, 'Descripción mínima 5 caracteres').max(200),
  valorObjetivo: z.number().positive('Objetivo debe ser positivo'),
  unidad: z.enum(['kg', '%', 'cm', 'reps', 'dias']),
  fechaObjetivo: isoDateSchema,
  valorInicial: z.number(),
  fechaInicio: isoDateSchema,
  estado: z.enum(['activa', 'lograda', 'pausada', 'cancelada']).default('activa'),
  creadoEn: isoDateTimeSchema.optional() }).refine(
  (data) => new Date(data.fechaObjetivo) >= new Date(data.fechaInicio),
  { message: 'Fecha objetivo debe ser posterior a inicio', path: ['fechaObjetivo'] }
);

export type MetaFormData = z.infer<typeof metaSchema>;

// ============================================
// BACKUP / EXPORT
// ============================================
export const backupDataSchema = z.object({
  version: z.number().int().positive(),
  exportDate: isoDateTimeSchema,
  clientes: z.array(clienteSchema),
  fichasIniciales: z.array(fichaInicialSchema),
  checkinsSemanales: z.array(checkinSemanalSchema),
  ejercicios: z.array(ejercicioSchema),
  rutinasSemanales: z.array(rutinaSemanalSchema),
  entrenamientosRealizados: z.array(entrenamientoRealizadoSchema),
  metas: z.array(metaSchema) });

export type BackupData = z.infer<typeof backupDataSchema>;

// ============================================
// HELPERS
// ============================================
export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ');
    throw new Error(`Validación fallida: ${errors}`);
  }
  return result.data;
}

export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`) };
}