/**
 * Cliente Detail Screen
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Pressable, Alert, Linking } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore, useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardHeader, CardContent, Avatar, SegmentedControl } from '@/components/ui';
import { formatDate, formatDecimal, calculateIMC, calculateIMCClassification, createEmptyPerimetros, createEmptyFotos } from '@/utils/helpers';
import { useMetas } from '@/hooks/useMetas';
import { getDatabase } from '@/db/database';
import { leerRutinas, type RutinaDetalle } from '@/services/rutinas';
import type { Theme } from '@/constants/theme';
import type { CheckinSemanal, FichaInicial, FotosProgreso, Perimetros } from '@/types';

type Params = { id: string };
type Row = any;
type TabKey = 'ficha' | 'checkins' | 'rutinas' | 'metas';

interface ClienteDetalle {
  id: string;
  nombre: string;
  apellido: string;
  email?: string;
  telefono?: string;
  fechaNacimiento: string;
  sexo: string;
  altura: number;
  fotoUri?: string;
  creadoEn: string;
}

interface DatosCliente {
  cliente: ClienteDetalle | null;
  ficha: FichaInicial | null;
  checkins: CheckinSemanal[];
  rutinas: RutinaDetalle[];
}

const PERIMETROS_VISIBLES: { key: keyof Perimetros; label: string }[] = [
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
];

const TABS: { key: TabKey; label: string }[] = [
  { key: 'ficha', label: 'Ficha' },
  { key: 'checkins', label: 'Check-ins' },
  { key: 'rutinas', label: 'Rutinas' },
  { key: 'metas', label: 'Metas' },
];

const numeroOpcional = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

const parseJSONObjeto = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

const parsePerimetros = (raw: unknown): Perimetros => {
  const data = parseJSONObjeto(raw);
  const base = createEmptyPerimetros();
  for (const k of Object.keys(base) as (keyof Perimetros)[]) base[k] = numeroOpcional(data[k]) ?? 0;
  return base;
};

const parseFotos = (raw: unknown): FotosProgreso => {
  const data = parseJSONObjeto(raw);
  const base = createEmptyFotos();
  for (const k of Object.keys(base) as (keyof FotosProgreso)[]) base[k] = typeof data[k] === 'string' ? (data[k] as string) : '';
  return base;
};

const rating = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v) || 3))) as 1 | 2 | 3 | 4 | 5;

/** Lectura síncrona: op-sqlite es sync, no hace falta esperar un async. */
function leerDatosCliente(id: string): DatosCliente {
  const vacio: DatosCliente = { cliente: null, ficha: null, checkins: [], rutinas: [] };
  if (!id) return vacio;
  try {
    const db = getDatabase();
    const c = db.executeSync('SELECT * FROM clientes WHERE id = ?', [id]).rows[0] as Row | undefined;
    if (!c) return vacio;

    const f = db.executeSync(
      'SELECT * FROM fichas_iniciales WHERE cliente_id = ? ORDER BY creado_en DESC LIMIT 1',
      [id]
    ).rows[0] as Row | undefined;
    const checkinRows = db.executeSync(
      'SELECT * FROM checkins_semanales WHERE cliente_id = ? ORDER BY semana ASC, creado_en ASC',
      [id]
    ).rows as Row[];

    return {
      cliente: {
        id: c.id,
        nombre: c.nombre ?? '',
        apellido: c.apellido ?? '',
        email: c.email ?? undefined,
        telefono: c.telefono ?? undefined,
        fechaNacimiento: c.fecha_nacimiento,
        sexo: c.sexo,
        altura: Number(c.altura) || 0,
        fotoUri: c.foto_uri ?? undefined,
        creadoEn: c.creado_en,
      },
      ficha: f
        ? {
            id: f.id,
            clienteId: f.cliente_id,
            fecha: f.fecha,
            peso: Number(f.peso) || 0,
            grasaCorporal: numeroOpcional(f.grasa_corporal),
            musculatura: numeroOpcional(f.musculatura),
            perimetros: parsePerimetros(f.perimetros),
            fotos: parseFotos(f.fotos),
            observaciones: f.observaciones ?? '',
            lesionLimitaciones: f.lesion_limitaciones ?? '',
            creadoEn: f.creado_en,
          }
        : null,
      checkins: checkinRows.map((r) => ({
        id: r.id,
        clienteId: r.cliente_id,
        semana: Number(r.semana) || 0,
        fecha: r.fecha,
        peso: Number(r.peso) || 0,
        grasaCorporal: numeroOpcional(r.grasa_corporal),
        musculatura: numeroOpcional(r.musculatura),
        perimetros: parsePerimetros(r.perimetros),
        fotos: parseFotos(r.fotos),
        energia: rating(r.energia),
        sueno: rating(r.sueno),
        estres: rating(r.estres),
        adherencia: rating(r.adherencia),
        notas: r.notas ?? '',
        creadoEn: r.creado_en,
      })),
      rutinas: leerRutinas(id),
    };
  } catch (error) {
    console.error('Error loading cliente detail:', error);
    return vacio;
  }
}

