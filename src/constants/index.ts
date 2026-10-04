/**
 * Application Constants
 */

export const APP_CONFIG = {
  name: 'PersonalTrainer',
  version: '1.0.0',
  minVersion: '1.0.0',
  dbName: 'personaltrainer.db',
  dbVersion: 1 } as const;

export const STORAGE_KEYS = {
  theme: 'ui-storage',
  clientes: 'clientes-storage',
  rutinas: 'rutinas-storage',
  entrenamientos: 'entrenamientos-storage',
  onboardingComplete: 'onboarding-complete',
  units: 'units-preference', // 'metric' | 'imperial',
  language: 'language-preference', // 'es' | 'en',
  autoBackup: 'auto-backup-enabled',
  backupFrequency: 'backup-frequency', // 'daily' | 'weekly' | 'never',
  lastBackupAt: 'last-backup-at' } as const;

export const UNITS = {
  metric: { weight: 'kg', height: 'cm', distance: 'km' },
  imperial: { weight: 'lb', height: 'ft', distance: 'mi' } } as const;

export const GRUPOS_MUSCULARES = [
  { id: 'pecho', label: 'Pecho', icon: '💪', color: '#ef4444', order: 1 },
  { id: 'espalda', label: 'Espalda', icon: '🦁', color: '#3b82f6', order: 2 },
  { id: 'hombros', label: 'Hombros', icon: '🏋️', color: '#f59e0b', order: 3 },
  { id: 'biceps', label: 'Bíceps', icon: '💪', color: '#ec4899', order: 4 },
  { id: 'triceps', label: 'Tríceps', icon: '💪', color: '#8b5cf6', order: 5 },
  { id: 'cuadriceps', label: 'Cuádriceps', icon: '🦵', color: '#22c55e', order: 6 },
  { id: 'isquios', label: 'Isquios', icon: '🦵', color: '#10b981', order: 7 },
  { id: 'gluteos', label: 'Glúteos', icon: '🍑', color: '#06b6d4', order: 8 },
  { id: 'pantorrillas', label: 'Pantorrillas', icon: '🦵', color: '#84cc16', order: 9 },
  { id: 'abdominales', label: 'Abdominales', icon: '🏋️', color: '#f97316', order: 10 },
  { id: 'antebrazos', label: 'Antebrazos', icon: '💪', color: '#6366f1', order: 11 },
  { id: 'trapecio', label: 'Trapecio', icon: '🏋️', color: '#14b8a6', order: 12 },
  { id: 'lumbares', label: 'Lumbares', icon: '🏋️', color: '#a855f7', order: 13 },
] as const;

export const PATRONES_MOVIMIENTO = [
  { id: 'empuje_horizontal', label: 'Empuje Horizontal', grupos: ['pecho', 'hombros', 'triceps'] },
  { id: 'empuje_vertical', label: 'Empuje Vertical', grupos: ['hombros', 'triceps', 'pecho'] },
  { id: 'traccion_horizontal', label: 'Tracción Horizontal', grupos: ['espalda', 'biceps', 'trapecio'] },
  { id: 'traccion_vertical', label: 'Tracción Vertical', grupos: ['espalda', 'biceps', 'hombros'] },
  { id: 'knee_dominant', label: 'Knee Dominant', grupos: ['cuadriceps', 'gluteos'] },
  { id: 'hip_dominant', label: 'Hip Dominant', grupos: ['isquios', 'gluteos', 'lumbares'] },
  { id: 'carry', label: 'Carry', grupos: ['antebrazos', 'trapecio', 'core'] },
  { id: 'core_anti_extension', label: 'Core Anti-Extensión', grupos: ['abdominales'] },
  { id: 'core_rotacion', label: 'Core Rotación', grupos: ['abdominales', 'oblicuos'] },
] as const;

