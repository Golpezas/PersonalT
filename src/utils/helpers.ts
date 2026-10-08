/**
 * Utility Functions
 */

import { format, parseISO, startOfWeek, endOfWeek, differenceInDays, differenceInWeeks, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Perimetros, FotosProgreso, EjercicioRutina, ProgresionPlan } from '@/types';

// ============================================
// ID Generation
// ============================================
/**
 * UUID v4. Hermes no expone `crypto`, así que el paquete `uuid` falla en el
 * dispositivo; para IDs locales de SQLite alcanza con Math.random.
 */
export const generateId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const generateShortId = (): string => {
  return Math.random().toString(36).substring(2, 10);
};

// ============================================
// Date Helpers
// ============================================
/** Fecha local "YYYY-MM-DD". `toISOString()` usa UTC y en UTC-3 adelanta un día después de las 21 h. */
export const fechaLocalISO = (date: Date = new Date()): string => {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
};

export const formatDate = (date: string | Date, pattern = 'dd/MM/yyyy'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Fecha inválida';
  return format(d, pattern, { locale: es });
};

export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
};

export const formatRelativeTime = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 'Fecha inválida';
  
  const now = new Date();

  // Fechas sin hora (check-ins, fichas): comparar días de calendario, no horas.
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const dias = Math.round(
      (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dias <= 0) return 'hoy';
    if (dias === 1) return 'ayer';
    if (dias <= 7) return `hace ${dias} días`;
    return formatDate(d);
  }

  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 7) return formatDate(d);
  if (diffDays > 0) return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  if (diffHours > 0) return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
  if (diffMinutes > 0) return `hace ${diffMinutes} min`;
  return 'ahora';
};

export const getWeekNumber = (date: string | Date): number => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return 1;
  const start = startOfWeek(d, { weekStartsOn: 1 });
  const yearStart = startOfWeek(new Date(d.getFullYear(), 0, 1), { weekStartsOn: 1 });
  return differenceInWeeks(start, yearStart) + 1;
};

export const getWeekRange = (week: number, year: number): { start: Date; end: Date } => {
  const yearStart = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 });
  const start = new Date(yearStart);
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = endOfWeek(start, { weekStartsOn: 1 });
  return { start, end };
};

export const getCurrentWeek = (): number => getWeekNumber(new Date());

export const daysUntilDate = (targetDate: string | Date): number => {
  const target = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  if (!isValid(target)) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(target, today);
};

// ============================================
// Number Formatting
// ============================================
export const formatWeight = (kg: number, unit: 'kg' | 'lb' = 'kg'): string => {
  if (unit === 'lb') {
    return `${(kg * 2.20462).toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
};

export const formatHeight = (cm: number): string => {
  const m = Math.floor(cm / 100);
  const remainingCm = cm % 100;
  return `${m}.${remainingCm.toString().padStart(2, '0')} m`;
};

export const formatPercentage = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`;
};

export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
};

/** Número para mostrar, con coma decimal como se carga en los formularios: 70.5 -> "70,5" */
export const formatDecimal = (n: number, decimals = 1): string => n.toFixed(decimals).replace('.', ',');

/** Hasta 1 decimal, sin ",0" sobrante: 65 → "65", 69.25 → "69,3". */
export const formatNumero = (n: number): string => String(Math.round(n * 10) / 10).replace('.', ',');

export const round1 = (n: number): number => Math.round(n * 10) / 10;
export const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Parsea un rango de reps de la rutina ("8-12", "8", "6-8") y devuelve { min, max }. */
export const parseRepRange = (reps: string): { min: number; max: number } => {
  const limpio = String(reps ?? '').replace(/[^\d\-]/g, '');
  if (!limpio) return { min: 8, max: 12 };
  const partes = limpio.split('-').map((n) => parseInt(n, 10)).filter((n) => !Number.isNaN(n));
  if (partes.length === 0) return { min: 8, max: 12 };
  if (partes.length === 1) return { min: partes[0], max: partes[0] };
  return { min: Math.min(partes[0], partes[1]), max: Math.max(partes[0], partes[1]) };
};

/** Objetivo de reps para la primera serie: el mínimo del rango (o el único valor). */
export const getRepsObjetivo = (reps: string): number => parseRepRange(reps).min;

