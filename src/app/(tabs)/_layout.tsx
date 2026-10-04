/**
 * Tabs Layout — navegación principal.
 *
 * La barra usa los design tokens (`useTheme`) para que respete el esquema de
 * claro/oscuro y tenga el mismo acento que el resto de la app.
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore } from '@/stores';

/** Rutas full-screen: se ocultan al entrar (logger, formularios, catálogo). */
const FULLSCREEN_ROUTES = [
  'entrenamiento/[rutinaId]/[diaId]',
  'rutinas/nuevo',
  'rutinas/catalogo',
  'clientes/nuevo',
  'clientes/[id]/ficha/nueva',
  'clientes/[id]/checkin/nueva',
  'clientes/[id]/meta/nueva',
  'clientes/[id]/meta/[metaId]',
];

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const selectedClienteId = useClientesStore((state) => state.selectedClienteId);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textSubtle,
        tabBarStyle: {
          backgroundColor: t.colors.chrome,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
          paddingTop: 6,
          // 6 arriba + 22 (icono+label) + safe-area abajo
          height: 58 + insets.bottom + (Platform.OS === 'ios' ? 6 : 4),
          paddingBottom: insets.bottom + (Platform.OS === 'ios' ? 18 : 8),
          elevation: 0,
        },
        tabBarLabelStyle: t.typography.micro,
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="clientes"
        options={{
          title: 'Clientes',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rutinas"
        options={{
          title: 'Rutinas',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'document-text' : 'document-text-outline'}
              size={size}
              color={color}
            />
          ),
          tabBarBadge: selectedClienteId ? undefined : undefined,
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'stats-chart' : 'stats-chart-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ajustes"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={size} color={color} />
          ),
        }}
      />

      {FULLSCREEN_ROUTES.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{ headerShown: false, tabBarStyle: { display: 'none' } }}
        />
      ))}
    </Tabs>
  );
}