/**
 * Fotos de técnica de un ejercicio: par "Inicio / Final" con visor a pantalla
 * completa, y una miniatura para listas.
 *
 * Las fotos del catálogo base van empaquetadas en la app (funcionan sin conexión).
 * Un ejercicio propio puede traer `imagenUri`; si no hay nada, no se renderiza.
 */

import React, { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { IMAGENES_EJERCICIO } from '@/constants/ejercicioImagenes';

const ETIQUETAS = ['Inicio', 'Final'];

export function imagenesDeEjercicio(ejercicioId?: string, imagenUri?: string): ImageSourcePropType[] {
  const base = ejercicioId ? IMAGENES_EJERCICIO[ejercicioId] : undefined;
  if (base) return [...base];
  return imagenUri ? [{ uri: imagenUri }] : [];
}

interface FotosProps {
  ejercicioId?: string;
  imagenUri?: string;
  nombre?: string;
}

export function EjercicioFotos({ ejercicioId, imagenUri, nombre }: FotosProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [visor, setVisor] = useState(false);
  const fotos = imagenesDeEjercicio(ejercicioId, imagenUri);
  if (fotos.length === 0) return null;

  return (
    <>
      <View style={styles.par}>
        {fotos.map((src, i) => (
          <Pressable
            key={i}
            style={styles.celda}
            onPress={() => setVisor(true)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Ver foto ${ETIQUETAS[i] ?? ''} de ${nombre ?? 'ejercicio'}`}
          >
            <Image
              source={src}
              style={[styles.foto, { backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.sm }]}
              contentFit="contain"
              transition={120}
            />
            {fotos.length > 1 ? (
              <Text style={[t.typography.micro, { color: t.colors.textMuted }]}>{ETIQUETAS[i]}</Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      <Modal visible={visor} animationType="fade" onRequestClose={() => setVisor(false)} statusBarTranslucent>
        <View style={[styles.visor, { backgroundColor: t.brand.background_dark, paddingTop: insets.top + 8 }]}>
          <StatusBar style="light" />
          <View style={styles.visorHeader}>
            <Text style={[t.typography.heading, { color: t.brand.text_white, flex: 1 }]} numberOfLines={2}>
              {nombre}
            </Text>
            <Pressable onPress={() => setVisor(false)} hitSlop={12} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={28} color={t.brand.text_white} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[styles.visorLista, { paddingBottom: insets.bottom + 24 }]}>
            {fotos.map((src, i) => (
              <View key={i} style={{ gap: 6 }}>
                {fotos.length > 1 ? (
                  <Text style={[t.typography.smallStrong, { color: t.brand.accent_yellow }]}>{ETIQUETAS[i]}</Text>
                ) : null}
                <Image source={src} style={styles.visorFoto} contentFit="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

export function EjercicioMiniatura({ ejercicioId, imagenUri, size = 44 }: FotosProps & { size?: number }) {
  const t = useTheme();
  const [primera] = imagenesDeEjercicio(ejercicioId, imagenUri);
  if (!primera) return null;
  return (
    <Image
      source={primera}
      style={{ width: size, height: size, borderRadius: t.radius.xs, backgroundColor: t.colors.surfaceAlt }}
      contentFit="cover"
    />
  );
}

const styles = StyleSheet.create({
  par: { flexDirection: 'row', gap: 8 },
  celda: { flex: 1, alignItems: 'center', gap: 4 },
  foto: { width: '100%', aspectRatio: 4 / 3 },
  visor: { flex: 1 },
  visorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  visorLista: { paddingHorizontal: 12, gap: 20 },
  visorFoto: { width: '100%', aspectRatio: 4 / 3 },
});
