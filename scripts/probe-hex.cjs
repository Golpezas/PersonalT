// Sonda de diagnóstico: ¿el regex de hex está viendo los colores del stylesheet?
const fs = require('fs');

const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');

const i = src.indexOf('const styles = StyleSheet.create({');
const b = src.indexOf('{', i);
const rest = src.slice(b);

const re = /(['"`])(#[0-9a-fA-F]{3,8})\1/g;
let m;
let n = 0;
const found = [];
while ((m = re.exec(rest)) !== null) {
  found.push(m[0]);
  if (++n >= 15) break;
}

console.log('archivo            :', file);
console.log('hex totales archivo:', (src.match(/#[0-9a-fA-F]{3,8}/g) || []).length);
console.log('hex con comillas   :', found.length);
console.log('muestras           :', found.join(' '));