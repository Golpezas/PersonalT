/**
 * Clientes — pantalla raíz de la tab "Clientes".
 *
 * Lista con búsqueda, estado vacío útil y acceso rápido a ficha/check-in.
 * Todo el styling sale de `useTheme()` para compartir look con el resto de la app.
 */

import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, StyleSheet, Pressable, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore, useUIStore } from '@/stores';
import { Button, Input, Avatar, EmptyState, Badge } from '@/components/ui';
import { formatDate } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';

export default function ClientesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const {
    clientes,
    searchQuery,
    isLoading,
    setClientes,
    setSearchQuery,
    selectCliente,
    setLoading,
    deleteCliente,
  } = useClientesStore();
  const addToast = useUIStore((s) => s.addToast);

  const filteredClientes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        (c.nombre ?? '').toLowerCase().includes(q) ||
        (c.apellido ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
    );
  }, [clientes, searchQuery]);

  const loadClientes = useCallback(() => {
    setLoading(true);
    try {
      const db = getDatabase();
      const result = db.executeSync('SELECT * FROM clientes ORDER BY actualizado_en DESC');
      setClientes(
        result.rows.map((row: any) => ({
          id: row.id,
          nombre: row.nombre ?? '',
          apellido: row.apellido ?? '',
          email: row.email ?? undefined,
          telefono: row.telefono ?? undefined,
          fechaNacimiento: row.fecha_nacimiento,
          sexo: row.sexo,
          altura: Number(row.altura) || 0,
          fotoUri: row.foto_uri ?? undefined,
          creadoEn: row.creado_en,
          actualizadoEn: row.actualizado_en,
        }))
      );
    } catch (error) {
      console.error('Error loading clientes:', error);
      addToast('Error al cargar clientes', 'error');
    } finally {
      setLoading(false);
    }
  }, [setClientes, setLoading, addToast]);

  // Relee SQLite cada vez que la pestaña gana foco (al volver de alta/edición/borrado).
  useFocusEffect(loadClientes);

  const deleteClienteAndData = useCallback(
    (id: string) => {
      try {
        runTransaction((tx) => {
          // Las tablas hijas tienen ON DELETE CASCADE
          tx.executeSync('DELETE FROM clientes WHERE id = ?', [id]);
        });
        deleteCliente(id);
        addToast('Cliente eliminado', 'success');
      } catch (error) {
        console.error('Error deleting cliente:', error);
        addToast('Error al eliminar cliente', 'error');
      }
    },
    [deleteCliente, addToast]
  );

  const handleDelete = useCallback(
    (id: string, nombre: string) => {
      Alert.alert(
        'Eliminar cliente',
        `¿Eliminar a ${nombre}? Se borran su ficha, check-ins, rutinas y entrenamientos. No se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => deleteClienteAndData(id) },
        ]
      );
    },
    [deleteClienteAndData]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => (
      <Pressable
        onPress={() => {
          selectCliente(item.id);
          router.push(`/clientes/${item.id}`);
        }}
        onLongPress={() => handleDelete(item.id, `${item.nombre} ${item.apellido}`)}
        delayLongPress={350}
        accessibilityRole="button"
        accessibilityLabel={`${item.nombre} ${item.apellido}`}
        accessibilityHint="Toca para ver el detalle, mantén presionado para eliminar"
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: t.colors.surface,
            borderColor: t.colors.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Avatar name={`${item.nombre} ${item.apellido}`} size={46} />

        <View style={styles.rowBody}>
          <Text style={[t.typography.bodyStrong, { color: t.colors.text }]} numberOfLines={1}>
            {item.nombre} {item.apellido}
          </Text>
          <View style={styles.rowMeta}>
            {item.email ? (
              <Text style={[t.typography.caption, { color: t.colors.textMuted }]} numberOfLines={1}>
                {item.email}
              </Text>
            ) : (
              <Text style={[t.typography.caption, { color: t.colors.textSubtle }]}>
                Actualizado {formatDate(item.actualizadoEn)}
              </Text>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={t.colors.textSubtle} />
      </Pressable>
    ),
    [t, selectCliente, handleDelete]
  );

  const showSkeleton = isLoading && clientes.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
      {/* ---------------------------------------------------------- Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + t.spacing.md,
            backgroundColor: t.colors.chrome,
            borderBottomColor: t.colors.border,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[t.typography.display, { color: t.colors.text }]}>Clientes</Text>
          <Text style={[t.typography.small, { color: t.colors.textMuted, marginTop: 2 }]}>
            {clientes.length === 0
              ? 'Todavía no hay clientes'
              : `${clientes.length} cliente${clientes.length !== 1 ? 's' : ''} · ${filteredClientes.length} visible${
                  filteredClientes.length !== 1 ? 's' : ''
                }`}
          </Text>
        </View>
        <Button
          onPress={() => router.push('/clientes/nuevo')}
          size="sm"
          leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
        >
          Nuevo
        </Button>
      </View>

      {/* ---------------------------------------------------------- Buscador */}
      <View style={[styles.searchWrap, { backgroundColor: t.colors.bg }]}>
        <Input
          placeholder="Buscar por nombre o email"
          value={searchQuery}
          onChange={setSearchQuery}
          returnKeyType="search"
          leftIcon={<Ionicons name="search" size={18} color={t.colors.textSubtle} />}
          rightIcon={
            searchQuery ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={10} accessibilityLabel="Limpiar búsqueda">
                <Ionicons name="close-circle" size={18} color={t.colors.textSubtle} />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {/* ---------------------------------------------------------- Contenido */}
      {showSkeleton ? (
        <View style={styles.loading}>
          <Text style={[t.typography.body, { color: t.colors.textMuted }]}>Cargando clientes…</Text>
        </View>
      ) : filteredClientes.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          keyExtractor={() => 'empty'}
          contentContainerStyle={styles.listEmpty}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadClientes} tintColor={t.colors.primary} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={searchQuery ? 'search-outline' : 'people-outline'}
              title={searchQuery ? 'Sin resultados' : 'Empezá con tu primer cliente'}
              subtitle={
                searchQuery
                  ? `No encontramos clientes para "${searchQuery}".`
                  : 'Cargá la ficha inicial, diseñá la rutina y seguí el progreso semana a semana.'
              }
              action={
                searchQuery ? (
                  <Button variant="soft" onPress={() => setSearchQuery('')}>
                    Limpiar búsqueda
                  </Button>
                ) : (
                  <Button
                    onPress={() => router.push('/clientes/nuevo')}
                    leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
                  >
                    Crear cliente
                  </Button>
                )
              }
            />
          }
        />
      ) : (
        <FlatList
          data={filteredClientes}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={loadClientes} tintColor={t.colors.primary} />
          }
          ListHeaderComponent={
            clientes.length > 0 ? (
              <View style={styles.listHeader}>
                <Badge label="Mantén presionado para eliminar" icon="information-circle-outline" tone="neutral" />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  searchWrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 10 },
  listEmpty: { flexGrow: 1, justifyContent: 'center' },
  listHeader: { paddingBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
  },
  rowBody: { flex: 1, gap: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});