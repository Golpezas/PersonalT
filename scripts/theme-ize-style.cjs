/**
 * theme-ize-style.cjs — convierte los colores hardcodeados de un `StyleSheet`
 * en design tokens de `useTheme()`.
 *
 * Por que: los stylesheets traian la paleta clara fija, asi que ninguna pantalla
 * respetaba el modo oscuro. Con tokens hay un solo lugar que decide el color.
 *
 * Uso:  node scripts/theme-ize-style.cjs <archivo.tsx> [...]
 *
 * El script es IDEMPOTENTE: se puede volver a correr sobre un archivo ya
 * procesado. En la primera pasada convierte
 *   const styles = StyleSheet.create({ ... })
 * en
 *   const createStyles = (t: Theme) => StyleSheet.create({ ... })
 * mas `const t = useTheme()` + `const styles = useMemo(...)` en el componente.
 * En las siguientes solo rellena los colores que quedaran.
 *
 * Solo reemplaza literales que:
 *   - son el valor de una propiedad `*Color` / `color`
 *   - tienen un equivalente conocido en la paleta de tokens
 * Deja intactos los hex que no reconoce (por ejemplo `#0B1120` de un gradiente
 * propio) y los reporta en la salida.
 *
 * Ejecuta `npx tsc --noEmit` despues: si una pantalla usaba `styles` fuera del
 * componente, el typecheck lo marca.
 */

const fs = require('fs');

/**
 * Tokens por "clase" de color. La clase se deduce del nombre de la propiedad:
 *   backgroundColor -> surface | primarySoft | success | ...
 *   border*Color     -> border
 *   color           -> text
 *   shadowColor     -> shadow
 */
const PALETTE = {
  surface: {
    fff: 'surface',
    ffffff: 'surface',
    f8fafc: 'bg',
    f1f5f9: 'surfaceAlt',
    edf0f4: 'surfaceAlt',
    e0f2fe: 'primarySoft',
    f0f9ff: 'primarySoft',
    f0fdf4: 'successSoft',
    bae6fd: 'primarySoft',
    dbeafe: 'primarySoft',
    dcfce7: 'successSoft',
    fee2e2: 'dangerSoft',
    fef3c7: 'warningSoft',
    ede9fe: 'accentSoft',
    '0f172a': 'overlay',
    '0ea5e9': 'primary',
    '0284c7': 'primaryDark',
    '22c55e': 'success',
    '16a34a': 'success',
    '4ade80': 'success',
    'f59e0b': 'warning',
    fbbf24: 'warning',
    'ef4444': 'danger',
    'dc2626': 'danger',
    '8b5cf6': 'accent',
    'a78bfa': 'accent',
  },
  border: {
    fff: 'border',
    ffffff: 'border',
    e2e8f0: 'border',
    e7e9ee: 'border',
    f1f5f9: 'border',
    cbd5e1: 'borderStrong',
    bae6fd: 'primarySoft',
    dbeafe: 'primarySoft',
    '22c55e': 'success',
    'f59e0b': 'warning',
    'ef4444': 'danger',
    '0ea5e9': 'primary',
  },
  text: {
    '0f172a': 'text',
    '1e293b': 'text',
    '334155': 'text',
    fff: 'textInverse',
    ffffff: 'textInverse',
    '64748b': 'textMuted',
    '475569': 'textMuted',
    '94a3b8': 'textSubtle',
    cbd5e1: 'textSubtle',
    '0369a1': 'primaryDark',
    '0284c7': 'primaryDark',
    '075985': 'primaryDark',
    '0ea5e9': 'primary',
    '38bdf8': 'primary',
    '22c55e': 'success',
    '16a34a': 'success',
    '4ade80': 'success',
    'f59e0b': 'warning',
    fbbf24: 'warning',
    'ef4444': 'danger',
    'dc2626': 'danger',
    '8b5cf6': 'accent',
    'a78bfa': 'accent',
  },
  shadow: {
    '0f172a': 'shadow',
    '000000': 'shadow',
  },
};

/** rgba hardcodeados -> token (independiente de la propiedad). */
const RGBA_MAP = {
  'rgba(14,165,233,0.1)': 'primarySoft',
  'rgba(14,165,233,0.15)': 'primarySoft',
  'rgba(239,68,68,0.1)': 'dangerSoft',
  'rgba(239, 68, 68, 0.1)': 'dangerSoft',
  'rgba(34,197,94,0.1)': 'successSoft',
  'rgba(34, 197, 94, 0.1)': 'successSoft',
};

const DECL_PLAIN = 'const styles = StyleSheet.create({';
const DECL_PLAIN_NEW = 'const createStyles = (t: Theme) => StyleSheet.create(';
const DECL_DONE = 'const createStyles = (t: Theme) => StyleSheet.create(';

// PROPIEDADES: `color` a secas o cualquier `*Color` / `*color`.
const COLOR_PROP = /([a-zA-Z]*[Cc]olor)\s*:\s*(['"])(#[0-9a-fA-F]{3,8}|rgba\([^)]*\))\2/g;

/** De la propiedad al grupo de tokens. `null` = no tocar. */
function kindOf(prop) {
  if (prop === 'shadowColor') return 'shadow';
  if (/^border/i.test(prop)) return 'border';
  if (prop === 'color') return 'text';
  if (prop === 'backgroundColor') return 'surface';
  return null;
}

/** Devuelve el indice de la `}` que cierra el objeto que abre en `openIdx`. */
function matchBrace(src, openIdx) {
  let depth = 0;
  let i = openIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === quote) break;
        i++;
      }
      i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return -1;
}

