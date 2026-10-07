/**
 * Database Connection using op-sqlite
 * Synchronous, JSI-based SQLite for React Native
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import { CREATE_TABLES_SQL, MIGRATIONS, DATABASE_NAME, DATABASE_VERSION } from './schema';
import type { CheckinSemanal, Ejercicio, EntrenamientoRealizado, FichaInicial } from '@/types';

let dbInstance: DB | null = null;
let initialized = false;

/**
 * Devuelve la conexión, abriéndola e inicializándola (pragmas, migraciones,
 * esquema, seed) la primera vez. Idempotente: llamarla N veces no repite el setup.
 */
export function getDatabase(): DB {
  if (!dbInstance) {
    dbInstance = open({ name: DATABASE_NAME });
  }
  if (!initialized) {
    // Se marca antes del setup para que una llamada reentrante no lo repita.
    initialized = true;
    try {
      setupDatabase(dbInstance);
    } catch (error) {
      initialized = false;
      throw error;
    }
  }
  return dbInstance;
}

/** Alias explícito para el arranque de la app; equivalente a `getDatabase()`. */
export function initializeDatabase(): void {
  getDatabase();
}

function setupDatabase(db: DB) {
  db.executeSync('PRAGMA journal_mode = WAL;');
  db.executeSync('PRAGMA foreign_keys = ON;');
  db.executeSync('PRAGMA busy_timeout = 5000;');

  runMigrations(db);
  // Repara instalaciones con user_version al día pero tablas faltantes.
  ensureSchema(db);
  seedExercisesIfEmpty(db);
}

/**
 * Parte un script SQL en sentencias individuales. Solo apto para nuestros
 * scripts de esquema: elimina comentarios `--` y corta por `;`, así que no
 * soporta `;` ni `--` dentro de literales de texto.
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function execScript(db: DB, sql: string) {
  for (const statement of splitSqlStatements(sql)) {
    db.executeSync(statement);
  }
}

function runMigrations(db: DB) {
  const result = db.executeSync('PRAGMA user_version;');
  const currentVersion = Number((result.rows[0] as any)?.user_version ?? 0) || 0;

  for (let v = currentVersion + 1; v <= DATABASE_VERSION; v++) {
    const migration = MIGRATIONS[v];
    if (!migration) continue;
    transact(db, (tx) => {
      execScript(tx, migration);
      tx.executeSync(`PRAGMA user_version = ${v};`);
    });
  }
}

function ensureSchema(db: DB) {
  execScript(db, CREATE_TABLES_SQL);
}

function seedExercisesIfEmpty(db: DB) {
  const result = db.executeSync('SELECT COUNT(*) as count FROM ejercicios;');
  const count = Number((result.rows[0] as any)?.count ?? 0) || 0;
  if (count > 0) return;

  const exercises = getInitialExercises();
  const now = new Date().toISOString();

  transact(db, (tx) => {
    for (const ex of exercises) {
      tx.executeSync(
        `INSERT OR IGNORE INTO ejercicios (id, nombre, grupo_muscular, patron, equipo, descripcion, video_uri, imagen_uri, es_compuesto, creado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ex.id,
          ex.nombre,
          ex.grupoMuscular,
          ex.patron,
          JSON.stringify(ex.equipo),
          ex.descripcion ?? null,
          ex.videoUri ?? null,
          ex.imagenUri ?? null,
          ex.esCompuesto ? 1 : 0,
          now,
        ]
      );
    }
  });
}

/** Re-siembra el catálogo base si la tabla `ejercicios` quedó vacía (tras limpiar/restaurar). */
export function ensureSeedData(): void {
  seedExercisesIfEmpty(getDatabase());
}

function safeRollback(db: DB) {
  try {
    db.executeSync('ROLLBACK;');
  } catch {
    // No había transacción activa (SQLite ya la revirtió).
  }
}

