/**
 * useTheme — expone los design tokens (`src/constants/theme.ts`) resueltos para
 * el esquema de color activo.
 *
 * Se usa así:
 * ```tsx
 * const t = useTheme();
 * <View style={{ backgroundColor: t.colors.bg, padding: t.spacing.lg }} />
 * ```
 */

import { useMemo } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { buildTheme, type Theme } from '@/constants/theme';

export function useTheme(): Theme {
  const { isDark } = useColorScheme();
  // `buildTheme` devuelve un objeto estable por esquema → el memo solo cambia
  // cuando el usuario cambia el tema del sistema.
  return useMemo(() => buildTheme(isDark), [isDark]);
}

export type { Theme };
export { palette, lightColors, darkColors, spacing, radius, typography, sizes } from '@/constants/theme';