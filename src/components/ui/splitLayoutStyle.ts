import { StyleSheet } from 'react-native';

// Componentes con wrapper (Button, Input): lo que posiciona al componente en su
// contenedor (flex, ancho, márgenes) tiene que ir en el wrapper o no surte efecto.
const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf',
  'width', 'minWidth', 'maxWidth',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'position', 'top', 'bottom', 'left', 'right', 'zIndex',
]);

export function splitLayoutStyle(style: unknown) {
  const flat = (StyleSheet.flatten(style as any) ?? {}) as Record<string, unknown>;
  const outerStyle: Record<string, unknown> = {};
  const innerStyle: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(flat)) (LAYOUT_KEYS.has(k) ? outerStyle : innerStyle)[k] = v;
  return { outerStyle, innerStyle };
}
