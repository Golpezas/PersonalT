// Quita `fontFamily: 'Inter_xxx'` de todo el código.
// Motivo: las fuentes Inter nunca se cargaron (no hay @expo-google-fonts ni
// expo-font con .ttf), así que React Native caía al font por defecto del sistema
// en Android pero mantenía un nombre inexistente en el estilo. mixed results +
// peso de texto inconsistente entre pantallas.
// Al borrarlo queda el font del sistema (Roboto / San Francisco) que es lo que
// se ve realmente en el dispositivo.
const fs = require('fs');
const path = require('path');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

let files = 0;
let matches = 0;
for (const f of walk('src')) {
  const orig = fs.readFileSync(f, 'utf8');
  // fontFamily: 'Inter_700Bold',   |   fontFamily: 'Inter_700Bold'
  let s = orig.replace(/,?\r?\n?\s*fontFamily:\s*'Inter_[A-Za-z0-9]+'\s*,?/g, (m) => {
    // Si el match empezaba con coma/nueva línea, conservamos el salto de línea
    const hadLeadingBreak = /^\r?\n/.test(m);
    matches++;
    return hadLeadingBreak ? '' : '';
  });
  // Limpia líneas que quedaron con doble coma o comas colgantes
  s = s.replace(/,\s*,/g, ',').replace(/\{,\s*/g, '{ ').replace(/,\s*\}/g, ' }');
  if (s !== orig) {
    fs.writeFileSync(f, s);
    files++;
    console.log('ok', f);
  }
}
console.log(`archivos: ${files}, ocurrencias fontFamily eliminadas: ${matches}`);