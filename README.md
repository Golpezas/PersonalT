# Personal Trainer

App de entrenamiento personal para Android. **Offline-first**: todos los datos viven en
SQLite dentro del dispositivo, sin cuenta, sin servidor y sin conexión. El peso estimado
de una rutina crece con el tiempo a propósito — refleja el trabajo acumulado.

## Stack

| Pieza | Versión | Nota |
|---|---|---|
| Expo | SDK 57 (`expo ~57.0.26`) | Continuous Native Generation |
| React Native | 0.86.3 | |
| TypeScript | 6 | |
| Base de datos | `@op-engineering/op-sqlite` 18.2.5 | JSI, **síncrono** |
| Estado | Zustand 5 | |
| Formularios | React Hook Form 7 + Zod 4 | |
| Navegación | Expo Router | file-based, rutas en `src/app/` |
| Gráficos | `victory-native` 42 + `@shopify/react-native-skia` 2.6.2 | |

**Sin NativeWind/Tailwind.** La UI usa un sistema de tokens propio
(`src/constants/theme.ts`), lo que además eliminó el bloqueo de bundling de Metro.

## Sistema de diseño

```
src/constants/theme.ts     paleta, light/dark colors, spacing, radius, typography, shadow
src/hooks/useTheme.ts      useTheme(): Theme
src/components/ui/         Button, Card, Input, Modal + blocks.tsx + index.ts
```

`blocks.tsx` aporta los bloques reutilizables: `ScreenHeader`, `SectionTitle`, `Chip`,
`ChipRow`, `Badge`, `StatTile`, `ProgressBar`, `EmptyState`, `SegmentedControl`,
`ListRow`, `Avatar`.

Todo se resuelve con `const t = useTheme()`. Las pantallas derivan sus styles de ahí:

```tsx
const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
});

export default function MiPantalla() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  ...
}
```

No hay `fontFamily` custom: sin `expo-font` cargando el archivo, una `fontFamily` no
registrada simplemente no aplica. Todo usa la fuente del sistema.

Dos scripts hacenTheme-izado mecánico de stylesheets. Son **idempotentes**:

```powershell
node scripts\theme-ize-style.cjs "src/app/(tabs)/progreso/index.tsx"
node scripts\theme-ize-props.cjs "src/app/(tabs)/rutinas/nuevo.tsx"
```

El primero convierte `StyleSheet.create({...})` en `createStyles(t)` y reemplaza colores
hardcodeados por tokens. El segundo hace lo mismo con los colores que viven en props de
JSX (`<Ionicons color="#94a3b8" />`) y en estilos inline.

## Base de datos

`op-sqlite` es **síncrono**. Eso cambia el patrón de lectura: no `useEffect` + `setState`,
sino un inicializador perezoso.

```ts
// db/ o services/
export function leerCliente(id: string): Cliente | null { ... }

// pantalla
const [cliente, setCliente] = useState(() => leerCliente(id));
```

Si el `id` cambia durante la vida del componente, hay que setear durante el render
(el patrón de "store derived state" de React).

## Build del APK

El proyecto vive en un **path corto** a propósito. En Windows, CMake limita la ruta de un
archivo objeto a 250 caracteres y, al superarla, el chequeo de globs no converge:

```
ninja: error: manifest 'build.ninja' still dirty after 100 tries
```

`E:\pt` deja el directorio de objetos en ~147 caracteres. Si hay que mover el proyecto,
mantener la base por debajo de ~40 caracteres.

Requisitos (fuera del repo):

- Android SDK 36, build-tools 36.0.0, NDK 27.1.12297006, CMake 3.22.1
- JDK 17 (Temurin)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\install-android-sdk.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-apk.ps1
```

`build-apk.ps1` hace prebuild → `local.properties` → limpia los `.cxx` → `gradlew assembleRelease`
con `buildArchs: [arm64-v8a, armeabi-v7a]`, minificado con R8 y `shrinkResources`.

**Durante el build nativo no ejecutar `npx` dentro del proyecto** (ni levantar el dev
server): `tsc`, `eslint` y `expo export` escriben en `node_modules` y desestabilizan los
globs de CMake.

Expo Go **no** sirve para probar: op-sqlite, Skia y el date picker son módulos nativos y
requieren un build de desarrollo.

## Comandos

```bash
npx expo start            # dev server
npx expo run:android      # build de desarrollo en un dispositivo
npx tsc --noEmit          # typecheck  → debe dar 0 errores
npx expo lint             # ESLint      → 0 errores (los warnings se toleran)
npx expo-doctor           # diagnóstico de deps y config
npx expo install <pkg>    # SIEMPRE en vez de npm install
```

## Estado

Fases 0–3 completas, más P1–P5 (fotos, ficha, backup JSON, logger, gráficos) y CRUD de
Metas. El pase de diseño está aplicado en todas las pantallas.

Pendiente: exportar PDF, carrusel de fotos, backup automático diario, duplicar semana,
skeletons/empty states, accesibilidad, tests y documentación de API.

El estado de trabajo vive en `../tasks/{engram,todo,lessons}.md`.

## Licencia

Uso personal. Los libros de referencia de movimiento (`Delavier`, `Calaise`) son material
con copyright y **no** forman parte de este repositorio.