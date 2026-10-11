/**
 * Logo — logotipo horizontal de KaizenFit (isotipo + "Kaizen" naranja + "Fit" amarillo).
 *
 * El amarillo de marca no es legible sobre fondos claros, así que en tema claro
 * el logo se monta sobre una pastilla `brand.background_dark`.
 */

import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';
import { brandFont } from '@/constants/theme';

const ISOTIPO = require('../../../assets/brand/isotipo.png');

interface LogoProps {
  /** Alto del isotipo en dp; el texto escala en proporción. */
  size?: number;
  /** Fuerza (o quita) la pastilla oscura. Por defecto solo en tema claro. */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Logo({ size = 28, badge, style }: LogoProps) {
  const t = useTheme();
  const conBadge = badge ?? !t.dark;
  const fontSize = Math.round(size * 0.78);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="KaizenFit"
      style={[
        styles.row,
        { gap: Math.round(size * 0.3) },
        conBadge && {
          backgroundColor: t.brand.background_dark,
          borderRadius: t.radius.pill,
          paddingVertical: Math.round(size * 0.18),
          paddingLeft: Math.round(size * 0.22),
          paddingRight: Math.round(size * 0.5),
        },
        style,
      ]}
    >
      <Image source={ISOTIPO} style={{ width: size, height: size }} contentFit="contain" />
      <Text style={[brandFont, styles.text, { fontSize, lineHeight: Math.round(fontSize * 1.25) }]}>
        <Text style={{ color: t.brand.primary_orange }}>Kaizen</Text>
        <Text style={{ color: t.brand.accent_yellow }}>Fit</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  text: { includeFontPadding: false, letterSpacing: -0.3 },
});
