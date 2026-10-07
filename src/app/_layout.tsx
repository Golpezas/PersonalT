/**
 * Root Layout - Expo Router
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Providers } from '@/providers';
import { useUIStore } from '@/stores';
import { Toast } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function RootLayout() {
  const { theme, toasts, removeToast } = useUIStore();
  const t = useTheme();
  const { isDark } = useColorScheme();

  useEffect(() => {
    // En web el tema se aplica con clases del <html>; en nativo lo resuelve `useColorScheme`.
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      if (theme !== 'system') {
        document.documentElement.classList.add(theme);
      }
    }
  }, [theme]);

  return (
    <Providers>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: t.colors.bg },
          }}
        />
        <ToastHost toasts={toasts} onClose={removeToast} />
      </View>
    </Providers>
  );
}

/** Toasts flotando arriba, por encima de cualquier pantalla. */
function ToastHost({
  toasts,
  onClose,
}: {
  toasts: { id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }[];
  onClose: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) return null;
  return (
    <View pointerEvents="box-none" style={[styles.toastHost, { top: insets.top }]}>
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => onClose(toast.id)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toastHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000 } });
