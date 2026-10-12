/**
 * Descarga las fotos "inicio" y "final" de cada ejercicio del catálogo desde
 * free-exercise-db (dominio público) y las deja comprimidas dentro de la app,
 * para que se vean sin conexión en el gimnasio.
 *
 * Uso (sharp se instala fuera del proyecto para no sumarlo a las dependencias):
 *   npm i --prefix "%TEMP%\kf-img" sharp@0.34
 *   set SHARP_MODULE=%TEMP%\kf-img\node_modules\sharp
 *   node scripts/fetch-exercise-images.mjs
 *
 * Salida: assets/ejercicios/<id>-0.webp, <id>-1.webp y el módulo generado
 * src/constants/ejercicioImagenes.ts (require estáticos para Metro).
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const sharp = require(process.env.SHARP_MODULE ?? 'sharp');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'assets', 'ejercicios');
const OUT_TS = join(ROOT, 'src', 'constants', 'ejercicioImagenes.ts');
const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const ANCHO = 480;

/** id del catálogo (database.ts) -> carpeta en free-exercise-db. Sin equivalente: bird dog (ex-68) y grippers (ex-72). */
const MAPA = {
  'ex-1': 'Barbell_Bench_Press_-_Medium_Grip',
  'ex-2': 'Dumbbell_Bench_Press',
  'ex-3': 'Incline_Dumbbell_Press',
  'ex-4': 'Decline_Dumbbell_Bench_Press',
  'ex-5': 'Dumbbell_Flyes',
  'ex-6': 'Cable_Crossover',
  'ex-7': 'Leverage_Chest_Press',
  'ex-8': 'Dips_-_Chest_Version',
  'ex-9': 'Pullups',
  'ex-10': 'Wide-Grip_Lat_Pulldown',
  'ex-11': 'Bent_Over_Barbell_Row',
  'ex-12': 'One-Arm_Dumbbell_Row',
  'ex-13': 'Leverage_Iso_Row',
  'ex-14': 'Seated_Cable_Rows',
  'ex-15': 'Straight-Arm_Dumbbell_Pullover',
  'ex-16': 'Face_Pull',
  'ex-17': 'Barbell_Deadlift',
  'ex-18': 'Standing_Military_Press',
  'ex-19': 'Dumbbell_Shoulder_Press',
  'ex-20': 'Arnold_Dumbbell_Press',
  'ex-21': 'Side_Lateral_Raise',
  'ex-22': 'Front_Dumbbell_Raise',
  'ex-23': 'Reverse_Flyes',
  'ex-24': 'Dumbbell_Shrug',
  'ex-26': 'Barbell_Curl',
  'ex-27': 'Dumbbell_Bicep_Curl',
  'ex-28': 'Hammer_Curls',
  'ex-29': 'Standing_Biceps_Cable_Curl',
  'ex-30': 'Concentration_Curls',
  'ex-31': 'Incline_Dumbbell_Curl',
  'ex-32': 'EZ-Bar_Skullcrusher',
  'ex-33': 'Triceps_Pushdown',
  'ex-34': 'Standing_Dumbbell_Triceps_Extension',
  'ex-35': 'Bench_Dips',
  'ex-36': 'JM_Press',
  'ex-37': 'Tricep_Dumbbell_Kickback',
  'ex-38': 'Barbell_Squat',
  'ex-39': 'Front_Barbell_Squat',
  'ex-40': 'Split_Squat_with_Dumbbells',
  'ex-41': 'Leg_Press',
  'ex-42': 'Leg_Extensions',
  'ex-43': 'Dumbbell_Lunges',
  'ex-44': 'Dumbbell_Step_Ups',
  'ex-45': 'Hack_Squat',
  'ex-46': 'Romanian_Deadlift',
  'ex-47': 'Kettlebell_One-Legged_Deadlift',
  'ex-48': 'Lying_Leg_Curls',
  'ex-49': 'Seated_Leg_Curl',
  'ex-50': 'Barbell_Hip_Thrust',
  'ex-51': 'Butt_Lift_Bridge',
  'ex-52': 'One-Legged_Cable_Kickback',
  'ex-53': 'Thigh_Abductor',
  'ex-54': 'Good_Morning',
  'ex-55': 'Natural_Glute_Ham_Raise',
  'ex-56': 'Standing_Calf_Raises',
  'ex-57': 'Seated_Calf_Raise',
  'ex-58': 'Calf_Press_On_The_Leg_Press_Machine',
  'ex-59': 'Rope_Jumping',
  'ex-60': 'Plank',
  'ex-61': 'Side_Bridge',
  'ex-62': 'Crunches',
  'ex-63': 'Hanging_Leg_Raise',
  'ex-64': 'Ab_Roller',
  'ex-65': 'Pallof_Press',
  'ex-66': 'Russian_Twist',
  'ex-67': 'Dead_Bug',
  'ex-69': 'Seated_Dumbbell_Palms-Up_Wrist_Curl',
  'ex-70': 'Seated_Dumbbell_Palms-Down_Wrist_Curl',
  'ex-71': 'Farmers_Walk',
  'ex-73': 'Hyperextensions_Back_Extensions',
  'ex-74': 'Superman',
  'ex-75': 'Good_Morning',
};

async function descargar(carpeta, n) {
  const res = await fetch(`${BASE}/${carpeta}/${n}.jpg`);
  if (!res.ok) throw new Error(`${carpeta}/${n}.jpg -> HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(OUT_DIR)) unlinkSync(join(OUT_DIR, f));

let bytes = 0;
const ids = Object.keys(MAPA);
for (const id of ids) {
  for (const n of [0, 1]) {
    const destino = join(OUT_DIR, `${id}-${n}.webp`);
    const info = await sharp(await descargar(MAPA[id], n))
      .resize({ width: ANCHO, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(destino);
    bytes += info.size;
  }
  process.stdout.write('.');
}

const lineas = ids.map(
  (id) =>
    `  '${id}': [require('../../assets/ejercicios/${id}-0.webp'), require('../../assets/ejercicios/${id}-1.webp')],`
);
writeFileSync(
  OUT_TS,
  `/**
 * Fotos "inicio" y "final" de los ejercicios del catálogo base.
 * Generado por scripts/fetch-exercise-images.mjs — no editar a mano.
 * Fuente: free-exercise-db (https://github.com/yuhonas/free-exercise-db), dominio público.
 */

export const IMAGENES_EJERCICIO: Record<string, readonly [number, number]> = {
${lineas.join('\n')}
};
`
);

console.log(`\n${ids.length} ejercicios, ${(bytes / 1024 / 1024).toFixed(2)} MB en assets/ejercicios`);
if (!existsSync(OUT_TS)) process.exit(1);
