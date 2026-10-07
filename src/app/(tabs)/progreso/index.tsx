/**
 * Progreso Screen — Dashboard con gráficos reales (victory-native + Skia)
 */

import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore, useProgresoStore } from '@/stores';
import {
  Button,
  Card,
  CardHeader,
  CardContent,
  StatTile,
  ProgressBar,
  Chip,
  ChipRow,
  Avatar,
} from '@/components/ui';
import { LineChart, BarChart, RadarChart, Heatmap } from '@/components/charts';
import { useMetas } from '@/hooks/useMetas';
import { formatDate, formatRelativeTime, createEmptyPerimetros, createEmptyFotos } from '@/utils/helpers';
import {
  volumenPorSemana,
  mejores1RM,
  evolucion1RM,
  resumenEntrenamientos,
  normalizarPerimetros } from '@/utils/metrics';
import { getDatabase } from '@/db/database';
import { leerRutinas } from '@/services/rutinas';
import { HEATMAP_COLORS, CHART_CONFIG } from '@/constants';
import type { Theme } from '@/constants/theme';
import type { CheckinSemanal, EntrenamientoRealizado, FichaInicial, FotosProgreso, Perimetros } from '@/types';

const TABS = [
  { key: 'antropometria', label: 'Antrop.', icon: 'body-outline' },
  { key: 'perimetros', label: 'Perím.', icon: 'resize-outline' },
  { key: 'fuerza', label: 'Fuerza', icon: 'barbell-outline' },
  { key: 'fotos', label: 'Fotos', icon: 'images-outline' },
  { key: 'adherencia', label: 'Adher.', icon: 'calendar-outline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type AnguloFoto = 'frontal' | 'lateral' | 'posterior';

const COLOR_PESO = CHART_CONFIG.colors.primary;
const COLOR_GRASA = CHART_CONFIG.colors.orange;
const COLOR_MUSCULO = CHART_CONFIG.colors.success;
const COLOR_INICIAL = '#94a3b8';

const PERIMETRO_LABELS: Record<string, string> = {
  brazoIzq: 'Brazo I',
  brazoDer: 'Brazo D',
  antebrazoIzq: 'Ant. I',
  antebrazoDer: 'Ant. D',
  pecho: 'Pecho',
  cintura: 'Cintura',
  cadera: 'Cadera',
  piernaIzq: 'Pierna I',
  piernaDer: 'Pierna D',
  pantorrillaIzq: 'Pant. I',
  pantorrillaDer: 'Pant. D' };

const RANGOS: { key: AnguloFoto; label: string }[] = [
  { key: 'frontal', label: 'Frontal' },
  { key: 'lateral', label: 'Lateral' },
  { key: 'posterior', label: 'Posterior' },
];

// Referencia estable: sin esto el `?? {}` crearía un objeto nuevo en cada render
// y rompería la memoización de los useMemo siguientes.
const SIN_PERIMETROS: Record<string, any> = {};

type Row = any;

interface DatosProgreso {
  cliente: { id: string; nombre: string; apellido: string } | null;
  ficha: FichaInicial | null;
  checkins: CheckinSemanal[];
  entrenamientos: EntrenamientoRealizado[];
  nombresRutina: Record<string, string>;
}

const SIN_DATOS: DatosProgreso = { cliente: null, ficha: null, checkins: [], entrenamientos: [], nombresRutina: {} };

const numeroOpcional = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

const parseJSON = (raw: unknown): unknown => {
  if (typeof raw !== 'string' || !raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const parsePerimetros = (raw: unknown): Perimetros => {
  const data = (parseJSON(raw) ?? {}) as Record<string, unknown>;
  const base = createEmptyPerimetros();
  for (const k of Object.keys(base) as (keyof Perimetros)[]) base[k] = numeroOpcional(data[k]) ?? 0;
  return base;
};

const parseFotos = (raw: unknown): FotosProgreso => {
  const data = (parseJSON(raw) ?? {}) as Record<string, unknown>;
  const base = createEmptyFotos();
  for (const k of Object.keys(base) as (keyof FotosProgreso)[]) base[k] = typeof data[k] === 'string' ? (data[k] as string) : '';
  return base;
};

const rating = (v: unknown) => Math.min(5, Math.max(1, Math.round(Number(v) || 3))) as 1 | 2 | 3 | 4 | 5;

/** Todo lo que muestra el dashboard, leído de SQLite (fuente de verdad). */
function leerDatosProgreso(clienteId: string | null): DatosProgreso {
  if (!clienteId) return SIN_DATOS;
  try {
    const db = getDatabase();
    const c = db.executeSync('SELECT id, nombre, apellido FROM clientes WHERE id = ?', [clienteId]).rows[0] as Row | undefined;
    if (!c) return SIN_DATOS;

    const f = db.executeSync(
      'SELECT * FROM fichas_iniciales WHERE cliente_id = ? ORDER BY creado_en DESC LIMIT 1',
      [clienteId]
    ).rows[0] as Row | undefined;
    const checkinRows = db.executeSync(
      'SELECT * FROM checkins_semanales WHERE cliente_id = ? ORDER BY semana ASC, creado_en ASC',
      [clienteId]
    ).rows as Row[];
    const entrenamientoRows = db.executeSync(
      'SELECT * FROM entrenamientos_realizados WHERE cliente_id = ? ORDER BY fecha ASC',
      [clienteId]
    ).rows as Row[];

    const nombresRutina: Record<string, string> = {};
    for (const r of leerRutinas(clienteId)) {
      for (const dia of r.dias) {
        for (const ej of dia.ejercicios) nombresRutina[ej.id] = ej.nombre;
      }
    }

    return {
      cliente: { id: c.id, nombre: c.nombre ?? '', apellido: c.apellido ?? '' },
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
      entrenamientos: entrenamientoRows.map((r) => {
        const ejercicios = parseJSON(r.ejercicios);
        return {
          id: r.id,
          clienteId: r.cliente_id,
          rutinaSemanalId: r.rutina_semanal_id,
          diaRutinaId: r.dia_rutina_id,
          fecha: String(r.fecha ?? ''),
          duracionMin: Number(r.duracion_min) || 0,
          ejercicios: (Array.isArray(ejercicios) ? ejercicios : []).map((ej: any) => ({
            ejercicioRutinaId: String(ej?.ejercicioRutinaId ?? ''),
            series: (Array.isArray(ej?.series) ? ej.series : []).map((s: any) => ({
              numero: Number(s?.numero) || 0,
              peso: Number(s?.peso) || 0,
              repeticiones: Number(s?.repeticiones) || 0,
              rpe: Number(s?.rpe) || 0,
              completada: !!s?.completada,
            })),
          })),
          rpeGlobal: numeroOpcional(r.rpe_global) as EntrenamientoRealizado['rpeGlobal'],
          notas: r.notas ?? '',
        };
      }),
      nombresRutina,
    };
  } catch (error) {
    console.error('Error leyendo progreso:', error);
    return SIN_DATOS;
  }
}

function calcularDeltas(ficha: FichaInicial | null, latest: CheckinSemanal | null) {
  if (!ficha || !latest) return null;
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
  };
}

export default function ProgresoScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const selectedClienteId = useClientesStore((s) => s.selectedClienteId);

  const [activeTab, setActiveTab] = useState<TabKey>('antropometria');
  const [angulo, setAngulo] = useState<AnguloFoto>('frontal');
  const [compararFotos, setCompararFotos] = useState(false);
  const [ejercicio1RM, setEjercicio1RM] = useState<string>('');

  // ============================================
  // Datos (síncronos desde SQLite; se releen al enfocar la pestaña)
  // ============================================
  const [datos, setDatos] = useState<DatosProgreso>(() => leerDatosProgreso(selectedClienteId));
  const [clienteCargado, setClienteCargado] = useState(selectedClienteId);
  if (clienteCargado !== selectedClienteId) {
    setClienteCargado(selectedClienteId);
    setDatos(leerDatosProgreso(selectedClienteId));
    setEjercicio1RM('');
  }

  const { conProgreso: metas, reload: recargarMetas } = useMetas(selectedClienteId);

  useFocusEffect(
    useCallback(() => {
      const nuevos = leerDatosProgreso(selectedClienteId);
      if (selectedClienteId && nuevos.cliente) {
        const id = selectedClienteId;
        useProgresoStore.setState((s) => {
          const fichas = { ...s.fichas };
          if (nuevos.ficha) fichas[id] = nuevos.ficha;
          else delete fichas[id];
          return { fichas, checkins: { ...s.checkins, [id]: nuevos.checkins } };
        });
      }
      setDatos(nuevos);
      recargarMetas();
    }, [selectedClienteId, recargarMetas])
  );

  const { cliente, ficha, checkins, entrenamientos, nombresRutina } = datos;
  const latestCheckin = checkins.length > 0 ? checkins[checkins.length - 1] : null;
  const deltas = calcularDeltas(ficha, latestCheckin);
  const activas = metas.filter((m) => m.meta.estado === 'activa').length;

  // Incluimos la ficha como punto 0 para que las líneas tengan origen
  const seriePeso = useMemo(() => {
    const puntos: Record<string, number | null>[] = [];
    if (ficha) puntos.push({ semana: 0, peso: ficha.peso, grasa: ficha.grasaCorporal ?? null, musculo: ficha.musculatura ?? null });
    for (const c of checkins) {
      puntos.push({ semana: c.semana, peso: c.peso, grasa: c.grasaCorporal ?? null, musculo: c.musculatura ?? null });
    }
    return puntos as Record<string, any>[];
  }, [ficha, checkins]);

  const serieComposicion = useMemo(
    () =>
      seriePeso.filter(
        (p) => typeof p.grasa === 'number' || typeof p.musculo === 'number'
      ) as Record<string, any>[],
    [seriePeso]
  );

  const perimetrosFicha = useMemo(
    () => (ficha ? (ficha.perimetros as unknown as Record<string, any>) : SIN_PERIMETROS),
    [ficha]
  );
  const perimetrosCheckin = useMemo(
    () => (latestCheckin ? (latestCheckin.perimetros as unknown as Record<string, any>) : null),
    [latestCheckin]
  );

  const perimetrosInitial = perimetrosFicha;
  const perimetrosLatest = perimetrosCheckin ?? perimetrosFicha;

  const clavesPerimetro = useMemo(
    () => Object.keys(PERIMETRO_LABELS).filter((k) => Number(perimetrosLatest[k]) > 0),
    [perimetrosLatest]
  );

  const radar = useMemo(
    () => normalizarPerimetros(perimetrosInitial, perimetrosLatest, clavesPerimetro),
    [perimetrosInitial, perimetrosLatest, clavesPerimetro]
  );

  // ---- Fuerza ----
  const volumenSemanal = useMemo(() => volumenPorSemana(entrenamientos), [entrenamientos]);
  const top1RM = useMemo(() => mejores1RM(entrenamientos, nombresRutina), [entrenamientos, nombresRutina]);
  const evolucion = useMemo(
    () => (ejercicio1RM ? evolucion1RM(entrenamientos, nombresRutina, ejercicio1RM) : []),
    [ejercicio1RM, entrenamientos, nombresRutina]
  );
  const resumen = useMemo(() => resumenEntrenamientos(entrenamientos), [entrenamientos]);

  // ---- Adherencia ----
  const adherenciaData = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const c of checkins) mapa[String(c.semana)] = c.adherencia;
    return mapa;
  }, [checkins]);

  // ---- Fotos ----
  const fotosFicha: FotosProgreso = ficha?.fotos ?? createEmptyFotos();
  const tieneFotosFicha = RANGOS.some((r) => !!fotosFicha[r.key]);
  // Las fotos son opcionales: por ángulo se usa el check-in más reciente que tenga foto.
  const fotosRecientes = useMemo(() => {
    const res: Record<AnguloFoto, { uri: string; semana: number } | null> = { frontal: null, lateral: null, posterior: null };
    for (let i = checkins.length - 1; i >= 0; i--) {
      for (const r of RANGOS) {
        const uri = checkins[i].fotos[r.key];
        if (!res[r.key] && uri) res[r.key] = { uri, semana: checkins[i].semana };
      }
    }
    return res;
  }, [checkins]);

  if (!selectedClienteId || !cliente) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: t.colors.bg, paddingTop: insets.top + 32 }]}>
        <Ionicons name="people-outline" size={64} color={t.colors.textSubtle} />
        <Text style={[t.typography.heading, { color: t.colors.text }]}>Selecciona un cliente</Text>
        <Text style={[t.typography.small, { color: t.colors.textMuted, textAlign: 'center' }]}>
          Elegí un cliente desde la pestaña Clientes para ver su progreso
        </Text>
        <Button
          onPress={() => router.navigate('/clientes')}
          leftIcon={<Ionicons name="people" size={18} color={t.colors.onPrimary} />}
        >
          Ir a Clientes
        </Button>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
      {/* ========================================
          Header
      ======================================== */}
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
        <TouchableOpacity onPress={() => router.navigate('/clientes')} style={styles.clientSelector}>
          <Avatar name={`${cliente.nombre} ${cliente.apellido}`} size={44} />
          <View style={styles.clientInfo}>
            <Text style={[t.typography.heading, { color: t.colors.text }]} numberOfLines={1}>
              {cliente.nombre} {cliente.apellido}
            </Text>
            <Text style={[t.typography.caption, { color: t.colors.primary, marginTop: 1 }]}>
              Cambiar cliente
            </Text>
          </View>
        </TouchableOpacity>
        {latestCheckin && (
          <View style={styles.lastUpdate}>
            <Text style={[t.typography.micro, { color: t.colors.textSubtle }]}>Último check-in</Text>
            <Text style={[t.typography.smallStrong, { color: t.colors.text }]}>
              {formatRelativeTime(latestCheckin.fecha)}
            </Text>
          </View>
        )}
      </View>

      {/* ========================================
          Quick stats — StatTile con barra de acento
      ======================================== */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={styles.statsContainer}
      >
        <StatTile
          label="Peso"
          value={(latestCheckin?.peso ?? ficha?.peso ?? 0).toFixed(1)}
          unit="kg"
          icon="scale-outline"
          delta={deltas?.peso != null ? { value: Number(deltas.peso.toFixed(1)) } : null}
        />
        <StatTile
          label="Grasa"
          value={(latestCheckin?.grasaCorporal ?? ficha?.grasaCorporal ?? 0).toFixed(1)}
          unit="%"
          icon="water-outline"
          tone="warning"
          delta={
            deltas?.grasaCorporal != null ? { value: Number(deltas.grasaCorporal.toFixed(1)) } : null
          }
        />
        <StatTile
          label="Músculo"
          value={(latestCheckin?.musculatura ?? ficha?.musculatura ?? 0).toFixed(1)}
          unit="kg"
          icon="barbell-outline"
          tone="success"
          delta={
            deltas?.musculatura != null ? { value: Number(deltas.musculatura.toFixed(1)) } : null
          }
        />
        <StatTile
          label="Adherencia"
          value={latestCheckin?.adherencia != null ? `${latestCheckin.adherencia}` : '—'}
          unit={latestCheckin?.adherencia != null ? '/5' : undefined}
          icon="checkmark-circle-outline"
          tone="accent"
        />
        <StatTile label="Entrenos" value={resumen.total} icon="barbell-outline" tone="primary" />
        <StatTile
          label="Volumen"
          value={(resumen.volumen / 1000).toFixed(1)}
          unit="t"
          icon="stats-chart-outline"
          tone="primary"
        />
      </ScrollView>

      {/* ========================================
          Tabs — chips scrolleables (5 tabs no entran en un segmented)
      ======================================== */}
      <View style={{ backgroundColor: t.colors.bg, paddingVertical: 10 }}>
        <ChipRow>
          {TABS.map((tab) => (
            <Chip
              key={tab.key}
              label={tab.label}
              icon={tab.icon as any}
              active={activeTab === tab.key}
              onPress={() => setActiveTab(tab.key)}
            />
          ))}
        </ChipRow>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ======================================
            ANTROPOMETRÍA
        ====================================== */}
        {activeTab === 'antropometria' && (
          <>
            <Card style={styles.chartCard}>
              <CardHeader title="Peso corporal" subtitle={`${seriePeso.length} mediciones`} />
              <CardContent>
                <LineChart
                  data={seriePeso}
                  xKey="semana"
                  series={[{ key: 'peso', label: 'Peso (kg)', color: COLOR_PESO }]}
                  formatX={(v) => (v === 0 ? 'Inicial' : `S${v}`)}
                  formatY={(v) => `${v.toFixed(1)}`}
                  emptyMessage="Registra la ficha inicial y check-ins semanales"
                />
              </CardContent>
            </Card>

            {serieComposicion.length > 1 ? (
              <Card style={styles.chartCard}>
                <CardHeader title="Composición corporal" subtitle="Grasa vs masa muscular" />
                <CardContent>
                  <LineChart
                    data={serieComposicion}
                    xKey="semana"
                    series={[
                      { key: 'grasa', label: 'Grasa (%)', color: COLOR_GRASA },
                      { key: 'musculo', label: 'Músculo (kg)', color: COLOR_MUSCULO },
                    ]}
                    formatX={(v) => (v === 0 ? 'Inicial' : `S${v}`)}
                    formatY={(v) => v.toFixed(1)}
                  />
                </CardContent>
              </Card>
            ) : (
              <Vacio
                icon="body-outline"
                titulo="Sin datos de composición"
                sub="Registra % de grasa y kg de músculo en los check-ins"
              />
            )}

            {checkins.length > 0 && (
              <Card style={styles.chartCard}>
                <CardHeader title="Bienestar semanal" subtitle="Energía · Sueño · Estrés" />
                <CardContent>
                  <LineChart
                    data={checkins.map((c: any) => ({
                      semana: c.semana,
                      energia: c.energia,
                      sueno: c.sueno,
                      estres: c.estres }))}
                    xKey="semana"
                    series={[
                      { key: 'energia', label: 'Energía', color: CHART_CONFIG.colors.warning },
                      { key: 'sueno', label: 'Sueño', color: CHART_CONFIG.colors.indigo },
                      { key: 'estres', label: 'Estrés', color: CHART_CONFIG.colors.danger },
                    ]}
                    formatX={(v) => `S${v}`}
                    formatY={(v) => `${Math.round(v)}`}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ======================================
            PERÍMETROS
        ====================================== */}
        {activeTab === 'perimetros' && (
          <>
            {clavesPerimetro.length >= 3 ? (
              <Card style={styles.chartCard}>
                <CardHeader
                  title="Radar de perímetros"
                  subtitle="Ficha inicial vs. estado actual"
                />
                <CardContent>
                  <RadarChart
                    labels={clavesPerimetro.map((k) => PERIMETRO_LABELS[k])}
                    series={[
                      { label: 'Inicial', color: COLOR_INICIAL, values: radar.inicial },
                      { label: 'Actual', color: COLOR_PESO, values: radar.actual },
                    ]}
                  />
                  <Text style={styles.radarNota}>
                    ⚠️ El radar se normaliza con el valor inicial como base; úsalo para ver
                    la <Text style={{ fontWeight: '700' }}>dirección</Text> del cambio, no el valor absoluto.
                  </Text>
                </CardContent>
              </Card>
            ) : (
              <Vacio
                icon="resize-outline"
                titulo="Sin datos de perímetros"
                sub="Completa la ficha inicial con al menos 3 perímetros"
              />
            )}

            {clavesPerimetro.length > 0 && (
              <Card style={styles.chartCard}>
                <CardHeader title="Detalle de perímetros" subtitle="Actual vs. ficha inicial" />
                <CardContent>
                  <View style={styles.perimetrosList}>
                    {clavesPerimetro.map((key) => {
                      const inicial = Number(perimetrosInitial[key]) || 0;
                      const actual = Number(perimetrosLatest[key]) || 0;
                      const diff = inicial > 0 ? actual - inicial : 0;
                      const pct = inicial > 0 ? (diff / inicial) * 100 : 0;
                      return (
                        <View key={key} style={styles.perimetroRow}>
                          <View style={styles.perimetroInfo}>
                            <Text style={styles.perimetroName}>{PERIMETRO_LABELS[key]}</Text>
                            <Text style={styles.perimetroBarCaption}>
                              {inicial > 0 ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% desde inicio` : 'sin base de comparación'}
                            </Text>
                            <View style={styles.perimetroTrack}>
                              <View
                                style={[
                                  styles.perimetroFill,
                                  {
                                    width: `${Math.min(100, Math.max(4, pct > 0 ? 50 + pct * 2 : 50 + pct * 2))}%`,
                                    backgroundColor: diff >= 0 ? CHART_CONFIG.colors.success : CHART_CONFIG.colors.danger },
                                ]}
                              />
                            </View>
                          </View>
                          <View style={styles.perimetroValues}>
                            <Text style={styles.perimetroCurrent}>{actual.toFixed(1)} cm</Text>
                            {inicial > 0 && (
                              <Text style={[styles.perimetroDiff, diff >= 0 ? styles.deltaGood : styles.deltaBad]}>
                                {diff > 0 ? '+' : ''}
                                {diff.toFixed(1)} cm
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ======================================
            FUERZA
        ====================================== */}
        {activeTab === 'fuerza' && (
          <>
            {volumenSemanal.length > 0 ? (
              <Card style={styles.chartCard}>
                <CardHeader title="Volumen semanal" subtitle="Tonelaje total levantado (kg)" />
                <CardContent>
                  <BarChart
                    data={volumenSemanal}
                    xKey="semana"
                    series={[{ key: 'volumen', label: 'Volumen (kg)', color: COLOR_PESO }]}
                    formatY={(v) => `${(v / 1000).toFixed(0)}t`}
                  />
                </CardContent>
              </Card>
            ) : (
              <Vacio
                icon="barbell-outline"
                titulo="Sin entrenamientos registrados"
                sub="Usa el logger de una rutina para registrar tus sesiones"
              />
            )}

            {top1RM.length > 0 && (
              <>
                <Card style={styles.chartCard}>
                  <CardHeader title="Evolución de 1RM" subtitle="Epley · mejor marca por sesión" />
                  <CardContent>
                    <View style={styles.pickerWrap}>
                      {top1RM.slice(0, 8).map((item) => {
                        const activo = item.etiqueta === ejercicio1RM;
                        return (
                          <TouchableOpacity
                            key={item.etiqueta}
                            onPress={() => setEjercicio1RM(activo ? '' : item.etiqueta)}
                            style={[styles.chip, activo && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, activo && styles.chipTextActive]}>{item.etiqueta}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {ejercicio1RM ? (
                      <LineChart
                        data={evolucion as any}
                        xKey="punto"
                        series={[{ key: 'r1rm', label: '1RM (kg)', color: CHART_CONFIG.colors.purple }]}
                        formatY={(v) => `${Math.round(v)}`}
                      />
                    ) : (
                      <Text style={styles.pickerHint}>Toca un ejercicio para ver su evolución</Text>
                    )}
                  </CardContent>
                </Card>

                <Card style={styles.chartCard}>
                  <CardHeader title="Ranking de 1RM" subtitle="Marca estimada actual por ejercicio" />
                  <CardContent>
                    {top1RM.slice(0, 10).map((item, i) => (
                      <View key={item.etiqueta} style={styles.rankRow}>
                        <View style={[styles.rankBadge, { backgroundColor: i < 3 ? t.colors.primary : t.colors.surfaceAlt }]}>
                          <Text style={[styles.rankNum, { color: i < 3 ? t.colors.onPrimary : t.colors.textMuted }]}>{i + 1}</Text>
                        </View>
                        <View style={styles.rankInfo}>
                          <Text style={styles.rankNombre}>{item.etiqueta}</Text>
                          <Text style={styles.rankDetalle}>
                            {item.peso} kg × {item.reps} reps · {formatDate(item.fecha)}
                          </Text>
                        </View>
                        <Text style={styles.rankValor}>{item.r1rm} kg</Text>
                      </View>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* ======================================
            FOTOS
        ====================================== */}
        {activeTab === 'fotos' && (
          <>
            {tieneFotosFicha || RANGOS.some((r) => !!fotosRecientes[r.key]) ? (
              <Card style={styles.chartCard}>
                <CardHeader
                  title="Comparativa de fotos"
                  subtitle={compararFotos ? 'Ficha inicial vs. último check-in' : 'Último registro'}
                  action={
                    <TouchableOpacity
                      onPress={() => setCompararFotos((v) => !v)}
                      style={[styles.compararToggle, compararFotos && { backgroundColor: t.colors.primary }]}
                    >
                      <Ionicons
                        name={compararFotos ? 'layers' : 'layers-outline'}
                        size={14}
                        color={compararFotos ? t.colors.onPrimary : t.colors.primary}
                      />
                      <Text style={[styles.compararToggleText, compararFotos && { color: t.colors.onPrimary }]}>Comparar</Text>
                    </TouchableOpacity>
                  }
                />
                <CardContent>
                  <View style={styles.rangoRow}>
                    {RANGOS.map((r) => (
                      <TouchableOpacity
                        key={r.key}
                        onPress={() => setAngulo(r.key)}
                        style={[styles.rangoBtn, angulo === r.key && styles.rangoBtnActive]}
                      >
                        <Text style={[styles.rangoText, angulo === r.key && styles.rangoTextActive]}>{r.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {compararFotos && fotosFicha[angulo] && fotosRecientes[angulo] ? (
                    <View style={styles.compararGrid}>
                      <View style={styles.compararCol}>
                        <Text style={styles.compararLabel}>Inicial</Text>
                        <Image source={{ uri: fotosFicha[angulo] }} style={styles.fotoComparada} resizeMode="cover" />
                      </View>
                      <View style={styles.compararCol}>
                        <Text style={styles.compararLabel}>Semana {fotosRecientes[angulo]?.semana}</Text>
                        <Image source={{ uri: fotosRecientes[angulo]?.uri }} style={styles.fotoComparada} resizeMode="cover" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.fotoUnicaWrap}>
                      {fotosRecientes[angulo]?.uri || fotosFicha[angulo] ? (
                        <Image
                          source={{ uri: fotosRecientes[angulo]?.uri || fotosFicha[angulo] }}
                          style={styles.fotoUnica}
                          resizeMode="contain"
                        />
                      ) : (
                        <Text style={styles.sinFoto}>Sin foto de {angulo}</Text>
                      )}
                    </View>
                  )}

                  <Text style={styles.tipText}>
                    📏 Mantén la misma distancia, luz y hora en cada sesión de fotos para que la comparación sea válida.
                  </Text>
                </CardContent>
              </Card>
            ) : (
              <Vacio
                icon="images-outline"
                titulo="Sin fotos de progreso"
                sub="Añade fotos en la ficha inicial y en cada check-in"
                action={
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() =>
                      router.push(
                        ficha
                          ? `/clientes/${selectedClienteId}/checkin/nueva`
                          : `/clientes/${selectedClienteId}/ficha/nueva`
                      )
                    }
                  >
                    {ficha ? 'Nuevo check-in con fotos' : 'Crear ficha inicial'}
                  </Button>
                }
              />
            )}
          </>
        )}

        {/* ======================================
            ADHERENCIA
        ====================================== */}
        {activeTab === 'adherencia' && (
          <>
            {checkins.length > 0 ? (
              <Card style={styles.chartCard}>
                <CardHeader title="Heatmap de adherencia" subtitle={`${checkins.length} semanas registradas`} />
                <CardContent>
                  <Heatmap data={adherenciaData} colorFor={(v) => HEATMAP_COLORS[Math.max(0, Math.min(5, Math.round(v)))]} />
                </CardContent>
              </Card>
            ) : (
              <Vacio icon="calendar-outline" titulo="Sin datos de adherencia" sub="Registra check-ins semanales" />
            )}

            {checkins.length > 0 && (
              <Card style={styles.chartCard}>
                <CardHeader title="Evolución de check-ins" subtitle="Energía / sueño / estrés / adherencia" />
                <CardContent>
                  <LineChart
                    data={checkins.map((c: any) => ({
                      semana: c.semana,
                      adherencia: c.adherencia,
                      energia: c.energia,
                      sueno: c.sueno }))}
                    xKey="semana"
                    series={[
                      { key: 'adherencia', label: 'Adherencia', color: COLOR_PESO },
                      { key: 'energia', label: 'Energía', color: CHART_CONFIG.colors.warning },
                      { key: 'sueno', label: 'Sueño', color: CHART_CONFIG.colors.indigo },
                    ]}
                    formatX={(v) => `S${v}`}
                    formatY={(v) => `${Math.round(v)}`}
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ======================================
            METAS
        ====================================== */}
        <Card style={styles.chartCard}>
          <CardHeader
            title="Metas"
            subtitle={metas.length > 0 ? `${activas} activa(s) de ${metas.length}` : undefined}
            action={
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push(`/clientes/${selectedClienteId}/meta/nueva`)}
              >
                + Meta
              </Button>
            }
          />
          <CardContent>
            {metas.length === 0 ? (
              <View style={styles.metasVacio}>
                <Ionicons name="flag-outline" size={32} color={t.colors.textSubtle} />
                <Text style={styles.emptyChartSubtitle}>
                  Crea un objetivo medible (peso, % grasa, fuerza…) y el avance se calcula
                  automáticamente contra la última medición.
                </Text>
              </View>
            ) : (
              metas.map(({ meta, progreso }) => {
                const pct = progreso.porcentaje;
                const metaActiva = meta.estado === 'activa';
                return (
                  <TouchableOpacity
                    key={meta.id}
                    style={styles.metaRow}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/clientes/${selectedClienteId}/meta/${meta.id}`)}
                  >
                    <View style={styles.metaInfo}>
                      <View style={styles.metaHeaderRow}>
                        <Text style={styles.metaTitle} numberOfLines={1}>
                          {meta.descripcion}
                        </Text>
                        {metaActiva && progreso.lograda && (
                          <View style={styles.metaLogradaBadge}>
                            <Ionicons name="checkmark-circle" size={12} color="#fff" />
                            <Text style={styles.metaLogradaText}>Lograda</Text>
                          </View>
                        )}
                        {!metaActiva && (
                          <View style={styles.metaEstadoBadge}>
                            <Text style={styles.metaEstadoText}>
                              {meta.estado.charAt(0).toUpperCase() + meta.estado.slice(1)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.metaSubtitle}>
                        {round(meta.valorInicial)} → {round(meta.valorObjetivo)}{' '}
                        {unidadLegible(meta.unidad)}
                        {progreso.valorActual != null && ` · actual ${round(progreso.valorActual)}`}
                        {` · ${formatDate(meta.fechaObjetivo)}`}
                      </Text>
                      <ProgressBar
                        value={pct}
                        height={7}
                        tone={progreso.lograda ? 'success' : metaActiva ? 'primary' : 'neutral'}
                      />
                    </View>
                    <View style={styles.metaBadge}>
                      <Text
                        style={[
                          styles.metaPercent,
                          progreso.lograda && { color: CHART_CONFIG.colors.success },
                        ]}
                      >
                        {Math.round(pct)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

// ============================================
// Helpers locales
// ============================================
/** Redondeo a 1 decimal para mostrar unidades de medida. */
function round(v: number): string {
  return `${Math.round(v * 10) / 10}`;
}

function unidadLegible(u: string): string {
  return u === 'dias' ? 'días' : u;
}

function Vacio({
  icon,
  titulo,
  sub,
  action }: {
  icon: any;
  titulo: string;
  sub: string;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Card>
      <CardContent
        style={{
          alignItems: 'center',
          gap: 10,
          paddingVertical: 28,
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: t.colors.primarySoft,
          }}
        >
          <Ionicons name={icon} size={26} color={t.colors.primary} />
        </View>
        <Text style={[t.typography.subheading, { color: t.colors.text, textAlign: 'center' }]}>
          {titulo}
        </Text>
        <Text
          style={[
            t.typography.small,
            { color: t.colors.textMuted, textAlign: 'center', maxWidth: 320 },
          ]}
        >
          {sub}
        </Text>
        {action ? <View style={{ marginTop: 4 }}>{action}</View> : null}
      </CardContent>
    </Card>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, color: t.colors.textMuted},
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: t.colors.text},
  emptySubtitle: { fontSize: 14, color: t.colors.textSubtle, textAlign: 'center'},

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: t.colors.surface,
    borderBottomWidth: 1, borderBottomColor: t.colors.border },
  clientSelector: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '600', color: t.colors.textMuted},
  clientInfo: { flex: 1 },
  clientName: { fontSize: 18, fontWeight: '600', color: t.colors.text},
  clientSubtitle: { fontSize: 12, color: t.colors.primary, marginTop: 2 },
  lastUpdate: { alignItems: 'flex-end' },
  lastUpdateLabel: { fontSize: 11, color: t.colors.textSubtle},
  lastUpdateValue: { fontSize: 13, fontWeight: '500', color: t.colors.text},

  statsScroll: { flexGrow: 0, flexShrink: 0 },
  statsContainer: { paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  statCard: {
    backgroundColor: t.colors.surface, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
    minWidth: 84, borderWidth: 1, borderColor: t.colors.border, alignItems: 'center' },
  statLabel: { fontSize: 11, color: t.colors.textSubtle},
  statValue: { fontSize: 15, fontWeight: '700', color: t.colors.text, marginTop: 2 },
  statDelta: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  deltaGood: { color: t.colors.success },
  deltaBad: { color: t.colors.danger },
  deltaNeutral: { color: t.colors.textMuted },

  tabBar: {
    flexDirection: 'row', backgroundColor: t.colors.surface, borderBottomWidth: 1,
    borderBottomColor: t.colors.border, paddingHorizontal: 6, marginTop: 4 },
  tabButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 10, borderRadius: 10 },
  tabButtonActive: { backgroundColor: t.colors.primarySoft },
  tabLabel: { fontSize: 9, fontWeight: '500', color: t.colors.textSubtle},
  tabLabelActive: { color: t.colors.primary, fontWeight: '700' },

  scrollContent: { padding: 16, gap: 14, paddingBottom: 100 },
  chartCard: { borderWidth: 1, borderColor: t.colors.border },
  emptyChartCard: { borderWidth: 1, borderColor: t.colors.border, borderStyle: 'dashed' },
  emptyChartContent: { alignItems: 'center', padding: 28, gap: 10 },
  emptyChartTitle: { fontSize: 15, fontWeight: '600', color: t.colors.text},
  emptyChartSubtitle: { fontSize: 13, color: t.colors.textSubtle, textAlign: 'center'},

  radarNota: { fontSize: 11, color: t.colors.textMuted, marginTop: 12, lineHeight: 15},

  perimetrosList: { gap: 12 },
  perimetroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  perimetroInfo: { flex: 1 },
  perimetroName: { fontSize: 13, color: t.colors.text},
  perimetroBarCaption: { fontSize: 10, color: t.colors.textSubtle, marginTop: 1 },
  perimetroTrack: { height: 5, backgroundColor: t.colors.surfaceAlt, borderRadius: 3, marginTop: 5, overflow: 'hidden' },
  perimetroFill: { height: '100%', borderRadius: 3 },
  perimetroValues: { alignItems: 'flex-end', minWidth: 72 },
  perimetroCurrent: { fontSize: 14, fontWeight: '700', color: t.colors.text},
  perimetroDiff: { fontSize: 11, fontWeight: '600'},

  pickerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  pickerHint: { fontSize: 12, color: t.colors.textSubtle, textAlign: 'center', paddingVertical: 24},
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: t.colors.surfaceAlt },
  chipActive: { backgroundColor: t.colors.accent },
  chipText: { fontSize: 11, fontWeight: '600', color: t.colors.textMuted},
  chipTextActive: { color: t.colors.textInverse },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rankBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontSize: 11, fontWeight: '700'},
  rankInfo: { flex: 1 },
  rankNombre: { fontSize: 13, fontWeight: '600', color: t.colors.text},
  rankDetalle: { fontSize: 11, color: t.colors.textSubtle},
  rankValor: { fontSize: 15, fontWeight: '700', color: t.colors.accent},

  compararToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: t.colors.primarySoft },
  compararToggleText: { fontSize: 11, fontWeight: '600', color: t.colors.primary},
  rangoRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  rangoBtn: { flex: 1, paddingVertical: 6, borderRadius: 10, backgroundColor: t.colors.surfaceAlt, alignItems: 'center' },
  rangoBtnActive: { backgroundColor: t.colors.primary },
  rangoText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted},
  rangoTextActive: { color: t.colors.textInverse },
  compararGrid: { flexDirection: 'row', gap: 8 },
  compararCol: { flex: 1, gap: 4 },
  compararLabel: { fontSize: 11, fontWeight: '600', color: t.colors.textMuted, textAlign: 'center'},
  fotoComparada: { width: '100%', aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: t.colors.surfaceAlt },
  fotoUnicaWrap: { alignItems: 'center' },
  fotoUnica: { width: '100%', height: 300, borderRadius: 12, backgroundColor: t.colors.surfaceAlt },
  sinFoto: { fontSize: 13, color: t.colors.textSubtle, paddingVertical: 60},
  tipText: { fontSize: 11, color: t.colors.textMuted, marginTop: 12, lineHeight: 15},

  metasVacio: { alignItems: 'center', gap: 10, paddingVertical: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  metaInfo: { flex: 1, gap: 2 },
  metaHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaLogradaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: CHART_CONFIG.colors.success },
  metaLogradaText: { fontSize: 10, fontWeight: '700', color: t.colors.textInverse},
  metaEstadoBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
    backgroundColor: t.colors.surfaceAlt },
  metaEstadoText: { fontSize: 10, fontWeight: '600', color: t.colors.textMuted},
  metaTitle: { fontSize: 14, fontWeight: '600', color: t.colors.text},
  metaSubtitle: { fontSize: 12, color: t.colors.textMuted, marginTop: 2},
  metaTrack: { height: 6, backgroundColor: t.colors.surfaceAlt, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  metaFill: { height: '100%', backgroundColor: CHART_CONFIG.colors.primary, borderRadius: 3 },
  metaBadge: {
    minWidth: 48, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 12,
    backgroundColor: 'rgba(14,165,233,0.12)', alignItems: 'center' },
  metaPercent: { fontSize: 13, fontWeight: '700', color: t.colors.primary} });