/**
 * useColorScheme — tema claro/oscuro.
 *
 * Antes se usaba `nativewind`, pero NativeWind 4 solo soporta Tailwind CSS v3
 * mientras el proyecto usa Tailwind v4 (y el bundle de Metro fallaba con
 * "NativeWind only supports Tailwind CSS v3"). Como la app usa estilos inline
 * con `StyleSheet`, se eliminó NativeWind y este hook cubre lo único que se
 * usaba de él: resolver el esquema de color.
 *
 * Respeta la preferencia de Ajustes (`useUIStore().theme`): 'light' / 'dark'
 * fuerzan el esquema; 'system' sigue al sistema operativo.
 */

import { useColorScheme as useRNColorScheme } from 'react-native';
import type { ColorSchemeName } from 'react-native';
import { useUIStore } from '@/stores';

export interface ThemeState {
  colorScheme: Exclude<ColorSchemeName, null | undefined | 'unspecified'>;
  isDark: boolean;
}

export function useColorScheme(): ThemeState {
  const systemScheme = useRNColorScheme();
  const preferencia = useUIStore((s) => s.theme);
  const isDark = preferencia === 'system' ? systemScheme === 'dark' : preferencia === 'dark';
  return {
    colorScheme: isDark ? 'dark' : 'light',
    isDark };
}