function getInitialExercises(): Ejercicio[] {
  const now = new Date().toISOString();
  return [
    // PECHO
    { id: 'ex-1', nombre: 'Press de banca con barra', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['barra'], descripcion: 'Ejercicio compuesto fundamental para pecho', esCompuesto: true, creadoEn: now },
    { id: 'ex-2', nombre: 'Press de banca con mancuernas', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Mayor rango de movimiento que con barra', esCompuesto: true, creadoEn: now },
    { id: 'ex-3', nombre: 'Press inclinado con mancuernas', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Enfasis en porción clavicular', esCompuesto: true, creadoEn: now },
    { id: 'ex-4', nombre: 'Press declinado con mancuernas', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Enfasis en porción esternal', esCompuesto: true, creadoEn: now },
    { id: 'ex-5', nombre: 'Aperturas con mancuernas', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Aislamiento de pecho', esCompuesto: false, creadoEn: now },
    { id: 'ex-6', nombre: 'Cruces en polea (cable crossover)', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['polea'], descripcion: 'Tensión constante durante todo el rango', esCompuesto: false, creadoEn: now },
    { id: 'ex-7', nombre: 'Press en máquina (machine press)', grupoMuscular: 'pecho', patron: 'empuje_horizontal', equipo: ['maquina'], descripcion: 'Estabilidad fija, buena para hipertrofia', esCompuesto: true, creadoEn: now },
    { id: 'ex-8', nombre: 'Fondos en paralelas (dips)', grupoMuscular: 'pecho', patron: 'empuje_vertical', equipo: ['peso_corporal'], descripcion: 'Enfasis en pecho inferior y tríceps', esCompuesto: true, creadoEn: now },

    // ESPALDA
    { id: 'ex-9', nombre: 'Dominadas (pull-ups)', grupoMuscular: 'espalda', patron: 'traccion_vertical', equipo: ['peso_corporal'], descripcion: 'Rey de ejercicios para dorsal ancho', esCompuesto: true, creadoEn: now },
    { id: 'ex-10', nombre: 'Jalón al pecho (lat pulldown)', grupoMuscular: 'espalda', patron: 'traccion_vertical', equipo: ['polea'], descripcion: 'Alternativa accesible a dominadas', esCompuesto: true, creadoEn: now },
    { id: 'ex-11', nombre: 'Remo con barra (barbell row)', grupoMuscular: 'espalda', patron: 'traccion_horizontal', equipo: ['barra'], descripcion: 'Grosor de espalda, dorsal y romboides', esCompuesto: true, creadoEn: now },
    { id: 'ex-12', nombre: 'Remo con mancuerna a una mano', grupoMuscular: 'espalda', patron: 'traccion_horizontal', equipo: ['mancuernas'], descripcion: 'Corrige desequilibrios, mayor rango', esCompuesto: true, creadoEn: now },
    { id: 'ex-13', nombre: 'Remo en máquina (seated row)', grupoMuscular: 'espalda', patron: 'traccion_horizontal', equipo: ['maquina'], descripcion: 'Estabilidad, foco en contracción', esCompuesto: true, creadoEn: now },
    { id: 'ex-14', nombre: 'Remo en polea baja (cable row)', grupoMuscular: 'espalda', patron: 'traccion_horizontal', equipo: ['polea'], descripcion: 'Tensión constante', esCompuesto: true, creadoEn: now },
    { id: 'ex-15', nombre: 'Pull-over con mancuerna', grupoMuscular: 'espalda', patron: 'traccion_vertical', equipo: ['mancuernas'], descripcion: 'Expansión torácica + dorsal', esCompuesto: false, creadoEn: now },
    { id: 'ex-16', nombre: 'Face pulls', grupoMuscular: 'espalda', patron: 'traccion_horizontal', equipo: ['polea'], descripcion: 'Romboides, rear delt, rotadores externos', esCompuesto: false, creadoEn: now },
    { id: 'ex-17', nombre: 'Peso muerto (deadlift)', grupoMuscular: 'espalda', patron: 'hip_dominant', equipo: ['barra'], descripcion: 'Posterior completo, erectores, trapecio', esCompuesto: true, creadoEn: now },

    // HOMBROS
    { id: 'ex-18', nombre: 'Press militar (overhead press)', grupoMuscular: 'hombros', patron: 'empuje_vertical', equipo: ['barra'], descripcion: 'Deltoides anterior + lateral + tríceps', esCompuesto: true, creadoEn: now },
    { id: 'ex-19', nombre: 'Press militar con mancuernas', grupoMuscular: 'hombros', patron: 'empuje_vertical', equipo: ['mancuernas'], descripcion: 'Mayor rango, corrige asimetrías', esCompuesto: true, creadoEn: now },
    { id: 'ex-20', nombre: 'Press Arnold', grupoMuscular: 'hombros', patron: 'empuje_vertical', equipo: ['mancuernas'], descripcion: 'Rotación + press, 3 cabezas deltoides', esCompuesto: true, creadoEn: now },
    { id: 'ex-21', nombre: 'Elevaciones laterales', grupoMuscular: 'hombros', patron: 'empuje_vertical', equipo: ['mancuernas'], descripcion: 'Aislamiento deltoides lateral', esCompuesto: false, creadoEn: now },
    { id: 'ex-22', nombre: 'Elevaciones frontales', grupoMuscular: 'hombros', patron: 'empuje_vertical', equipo: ['mancuernas'], descripcion: 'Aislamiento deltoides anterior', esCompuesto: false, creadoEn: now },
    { id: 'ex-23', nombre: 'Elevaciones posteriores (rear delt fly)', grupoMuscular: 'hombros', patron: 'traccion_horizontal', equipo: ['mancuernas'], descripcion: 'Deltoides posterior', esCompuesto: false, creadoEn: now },
    { id: 'ex-24', nombre: 'Encogimientos (shrugs)', grupoMuscular: 'trapecio', patron: 'carry', equipo: ['mancuernas', 'barra'], descripcion: 'Trapecio superior', esCompuesto: false, creadoEn: now },

    // BÍCEPS
    { id: 'ex-26', nombre: 'Curl con barra', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['barra'], descripcion: 'Masa general bíceps', esCompuesto: false, creadoEn: now },
    { id: 'ex-27', nombre: 'Curl con mancuernas (supinación)', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Supinación activa, pico bíceps', esCompuesto: false, creadoEn: now },
    { id: 'ex-28', nombre: 'Curl martillo (hammer curl)', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Braquial + braquiorradial', esCompuesto: false, creadoEn: now },
    { id: 'ex-29', nombre: 'Curl en polea baja', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['polea'], descripcion: 'Tensión constante', esCompuesto: false, creadoEn: now },
    { id: 'ex-30', nombre: 'Curl concentrado', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Aislamiento máximo, pico', esCompuesto: false, creadoEn: now },
    { id: 'ex-31', nombre: 'Curl en banco inclinado', grupoMuscular: 'biceps', patron: 'empuje_horizontal', equipo: ['mancuernas'], descripcion: 'Estiramiento máximo cabeza larga', esCompuesto: false, creadoEn: now },

    // TRÍCEPS
    { id: 'ex-32', nombre: 'Press francés (skull crushers)', grupoMuscular: 'triceps', patron: 'empuje_horizontal', equipo: ['barra', 'mancuernas'], descripcion: 'Cabeza larga tríceps', esCompuesto: false, creadoEn: now },
    { id: 'ex-33', nombre: 'Extensiones en polea (pushdown)', grupoMuscular: 'triceps', patron: 'empuje_horizontal', equipo: ['polea'], descripcion: 'Todas las cabezas, tensión constante', esCompuesto: false, creadoEn: now },
    { id: 'ex-34', nombre: 'Extensiones overhead con mancuerna', grupoMuscular: 'triceps', patron: 'empuje_vertical', equipo: ['mancuernas'], descripcion: 'Énfasis cabeza larga', esCompuesto: false, creadoEn: now },
    { id: 'ex-35', nombre: 'Fondos en banco (bench dips)', grupoMuscular: 'triceps', patron: 'empuje_horizontal', equipo: ['peso_corporal'], descripcion: 'Accesible, buena carga', esCompuesto: true, creadoEn: now },
    { id: 'ex-36', nombre: 'Press JM (JM press)', grupoMuscular: 'triceps', patron: 'empuje_horizontal', equipo: ['barra'], descripcion: 'Híbrido press + extensión', esCompuesto: true, creadoEn: now },
    { id: 'ex-37', nombre: 'Kickbacks en polea', grupoMuscular: 'triceps', patron: 'empuje_horizontal', equipo: ['polea'], descripcion: 'Contracción pico', esCompuesto: false, creadoEn: now },

    // PIERNA - CUÁDRICEPS
    { id: 'ex-38', nombre: 'Sentadilla libre (back squat)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['barra'], descripcion: 'Rey de piernas, cuerpo completo', esCompuesto: true, creadoEn: now },
    { id: 'ex-39', nombre: 'Sentadilla frontal (front squat)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['barra'], descripcion: 'Más cuádriceps, menos lumbar', esCompuesto: true, creadoEn: now },
    { id: 'ex-40', nombre: 'Sentadilla búlgara (bulgarian split squat)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['mancuernas'], descripcion: 'Unilateral, corrige asimetrías', esCompuesto: true, creadoEn: now },
    { id: 'ex-41', nombre: 'Prensa de piernas (leg press)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Carga alta sin fatiga axial', esCompuesto: true, creadoEn: now },
    { id: 'ex-42', nombre: 'Extensiones de cuádriceps (leg extension)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Aislamiento puro cuádriceps', esCompuesto: false, creadoEn: now },
    { id: 'ex-43', nombre: 'Zancadas (lunges)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['mancuernas', 'peso_corporal'], descripcion: 'Unilateral, funcional', esCompuesto: true, creadoEn: now },
    { id: 'ex-44', nombre: 'Step-ups', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['mancuernas'], descripcion: 'Unilateral, patrón escalada', esCompuesto: true, creadoEn: now },
    { id: 'ex-45', nombre: 'Sentadilla hack (hack squat)', grupoMuscular: 'cuadriceps', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Ángulo fijo, foco cuádriceps', esCompuesto: true, creadoEn: now },

    // PIERNA - ISQUIOS / GLÚTEOS
    { id: 'ex-46', nombre: 'Peso muerto rumano (RDL)', grupoMuscular: 'isquios', patron: 'hip_dominant', equipo: ['barra', 'mancuernas'], descripcion: 'Isquios + glúteos, patrón bisagra', esCompuesto: true, creadoEn: now },
    { id: 'ex-47', nombre: 'Peso muerto rumano a una pierna', grupoMuscular: 'isquios', patron: 'hip_dominant', equipo: ['mancuernas'], descripcion: 'Unilateral, equilibrio', esCompuesto: true, creadoEn: now },
    { id: 'ex-48', nombre: 'Curl femoral tumbado (lying leg curl)', grupoMuscular: 'isquios', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Aislamiento isquios rodilla', esCompuesto: false, creadoEn: now },
    { id: 'ex-49', nombre: 'Curl femoral sentado (seated leg curl)', grupoMuscular: 'isquios', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Isquios en longitud larga', esCompuesto: false, creadoEn: now },
    { id: 'ex-50', nombre: 'Hip thrust', grupoMuscular: 'gluteos', patron: 'hip_dominant', equipo: ['barra'], descripcion: 'Máxima activación glúteo', esCompuesto: true, creadoEn: now },
    { id: 'ex-51', nombre: 'Glute bridge', grupoMuscular: 'gluteos', patron: 'hip_dominant', equipo: ['peso_corporal', 'barra'], descripcion: 'Activación glúteo, menos ROM', esCompuesto: false, creadoEn: now },
    { id: 'ex-52', nombre: 'Patada de glúteo en polea (cable kickback)', grupoMuscular: 'gluteos', patron: 'hip_dominant', equipo: ['polea'], descripcion: 'Aislamiento glúteo', esCompuesto: false, creadoEn: now },
    { id: 'ex-53', nombre: 'Abducción de cadera (machine abduction)', grupoMuscular: 'gluteos', patron: 'hip_dominant', equipo: ['maquina'], descripcion: 'Glúteo medio', esCompuesto: false, creadoEn: now },
    { id: 'ex-54', nombre: 'Good mornings', grupoMuscular: 'isquios', patron: 'hip_dominant', equipo: ['barra'], descripcion: 'Isquios + lumbares', esCompuesto: true, creadoEn: now },
    { id: 'ex-55', nombre: 'Nordic curl', grupoMuscular: 'isquios', patron: 'knee_dominant', equipo: ['peso_corporal'], descripcion: 'Excéntrico intenso isquios', esCompuesto: false, creadoEn: now },

    // PANTORRILLAS
    { id: 'ex-56', nombre: 'Elevación de talones de pie (standing calf raise)', grupoMuscular: 'pantorrillas', patron: 'knee_dominant', equipo: ['maquina', 'mancuernas', 'peso_corporal'], descripcion: 'Gastrocnemio (rodilla extendida)', esCompuesto: false, creadoEn: now },
    { id: 'ex-57', nombre: 'Elevación de talones sentado (seated calf raise)', grupoMuscular: 'pantorrillas', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Soleo (rodilla flexionada)', esCompuesto: false, creadoEn: now },
    { id: 'ex-58', nombre: 'Elevación de talones en prensa', grupoMuscular: 'pantorrillas', patron: 'knee_dominant', equipo: ['maquina'], descripcion: 'Carga alta, gastrocnemio', esCompuesto: false, creadoEn: now },
    { id: 'ex-59', nombre: 'Saltos a la comba', grupoMuscular: 'pantorrillas', patron: 'knee_dominant', equipo: ['peso_corporal'], descripcion: 'Pliometría, reactividad', esCompuesto: false, creadoEn: now },

    // ABDOMINALES / CORE
    { id: 'ex-60', nombre: 'Plancha (plank)', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Anti-extensión, estabilidad', esCompuesto: false, creadoEn: now },
    { id: 'ex-61', nombre: 'Plancha lateral (side plank)', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Oblicuos, anti-flexión lateral', esCompuesto: false, creadoEn: now },
    { id: 'ex-62', nombre: 'Crunch abdominal', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Recto abdominal, flexión', esCompuesto: false, creadoEn: now },
    { id: 'ex-63', nombre: 'Elevación de piernas colgado (hanging leg raise)', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Recto abdominal inferior', esCompuesto: false, creadoEn: now },
    { id: 'ex-64', nombre: 'Ab wheel rollout', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['otro'], descripcion: 'Anti-extensión avanzada', esCompuesto: false, creadoEn: now },
    { id: 'ex-65', nombre: 'Pallof press', grupoMuscular: 'abdominales', patron: 'core_rotacion', equipo: ['polea', 'bandas'], descripcion: 'Anti-rotación', esCompuesto: false, creadoEn: now },
    { id: 'ex-66', nombre: 'Russian twist', grupoMuscular: 'abdominales', patron: 'core_rotacion', equipo: ['mancuernas', 'peso_corporal'], descripcion: 'Rotación controlada', esCompuesto: false, creadoEn: now },
    { id: 'ex-67', nombre: 'Dead bug', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Estabilidad lumbo-pélvica', esCompuesto: false, creadoEn: now },
    { id: 'ex-68', nombre: 'Bird dog', grupoMuscular: 'abdominales', patron: 'core_anti_extension', equipo: ['peso_corporal'], descripcion: 'Contralateral, estabilidad', esCompuesto: false, creadoEn: now },

    // ANTEBRAZOS
    { id: 'ex-69', nombre: 'Curl de muñeca (wrist curl)', grupoMuscular: 'antebrazos', patron: 'empuje_horizontal', equipo: ['mancuernas', 'barra'], descripcion: 'Flexores muñeca', esCompuesto: false, creadoEn: now },
    { id: 'ex-70', nombre: 'Curl de muñeca inverso (reverse wrist curl)', grupoMuscular: 'antebrazos', patron: 'empuje_horizontal', equipo: ['mancuernas', 'barra'], descripcion: 'Extensores muñeca', esCompuesto: false, creadoEn: now },
    { id: 'ex-71', nombre: 'Farmer walk', grupoMuscular: 'antebrazos', patron: 'carry', equipo: ['mancuernas', 'kettlebell'], descripcion: 'Agarre + core + trapecio', esCompuesto: true, creadoEn: now },
    { id: 'ex-72', nombre: 'Pinzas de agarre (grippers)', grupoMuscular: 'antebrazos', patron: 'carry', equipo: ['otro'], descripcion: 'Fuerza de agarre pura', esCompuesto: false, creadoEn: now },

    // LUMBARES
    { id: 'ex-73', nombre: 'Hiperextensiones (back extension)', grupoMuscular: 'lumbares', patron: 'hip_dominant', equipo: ['maquina', 'peso_corporal'], descripcion: 'Erectores espinales', esCompuesto: false, creadoEn: now },
    { id: 'ex-74', nombre: 'Superman', grupoMuscular: 'lumbares', patron: 'hip_dominant', equipo: ['peso_corporal'], descripcion: 'Extensión lumbar suelo', esCompuesto: false, creadoEn: now },
    { id: 'ex-75', nombre: 'Good mornings (repetido para lumbares)', grupoMuscular: 'lumbares', patron: 'hip_dominant', equipo: ['barra'], descripcion: 'Erectores + isquios', esCompuesto: true, creadoEn: now },
  ];
}

// Transaction helper
let txDepth = 0;

function transact<T>(db: DB, fn: (db: DB) => T): T {
  // SQLite no admite BEGIN anidado: las llamadas internas se suman a la transacción externa.
  if (txDepth > 0) return fn(db);
  db.executeSync('BEGIN TRANSACTION;');
  txDepth++;
  try {
    const result = fn(db);
    db.executeSync('COMMIT;');
    return result;
  } catch (error) {
    safeRollback(db);
    throw error;
  } finally {
    txDepth--;
  }
}

export function runTransaction<T>(fn: (db: DB) => T): T {
  return transact(getDatabase(), fn);
}

// Query helpers
export function queryOne<T>(sql: string, params: unknown[] = []): T | null {
  const db = getDatabase();
  const result = db.executeSync(sql, params as any);
  return result.rows.length > 0 ? (result.rows[0] as T) : null;
}

export function queryAll<T>(sql: string, params: unknown[] = []): T[] {
  const db = getDatabase();
  const result = db.executeSync(sql, params as any);
  return result.rows as T[];
}

export function executeSync(sql: string, params: unknown[] = []): { changes: number; lastInsertRowId: string | number } {
  const db = getDatabase();
  const result = db.executeSync(sql, params as any);
  return { changes: result.rowsAffected, lastInsertRowId: result.insertId ?? 0 };
}

export function execSync(sql: string): void {
  const db = getDatabase();
  db.executeSync(sql);
}

// ============================================
// Lecturas de dominio (SQLite es la fuente de verdad)
// ============================================
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const numOrUndef = (v: unknown): number | undefined =>
  v === null || v === undefined || v === '' ? undefined : Number(v);

const EMPTY_FOTOS = { frontal: '', lateral: '', posterior: '' };

function filaAFicha(r: any): FichaInicial {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    fecha: r.fecha,
    peso: Number(r.peso),
    grasaCorporal: numOrUndef(r.grasa_corporal),
    musculatura: numOrUndef(r.musculatura),
    perimetros: parseJson(r.perimetros, {} as FichaInicial['perimetros']),
    pliegues: parseJson<Record<string, number> | undefined>(r.pliegues, undefined),
    fotos: parseJson(r.fotos, EMPTY_FOTOS),
    observaciones: r.observaciones ?? '',
    lesionLimitaciones: r.lesion_limitaciones ?? '',
    creadoEn: r.creado_en,
  };
}

function filaACheckin(r: any): CheckinSemanal {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    semana: Number(r.semana),
    fecha: r.fecha,
    peso: Number(r.peso),
    grasaCorporal: numOrUndef(r.grasa_corporal),
    musculatura: numOrUndef(r.musculatura),
    perimetros: parseJson(r.perimetros, {} as CheckinSemanal['perimetros']),
    fotos: parseJson(r.fotos, EMPTY_FOTOS),
    energia: Number(r.energia) as CheckinSemanal['energia'],
    sueno: Number(r.sueno) as CheckinSemanal['sueno'],
    estres: Number(r.estres) as CheckinSemanal['estres'],
    adherencia: Number(r.adherencia) as CheckinSemanal['adherencia'],
    notas: r.notas ?? '',
    creadoEn: r.creado_en,
  };
}

function filaAEntrenamiento(r: any): EntrenamientoRealizado {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    rutinaSemanalId: r.rutina_semanal_id,
    diaRutinaId: r.dia_rutina_id,
    fecha: r.fecha,
    duracionMin: Number(r.duracion_min),
    ejercicios: parseJson(r.ejercicios, [] as EntrenamientoRealizado['ejercicios']),
    rpeGlobal: numOrUndef(r.rpe_global) as EntrenamientoRealizado['rpeGlobal'],
    notas: r.notas ?? '',
  };
}

/** Ficha inicial más reciente del cliente, o null si no tiene. */
export function leerFichaInicial(clienteId: string): FichaInicial | null {
  try {
    const r = getDatabase().executeSync(
      'SELECT * FROM fichas_iniciales WHERE cliente_id = ? ORDER BY fecha DESC, creado_en DESC LIMIT 1',
      [clienteId]
    ).rows[0];
    return r ? filaAFicha(r) : null;
  } catch (error) {
    console.error('[db] error al leer ficha inicial:', error);
    return null;
  }
}

/** Check-ins del cliente ordenados por semana ascendente (el último es el más reciente). */
export function leerCheckins(clienteId: string): CheckinSemanal[] {
  try {
    const rows = getDatabase().executeSync(
      'SELECT * FROM checkins_semanales WHERE cliente_id = ? ORDER BY semana ASC, fecha ASC',
      [clienteId]
    ).rows;
    return rows.map(filaACheckin);
  } catch (error) {
    console.error('[db] error al leer check-ins:', error);
    return [];
  }
}

/** Entrenamientos registrados del cliente, del más reciente al más antiguo. */
export function leerEntrenamientos(clienteId: string): EntrenamientoRealizado[] {
  try {
    const rows = getDatabase().executeSync(
      'SELECT * FROM entrenamientos_realizados WHERE cliente_id = ? ORDER BY fecha DESC',
      [clienteId]
    ).rows;
    return rows.map(filaAEntrenamiento);
  } catch (error) {
    console.error('[db] error al leer entrenamientos:', error);
    return [];
  }
}