/** Formatea segundos como reloj mm:ss (para descansos). */
export const formatSeconds = (seg: number): string => {
  const s = Math.max(0, Math.round(seg));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** Formatea segundos como cronómetro grande (00:00:00 o 00:00). */
export const formatCronometro = (seg: number): string => {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

// ============================================
// Calculations
// ============================================
export const calculateIMC = (pesoKg: number, alturaCm: number): number => {
  const alturaM = alturaCm / 100;
  return round1(pesoKg / (alturaM * alturaM));
};

export const calculateIMCClassification = (imc: number): string => {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25) return 'Normal';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidad I';
  if (imc < 40) return 'Obesidad II';
  return 'Obesidad III';
};

export const calculateEpley1RM = (peso: number, repeticiones: number): number => {
  if (repeticiones <= 1) return peso;
  return round1(peso * (1 + repeticiones / 30));
};

export const calculateBrzycki1RM = (peso: number, repeticiones: number): number => {
  if (repeticiones <= 1) return peso;
  return round1(peso * (36 / (37 - repeticiones)));
};

export const calculateLander1RM = (peso: number, repeticiones: number): number => {
  if (repeticiones <= 1) return peso;
  return round1((100 * peso) / (101.3 - 2.67 * repeticiones));
};

export const estimate1RM = (peso: number, repeticiones: number, method: 'epley' | 'brzycki' | 'lander' = 'epley'): number => {
  switch (method) {
    case 'brzycki': return calculateBrzycki1RM(peso, repeticiones);
    case 'lander': return calculateLander1RM(peso, repeticiones);
    default: return calculateEpley1RM(peso, repeticiones);
  }
};

export const calculateVolume = (series: Array<{ peso: number; repeticiones: number }>): number => {
  return series.reduce((sum, s) => sum + s.peso * s.repeticiones, 0);
};

export const calculateSessionVolume = (ejercicios: Array<{ series: Array<{ peso: number; repeticiones: number }> }>): number => {
  return ejercicios.reduce((sum, e) => sum + calculateVolume(e.series), 0);
};

export const calculateAverageRPE = (series: Array<{ rpe: number }>): number => {
  if (series.length === 0) return 0;
  const sum = series.reduce((s, se) => s + se.rpe, 0);
  return round1(sum / series.length);
};

// ============================================
// Progresión Helpers
// ============================================
export const getProgresionLabel = (progresion: ProgresionPlan): string => {
  switch (progresion.tipo) {
    case 'lineal':
      return `+${progresion.incrementoPeso}kg cada ${progresion.frecuenciaSemanas} sem`;
    case 'double_progression':
      return `${progresion.repObjetivoMax} reps → +${progresion.incrementoPeso}kg`;
    case 'rpe_based':
      return `RPE ${progresion.rpeMeta} → ajustar ${progresion.ajustePeso}kg`;
    case 'personalizada':
      return progresion.descripcion;
  }
};

export const calculateNextWeight = (
  currentWeight: number,
  progresion: ProgresionPlan,
  completedReps?: number,
  currentRPE?: number
): number => {
  switch (progresion.tipo) {
    case 'lineal':
      return currentWeight + progresion.incrementoPeso;
    case 'double_progression':
      if (completedReps && completedReps >= progresion.repObjetivoMax) {
        return currentWeight + progresion.incrementoPeso;
      }
      return currentWeight;
    case 'rpe_based':
      if (currentRPE !== undefined) {
        const diff = currentRPE - progresion.rpeMeta;
        if (diff <= -2) return currentWeight + progresion.ajustePeso;
        if (diff >= 2) return Math.max(0, currentWeight - progresion.ajustePeso);
      }
      return currentWeight;
    case 'personalizada':
      return currentWeight;
  }
};

// ============================================
// Perimetros Helpers
// ============================================
export const createEmptyPerimetros = (): Perimetros => ({
  brazoIzq: 0, brazoDer: 0,
  antebrazoIzq: 0, antebrazoDer: 0,
  pecho: 0, cintura: 0, cadera: 0,
  piernaIzq: 0, piernaDer: 0,
  pantorrillaIzq: 0, pantorrillaDer: 0 });

export const getPerimetroLabel = (key: keyof Perimetros): string => {
  const labels: Record<keyof Perimetros, string> = {
    brazoIzq: 'Brazo Izq',
    brazoDer: 'Brazo Der',
    antebrazoIzq: 'Antebrazo Izq',
    antebrazoDer: 'Antebrazo Der',
    pecho: 'Pecho',
    cintura: 'Cintura',
    cadera: 'Cadera',
    piernaIzq: 'Pierna Izq',
    piernaDer: 'Pierna Der',
    pantorrillaIzq: 'Pantorrilla Izq',
    pantorrillaDer: 'Pantorrilla Der' };
  return labels[key];
};

export const getBilateralPairs = (): Array<[keyof Perimetros, keyof Perimetros]> => [
  ['brazoIzq', 'brazoDer'],
  ['antebrazoIzq', 'antebrazoDer'],
  ['piernaIzq', 'piernaDer'],
  ['pantorrillaIzq', 'pantorrillaDer'],
];

export const checkAsymmetry = (perimetros: Perimetros, threshold = 2): Array<{ pair: string; diff: number }> => {
  const pairs = getBilateralPairs();
  return pairs
    .map(([left, right]) => ({
      pair: `${getPerimetroLabel(left)} / ${getPerimetroLabel(right)}`,
      diff: Math.abs(perimetros[left] - perimetros[right]) }))
    .filter(p => p.diff > threshold);
};

export const sumPerimetros = (perimetros: Perimetros): number => {
  return Object.values(perimetros).reduce((sum, v) => sum + v, 0);
};

// ============================================
// Fotos Helpers
// ============================================
export const createEmptyFotos = (): FotosProgreso => ({
  frontal: '',
  lateral: '',
  posterior: '' });

export const isValidFotos = (fotos: FotosProgreso): boolean => {
  return !!fotos.frontal || !!fotos.lateral || !!fotos.posterior;
};

export const getFotoLabel = (key: keyof FotosProgreso): string => {
  const labels: Record<keyof FotosProgreso, string> = {
    frontal: 'Frontal',
    lateral: 'Lateral',
    posterior: 'Posterior' };
  return labels[key];
};

// ============================================
// Ejercicio Helpers
// ============================================
export const getGrupoMuscularLabel = (grupo: string): string => {
  const labels: Record<string, string> = {
    pecho: 'Pecho',
    espalda: 'Espalda',
    hombros: 'Hombros',
    biceps: 'Bíceps',
    triceps: 'Tríceps',
    cuadriceps: 'Cuádriceps',
    isquios: 'Isquios',
    gluteos: 'Glúteos',
    pantorrillas: 'Pantorrillas',
    abdominales: 'Abdominales',
    antebrazos: 'Antebrazos',
    trapecio: 'Trapecio',
    lumbares: 'Lumbares' };
  return labels[grupo] || grupo;
};

export const getPatronLabel = (patron: string): string => {
  const labels: Record<string, string> = {
    empuje_horizontal: 'Empuje Horizontal',
    empuje_vertical: 'Empuje Vertical',
    traccion_horizontal: 'Tracción Horizontal',
    traccion_vertical: 'Tracción Vertical',
    knee_dominant: 'Knee Dominant',
    hip_dominant: 'Hip Dominant',
    carry: 'Carry',
    core_anti_extension: 'Core Anti-Extensión',
    core_rotacion: 'Core Rotación' };
  return labels[patron] || patron;
};

export const getEquipoLabel = (equipo: string): string => {
  const labels: Record<string, string> = {
    barra: 'Barra',
    mancuernas: 'Mancuernas',
    maquina: 'Máquina',
    polea: 'Polea',
    bandas: 'Bandas',
    peso_corporal: 'Peso Corporal',
    kettlebell: 'Kettlebell',
    otro: 'Otro' };
  return labels[equipo] || equipo;
};

export const getMuscleGroupColor = (grupo: string): string => {
  const colors: Record<string, string> = {
    pecho: '#ef4444',
    espalda: '#3b82f6',
    hombros: '#f59e0b',
    biceps: '#ec4899',
    triceps: '#8b5cf6',
    cuadriceps: '#22c55e',
    isquios: '#10b981',
    gluteos: '#06b6d4',
    pantorrillas: '#84cc16',
    abdominales: '#f97316',
    antebrazos: '#6366f1',
    trapecio: '#14b8a6',
    lumbares: '#a855f7' };
  return colors[grupo] || '#64748b';
};

// ============================================
// String Helpers
// ============================================
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const truncate = (str: string, max: number): string => {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
};

export const slugify = (str: string): string => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
};

