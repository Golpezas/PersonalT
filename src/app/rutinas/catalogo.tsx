/**
 * Catálogo de Ejercicios
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRutinasStore, useUIStore } from '@/stores';
import { getDatabase } from '@/db/database';
import { getEquipoLabel, getGrupoMuscularLabel, getMuscleGroupColor, getPatronLabel } from '@/utils/helpers';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { Ejercicio } from '@/types';

/** Lee el catálogo completo desde SQLite (fuente de verdad). */
function leerEjercicios(): Ejercicio[] {
  const rows = getDatabase().executeSync('SELECT * FROM ejercicios ORDER BY grupo_muscular, nombre').rows as any[];
  return rows.map((row) => {
    let equipo: Ejercicio['equipo'] = [];
    try {
      const parsed = JSON.parse(row.equipo || '[]');
      equipo = Array.isArray(parsed) ? parsed : [];
    } catch {
      equipo = [];
    }
    return {
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      grupoMuscular: row.grupo_muscular,
      patron: row.patron,
      equipo,
      descripcion: row.descripcion ?? '',
      videoUri: row.video_uri ?? undefined,
      imagenUri: row.imagen_uri ?? undefined,
      esCompuesto: row.es_compuesto === 1,
      creadoEn: row.creado_en };
  });
}

export default function CatalogoScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { ejercicios, setEjercicios } = useRutinasStore();
  const { addToast } = useUIStore();
  const [search, setSearch] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setEjercicios(leerEjercicios());
      } catch (error) {
        console.error('Error loading ejercicios:', error);
        addToast('Error al cargar ejercicios', 'error');
      }
    }, [setEjercicios, addToast])
  );

  const grupos = useMemo(() => Array.from(new Set(ejercicios.map((e) => e.grupoMuscular))), [ejercicios]);

  const filteredEjercicios = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ejercicios.filter((e) => {
      const matchSearch =
        !q ||
        (e.nombre ?? '').toLowerCase().includes(q) ||
        (e.descripcion ?? '').toLowerCase().includes(q) ||
        getGrupoMuscularLabel(e.grupoMuscular).toLowerCase().includes(q);
      const matchGrupo = selectedGrupo ? e.grupoMuscular === selectedGrupo : true;
      return matchSearch && matchGrupo;
    });
  }, [ejercicios, search, selectedGrupo]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/rutinas'));

  const renderEjercicio = ({ item }: { item: Ejercicio }) => {
    const abierto = expandido === item.id;
    return (
      <TouchableOpacity
        style={styles.ejercicioCard}
        activeOpacity={0.8}
        onPress={() => setExpandido(abierto ? null : item.id)}
      >
        <View style={styles.ejercicioRow}>
          <View style={styles.ejercicioLeft}>
            <View style={[styles.grupoDot, { backgroundColor: getMuscleGroupColor(item.grupoMuscular) }]} />
            <View style={styles.ejercicioInfo}>
              <Text style={styles.ejercicioNombre}>{item.nombre}</Text>
              <View style={styles.ejercicioMeta}>
                <Text style={styles.metaText}>{getGrupoMuscularLabel(item.grupoMuscular)}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{getPatronLabel(item.patron)}</Text>
                {item.esCompuesto ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={[styles.metaText, { color: t.colors.primary }]}>Compuesto</Text>
                  </>
                ) : null}
              </View>
            </View>
          </View>
          <Ionicons name={abierto ? 'chevron-up' : 'chevron-down'} size={20} color={t.colors.textSubtle} />
        </View>
        {abierto ? (
          <View style={styles.detalle}>
            {item.equipo.length > 0 ? (
              <Text style={styles.detalleText}>
                <Text style={styles.detalleLabel}>Equipo: </Text>
                {item.equipo.map(getEquipoLabel).join(', ')}
              </Text>
            ) : null}
            <Text style={styles.detalleText}>{item.descripcion ? item.descripcion : 'Sin descripción.'}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={volver} style={styles.backBtn} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={t.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Catálogo de Ejercicios</Text>
          <Text style={styles.headerSubtitle}>{filteredEjercicios.length} ejercicios disponibles</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={t.colors.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ejercicio..."
          placeholderTextColor={t.colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={t.colors.textSubtle} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filtros por grupo muscular */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        data={[{ id: 'all', label: 'Todos', grupo: null as string | null }, ...grupos.map((g) => ({ id: g, label: getGrupoMuscularLabel(g), grupo: g as string | null }))]}
        keyExtractor={(item) => item.id}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterChip, selectedGrupo === item.grupo && styles.filterChipActive]}
            onPress={() => setSelectedGrupo(item.grupo === selectedGrupo ? null : item.grupo)}
          >
            <Text style={[styles.filterChipText, selectedGrupo === item.grupo && styles.filterChipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Lista */}
      <FlatList
        style={{ flex: 1 }}
        data={filteredEjercicios}
        renderItem={renderEjercicio}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.listContainer, { paddingBottom: 32 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="search-outline" size={48} color={t.colors.textSubtle} />
            <Text style={styles.emptyListText}>No se encontraron ejercicios</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  backBtn: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: t.colors.text },
  headerSubtitle: { fontSize: 14, color: t.colors.textMuted, marginTop: 2 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: t.colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: t.colors.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 16, color: t.colors.text, paddingVertical: 0 },
  filterScroll: { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  filterList: { gap: 8, paddingRight: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border },
  filterChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '500', color: t.colors.textMuted },
  filterChipTextActive: { color: t.colors.onPrimary },
  listContainer: { gap: 10 },
  ejercicioCard: {
    backgroundColor: t.colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.colors.border },
  ejercicioRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ejercicioLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  grupoDot: { width: 12, height: 12, borderRadius: 6 },
  ejercicioInfo: { flex: 1 },
  ejercicioNombre: { fontSize: 15, fontWeight: '600', color: t.colors.text },
  ejercicioMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  metaText: { fontSize: 12, color: t.colors.textMuted },
  metaDot: { fontSize: 12, color: t.colors.textSubtle },
  detalle: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.border, gap: 6 },
  detalleLabel: { fontWeight: '600', color: t.colors.text },
  detalleText: { fontSize: 13, lineHeight: 19, color: t.colors.textMuted },
  emptyList: { alignItems: 'center', padding: 48, gap: 12 },
  emptyListText: { fontSize: 14, color: t.colors.textSubtle } });
