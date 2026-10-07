/**
 * Modal, Sheet & Toast — superficies flotantes.
 *
 * Todos usan los design tokens y se comportan como bottom sheets (el patrón más
 * natural en móvil). La animación es con `Animated` de RN core: sin librerías
 * extra y con `useNativeDriver`, así no toca el JS thread.
 *
 * Nota de implementación: los `Animated.Value` se crean con
 * `useState(() => new Animated.Value(...))` en vez de `useRef(...).current`.
 * El lint de `react-hooks` v7 marca leer `.current` durante el render, y además
 * el inicializador perezoso de `useState` garantiza una sola instancia.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Keyboard,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================
// Modal (centrado, ancho casi completo)
// ============================================
interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'full';
  closeOnOverlayPress?: boolean;
  showHandle?: boolean;
  style?: any;
}

export const Modal = ({
  visible,
  onClose,
  children,
  title,
  size = 'md',
  closeOnOverlayPress = true,
  showHandle = true,
  style,
}: ModalProps) => {
  const t = useTheme();
  const { width, height } = useWindowDimensions();

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.parallel(
      visible
        ? [
            Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
          ]
        : [
            Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]
    ).start();
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  const maxHeight = { sm: height * 0.55, md: height * 0.75, lg: height * 0.9, full: height }[size];
  const pad = size === 'full' ? 0 : t.spacing.xl;

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <RNModal visible transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.overlay, opacity: fadeAnim }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeOnOverlayPress ? handleClose : undefined}
          accessibilityLabel="Cerrar"
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[
            {
              width: Math.min(width * 0.94, 560),
              maxHeight,
              backgroundColor: t.colors.surface,
              borderRadius: t.radius.xl,
              overflow: 'hidden',
              transform: [
                { translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) },
                { scale: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.96] }) },
              ],
              ...t.shadow(3),
              paddingHorizontal: pad,
            },
            style,
          ]}
        >
          {showHandle ? (
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: t.colors.borderStrong }]} />
            </View>
          ) : null}

          {title ? (
            <View style={[styles.header, { borderBottomColor: t.colors.border }]}>
              <Text style={[t.typography.heading, { color: t.colors.text, flex: 1 }]}>{title}</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityLabel="Cerrar"
                style={[styles.closeBtn, { backgroundColor: t.colors.surfaceAlt }]}
              >
                <Ionicons name="close" size={18} color={t.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={{ paddingBottom: t.spacing.xl }}>{children}</View>
        </Animated.View>
      </View>
    </RNModal>
  );
};

Modal.displayName = 'Modal';

// ============================================
// Sheet (bottom sheet a pantalla)
// ============================================
interface SheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  snapPoints?: number[];
  showHandle?: boolean;
  style?: any;
}

export const Sheet = ({
  visible,
  onClose,
  children,
  title,
  snapPoints = [SCREEN_HEIGHT * 0.45, SCREEN_HEIGHT * 0.72, SCREEN_HEIGHT * 0.94],
  showHandle = true,
  style,
}: SheetProps) => {
  const t = useTheme();
  const { height } = useWindowDimensions();

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(1));

  useEffect(() => {
    Animated.parallel(
      visible
        ? [
            Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 2 }),
          ]
        : [
            Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 1, duration: 220, useNativeDriver: true }),
          ]
    ).start();
  }, [visible, fadeAnim, translateY]);

  if (!visible) return null;

  const maxHeight = snapPoints[snapPoints.length - 1];

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <RNModal visible transparent animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.overlay, opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Cerrar" />
      </Animated.View>

      <View style={styles.sheetAnchor} pointerEvents="box-none">
        <Animated.View
          style={[
            {
              maxHeight,
              backgroundColor: t.colors.surface,
              borderTopLeftRadius: t.radius.xxl,
              borderTopRightRadius: t.radius.xxl,
              paddingBottom: t.spacing.xl,
              transform: [{ translateY: translateY.interpolate({ inputRange: [0, 1], outputRange: [0, height] }) }],
              ...t.shadow(3),
            },
            style,
          ]}
        >
          {showHandle ? (
            <View style={styles.handleRow}>
              <View style={[styles.handle, { backgroundColor: t.colors.borderStrong }]} />
            </View>
          ) : null}

          {title ? (
            <View style={[styles.header, { paddingHorizontal: t.spacing.xl, borderBottomColor: t.colors.border }]}>
              <Text style={[t.typography.heading, { color: t.colors.text, flex: 1 }]}>{title}</Text>
              <Pressable
                onPress={handleClose}
                hitSlop={12}
                accessibilityLabel="Cerrar"
                style={[styles.closeBtn, { backgroundColor: t.colors.surfaceAlt }]}
              >
                <Ionicons name="close" size={18} color={t.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: t.spacing.xl }}>{children}</View>
        </Animated.View>
      </View>
    </RNModal>
  );
};

Sheet.displayName = 'Sheet';

// ============================================
// Toast
// ============================================
interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

const TOAST_ICON: Record<string, any> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  warning: 'warning',
  info: 'information-circle',
};

export const Toast = ({ message, type = 'info', onClose }: ToastProps) => {
  const t = useTheme();

  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(-1));

  // El padre suele pasar un `onClose` inline nuevo en cada render; si fuera
  // dependencia del efecto, el temporizador se reiniciaría y el toast no se cerraría.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 16, bounciness: 6 }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -1, duration: 220, useNativeDriver: true }),
      ]).start(() => onCloseRef.current());
    }, 3200);

    return () => clearTimeout(timer);
  }, [fadeAnim, slideAnim]);

  const accent =
    type === 'success' ? t.colors.success
      : type === 'error' ? t.colors.danger
        : type === 'warning' ? t.colors.warning
          : t.colors.primary;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: t.colors.surface,
          borderColor: t.colors.border,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim.interpolate({ inputRange: [-1, 0], outputRange: [-90, 0] }) }],
          ...t.shadow(2),
        },
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: accent + '1F' }]}>
        <Ionicons name={TOAST_ICON[type]} size={17} color={accent} />
      </View>
      <Text style={[t.typography.small, { color: t.colors.text, flex: 1 }]}>{message}</Text>
      <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Cerrar aviso">
        <Ionicons name="close" size={16} color={t.colors.textSubtle} />
      </Pressable>
    </Animated.View>
  );
};

Toast.displayName = 'Toast';

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  handleRow: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    paddingRight: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 8,
  },
  toastIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});