// Reparación post-strip-inter-font.js.
//
// El script anterior removió `, fontFamily: 'Inter_X',` (coma inicial + prop +
// coma final), dejando DOS propiedades pegadas sin separador:
//     color: '#64748b' marginTop: 4
// Este script reinserta la coma que falta.
//
// Regla: un valor (string, número, `)` o `]`) seguido de whitespace y luego
// `identificador:` dentro de un objeto. Ese patrón es inválido en TS/TSX por
// sí solo, así que sólo puede ser daño de la migración.
const fs = require('fs');
const path = require('path');

const ROOTS = process.argv.slice(2).length ? process.argv.slice(2) : ['src'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Valor terminado en quote, número, `)` o `]` + whitespace + `key:`
const RE = /(['"\d)\]])(\s+)([A-Za-z_$][\w$]*)(\s*):/g;

let total = 0;
for (const root of ROOTS) {
  for (const f of walk(root)) {
    const orig = fs.readFileSync(f, 'utf8');
    let n = 0;
    const out = orig.replace(RE, (m, val, ws, key, ws2) => {
      n++;
      return `${val},${ws}${key}${ws2}:`;
    });
    if (n > 0) {
      fs.writeFileSync(f, out);
      total += n;
      console.log(`+${n}  ${f}`);
    }
  }
}
console.log(`comas reinsertadas: ${total}`);