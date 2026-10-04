/**
 * theme-ize-props.cjs — segunda pasada: convierte colores hardcodeados que
 * viven en props de JSX y en estilos inline, no en el `StyleSheet`.
 *
 * Cubre:
 *   <Ionicons color="#94a3b8" />            ->  color={t.colors.textSubtle}
 *   <Ionicons color={x ? '#fff' : '#0ea5e9'} />  ->  color={x ? t.colors.textInverse : t.colors.primary}
 *   <Input placeholderTextColor="#94a3b8" /> ->  placeholderTextColor={t.colors.textSubtle}
 *   { backgroundColor: a ? '#22c55e' : '#0ea5e9' }  ->  tokens
 *
 * Complementa a `theme-ize-style.cjs` (que solo toca el `StyleSheet.create`).
 * Es idempotente. Requiere que `t` (de `useTheme()`) esté en scope: el
 * typecheck lo verifica.
 *
 * Uso:  node scripts/theme-ize-props.cjs <archivo.tsx> [...]
 */

const fs = require('fs');

/** hex (sin #) -> token de theme. Solo los que aparecen en las pantallas. */
const TOKEN = {
  '0f172a': 'text',
  '334155': 'text',
  fff: 'textInverse',
  FFFFFF: 'textInverse',
  '64748b': 'textMuted',
  '475569': 'textMuted',
  '94a3b8': 'textSubtle',
  cbd5e1: 'textSubtle',
  'e2e8f0': 'border',
  f1f5f9: 'surfaceAlt',
  '0ea5e9': 'primary',
  '22c55e': 'success',
  'ef4444': 'danger',
  'f59e0b': 'warning',
  '8b5cf6': 'accent',
};

function tokenFor(hex) {
  return TOKEN[hex] || TOKEN[hex.toLowerCase()];
}

/** Convierte un literal `'#abc'` a `t.colors.X`, o null si no hay token. */
function tokenize(value) {
  const m = /^['"]#([0-9a-fA-F]{3,8})['"]$/.exec(value);
  if (!m) return null;
  return tokenFor(m[1]) ? `t.colors.${tokenFor(m[1])}` : null;
}

/** Reemplaza todos los literales de color dentro de un fragmento. */
function tokenizeFragment(fragment) {
  let changed = false;
  const out = fragment.replace(/['"]#([0-9a-fA-F]{3,8})['"]/g, (m, hex) => {
    const tok = tokenFor(hex);
    if (!tok) return m;
    changed = true;
    return `t.colors.${tok}`;
  });
  return changed ? out : fragment;
}

function processFile(file) {
  let src = fs.readFileSync(file, 'utf8');
  const original = src;
  const counts = {};

  const bump = (k) => { counts[k] = (counts[k] || 0) + 1; };

  // ---- 1. Prop con string literal:  color="#94a3b8"  ->  color={t.colors.x}
  src = src.replace(
    /\b(color|placeholderTextColor|tintColor|selectionColor)\s*=\s*(['"])#([0-9a-fA-F]{3,8})\2/g,
    (m, prop, q, hex) => {
      const tok = tokenFor(hex);
      if (!tok) return m;
      bump(prop);
      return `${prop}={t.colors.${tok}}`;
    }
  );

  // ---- 2. Prop con expresion ternaria: color={a ? '#fff' : '#0ea5e9'}
  //      Solo cuando TODOS los hex de la expresion tienen token.
  src = src.replace(
    /\b(color|placeholderTextColor|tintColor)\s*=\s*\{([^{}]*)\}/g,
    (m, prop, expr) => {
      const hasHex = /['"]#[0-9a-fA-F]{3,8}['"]/.test(expr);
      if (!hasHex) return m;
      const next = tokenizeFragment(expr);
      if (next === expr) return m; // habia hex sin token
      bump(prop + ' (ternario)');
      return `${prop}={${next}}`;
    }
  );

  // ---- 3. Estilos inline:  { backgroundColor: a ? '#22c55e' : '#0ea5e9' }
  src = src.replace(
    /([a-zA-Z]*[Cc]olor)\s*:\s*([^{}]*['"]#[0-9a-fA-F]{3,8}['"][^{}]*)/g,
    (m, prop, expr) => {
      const next = tokenizeFragment(expr);
      if (next === expr) return m;
      bump(prop + ' (inline)');
      return `${prop}: ${next}`;
    }
  );

  if (src === original) {
    console.log(`--    ${file} (sin cambios)`);
    return;
  }

  fs.writeFileSync(file, src, 'utf8');
  console.log(`OK    ${file}`);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${v}x ${k}`);
  }
}

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node scripts/theme-ize-props.cjs <archivo.tsx> [...]');
  process.exit(1);
}
files.forEach(processFile);