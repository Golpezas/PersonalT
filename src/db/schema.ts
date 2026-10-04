/**
 * Database Schema Definitions
 * Using op-sqlite (synchronous, JSI-based)
 */

export const DATABASE_VERSION = 1;
export const DATABASE_NAME = 'personaltrainer.db';

export const CREATE_TABLES_SQL = `
-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  fecha_nacimiento TEXT NOT NULL,
  sexo TEXT NOT NULL CHECK (sexo IN ('M', 'F', 'Otro')),
  altura REAL NOT NULL,
  foto_uri TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL
);

-- Fichas Iniciales
CREATE TABLE IF NOT EXISTS fichas_iniciales (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  peso REAL NOT NULL,
  grasa_corporal REAL,
  musculatura REAL,
  perimetros TEXT NOT NULL, -- JSON
  pliegues TEXT, -- JSON
  fotos TEXT NOT NULL, -- JSON {frontal, lateral, posterior}
  observaciones TEXT,
  lesion_limitaciones TEXT,
  creado_en TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Check-ins Semanales
CREATE TABLE IF NOT EXISTS checkins_semanales (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  semana INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  peso REAL NOT NULL,
  grasa_corporal REAL,
  musculatura REAL,
  perimetros TEXT NOT NULL, -- JSON
  fotos TEXT NOT NULL, -- JSON
  energia INTEGER NOT NULL CHECK (energia BETWEEN 1 AND 5),
  sueno INTEGER NOT NULL CHECK (sueno BETWEEN 1 AND 5),
  estres INTEGER NOT NULL CHECK (estres BETWEEN 1 AND 5),
  adherencia INTEGER NOT NULL CHECK (adherencia BETWEEN 1 AND 5),
  notas TEXT,
  creado_en TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Catálogo de Ejercicios
CREATE TABLE IF NOT EXISTS ejercicios (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  grupo_muscular TEXT NOT NULL,
  patron TEXT NOT NULL,
  equipo TEXT NOT NULL, -- JSON array
  descripcion TEXT,
  video_uri TEXT,
  imagen_uri TEXT,
  es_compuesto INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL
);

-- Rutinas Semanales (Plantillas)
CREATE TABLE IF NOT EXISTS rutinas_semanales (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  nombre TEXT NOT NULL,
  mesociclo INTEGER NOT NULL,
  semana_inicio INTEGER NOT NULL,
  semana_fin INTEGER NOT NULL,
  dias TEXT NOT NULL, -- JSON array de DiaRutina
  notas_generales TEXT,
  creado_en TEXT NOT NULL,
  actualizado_en TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Entrenamientos Realizados (Logs)
CREATE TABLE IF NOT EXISTS entrenamientos_realizados (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  rutina_semanal_id TEXT NOT NULL,
  dia_rutina_id TEXT NOT NULL,
  fecha TEXT NOT NULL,
  duracion_min INTEGER NOT NULL,
  ejercicios TEXT NOT NULL, -- JSON array de EjercicioRealizado
  rpe_global INTEGER CHECK (rpe_global BETWEEN 1 AND 10),
  notas TEXT,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  FOREIGN KEY (rutina_semanal_id) REFERENCES rutinas_semanales(id) ON DELETE CASCADE
);

-- Metas
CREATE TABLE IF NOT EXISTS metas (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('peso', 'grasa', 'musculo', 'fuerza', 'perimetro', 'habito')),
  descripcion TEXT NOT NULL,
  valor_objetivo REAL NOT NULL,
  unidad TEXT NOT NULL CHECK (unidad IN ('kg', '%', 'cm', 'reps', 'dias')),
  fecha_objetivo TEXT NOT NULL,
  valor_inicial REAL NOT NULL,
  fecha_inicio TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'lograda', 'pausada', 'cancelada')),
  creado_en TEXT NOT NULL,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_clientes_nombre ON clientes(nombre, apellido);
CREATE INDEX IF NOT EXISTS idx_fichas_cliente ON fichas_iniciales(cliente_id);
CREATE INDEX IF NOT EXISTS idx_checkins_cliente_fecha ON checkins_semanales(cliente_id, fecha);
CREATE INDEX IF NOT EXISTS idx_checkins_cliente_semana ON checkins_semanales(cliente_id, semana);
CREATE INDEX IF NOT EXISTS idx_rutinas_cliente_mesociclo ON rutinas_semanales(cliente_id, mesociclo);
CREATE INDEX IF NOT EXISTS idx_entrenamientos_cliente_fecha ON entrenamientos_realizados(cliente_id, fecha);
CREATE INDEX IF NOT EXISTS idx_entrenamientos_rutina ON entrenamientos_realizados(rutina_semanal_id);
CREATE INDEX IF NOT EXISTS idx_metas_cliente_estado ON metas(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_ejercicios_grupo ON ejercicios(grupo_muscular);
`;

export const MIGRATIONS: Record<number, string> = {
  1: CREATE_TABLES_SQL };

export type GrupoMuscular =
  | 'pecho'
  | 'espalda'
  | 'hombros'
  | 'biceps'
  | 'triceps'
  | 'cuadriceps'
  | 'isquios'
  | 'gluteos'
  | 'pantorrillas'
  | 'abdominales'
  | 'antebrazos'
  | 'trapecio'
  | 'lumbares';

export type PatronMovimiento =
  | 'empuje_horizontal'
  | 'empuje_vertical'
  | 'traccion_horizontal'
  | 'traccion_vertical'
  | 'knee_dominant'
  | 'hip_dominant'
  | 'carry'
  | 'core_anti_extension'
  | 'core_rotacion';

export type Equipo =
  | 'barra'
  | 'mancuernas'
  | 'maquina'
  | 'polea'
  | 'bandas'
  | 'peso_corporal'
  | 'kettlebell'
  | 'otro';

export type TipoProgresion = 'lineal' | 'double_progression' | 'rpe_based' | 'personalizada';

export type EstadoMeta = 'activa' | 'lograda' | 'pausada' | 'cancelada';
export type TipoMeta = 'peso' | 'grasa' | 'musculo' | 'fuerza' | 'perimetro' | 'habito';
export type Sexo = 'M' | 'F' | 'Otro';