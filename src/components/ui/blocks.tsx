/**
 * Building blocks reutilizables — consistencia visual en todas las pantallas.
 *
 * Todos consumen `useTheme()`, así el mismo componente se ve igual en Clientes,
 * Rutinas, Progreso, Detalle, Logger y Ajustes.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

// ============================================
// ScreenHeader — encabezado de pantalla completa
// ============================================
export function ScreenHeader({
  title,
  subtitle,
  right,
  onBack,
  icon }: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  icon?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingHorizontal: t.spacing.lg,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.md,
        backgroundColor: t.colors.chrome,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border }}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.iconBtn, { backgroundColor: t.colors.surfaceAlt }]}
        >
          <Ionicons name="chevron-back" size={20} color={t.colors.text} />
        </Pressable>
      ) : null}
      {icon ? <View style={{ marginRight: 2 }}>{icon}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[t.typography.title, { color: t.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[t.typography.small, { color: t.colors.textMuted, marginTop: 1 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

// ============================================
// SectionTitle — rótulo de sección dentro de un scroll
// ============================================
export function SectionTitle({
  title,
  action,
  style }: {
  title: string;
  action?: React.ReactNode;
  style?: any;
}) {
  const t = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }, style]}>
      <Text
        style={[
          t.typography.micro,
          { color: t.colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.8, flex: 1 },
        ]}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}

// ============================================
// Chip — etiqueta / filtro seleccionable
// ============================================
export function Chip({
  label,
  active = false,
  onPress,
  icon,
  tone = 'primary',
  size = 'md' }: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: any;
  tone?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}) {
  const t = useTheme();
  // `useState` perezoso en vez de `useRef(...).current`: una sola instancia y
  // el lint de react-hooks v7 no marca leer refs durante el render.
  const [scale] = useState(() => new Animated.Value(1));

  const accent = {
    primary: t.colors.primary,
    neutral: t.colors.textMuted,
    success: t.colors.success,
    warning: t.colors.warning,
    danger: t.colors.danger }[tone];

  const soft = {
    primary: t.colors.primarySoft,
    neutral: t.colors.surfaceAlt,
    success: t.colors.successSoft,
    warning: t.colors.warningSoft,
    danger: t.colors.dangerSoft }[tone];

  const height = size === 'sm' ? 28 : 36;

  const content = (
    <Animated.View
      style={{
        transform: [{ scale }],
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        height,
        paddingHorizontal: size === 'sm' ? 10 : 14,
        borderRadius: t.radius.pill,
        backgroundColor: active ? accent : soft,
        borderWidth: active ? 0 : 1,
        borderColor: t.colors.border }}
    >
      {icon ? (
        <Ionicons name={icon} size={size === 'sm' ? 13 : 15} color={active ? '#FFFFFF' : accent} />
      ) : null}
      <Text
        numberOfLines={1}
        style={[
          size === 'sm' ? t.typography.micro : t.typography.smallStrong,
          { color: active ? '#FFFFFF' : t.colors.text },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
      }
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 4 }).start()}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {content}
    </Pressable>
  );
}

// ============================================
// Badge — estado compacto
// ============================================
export function Badge({
  label,
  tone = 'neutral',
  icon,
  style }: {
  label: string;
  tone?: 'primary' | 'neutral' | 'success' | 'warning' | 'danger' | 'accent';
  icon?: any;
  style?: any;
}) {
  const t = useTheme();
  const map = {
    primary: [t.colors.primarySoft, t.colors.primaryDark],
    neutral: [t.colors.surfaceAlt, t.colors.textMuted],
    success: [t.colors.successSoft, t.colors.success],
    warning: [t.colors.warningSoft, t.colors.warning],
    danger: [t.colors.dangerSoft, t.colors.danger],
    accent: [t.colors.accentSoft, t.colors.accent] }[tone];

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          alignSelf: 'flex-start',
          paddingHorizontal: 9,
          paddingVertical: 4,
          borderRadius: t.radius.pill,
          backgroundColor: map[0] },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={11} color={map[1]} /> : null}
      <Text style={[t.typography.micro, { color: map[1] }]}>{label}</Text>
    </View>
  );
}

// ============================================
// StatTile — métrica destacada
// ============================================
export function StatTile({
  label,
  value,
  unit,
  delta,
  icon,
  tone = 'primary',
  onPress,
  style }: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: { value: number; suffix?: string } | null;
  icon?: any;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  onPress?: () => void;
  style?: any;
}) {
  const t = useTheme();
  const accent = {
    primary: t.colors.primary,
    success: t.colors.success,
    warning: t.colors.warning,
    danger: t.colors.danger,
    accent: t.colors.accent }[tone];

  const deltaColor =
    delta == null ? t.colors.textSubtle : delta.value > 0 ? t.colors.success : delta.value < 0 ? t.colors.danger : t.colors.textMuted;

  const Wrapper: any = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={[
        {
          flex: 1,
          minWidth: 148,
          backgroundColor: t.colors.surface,
          borderRadius: t.radius.lg,
          borderWidth: 1,
          borderColor: t.colors.border,
          padding: t.spacing.lg,
          gap: 6,
          overflow: 'hidden' },
        style,
      ]}
    >
      {/* Barra de acento a la izquierda: da identidad sin gastar espacio */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accent }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {icon ? <Ionicons name={icon} size={13} color={t.colors.textSubtle} /> : null}
        <Text style={[t.typography.micro, { color: t.colors.textSubtle, textTransform: 'uppercase', letterSpacing: 0.6 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text style={[t.typography.metric, { color: t.colors.text }]}>{value}</Text>
        {unit ? <Text style={[t.typography.smallStrong, { color: t.colors.textSubtle }]}>{unit}</Text> : null}
      </View>
      {delta ? (
        <Text style={[t.typography.caption, { color: deltaColor, fontWeight: '700' }]}>
          {delta.value > 0 ? '+' : ''}
          {delta.value}
          {delta.suffix ?? ''}
        </Text>
      ) : null}
    </Wrapper>
  );
}

// ============================================
// ProgressBar
// ============================================
export function ProgressBar({
  value,
  tone = 'primary',
  height = 8,
  style }: {
  /** 0 – 100 */
  value: number;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent' | 'neutral';
  height?: number;
  style?: any;
}) {
  const t = useTheme();
  const color = {
    primary: t.colors.primary,
    success: t.colors.success,
    warning: t.colors.warning,
    danger: t.colors.danger,
    accent: t.colors.accent,
    neutral: t.colors.textSubtle }[tone];

  const pct = Math.max(0, Math.min(100, value));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={[{ height, borderRadius: height / 2, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden' }, style]}
    >
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

// ============================================
// EmptyState
// ============================================
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  subtitle,
  action,
  compact = false }: {
  icon?: any;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.sm, paddingVertical: compact ? t.spacing.xxl : t.spacing.huge, paddingHorizontal: t.spacing.xl }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: t.colors.primarySoft }}
      >
        <Ionicons name={icon} size={28} color={t.colors.primary} />
      </View>
      <Text style={[t.typography.subheading, { color: t.colors.text, textAlign: 'center' }]}>{title}</Text>
      {subtitle ? (
        <Text style={[t.typography.small, { color: t.colors.textMuted, textAlign: 'center', maxWidth: 320 }]}>{subtitle}</Text>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.sm }}>{action}</View> : null}
    </View>
  );
}