function themeizeBlock(block) {
  const hits = {};
  const record = (token) => { hits[token] = (hits[token] || 0) + 1; };

  const out = block.replace(COLOR_PROP, (m, prop, q, value) => {
    const kind = kindOf(prop);
    if (!kind) return m;

    if (value.toLowerCase().startsWith('rgba')) {
      const token = RGBA_MAP[value.replace(/\s+/g, '').toLowerCase()];
      if (!token) return m;
      record(token);
      return `${prop}: t.colors.${token}`;
    }

    const token = PALETTE[kind][value.slice(1).toLowerCase()];
    if (!token) return m;
    record(token);
    return `${prop}: t.colors.${token}`;
  });

  return { out, hits };
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const report = [];
  const alreadyDone = src.includes(DECL_DONE);

  // -------------------------------------------------------- 1. stylesheet
  const declIdx = alreadyDone ? src.indexOf(DECL_DONE) : src.indexOf(DECL_PLAIN);
  if (declIdx === -1) {
    console.log(`SKIP  ${file} — no encontre el StyleSheet`);
    return;
  }
  const braceIdx = src.indexOf('{', declIdx);
  const closeIdx = matchBrace(src, braceIdx);
  if (closeIdx === -1) {
    console.log(`SKIP  ${file} — no pude emparejar llaves`);
    return;
  }

  const { out: newBlock, hits } = themeizeBlock(src.slice(braceIdx, closeIdx + 1));
  const head = alreadyDone ? DECL_DONE : DECL_PLAIN_NEW;
  src = src.slice(0, declIdx) + head + newBlock + src.slice(closeIdx + 1);

  const total = Object.values(hits).reduce((a, b) => a + b, 0);
  report.push(`  styles: ${total} colores -> tokens`);
  for (const [k, v] of Object.entries(hits).sort((a, b) => b[1] - a[1])) {
    report.push(`    ${v}x t.colors.${k}`);
  }
  const left = (newBlock.match(/#[0-9a-fA-F]{3,8}/g) || []).length;
  if (left) report.push(`    quedan ${left} hex sin mapear (revisar a mano)`);

  // -------------------------------------------------------- 2. imports
  if (!alreadyDone) {
    const additions = [];
    const reactImport = src.match(/import\s+(?:React,\s*)?\{([^}]*)\}\s+from 'react';/);
    if (reactImport) {
      if (!/\buseMemo\b/.test(reactImport[1])) {
        src = src.replace(reactImport[0], (full, names) =>
          full.replace(/\{([^}]*)\}/, (_m, n) => `{ ${n.trim()}, useMemo }`)
        );
      }
    } else {
      additions.push("import React, { useMemo } from 'react';");
    }
    if (!/from '@\/hooks\/useTheme'/.test(src)) {
      additions.push("import { useTheme } from '@/hooks/useTheme';");
    }
    if (!/type \{ Theme \}/.test(src)) {
      additions.push("import type { Theme } from '@/constants/theme';");
    }
    if (additions.length) {
      const lines = [...src.matchAll(/^import .*?;$/gm)];
      const last = lines[lines.length - 1];
      const at = last.index + last[0].length;
      src = src.slice(0, at) + '\n' + additions.join('\n') + src.slice(at);
      report.push(`  imports: +${additions.length}`);
    }

    // ------------------------------------------------ 3. dentro del componente
    // Si el archivo ya pide el tema (p. ej. una pantalla reescrita a mano que
    // solo tokeniza su JSX), no se vuelve a declarar `t`: se cuelga el memo de
    // styles de la PRIMERA llamada, que es la del componente exportado.
    const existingHook = src.match(/^[ \t]*const t = useTheme\(\);[ \t]*$/m);
    if (existingHook) {
      const at = existingHook.index + existingHook[0].length;
      src =
        src.slice(0, at) +
        `\n  const styles = useMemo(() => createStyles(t), [t]);` +
        src.slice(at);
      report.push('  componente: styles memo (reusando const t existente)');
    } else {
      // Acepta `export default function X` y `export function X` (MetaForm).
      const fnMatch = src.match(/export (?:default )?function\s+\w+\s*\([^)]*\)\s*\{/);
      if (!fnMatch) {
        console.log(`AVISO ${file} — no encontre el componente exportado; revisa a mano`);
        return;
      }
      const at = fnMatch.index + fnMatch[0].length;
      src =
        src.slice(0, at) +
        `\n  // Tokens de diseño + styles derivados del tema activo\n` +
        `  const t = useTheme();\n` +
        `  const styles = useMemo(() => createStyles(t), [t]);` +
        src.slice(at);
      report.push('  componente: const t + styles memo');
    }
  }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`OK    ${file}`);
  report.forEach((l) => console.log(l));
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node scripts/theme-ize-style.cjs <archivo.tsx> [...]');
  process.exit(1);
}
files.forEach(processFile);