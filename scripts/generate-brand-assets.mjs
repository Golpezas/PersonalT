/**
 * Genera los assets de marca KaizenFit desde un único isotipo vectorial:
 * mancuerna naranja cruzada por una flecha de crecimiento amarilla, dentro de un aro.
 *
 * Uso (resvg se instala fuera del proyecto para no sumarlo a las dependencias):
 *   npm i --prefix "%TEMP%\kf-brand" @resvg/resvg-js@2
 *   set RESVG_MODULE=%TEMP%\kf-brand\node_modules\@resvg\resvg-js
 *   node scripts/generate-brand-assets.mjs
 *
 * Salida en assets/: icon.png (iOS y fallback), android-icon-*.png (adaptive),
 * splash-icon.png, favicon.png y assets/brand/ (isotipo para la UI + SVG fuente).
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Resvg } = require(process.env.RESVG_MODULE ?? '@resvg/resvg-js');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'assets');

const BRAND = {
  backgroundDark: '#111111',
  primaryOrange: '#FF6B00',
  accentYellow: '#FFC700',
  textWhite: '#FFFFFF',
};

// ------------------------------------------------------------------ geometría
// Isotipo en un lienzo de 1000×1000 centrado en (500, 500).
const C = 500;
const R = 400;
const RING = 58;

const punto = (grados, r = R) => {
  const a = (grados * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

/** Arco en sentido horario (ángulos SVG: 0° = derecha, 90° = abajo). */
const arco = (desde, hasta) => {
  const [x1, y1] = punto(desde);
  const [x2, y2] = punto(hasta);
  const grande = (hasta - desde + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 ${grande} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

// Mancuerna horizontal, levemente sobre el centro (los quiebres de la flecha van debajo).
const Y = 480;
const placa = (x, ancho, alto, rx) =>
  `<rect x="${x}" y="${Y - alto / 2}" width="${ancho}" height="${alto}" rx="${rx}"/>`;
const mancuerna = [
  placa(200, 34, 70, 12), //   tope izquierdo
  placa(240, 46, 170, 16), //  disco chico
  placa(292, 62, 260, 20), //  disco grande
  `<rect x="354" y="${Y - 19}" width="292" height="38" rx="8"/>`, // barra
  placa(646, 62, 260, 20),
  placa(714, 46, 170, 16),
  placa(766, 34, 70, 12),
].join('');

// Flecha en zigzag ascendente que sale del aro por arriba a la derecha.
const TRAZO = 54;
const punta = [842, 232];
const desdeUltimoQuiebre = [485, 705];
const dx = punta[0] - desdeUltimoQuiebre[0];
const dy = punta[1] - desdeUltimoQuiebre[1];
const largo = Math.hypot(dx, dy);
const u = [dx / largo, dy / largo];
const p = [-u[1], u[0]];
const LARGO_PUNTA = 150;
const MEDIO_ANCHO = 92;
const base = [punta[0] - LARGO_PUNTA * u[0], punta[1] - LARGO_PUNTA * u[1]];
const cabeza = [
  punta,
  [base[0] + MEDIO_ANCHO * p[0], base[1] + MEDIO_ANCHO * p[1]],
  [base[0] - MEDIO_ANCHO * p[0], base[1] - MEDIO_ANCHO * p[1]],
]
  .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
  .join(' ');
const finTrazo = [base[0] + 12 * u[0], base[1] + 12 * u[1]];
const zigzag = `M 230 800 L 395 640 L ${desdeUltimoQuiebre.join(' ')} L ${finTrazo[0].toFixed(1)} ${finTrazo[1].toFixed(1)}`;

/** `extra` engrosa la flecha para la máscara de corte; ahí las uniones van redondeadas para no dejar picos. */
const flecha = (color, extra = 0) =>
  `<path d="${zigzag}" fill="none" stroke="${color}" stroke-width="${TRAZO + extra}" stroke-linejoin="${extra ? 'round' : 'miter'}" stroke-miterlimit="4" stroke-linecap="butt"/>` +
  `<polygon points="${cabeza}" fill="${color}" stroke="${color}" stroke-width="${extra}" stroke-linejoin="round"/>`;

/**
 * Isotipo. `mono` pinta todo de un color (ícono temático de Android 13+).
 * La flecha "corta" la mancuerna y el aro con una máscara, así el cruce se ve
 * sobre cualquier fondo (incluso transparente).
 */
function isotipo({ mono } = {}) {
  const naranja = mono ?? BRAND.primaryOrange;
  const amarillo = mono ?? BRAND.accentYellow;
  return `
    <defs>
      <mask id="corte" maskUnits="userSpaceOnUse" x="0" y="0" width="1000" height="1000">
        <rect width="1000" height="1000" fill="#fff"/>
        ${flecha('#000', 30)}
      </mask>
    </defs>
    <g mask="url(#corte)">
      <path d="${arco(32, 292)}" fill="none" stroke="${naranja}" stroke-width="${RING}" stroke-linecap="round"/>
      <path d="${arco(-14, 18)}" fill="none" stroke="${amarillo}" stroke-width="${RING}" stroke-linecap="round"/>
      <g fill="${naranja}">${mancuerna}</g>
    </g>
    ${flecha(amarillo)}`;
}

/** Lienzo cuadrado con el isotipo escalado al `escala` del lado y centrado. */
function lienzo(lado, { escala, fondo, mono } = {}) {
  const s = (lado * escala) / 1000;
  const off = (lado - 1000 * s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}">
    ${fondo ? `<rect width="${lado}" height="${lado}" fill="${fondo}"/>` : ''}
    <g transform="translate(${off} ${off}) scale(${s})">${isotipo({ mono })}</g>
  </svg>`;
}

function logoHorizontal() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1580" height="420" viewBox="0 0 1580 420">
    <rect width="1580" height="420" fill="${BRAND.backgroundDark}"/>
    <g transform="translate(40 30) scale(0.36)">${isotipo()}</g>
    <text x="440" y="275" font-family="Poppins" font-weight="700" font-size="200" letter-spacing="-4">
      <tspan fill="${BRAND.primaryOrange}">Kaizen</tspan><tspan fill="${BRAND.accentYellow}">Fit</tspan>
    </text>
  </svg>`;
}

function png(svg, archivo) {
  const ruta = join(ASSETS, archivo);
  mkdirSync(dirname(ruta), { recursive: true });
  const render = new Resvg(svg, {
    font: { fontFiles: [join(ASSETS, 'fonts', 'Poppins-Bold.ttf')], loadSystemFonts: false },
  }).render();
  writeFileSync(ruta, render.asPng());
  console.log(`  ${archivo} (${render.width}×${render.height})`);
}

console.log('Generando assets KaizenFit:');
// iOS (1024, sin transparencia) y fallback de Android sin adaptive icon.
png(lienzo(1024, { escala: 0.74, fondo: BRAND.backgroundDark }), 'icon.png');
// Adaptive icon: el sistema recorta ~1/3 del borde; el isotipo queda dentro de la zona segura.
png(lienzo(1024, { escala: 0.56 }), 'android-icon-foreground.png');
png(lienzo(1024, { escala: 0.56, mono: '#FFFFFF' }), 'android-icon-monochrome.png');
// Splash: Android 12+ lo muestra dentro de un círculo, por eso solo el isotipo.
png(lienzo(1024, { escala: 0.8 }), 'splash-icon.png');
png(lienzo(48, { escala: 0.86, fondo: BRAND.backgroundDark }), 'favicon.png');
// UI: isotipo transparente para el logo horizontal (texto con Poppins en RN).
png(lienzo(512, { escala: 1 }), 'brand/isotipo.png');
png(logoHorizontal(), 'brand/logo-horizontal.png');

writeFileSync(join(ASSETS, 'brand', 'isotipo.svg'), lienzo(1000, { escala: 1 }));
writeFileSync(join(ASSETS, 'brand', 'logo-horizontal.svg'), logoHorizontal());
console.log('  brand/isotipo.svg, brand/logo-horizontal.svg');
