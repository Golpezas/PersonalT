/**
 * Button Component — primitiva de acción.
 *
 * Diseño: esquinas redondeadas consistentes, altura mínima de 44dp (accesible),
 * sombra suave en variantes sólidas y feedback de pulsación (escala + opacidad)
 * con `Animated` de Reanimated-free (RN core) para que se sienta nativo.
 */

import React, { useState } from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, Animated, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export type ButtonVariant = 'primary' | 'accent' | 'soft' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ComponentPropsWithoutRef<typeof Pressable>, 'style'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  block?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: any;
  /** Estilo del texto (color/tamaño) */
  textStyle?: any;
  children: React.ReactNode;
}

export const Button = React.forwardRef<View, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      block = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      style,
      textStyle,
      ...props
    },
    ref
  ) => {
    const t = useTheme();
    const [scale] = useState(() => new Animated.Value(1));

    const { bg, fg, border } = variantColors(t, variant);

    const height = { xs: 30, sm: 36, md: 44, lg: 52 }[size];
    const padH = { xs: 10, sm: 14, md: 18, lg: 22 }[size];
    const fontSize = { xs: 12, sm: 13, md: 15, lg: 16 }[size];
    const isInactive = !!disabled || loading;

    // Presión: encoge levemente. Da sensación de "fisicalidad" sin librerías extra.
    const animate = (to: number) =>
      Animated.spring(scale, {
        toValue: to,
        useNativeDriver: true,
        speed: 40,
        bounciness: 4 }).start();

    return (
      <Animated.View style={{ transform: [{ scale }], opacity: isInactive ? 0.55 : 1 }}>
        <Pressable
          ref={ref}
          disabled={isInactive}
          accessibilityRole="button"
          accessibilityState={{ disabled: isInactive, busy: loading }}
          onPressIn={() => animate(0.96)}
          onPressOut={() => animate(1)}
          style={[
            styles.base,
            {
              height,
              paddingHorizontal: padH,
              borderRadius: size === 'xs' ? t.radius.sm : t.radius.md,
              backgroundColor: bg,
              borderColor: border,
              borderWidth: border === 'transparent' ? 0 : 1.5 },
            variant === 'primary' && !isInactive ? t.shadow(1) : null,
            (fullWidth || block) && styles.fullWidth,
            style,
          ]}
          {...props}
        >
          {loading ? (
            <ActivityIndicator size="small" color={fg} />
          ) : (
            <>
              {leftIcon ? <View style={styles.icon}>{leftIcon}</View> : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.label,
                  { color: fg, fontSize },
                  size === 'xs' && styles.labelXs,
                  textStyle,
                ]}
              >
                {children}
              </Text>
              {rightIcon ? <View style={styles.icon}>{rightIcon}</View> : null}
            </>
          )}
        </Pressable>
      </Animated.View>
    );
  }
);

Button.displayName = 'Button';

function variantColors(t: ReturnType<typeof useTheme>, variant: ButtonVariant) {
  switch (variant) {
    case 'primary':
      return { bg: t.colors.primary, fg: t.colors.onPrimary, border: 'transparent' };
    case 'accent':
      return { bg: t.colors.accent, fg: '#FFFFFF', border: 'transparent' };
    case 'soft':
      return { bg: t.colors.primarySoft, fg: t.colors.primaryDark, border: 'transparent' };
    case 'outline':
      return { bg: 'transparent', fg: t.colors.primary, border: t.colors.primary };
    case 'ghost':
      return { bg: 'transparent', fg: t.colors.textMuted, border: 'transparent' };
    case 'danger':
      return { bg: t.colors.danger, fg: '#FFFFFF', border: 'transparent' };
  }
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7 },
  fullWidth: {
    width: '100%' },
  icon: {
    alignItems: 'center',
    justifyContent: 'center' },
  label: {
    fontWeight: '700',
    letterSpacing: -0.1 },
  labelXs: {
    fontWeight: '700' } });