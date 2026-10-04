/**
 * Cliente Detail Screen
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Alert, Linking } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore, useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardHeader, CardContent, Avatar, SegmentedControl } from '@/components/ui';
import { formatDate, calculateIMC, calculateIMCClassification } from '@/utils/helpers';
import { useMetas } from '@/hooks/useMetas';
import { getDatabase } from '@/db/database';
import type { Theme } from '@/constants/theme';

type Params = { id: string };

/** Lectura síncrona: op-sqlite es sync, no hace falta esperar un async. */
function leerCliente(id: string) {
  try {
    const db = getDatabase();
    const result = db.executeSync('SELECT * FROM clientes WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    const c = result.rows[0];
    return {
      id: c.id,
      nombre: c.nombre,
      apellido: c.apellido,
      email: c.email,
      telefono: c.telefono,
      fechaNacimiento: c.fecha_nacimiento,
      sexo: c.sexo,
      altura: c.altura,
      fotoUri: c.foto_uri,
      creadoEn: c.creado_en };
  } catch (error) {
    console.error('Error loading cliente detail:', error);
    return null;
  }
}

export default function ClienteDetailScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<Params>();
  const { selectedClienteId, selectCliente, getSelectedCliente } = useClientesStore();
  const { getFicha, getLatestCheckin, calculateDeltas } = useProgresoStore();
  const { addToast } = useUIStore();
  const [cliente, setCliente] = React.useState<any>(() => leerCliente(id));
  const [activeTab, setActiveTab] = React.useState('ficha');

  const ficha = getFicha(id);
  const latestCheckin = getLatestCheckin(id);
  const deltas = calculateDeltas(id);
  const { conProgreso: metasConProgreso } = useMetas(id);

  // Si cambia el id en la misma instancia (navegación interna), reajusta durante
  // el render en vez de en un efecto — patrón oficial de React para estado derivado.
  const [idCargado, setIdCargado] = React.useState(id);
  if (idCargado !== id) {
    setIdCargado(id);
    setCliente(leerCliente(id));
    setActiveTab('ficha');
  }

  // Efecto real: seleccionar el cliente en el store global (efecto secundario).
  useEffect(() => {
    if (id) selectCliente(id);
  }, [id, selectCliente]);

  if (!cliente) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.colors.bg }]}>
        <Ionicons name="person-outline" size={44} color={t.colors.textSubtle} />
        <Text style={[t.typography.subheading, { color: t.colors.text }]}>Cliente no encontrado</Text>
        <Button variant="soft" onPress={() => router.back()}>
          Volver
        </Button>
      </View>
    );
  }

  const imc = ficha ? calculateIMC(ficha.peso, cliente.altura) : null;
  const imcClass = imc ? calculateIMCClassification(imc) : null;

  const handleCall = () => cliente.telefono && Linking.openURL(`tel:${cliente.telefono}`);
  const handleEmail = () => cliente.email && Linking.openURL(`mailto:${cliente.email}`);

  const handleDelete = () => {
    Alert.alert(
      'Eliminar cliente',
      `¿Eliminar a ${cliente.nombre} ${cliente.apellido}? Se borrarán todos sus datos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => deleteCliente() },
      ]
    );
  };

  const deleteCliente = async () => {
    try {
      const db = getDatabase();
      db.executeSync('DELETE FROM clientes WHERE id = ?', [id]);
      addToast('Cliente eliminado', 'success');
      router.back();
    } catch (error) {
      addToast('Error al eliminar', 'error');
    }
  };

  const tabs = [
    { key: 'ficha', label: 'Ficha' },
    { key: 'checkins', label: 'Check-ins' },
    { key: 'rutinas', label: 'Rutinas' },
    { key: 'metas', label: 'Metas' },
  ] as const;

  return (
    <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + t.spacing.sm,
            backgroundColor: t.colors.chrome,
            borderBottomColor: t.colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={[styles.backBtn, { backgroundColor: t.colors.surfaceAlt }]}
        >
          <Ionicons name="chevron-back" size={20} color={t.colors.text} />
        </Pressable>

        <Avatar name={`${cliente.nombre} ${cliente.apellido}`} size={46} />

        <View style={styles.headerInfo}>
          <Text style={[t.typography.heading, { color: t.colors.text }]} numberOfLines={1}>
            {cliente.nombre} {cliente.apellido}
          </Text>
          <View style={styles.headerMeta}>
            {cliente.email ? (
              <TouchableOpacity onPress={handleEmail} style={styles.metaItem} hitSlop={6}>
                <Ionicons name="mail-outline" size={13} color={t.colors.textMuted} />
                <Text style={[t.typography.caption, { color: t.colors.textMuted }]} numberOfLines={1}>
                  {cliente.email}
                </Text>
              </TouchableOpacity>
            ) : null}
            {cliente.telefono ? (
              <TouchableOpacity onPress={handleCall} style={styles.metaItem} hitSlop={6}>
                <Ionicons name="call-outline" size={13} color={t.colors.textMuted} />
                <Text style={[t.typography.caption, { color: t.colors.textMuted }]}>
                  {cliente.telefono}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <TouchableOpacity onPress={handleDelete} hitSlop={10} style={styles.deleteButton}>
          <Ionicons name="trash-outline" size={19} color={t.colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBarWrap}>
        <SegmentedControl
          options={tabs.map((x) => ({ key: x.key, label: x.label }))}
          value={activeTab as (typeof tabs)[number]['key']}
          onChange={(k) => setActiveTab(k as string)}
        />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ficha Inicial Tab */}
        {activeTab === 'ficha' && (
          <>
            {ficha ? (
              <>
                <Card style={styles.summaryCard}>
                  <CardHeader title="Resumen Antropométrico" />
                  <CardContent>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Peso</Text>
                        <Text style={styles.summaryValue}>{ficha.peso.toFixed(1)} kg</Text>
                        {deltas && (
                          <Text style={[
                            styles.summaryDelta,
                            deltas.peso > 0 ? styles.deltaPositive : deltas.peso < 0 ? styles.deltaNegative : styles.deltaNeutral,
                          ]}>
                            {deltas.peso > 0 ? '+' : ''}{deltas.peso.toFixed(1)} kg
                          </Text>
                        )}
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Grasa Corporal</Text>
                        <Text style={styles.summaryValue}>{ficha.grasaCorporal?.toFixed(1) || '-'}%</Text>
                        {deltas && deltas.grasaCorporal !== undefined && (
                          <Text style={[
                            styles.summaryDelta,
                            deltas.grasaCorporal > 0 ? styles.deltaPositive : deltas.grasaCorporal < 0 ? styles.deltaNegative : styles.deltaNeutral,
                          ]}>
                            {deltas.grasaCorporal > 0 ? '+' : ''}{deltas.grasaCorporal.toFixed(1)}%
                          </Text>
                        )}
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Masa Muscular</Text>
                        <Text style={styles.summaryValue}>{ficha.musculatura?.toFixed(1) || '-'} kg</Text>
                        {deltas && deltas.musculatura !== undefined && (
                          <Text style={[
                            styles.summaryDelta,
                            deltas.musculatura > 0 ? styles.deltaNegative : deltas.musculatura < 0 ? styles.deltaPositive : styles.deltaNeutral,
                          ]}>
                            {deltas.musculatura > 0 ? '+' : ''}{deltas.musculatura.toFixed(1)} kg
                          </Text>
                        )}
                      </View>
                      {imc && (
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>IMC</Text>
                          <Text style={styles.summaryValue}>{imc.toFixed(1)}</Text>
                          <Text style={styles.summaryDelta}>{imcClass}</Text>
                        </View>
                      )}
                    </View>
                  </CardContent>
                </Card>

                <Card style={styles.sectionCard}>
                  <CardHeader title="Perímetros (cm)" />
                  <CardContent>
                    <View style={styles.perimetrosGrid}>
                      {[
                        { key: 'pecho', label: 'Pecho' },
                        { key: 'brazoIzq', label: 'Brazo Izq' },
                        { key: 'brazoDer', label: 'Brazo Der' },
                        { key: 'antebrazoIzq', label: 'Ant. Izq' },
                        { key: 'antebrazoDer', label: 'Ant. Der' },
                        { key: 'cintura', label: 'Cintura' },
                        { key: 'cadera', label: 'Cadera' },
                        { key: 'piernaIzq', label: 'Pierna Izq' },
                        { key: 'piernaDer', label: 'Pierna Der' },
                        { key: 'pantorrillaIzq', label: 'Pant. Izq' },
                        { key: 'pantorrillaDer', label: 'Pant. Der' },
                      ].map((p) => (
                        <View key={p.key} style={styles.perimetroItem}>
                          <Text style={styles.perimetroLabel}>{p.label}</Text>
                          <Text style={styles.perimetroValue}>{ficha.perimetros[p.key as any].toFixed(1)}</Text>
                          {deltas && deltas.perimetros[p.key as any] !== undefined && (
                            <Text style={[
                              styles.perimetroDelta,
                              deltas.perimetros[p.key as any]! > 0 ? styles.deltaPositive :
                              deltas.perimetros[p.key as any]! < 0 ? styles.deltaNegative : styles.deltaNeutral,
                            ]}>
                              {deltas.perimetros[p.key as any]! > 0 ? '+' : ''}{deltas.perimetros[p.key as any]!.toFixed(1)}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </CardContent>
                </Card>

                {ficha.observaciones && (
                  <Card style={styles.sectionCard}>
                    <CardHeader title="Observaciones" />
                    <CardContent>
                      <Text style={styles.notesText}>{ficha.observaciones}</Text>
                    </CardContent>
                  </Card>
                )}

                {ficha.lesionLimitaciones && (
                  <Card style={styles.sectionCard}>
                    <CardHeader title="Lesiones / Limitaciones" />
                    <CardContent>
                      <Text style={styles.notesText}>{ficha.lesionLimitaciones}</Text>
                    </CardContent>
                  </Card>
                )}

                <View style={styles.buttonRow}>
                  <Button variant="primary" onPress={() => router.push(`/clientes/${id}/ficha/nueva`)} leftIcon={<Ionicons name="add" size={18} color="#fff" />}>
                    Nuevo Check-in
                  </Button>
                  <Button variant="outline" onPress={() => router.push(`/clientes/${id}/ficha/editar`)} style={styles.editButton}>
                    Editar Ficha
                  </Button>
                </View>
              </>
            ) : (
              <Card style={styles.emptyCard}>
                <CardContent style={styles.emptyContent}>
                  <Ionicons name="document-text-outline" size={64} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Sin Ficha Inicial</Text>
                  <Text style={styles.emptySubtitle}>Crea la ficha inicial para empezar el seguimiento</Text>
                  <Button variant="primary" onPress={() => router.push(`/clientes/${id}/ficha/nueva`)} style={styles.emptyButton} leftIcon={<Ionicons name="add" size={18} color="#fff" />}>
                    Crear Ficha Inicial
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Check-ins Tab */}
        {activeTab === 'checkins' && (
          <>
            <View style={styles.buttonRow}>
              <Button variant="primary" onPress={() => router.push(`/clientes/${id}/ficha/nueva`)} leftIcon={<Ionicons name="add" size={18} color="#fff" />}>
                Nuevo Check-in
              </Button>
            </View>
            {latestCheckin ? (
              <Card style={styles.sectionCard}>
                <CardHeader title="Último Check-in" subtitle={`Semana ${latestCheckin.semana} - ${formatDate(latestCheckin.fecha)}`} />
                <CardContent>
                  <View style={styles.checkinSummary}>
                    <View style={styles.checkinItem}>
                      <Text style={styles.checkinLabel}>Peso</Text>
                      <Text style={styles.checkinValue}>{latestCheckin.peso.toFixed(1)} kg</Text>
                      {deltas && (
                        <Text style={[
                          styles.checkinDelta,
                          deltas.peso > 0 ? styles.deltaPositive : deltas.peso < 0 ? styles.deltaNegative : styles.deltaNeutral,
                        ]}>
                          {deltas.peso > 0 ? '+' : ''}{deltas.peso.toFixed(1)} kg
                        </Text>
                      )}
                    </View>
                    <View style={styles.checkinItem}>
                      <Text style={styles.checkinLabel}>Adherencia</Text>
                      <Text style={styles.checkinValue}>{latestCheckin.adherencia}/5</Text>
                    </View>
                    <View style={styles.checkinItem}>
                      <Text style={styles.checkinLabel}>Energía</Text>
                      <Text style={styles.checkinValue}>{latestCheckin.energia}/5</Text>
                    </View>
                    <View style={styles.checkinItem}>
                      <Text style={styles.checkinLabel}>Sueño</Text>
                      <Text style={styles.checkinValue}>{latestCheckin.sueno}/5</Text>
                    </View>
                  </View>
                  {latestCheckin.notas && (
                    <Text style={styles.notesText}>{latestCheckin.notas}</Text>
                  )}
                </CardContent>
              </Card>
            ) : null}
            <Card style={styles.sectionCard}>
              <CardHeader title="Historial de Check-ins" />
              <CardContent>
                <Text style={styles.comingSoon}>Próximamente: lista completa de check-ins</Text>
              </CardContent>
            </Card>
          </>
        )}

        {/* Rutinas Tab */}
        {activeTab === 'rutinas' && (
          <Card style={styles.sectionCard}>
            <CardHeader
              title="Rutinas Asignadas"
              action={
                <Button variant="primary" size="sm" onPress={() => router.push(`/rutinas/nuevo?cliente=${id}`)} leftIcon={<Ionicons name="add" size={16} color="#fff" />}>
                  Nueva
                </Button>
              }
            />
            <CardContent>
              <Text style={styles.comingSoon}>Próximamente: lista de rutinas del cliente</Text>
            </CardContent>
          </Card>
        )}

        {/* Metas Tab */}
        {activeTab === 'metas' && (
          <>
            <View style={styles.buttonRow}>
              <Button variant="primary" onPress={() => router.push(`/clientes/${id}/meta/nueva`)} leftIcon={<Ionicons name="add" size={18} color="#fff" />}>
                Nueva Meta
              </Button>
            </View>
            {metasConProgreso.length > 0 ? (
              metasConProgreso.map(({ meta, progreso }) => (
                <Card
                  key={meta.id}
                  style={styles.sectionCard}
                >
                  <CardContent>
                    <TouchableOpacity
                      style={styles.metaItemCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/clientes/${id}/meta/${meta.id}`)}
                    >
                      <View style={styles.metaInfo}>
                        <View style={styles.metaTitleRow}>
                          <Text style={styles.metaTitle} numberOfLines={1}>{meta.descripcion}</Text>
                          {meta.estado === 'lograda' && (
                            <View style={styles.metaBadgeLograda}>
                              <Text style={styles.metaBadgeLogradaText}>Lograda</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.metaSubtitle}>
                          {Math.round(meta.valorInicial * 10) / 10} {meta.unidad} → {Math.round(meta.valorObjetivo * 10) / 10} {meta.unidad}
                          {progreso.valorActual != null && ` · actual ${Math.round(progreso.valorActual * 10) / 10}`}
                          {' | '}
                          {formatDate(meta.fechaObjetivo)}
                        </Text>
                        <View style={styles.metaTrack}>
                          <View
                            style={[
                              styles.metaTrackFill,
                              {
                                width: `${Math.max(2, Math.min(100, progreso.porcentaje))}%`,
                                backgroundColor: progreso.lograda ? '#22c55e' : '#0ea5e9' },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.metaProgress}>
                        <Text style={styles.metaPercent}>{Math.round(progreso.porcentaje)}%</Text>
                        <Ionicons name="chevron-forward" size={14} color="#94a3b8" />
                      </View>
                    </TouchableOpacity>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <CardContent style={styles.emptyContent}>
                  <Ionicons name="flag-outline" size={64} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Sin Metas</Text>
                  <Text style={styles.emptySubtitle}>Define objetivos medibles para motivar a tu cliente</Text>
                  <Button variant="primary" onPress={() => router.push(`/clientes/${id}/meta/nueva`)} style={styles.emptyButton} leftIcon={<Ionicons name="add" size={18} color="#fff" />}>
                    Crear Meta
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1 },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  tabBarWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  headerInfo: { flex: 1, gap: 2 },
  clientName: { fontSize: 20, fontWeight: '600', color: t.colors.text},
  headerMeta: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: t.colors.textMuted},
  tabBar: {
    flexDirection: 'row',
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    paddingHorizontal: 8 },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12 },
  tabButtonActive: { backgroundColor: t.colors.primarySoft },
  tabLabel: { fontSize: 12, fontWeight: '500', color: t.colors.textSubtle},
  tabLabelActive: { color: t.colors.primary, fontWeight: '600' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  summaryCard: { borderWidth: 1, borderColor: t.colors.border },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  summaryItem: { flex: 1, minWidth: '45%', gap: 4 },
  summaryLabel: { fontSize: 12, color: t.colors.textSubtle},
  summaryValue: { fontSize: 20, fontWeight: '700', color: t.colors.text},
  summaryDelta: { fontSize: 12, fontWeight: '500'},
  deltaPositive: { color: t.colors.success },
  deltaNegative: { color: t.colors.danger },
  deltaNeutral: { color: t.colors.textMuted },
  sectionCard: { borderWidth: 1, borderColor: t.colors.border },
  perimetrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  perimetroItem: { flex: 1, minWidth: '30%', gap: 2, alignItems: 'center' },
  perimetroLabel: { fontSize: 11, color: t.colors.textSubtle, textAlign: 'center' },
  perimetroValue: { fontSize: 16, fontWeight: '600', color: t.colors.text},
  perimetroDelta: { fontSize: 11, fontWeight: '500'},
  notesText: { fontSize: 14, color: t.colors.text, lineHeight: 22},
  buttonRow: { flexDirection: 'row', gap: 12 },
  editButton: { flex: 1 },
  emptyCard: { borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed' },
  emptyContent: { alignItems: 'center', padding: 32, gap: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: t.colors.text},
  emptySubtitle: { fontSize: 14, color: t.colors.textSubtle, textAlign: 'center'},
  emptyButton: { marginTop: 8, minWidth: 200 },
  checkinSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  checkinItem: { flex: 1, minWidth: '45%', gap: 4 },
  checkinLabel: { fontSize: 12, color: t.colors.textSubtle},
  checkinValue: { fontSize: 18, fontWeight: '600', color: t.colors.text},
  checkinDelta: { fontSize: 12, fontWeight: '500'},
  comingSoon: { fontSize: 14, color: t.colors.textSubtle, textAlign: 'center', padding: 32},
  metaItemCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  metaInfo: { flex: 1, gap: 2 },
  metaTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, flexShrink: 1 },
  metaBadgeLograda: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: t.colors.success },
  metaBadgeLogradaText: { fontSize: 10, fontWeight: '700', color: t.colors.textInverse},
  metaSubtitle: { fontSize: 13, color: t.colors.textMuted, marginTop: 2},
  metaTrack: { height: 6, backgroundColor: t.colors.surfaceAlt, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  metaTrackFill: { height: '100%', borderRadius: 3 },
  metaProgress: { alignItems: 'flex-end', gap: 2 },
  metaPercent: { fontSize: 14, fontWeight: '700', color: t.colors.primary, textAlign: 'right' } });