function calcularDeltas(ficha: FichaInicial | null, latest: CheckinSemanal | undefined) {
  if (!ficha || !latest) return null;
  const perimetros: Partial<Record<keyof Perimetros, number>> = {};
  for (const { key } of PERIMETROS_VISIBLES) {
    const inicial = ficha.perimetros[key];
    const actual = latest.perimetros[key];
    if (inicial > 0 && actual > 0) perimetros[key] = Number((actual - inicial).toFixed(1));
  }
  return {
    peso: Number((latest.peso - ficha.peso).toFixed(1)),
    grasaCorporal:
      latest.grasaCorporal != null && ficha.grasaCorporal != null
        ? Number((latest.grasaCorporal - ficha.grasaCorporal).toFixed(1))
        : undefined,
    musculatura:
      latest.musculatura != null && ficha.musculatura != null
        ? Number((latest.musculatura - ficha.musculatura).toFixed(1))
        : undefined,
    perimetros,
  };
}

export default function ClienteDetailScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<Params>();
  const selectCliente = useClientesStore((s) => s.selectCliente);
  const quitarClienteDelStore = useClientesStore((s) => s.deleteCliente);
  const addToast = useUIStore((s) => s.addToast);
  const [datos, setDatos] = React.useState<DatosCliente>(() => leerDatosCliente(id));
  const [activeTab, setActiveTab] = React.useState<TabKey>('ficha');
  const { conProgreso: metasConProgreso, reload: recargarMetas } = useMetas(id);

  // Si cambia el id en la misma instancia (navegación interna), reajusta durante
  // el render en vez de en un efecto — patrón oficial de React para estado derivado.
  const [idCargado, setIdCargado] = React.useState(id);
  if (idCargado !== id) {
    setIdCargado(id);
    setDatos(leerDatosCliente(id));
    setActiveTab('ficha');
  }

  // SQLite es la fuente de verdad: se relee al volver de los formularios y se
  // refleja en el store para los hooks compartidos (useMetas, useGuardFicha).
  useFocusEffect(
    useCallback(() => {
      const nuevos = leerDatosCliente(id);
      if (id) {
        useProgresoStore.setState((s) => {
          const fichas = { ...s.fichas };
          if (nuevos.ficha) fichas[id] = nuevos.ficha;
          else delete fichas[id];
          return { fichas, checkins: { ...s.checkins, [id]: nuevos.checkins } };
        });
      }
      setDatos(nuevos);
      recargarMetas();
    }, [id, recargarMetas])
  );

  // Efecto real: seleccionar el cliente en el store global (efecto secundario).
  useEffect(() => {
    if (id) selectCliente(id);
  }, [id, selectCliente]);

  const { cliente, ficha, checkins, rutinas } = datos;
  const latestCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : undefined;
  const deltas = calcularDeltas(ficha, latestCheckin);

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/clientes'));

  if (!cliente) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: t.colors.bg, paddingTop: insets.top }]}>
        <Ionicons name="person-outline" size={44} color={t.colors.textSubtle} />
        <Text style={[t.typography.subheading, { color: t.colors.text }]}>Cliente no encontrado</Text>
        <Button variant="soft" onPress={volver}>
          Volver
        </Button>
      </View>
    );
  }

  const pesoActual = latestCheckin?.peso ?? ficha?.peso;
  const imc = pesoActual && cliente.altura > 0 ? calculateIMC(pesoActual, cliente.altura) : null;
  const imcClass = imc ? calculateIMCClassification(imc) : null;

  const handleCall = () => {
    if (cliente.telefono) Linking.openURL(`tel:${cliente.telefono}`).catch(() => addToast('No se pudo abrir el teléfono', 'error'));
  };
  const handleEmail = () => {
    if (cliente.email) Linking.openURL(`mailto:${cliente.email}`).catch(() => addToast('No se pudo abrir el email', 'error'));
  };

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

  const deleteCliente = () => {
    try {
      const db = getDatabase();
      db.executeSync('DELETE FROM clientes WHERE id = ?', [id]);
      quitarClienteDelStore(id);
      addToast('Cliente eliminado', 'success');
      router.dismissTo('/clientes');
    } catch (error) {
      console.error('Error deleting cliente:', error);
      addToast('Error al eliminar', 'error');
    }
  };

  const nuevoCheckin = () => router.push(`/clientes/${id}/checkin/nueva`);

  const deltaStyle = (v: number) => (v > 0 ? styles.deltaPositive : v < 0 ? styles.deltaNegative : styles.deltaNeutral);
  const fmtDelta = (v: number, unidad: string) => `${v > 0 ? '+' : ''}${formatDecimal(v)}${unidad}`;

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
          onPress={volver}
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

        <TouchableOpacity
          onPress={handleDelete}
          hitSlop={10}
          style={styles.deleteButton}
          accessibilityRole="button"
          accessibilityLabel="Eliminar cliente"
        >
          <Ionicons name="trash-outline" size={19} color={t.colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBarWrap}>
        <SegmentedControl<TabKey> options={TABS} value={activeTab} onChange={setActiveTab} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ficha Inicial Tab */}
        {activeTab === 'ficha' && (
          <>
            {ficha ? (
              <>
                <Card style={styles.summaryCard}>
                  <CardHeader title="Resumen Antropométrico" subtitle={`Ficha inicial · ${formatDate(ficha.fecha)}`} />
                  <CardContent>
                    <View style={styles.summaryGrid}>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Peso</Text>
                        <Text style={styles.summaryValue}>{formatDecimal(ficha.peso)} kg</Text>
                        {deltas ? (
                          <Text style={[styles.summaryDelta, deltaStyle(deltas.peso)]}>{fmtDelta(deltas.peso, ' kg')}</Text>
                        ) : null}
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Grasa Corporal</Text>
                        <Text style={styles.summaryValue}>
                          {ficha.grasaCorporal != null ? `${formatDecimal(ficha.grasaCorporal)}%` : '-'}
                        </Text>
                        {deltas?.grasaCorporal !== undefined ? (
                          <Text style={[styles.summaryDelta, deltaStyle(deltas.grasaCorporal)]}>
                            {fmtDelta(deltas.grasaCorporal, '%')}
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.summaryItem}>
                        <Text style={styles.summaryLabel}>Masa Muscular</Text>
                        <Text style={styles.summaryValue}>
                          {ficha.musculatura != null ? `${formatDecimal(ficha.musculatura)} kg` : '-'}
                        </Text>
                        {deltas?.musculatura !== undefined ? (
                          <Text style={[styles.summaryDelta, deltaStyle(deltas.musculatura)]}>
                            {fmtDelta(deltas.musculatura, ' kg')}
                          </Text>
                        ) : null}
                      </View>
                      {imc ? (
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>IMC actual</Text>
                          <Text style={styles.summaryValue}>{formatDecimal(imc)}</Text>
                          <Text style={[styles.summaryDelta, styles.deltaNeutral]}>{imcClass}</Text>
                        </View>
                      ) : null}
                    </View>
                  </CardContent>
                </Card>

                <Card style={styles.sectionCard}>
                  <CardHeader title="Perímetros (cm)" />
                  <CardContent>
                    <View style={styles.perimetrosGrid}>
                      {PERIMETROS_VISIBLES.map((p) => {
                        const delta = deltas?.perimetros[p.key];
                        return (
                          <View key={p.key} style={styles.perimetroItem}>
                            <Text style={styles.perimetroLabel}>{p.label}</Text>
                            <Text style={styles.perimetroValue}>
                              {ficha.perimetros[p.key] > 0 ? formatDecimal(ficha.perimetros[p.key]) : '-'}
                            </Text>
                            {delta !== undefined ? (
                              <Text style={[styles.perimetroDelta, deltaStyle(delta)]}>{fmtDelta(delta, '')}</Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </CardContent>
                </Card>

                {ficha.observaciones ? (
                  <Card style={styles.sectionCard}>
                    <CardHeader title="Observaciones" />
                    <CardContent>
                      <Text style={styles.notesText}>{ficha.observaciones}</Text>
                    </CardContent>
                  </Card>
                ) : null}

                {ficha.lesionLimitaciones ? (
                  <Card style={styles.sectionCard}>
                    <CardHeader title="Lesiones / Limitaciones" />
                    <CardContent>
                      <Text style={styles.notesText}>{ficha.lesionLimitaciones}</Text>
                    </CardContent>
                  </Card>
                ) : null}

                <View style={styles.buttonRow}>
                  <Button
                    variant="primary"
                    onPress={nuevoCheckin}
                    style={styles.flexButton}
                    leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
                  >
                    Nuevo Check-in
                  </Button>
                  <Button variant="outline" onPress={() => router.push(`/clientes/${id}/ficha/nueva`)} style={styles.flexButton}>
                    Rehacer Ficha
                  </Button>
                </View>
              </>
            ) : (
              <Card style={styles.emptyCard}>
                <CardContent style={styles.emptyContent}>
                  <Ionicons name="document-text-outline" size={64} color={t.colors.textSubtle} />
                  <Text style={styles.emptyTitle}>Sin Ficha Inicial</Text>
                  <Text style={styles.emptySubtitle}>Crea la ficha inicial para empezar el seguimiento</Text>
                  <Button
                    variant="primary"
                    onPress={() => router.push(`/clientes/${id}/ficha/nueva`)}
                    style={styles.emptyButton}
                    leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
                  >
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
              <Button
                variant="primary"
                onPress={nuevoCheckin}
                style={styles.flexButton}
                leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
              >
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
                      <Text style={styles.checkinValue}>{formatDecimal(latestCheckin.peso)} kg</Text>
                      {deltas ? (
                        <Text style={[styles.checkinDelta, deltaStyle(deltas.peso)]}>{fmtDelta(deltas.peso, ' kg')}</Text>
                      ) : null}
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
                  {latestCheckin.notas ? <Text style={styles.notesText}>{latestCheckin.notas}</Text> : null}
                </CardContent>
              </Card>
            ) : (
              <Card style={styles.emptyCard}>
                <CardContent style={styles.emptyContent}>
                  <Ionicons name="calendar-outline" size={64} color={t.colors.textSubtle} />
                  <Text style={styles.emptyTitle}>Sin check-ins</Text>
                  <Text style={styles.emptySubtitle}>Registrá el primer check-in semanal para seguir el progreso</Text>
                </CardContent>
              </Card>
            )}
            {checkins.length > 0 ? (
              <Card style={styles.sectionCard}>
                <CardHeader title="Historial de Check-ins" subtitle={`${checkins.length} registrado(s)`} />
                <CardContent>
                  {checkins
                    .slice()
                    .reverse()
                    .map((c) => (
                      <View key={c.id} style={styles.historyRow}>
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>S{c.semana}</Text>
                        </View>
                        <View style={styles.historyInfo}>
                          <Text style={styles.historyTitle}>{formatDecimal(c.peso)} kg</Text>
                          <Text style={styles.historySubtitle}>{formatDate(c.fecha)}</Text>
                        </View>
                        <Text style={styles.historyMeta}>
                          Adh {c.adherencia}/5 · Ene {c.energia}/5
                        </Text>
                      </View>
                    ))}
                </CardContent>
              </Card>
            ) : null}
          </>
        )}

        {/* Rutinas Tab */}
        {activeTab === 'rutinas' && (
          <Card style={styles.sectionCard}>
            <CardHeader
              title="Rutinas Asignadas"
              action={
                <Button
                  variant="primary"
                  size="sm"
                  onPress={() => {
                    selectCliente(id);
                    router.push('/rutinas/nuevo');
                  }}
                  leftIcon={<Ionicons name="add" size={16} color={t.colors.onPrimary} />}
                >
                  Nueva
                </Button>
              }
            />
            <CardContent>
              {rutinas.length === 0 ? (
                <Text style={styles.comingSoon}>Este cliente todavía no tiene rutinas</Text>
              ) : (
                rutinas.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={styles.historyRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      selectCliente(id);
                      router.push(`/rutinas/${r.id}`);
                    }}
                  >
                    <View style={styles.historyBadge}>
                      <Text style={styles.historyBadgeText}>M{r.mesociclo}</Text>
                    </View>
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyTitle} numberOfLines={1}>{r.nombre}</Text>
                      <Text style={styles.historySubtitle}>
                        Semanas {r.semanaInicio}–{r.semanaFin} · {r.dias.length} día(s)
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={t.colors.textSubtle} />
                  </TouchableOpacity>
                ))
              )}
            </CardContent>
          </Card>
        )}

        {/* Metas Tab */}
        {activeTab === 'metas' && (
          <>
            <View style={styles.buttonRow}>
              <Button
                variant="primary"
                onPress={() => router.push(`/clientes/${id}/meta/nueva`)}
                style={styles.flexButton}
                leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
              >
                Nueva Meta
              </Button>
            </View>
            {metasConProgreso.length > 0 ? (
              metasConProgreso.map(({ meta, progreso }) => (
                <Card key={meta.id} style={styles.sectionCard}>
                  <CardContent>
                    <TouchableOpacity
                      style={styles.metaItemCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/clientes/${id}/meta/${meta.id}`)}
                    >
                      <View style={styles.metaInfo}>
                        <View style={styles.metaTitleRow}>
                          <Text style={styles.metaTitle} numberOfLines={1}>{meta.descripcion}</Text>
                          {meta.estado === 'lograda' ? (
                            <View style={styles.metaBadgeLograda}>
                              <Text style={styles.metaBadgeLogradaText}>Lograda</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.metaSubtitle}>
                          {Math.round(meta.valorInicial * 10) / 10} {meta.unidad} → {Math.round(meta.valorObjetivo * 10) / 10} {meta.unidad}
                          {progreso.valorActual != null ? ` · actual ${Math.round(progreso.valorActual * 10) / 10}` : ''}
                          {' | '}
                          {formatDate(meta.fechaObjetivo)}
                        </Text>
                        <View style={styles.metaTrack}>
                          <View
                            style={[
                              styles.metaTrackFill,
                              {
                                width: `${Math.max(2, Math.min(100, progreso.porcentaje))}%`,
                                backgroundColor: progreso.lograda ? t.colors.success : t.colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <View style={styles.metaProgress}>
                        <Text style={styles.metaPercent}>{Math.round(progreso.porcentaje)}%</Text>
                        <Ionicons name="chevron-forward" size={14} color={t.colors.textSubtle} />
                      </View>
                    </TouchableOpacity>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <CardContent style={styles.emptyContent}>
                  <Ionicons name="flag-outline" size={64} color={t.colors.textSubtle} />
                  <Text style={styles.emptyTitle}>Sin Metas</Text>
                  <Text style={styles.emptySubtitle}>Define objetivos medibles para motivar a tu cliente</Text>
                  <Button
                    variant="primary"
                    onPress={() => router.push(`/clientes/${id}/meta/nueva`)}
                    style={styles.emptyButton}
                    leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
                  >
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
  headerMeta: { flexDirection: 'row', gap: 16, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  flexButton: { flex: 1 },
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
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: t.colors.border },
  historyBadge: {
    minWidth: 40, height: 32, paddingHorizontal: 6, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.primarySoft },
  historyBadgeText: { fontSize: 12, fontWeight: '700', color: t.colors.primary },
  historyInfo: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 15, fontWeight: '600', color: t.colors.text },
  historySubtitle: { fontSize: 12, color: t.colors.textMuted },
  historyMeta: { fontSize: 12, color: t.colors.textSubtle },
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