export const EQUIPOS = [
  { id: 'barra', label: 'Barra', icon: '🏋️' },
  { id: 'mancuernas', label: 'Mancuernas', icon: '🏋️' },
  { id: 'maquina', label: 'Máquina', icon: '🏭' },
  { id: 'polea', label: 'Polea', icon: '⚙️' },
  { id: 'bandas', label: 'Bandas', icon: '🔗' },
  { id: 'peso_corporal', label: 'Peso Corporal', icon: '🤸' },
  { id: 'kettlebell', label: 'Kettlebell', icon: '🏋️' },
  { id: 'otro', label: 'Otro', icon: '❓' },
] as const;

export const TIPOS_PROGRESION = [
  { 
    id: 'lineal', 
    label: 'Progresión Lineal', 
    description: 'Aumentar peso fijo cada N semanas',
    fields: ['incrementoPeso', 'frecuenciaSemanas'] },
  { 
    id: 'double_progression', 
    label: 'Doble Progresión', 
    description: 'Subir reps hasta tope, luego subir peso y bajar reps',
    fields: ['repObjetivoMax', 'incrementoPeso'] },
  { 
    id: 'rpe_based', 
    label: 'Basada en RPE', 
    description: 'Ajustar peso según RPE real vs objetivo',
    fields: ['rpeMeta', 'ajustePeso'] },
  { 
    id: 'personalizada', 
    label: 'Personalizada', 
    description: 'Descripción libre de la progresión',
    fields: ['descripcion'] },
] as const;

export const TIPOS_META = [
  { id: 'peso', label: 'Peso Corporal', unidades: ['kg', 'lb'], icon: '⚖️' },
  { id: 'grasa', label: 'Grasa Corporal', unidades: ['%'], icon: '📊' },
  { id: 'musculo', label: 'Masa Muscular', unidades: ['kg', 'lb'], icon: '💪' },
  { id: 'fuerza', label: 'Fuerza (1RM)', unidades: ['kg', 'lb', 'reps'], icon: '🏋️' },
  { id: 'perimetro', label: 'Perímetro', unidades: ['cm'], icon: '📏' },
  { id: 'habito', label: 'Hábito/Adherencia', unidades: ['dias', '%'], icon: '📅' },
] as const;

export const ESTADOS_META = [
  { id: 'activa', label: 'Activa', color: '#0ea5e9' },
  { id: 'lograda', label: 'Lograda', color: '#22c55e' },
  { id: 'pausada', label: 'Pausada', color: '#f59e0b' },
  { id: 'cancelada', label: 'Cancelada', color: '#ef4444' },
] as const;

export const VALIDATION_LIMITS = {
  cliente: {
    nombre: { min: 1, max: 50 },
    apellido: { min: 1, max: 50 },
    telefono: { max: 20 } },
  ficha: {
    peso: { min: 30, max: 300 },
    grasaCorporal: { min: 3, max: 50 },
    musculatura: { min: 10, max: 150 },
    altura: { min: 100, max: 250 },
    observaciones: { max: 2000 },
    lesionLimitaciones: { max: 2000 } },
  checkin: {
    semana: { min: 1 },
    energia: { min: 1, max: 5 },
    sueno: { min: 1, max: 5 },
    estres: { min: 1, max: 5 },
    adherencia: { min: 1, max: 5 },
    notas: { max: 2000 } },
  ejercicio: {
    nombre: { min: 2, max: 100 },
    descripcion: { max: 1000 } },
  rutina: {
    nombre: { min: 1, max: 100 },
    notasGenerales: { max: 2000 },
    series: { min: 1, max: 20 },
    repeticiones: { max: 20 },
    rpeObjetivo: { min: 6, max: 10 },
    tempo: { pattern: /^\d-\d-\d-\d$/ },
    descansoSeg: { min: 30, max: 600 },
    notas: { max: 500 } },
  entrenamiento: {
    duracionMin: { min: 1, max: 300 },
    rpeGlobal: { min: 1, max: 10 },
    notas: { max: 2000 },
    peso: { min: 0, max: 500 },
    repeticiones: { min: 0, max: 100 } },
  meta: {
    descripcion: { min: 5, max: 200 },
    valorObjetivo: { min: 0.1 } } } as const;

