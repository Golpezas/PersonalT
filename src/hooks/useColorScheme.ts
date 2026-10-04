/**
 * useColorScheme — tema claro/oscuro.
 *
 * Antes se usaba `nativewind`, pero NativeWind 4 solo soporta Tailwind CSS v3
 * mientras el proyecto usa Tailwind v4 (y el bundle de Metro fallaba con
 * "NativeWind only supports Tailwind CSS v3"). Como la app usa estilos inline
 * con `StyleSheet`, se eliminó NativeWind y este hook cubre lo único que se
 * usaba de él: leer el esquema de color del sistema.
 */

import { useColorScheme as useRNColorScheme } from 'react-native';
import type { ColorSchemeName } from 'react-native';

export interface ThemeState {
  colorScheme: Exclude<ColorSchemeName, null | undefined>;
  isDark: boolean;
}

export function useColorScheme(): ThemeState {
  const scheme = useRNColorScheme();
  return {
    colorScheme: scheme === 'dark' ? 'dark' : 'light',
    isDark: scheme === 'dark' };
}