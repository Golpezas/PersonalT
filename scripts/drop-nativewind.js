// Migración: quitar NativeWind del código.
// Uso: node scripts/drop-nativewind.js
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

const OLD_IMPORT = "import { useColorScheme } from 'nativewind';";
const NEW_IMPORT = "import { useColorScheme } from '@/hooks/useColorScheme';";

let n = 0;
for (const f of walk('src')) {
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;
  s = s.split(OLD_IMPORT).join(NEW_IMPORT);
  s = s.split('className="mt-4"').join('style={{ marginTop: 16 }}');
  s = s.split('className="mt-2"').join('style={{ marginTop: 8 }}');
  if (s !== orig) {
    fs.writeFileSync(f, s);
    n++;
    console.log('patched', f);
  }
}
console.log('archivos modificados:', n);