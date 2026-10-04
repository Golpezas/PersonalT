/**
 * Root Layout - Expo Router
 */

import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Slot } from 'expo-router';
import { Providers } from '@/providers';
import { useUIStore } from '@/stores';
import { initializeDatabase } from '@/db/database';
import { Toast } from '@/components/ui';

export default function RootLayout() {
  const { theme, toasts, removeToast } = useUIStore();

  useEffect(() => {
    // Initialize database on app start
    initializeDatabase();
  }, []);

  useEffect(() => {
    // El tema se aplica en web manipulating clases del <html>.
    // En nativo, `useColorScheme` de React Native ya lee el esquema del sistema.
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('light', 'dark');
      if (theme !== 'system') {
        document.documentElement.classList.add(theme);
      }
    }
  }, [theme]);

  return (
    <Providers>
      <View style={styles.container}>
        <Slot />
        {/* Global Toasts */}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </View>
    </Providers>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc' } });
