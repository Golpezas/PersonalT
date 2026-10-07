/**
 * Card Components — contenedor de contenido.
 *
 * Superficie elevada con borde sutil + sombra muy suave (nivel 1). Nada de
 * sombras duras: el diseño busca "moderno y práctico", noskeuomórfico.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

interface CardProps {
  children: React.ReactNode;
  style?: any;
  padding?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  elevated?: boolean;
  bordered?: boolean;
  onPress?: () => void;
}

export const Card = React.forwardRef<View, CardProps>(
  ({ children, style, padding = 'md', elevated = false, bordered = true, onPress, ...props }, ref) => {
    const t = useTheme();

    const paddingValue = {
      none: 0,
      xs: t.spacing.sm,
      sm: t.spacing.md,
      md: t.spacing.lg,
      lg: t.spacing.xxl }[padding];

    const baseStyle = [
      {
        backgroundColor: t.colors.surface,
        borderRadius: t.radius.lg,
        padding: paddingValue,
        borderWidth: bordered ? 1 : 0,
        borderColor: t.colors.border,
        overflow: 'hidden' as const },
      elevated ? t.shadow(1) : null,
    ];

    // `View` no acepta `style` como función: solo `Pressable` recibe el estado `pressed`.
    if (!onPress) {
      return (
        <View ref={ref} style={[...baseStyle, style]} {...(props as any)}>
          {children}
        </View>
      );
    }

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        accessibilityRole="button"
        style={({ pressed }) => [
          ...baseStyle,
          pressed && { opacity: 0.9, transform: [{ scale: 0.995 }] },
          style,
        ]}
        {...(props as any)}
      >
        {children}
      </Pressable>
    );
  }
);

Card.displayName = 'Card';

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  style?: any;
}

export const CardHeader = ({ title, subtitle, action, icon, style }: CardHeaderProps) => {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.md, paddingBottom: subtitle ? t.spacing.sm : t.spacing.xs }, style]}>
      {icon ? <View style={{ paddingTop: 2 }}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[t.typography.subheading, { color: t.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[t.typography.caption, { color: t.colors.textMuted, marginTop: 2 }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action ? <View style={{ marginLeft: t.spacing.sm }}>{action}</View> : null}
    </View>
  );
};

CardHeader.displayName = 'CardHeader';

interface CardContentProps {
  children: React.ReactNode;
  style?: any;
  /** Quita el padding lateral heredado del Card (para gráficos a sangre). */
  flush?: boolean;
}

export const CardContent = ({ children, style, flush = false }: CardContentProps) => {
  const t = useTheme();
  return <View style={[flush ? { paddingTop: t.spacing.sm } : null, style]}>{children}</View>;
};

CardContent.displayName = 'CardContent';

interface CardFooterProps {
  children: React.ReactNode;
  style?: any;
  divided?: boolean;
}

export const CardFooter = ({ children, style, divided = true }: CardFooterProps) => {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          marginTop: t.spacing.md,
          paddingTop: t.spacing.md,
          borderTopWidth: divided ? 1 : 0,
          borderTopColor: t.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
};

CardFooter.displayName = 'CardFooter';