// ============================================
// SegmentedControl — tabs compactos
// ============================================
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style }: {
  options: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
  style?: any;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          backgroundColor: t.colors.surfaceAlt,
          borderRadius: t.radius.md,
          padding: 3,
          gap: 2 },
        style,
      ]}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              height: 34,
              borderRadius: t.radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'row',
              gap: 5,
              backgroundColor: active ? t.colors.surface : 'transparent',
              ...(active ? t.shadow(1) : null) }}
          >
            <Text
              numberOfLines={1}
              style={[
                t.typography.smallStrong,
                { color: active ? t.colors.text : t.colors.textMuted },
              ]}
            >
              {o.label}
            </Text>
            {o.badge != null && o.badge > 0 ? (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? t.colors.primary : t.colors.borderStrong }}
              >
                <Text style={[t.typography.micro, { color: active ? '#FFFFFF' : t.colors.text }]}>{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ============================================
// ChipRow — fila de chips scrolleable
// ============================================
export function ChipRow({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, alignItems: 'center' }}
      style={style}
    >
      {children}
    </ScrollView>
  );
}

// ============================================
// ListRow — fila de lista reutilizable
// ============================================
export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
  chevron = true,
  style }: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  style?: any;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.md,
          paddingVertical: t.spacing.md,
          opacity: pressed ? 0.6 : 1 },
        style,
      ]}
    >
      {left ? <View>{left}</View> : null}
      <View style={{ flex: 1 }}>
        <Text style={[t.typography.body, { color: t.colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[t.typography.caption, { color: t.colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && onPress ? <Ionicons name="chevron-forward" size={16} color={t.colors.textSubtle} /> : null}
    </Pressable>
  );
}

// ============================================
// Avatar — iniciales con color derivado del nombre
// ============================================
const AVATAR_COLORS = ['#0EA5E9', '#8B5CF6', '#22C55E', '#F97316', '#EC4899', '#06B6D4', '#6366F1', '#84CC16'];

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const t = useTheme();
  const partes = (name || '?').trim().split(/\s+/);
  const iniciales = (partes[0]?.[0] ?? '?').toUpperCase() + (partes[1]?.[0] ?? '').toUpperCase();

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length];

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg + (t.dark ? '33' : '1F') }}
    >
      <Text style={[t.typography.subheading, { color: bg, fontSize: size * 0.36 }]}>{iniciales}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center' } });