// ============================================
// Validation Helpers
// ============================================
export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(phone);
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

// ============================================
// Array Helpers
// ============================================
export const groupBy = <T, K extends keyof T>(array: T[], key: K): Record<string, T[]> => {
  return array.reduce((acc, item) => {
    const groupKey = String(item[key]);
    if (!acc[groupKey]) acc[groupKey] = [];
    acc[groupKey].push(item);
    return acc;
  }, {} as Record<string, T[]>);
};

export const sortBy = <T>(array: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] => {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
};

export const uniqueBy = <T, K>(array: T[], key: (item: T) => K): T[] => {
  const seen = new Set<K>();
  return array.filter(item => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

// ============================================
// File/Storage Helpers
// ============================================
export const getFileExtension = (uri: string): string => {
  return uri.split('.').pop()?.toLowerCase() || '';
};

export const isImageFile = (uri: string): boolean => {
  const ext = getFileExtension(uri);
  return ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext);
};

export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ============================================
// Color Helpers (for charts)
// ============================================
export const CHART_COLORS = [
  '#0ea5e9', // primary
  '#22c55e', // success
  '#f59e0b', // warning
  '#ef4444', // danger
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export const getChartColor = (index: number): string => {
  return CHART_COLORS[index % CHART_COLORS.length];
};

export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};