export const CHART_CONFIG = {
  colors: {
    primary: '#0ea5e9',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    purple: '#8b5cf6',
    pink: '#ec4899',
    cyan: '#06b6d4',
    lime: '#84cc16',
    orange: '#f97316',
    indigo: '#6366f1' },
  gridColor: 'rgba(148, 163, 184, 0.2)',
  textColor: '#64748b',
  backgroundColor: 'transparent',
  animationDuration: 300 } as const;

export const HEATMAP_COLORS = [
  '#e2e8f0', // 0 - no data
  '#fef3c7', // 1 - muy baja
  '#fde68a', // 2 - baja
  '#fcd34d', // 3 - media
  '#fbbf24', // 4 - alta
  '#f59e0b', // 5 - muy alta
] as const;

export const PERIMETROS_ORDER: Array<keyof import('@/types').Perimetros> = [
  'pecho',
  'brazoIzq', 'brazoDer',
  'antebrazoIzq', 'antebrazoDer',
  'cintura',
  'cadera',
  'piernaIzq', 'piernaDer',
  'pantorrillaIzq', 'pantorrillaDer',
];

export const PERIMETROS_GROUPS = {
  'Tronco Superior': ['pecho', 'brazoIzq', 'brazoDer', 'antebrazoIzq', 'antebrazoDer'],
  'Core': ['cintura', 'cadera'],
  'Tren Inferior': ['piernaIzq', 'piernaDer', 'pantorrillaIzq', 'pantorrillaDer'] } as const;

export const DEFAULT_TEMPOS = [
  '3-0-1-0', // Estándar hipertrofia
  '2-0-2-0', // Controlado
  '3-1-1-0', // Pausa en excéntrica
  '4-0-1-0', // Tempo lento
  '2-0-1-0', // Tempo rápido
  '1-0-1-0', // Explosivo
] as const;

export const REP_RANGES = [
  '1-3', '3-5', '5-8', '6-10', '8-12', '10-15', '12-20', '15-25', '20+', 'AMRAP',
] as const;

export const RPE_SCALE = [
  { value: 10, label: '10 - Fallo muscular', desc: 'No más reps posibles' },
  { value: 9.5, label: '9.5', desc: 'Quizás 0 reps más' },
  { value: 9, label: '9 - Muy cerca del fallo', desc: '1 rep más posible' },
  { value: 8.5, label: '8.5', desc: '1-2 reps más' },
  { value: 8, label: '8 - Cerca del fallo', desc: '2 reps más posibles' },
  { value: 7.5, label: '7.5', desc: '2-3 reps más' },
  { value: 7, label: '7 - Moderado', desc: '3 reps más posibles' },
  { value: 6.5, label: '6.5', desc: '3-4 reps más' },
  { value: 6, label: '6 - Ligero', desc: '4+ reps más posibles' },
  { value: 5, label: '5 - Muy ligero', desc: 'Calentamiento' },
] as const;

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
export const WEEKDAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export const MESOCICLO_DURATION_WEEKS = [4, 6, 8, 10, 12] as const;

export const DELLOAD_WEEK_PATTERNS = [
  { label: 'Cada 4 semanas', value: 4 },
  { label: 'Cada 6 semanas', value: 6 },
  { label: 'Cada 8 semanas', value: 8 },
  { label: 'Manual', value: 0 },
] as const;

export const EXPORT_OPTIONS = {
  includeImages: true,
  compressImages: true,
  maxImageDimension: 1024,
  imageQuality: 0.8,
  dateFormat: 'YYYY-MM-DD' } as const;

export const PERFORMANCE_TARGETS = {
  apkSizeMB: 25,
  coldStartMs: 2500,
  listScrollFps: 60,
  chartRenderMs: 300,
  dbQueryMs: 50 } as const;