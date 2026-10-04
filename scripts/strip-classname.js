// Limpia el prop `className` de los componentes de UI (nacía de NativeWind).
// Uso: node scripts/strip-classname.js
const fs = require('fs');

const files = [
  'src/components/ui/Card.tsx',
  'src/components/ui/Input.tsx',
  'src/components/ui/Modal.tsx',
  'src/components/ui/Button.tsx',
];

// Cada regla: [regex, replacement]
const REGLAS = [
  // Interfaces: quita la declaración del prop
  [/\r?\n\s*className\?: string;/g, ''],
  // Destructuring con default
  [/\r?\n\s*className = '',/g, ''],
  // Destructuring simple
  [/\r?\n\s*className,(?=\r?\n\s*(style|\.\.\.props|disabled))/g, ''],
  // Entrada suelta dentro de un array de estilos
  [/\r?\n\s*className,(?=\r?\n\s*(className,|\}\]|style,))/g, ''],
  // CardHeader / CardContent / CardFooter inline
  [/style, className\}>/g, 'style}>'],
  [/style, className\]}>/g, 'style]}>{children}</View>'],
  [/style, className\]}>/g, 'style]}>{children}</View>'],
  [/style, className\}>/g, 'style}>'],
];

for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const before = s;
  for (const [re, rep] of REGLAS) s = s.replace(re, rep);
  // Cualquier línea `className` suelta que haya sobrevivido
  s = s.split(/\r?\n\s*className,\r?\n/).join('\n');
  s = s.split(/\r?\n\s*className\}/).join('\n}');
  if (s !== before) {
    fs.writeFileSync(f, s);
    console.log('limpio', f);
  }
}
console.log('--- restos ---');
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  s.split(/\r?\n/).forEach((l, i) => {
    if (l.includes('className')) console.log(`${f}:${i + 1}: ${l}`);
  });
}