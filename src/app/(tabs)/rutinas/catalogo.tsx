/**
 * Catálogo de Ejercicios
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRutinasStore, useUIStore } from '@/stores';
import { Card, CardContent, CardHeader, Button } from '@/components/ui';
import { getDatabase } from '@/db/database';
import { getGrupoMuscularLabel, getMuscleGroupColor, getPatronLabel } from '@/utils/helpers';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

export default function CatalogoScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { ejercicios, setEjercicios } = useRutinasStore();
  const { addToast } = useUIStore();
  const [search, setSearch] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const grupos = Array.from(new Set(ejercicios.map(e => e.grupoMuscular)));

  const filteredEjercicios = ejercicios.filter(e => {
    const matchSearch = e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.descripcion?.toLowerCase().includes(search.toLowerCase());
    const matchGrupo = selectedGrupo ? e.grupoMuscular === selectedGrupo : true;
    return matchSearch && matchGrupo;
  });

  const loadEjercicios = useCallback(async () => {
    try {
      const db = getDatabase();
      const result = db.executeSync('SELECT * FROM ejercicios ORDER BY grupo_muscular, nombre');
      const loaded = result.rows.map((row: any) => ({
        id: row.id,
        nombre: row.nombre,
        grupoMuscular: row.grupo_muscular,
        patron: row.patron,
        equipo: JSON.parse(row.equipo || '[]'),
        descripcion: row.descripcion,
        videoUri: row.video_uri,
        imagenUri: row.imagen_uri,
        esCompuesto: row.es_compuesto === 1,
        creadoEn: row.creado_en }));
      setEjercicios(loaded);
    } catch (error) {
      console.error('Error loading ejercicios:', error);
      addToast('Error al cargar ejercicios', 'error');
    } finally {
      setLoading(false);
    }
  }, [setEjercicios, addToast]);

  useEffect(() => {
    loadEjercicios();
  }, [loadEjercicios]);

  const renderEjercicio = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.ejercicioCard} activeOpacity={0.8}>
      <View style={styles.ejercicioLeft}>
        <View style={[styles.grupoDot, { backgroundColor: getMuscleGroupColor(item.grupoMuscular) }]} />
        <View style={styles.ejercicioInfo}>
          <Text style={styles.ejercicioNombre}>{item.nombre}</Text>
          <View style={styles.ejercicioMeta}>
            <Text style={styles.metaText}>{getGrupoMuscularLabel(item.grupoMuscular)}</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{getPatronLabel(item.patron)}</Text>
            {item.esCompuesto && <><Text style={styles.metaDot}>·</Text><Text style={[styles.metaText, { color: '#0ea5e9' }]}>Compuesto</Text></>}
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color="#94a3b8" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Catálogo de Ejercicios</Text>
      <Text style={styles.headerSubtitle}>{filteredEjercicios.length} ejercicios disponibles</Text>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar ejercicio..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color="#94a3b8" /></TouchableOpacity>}
      </View>

      {/* Filtros por grupo muscular */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={[{ id: 'all', label: 'Todos', grupo: null }, ...grupos.map(g => ({ id: g, label: getGrupoMuscularLabel(g), grupo: g }))]}
        keyExtractor={item => item.id}
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
        data={filteredEjercicios}
        renderItem={renderEjercicio}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyList}>
            <Ionicons name="search-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyListText}>No se encontraron ejercicios</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg, padding: 16 },
  headerTitle: { fontSize: 28, fontWeight: '700', color: t.colors.text},
  headerSubtitle: { fontSize: 14, color: t.colors.textMuted, marginTop: 2, marginBottom: 16 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: t.colors.surface, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: t.colors.border, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 16, color: t.colors.text},
  filterList: { gap: 8, marginBottom: 12, paddingRight: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border },
  filterChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  filterChipText: { fontSize: 13, fontWeight: '500', color: t.colors.textMuted},
  filterChipTextActive: { color: t.colors.textInverse },
  listContainer: { gap: 10, paddingBottom: 100 },
  ejercicioCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: t.colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: t.colors.border },
  ejercicioLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  grupoDot: { width: 12, height: 12, borderRadius: 6 },
  ejercicioInfo: { flex: 1 },
  ejercicioNombre: { fontSize: 15, fontWeight: '600', color: t.colors.text},
  ejercicioMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { fontSize: 12, color: t.colors.textMuted},
  metaDot: { fontSize: 12, color: t.colors.textSubtle },
  emptyList: { alignItems: 'center', padding: 48, gap: 12 },
  emptyListText: { fontSize: 14, color: t.colors.textSubtle} });