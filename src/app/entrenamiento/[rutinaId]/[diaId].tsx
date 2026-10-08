/**
 * Logger de Entrenamiento
 * Registro de series en vivo con cronómetro, descanso, RPE y cálculo de volumen/1RM.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput, KeyboardAvoidingView, BackHandler } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientesStore, useEntrenamientosStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { getDatabase, runTransaction } from '@/db/database';
import { entrenamientoRealizadoSchema } from '@/schemas/validation';
import {
  generateId,
  calculateVolume,
  calculateSessionVolume,
  calculateAverageRPE,
  estimate1RM,
  getRepsObjetivo,
  formatCronometro,
  formatSeconds,
  getProgresionLabel } from '@/utils/helpers';
import type { DiaRutina, EjercicioRutina, EntrenamientoRealizado, SerieReal } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

type Params = { rutinaId: string; diaId: string };

/** Serie en edición: los numéricos también se guardan como texto para no perder la coma al tipear. */
interface SerieEditable extends SerieReal {
  pesoTxt: string;
  repsTxt: string;
  rpeTxt: string;
}

interface EstadoEjercicio {
  ejercicioRutinaId: string;
  nombre: string;
  grupo: string;
  series: SerieEditable[];
  colapsado: boolean;
  ultimoPeso: number | null;
}

/** Peso inicial estimado por grupo para bodyweight / máquinas sin referencia previa. */
const PESO_INICIAL_POR_GRUPO: Record<string, number> = {
  pecho: 40,
  espalda: 45,
  hombros: 20,
  biceps: 15,
  triceps: 20,
  cuadriceps: 50,
  isquios: 40,
  gluteos: 45,
  pantorrillas: 30,
  abdominales: 10,
  antebrazos: 15,
  trapecio: 30,
  lumbares: 40 };

/** Rangos de `serieRealSchema` / `entrenamientoRealizadoSchema`. */
const LIM = {
  peso: { min: 0, max: 500 },
  reps: { min: 0, max: 100 },
  rpe: { min: 1, max: 10 },
  duracion: { min: 1, max: 300 },
} as const;

const clamp = (n: number, min: number, max: number): number => Math.min(max, Math.max(min, n));

/** "62,5" | "62.5" -> 62.5; vacío o inválido -> undefined. */
const parseDecimal = (texto: string): number | undefined => {
  const n = parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Deja solo dígitos y un separador decimal mientras se escribe. */
const limpiarDecimal = (texto: string): string => texto.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');

const soloDigitos = (texto: string): string => texto.replace(/\D/g, '');

const pesoATexto = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');

const vibrar = (fn: () => Promise<void>) => {
  fn().catch(() => {});
};

const crearSerie = (numero: number, peso: number, repeticiones: number, rpe: number): SerieEditable => ({
  numero,
  peso,
  repeticiones,
  rpe,
  completada: false,
  pesoTxt: pesoATexto(peso),
  repsTxt: String(repeticiones),
  rpeTxt: String(rpe) });

// ============================================
// Lecturas síncronas (op-sqlite es sync: no hace falta un efecto de carga)
// ============================================
interface CatalogoEjercicio {
  id: string;
  nombre: string;
  grupoMuscular: string;
}

function leerCatalogo(): CatalogoEjercicio[] {
  try {
    const r = getDatabase().executeSync('SELECT id, nombre, grupo_muscular FROM ejercicios');
    return (r.rows as any[]).map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre ?? ''),
      grupoMuscular: String(row.grupo_muscular ?? '') }));
  } catch {
    return [];
  }
}

/** Último peso usado por cada ejercicio de rutina, para precargar las series. */
function leerUltimosPesos(clienteId: string | null): Map<string, number> {
  const mapa = new Map<string, number>();
  if (!clienteId) return mapa;
  try {
    const logs = getDatabase().executeSync(
      'SELECT ejercicios FROM entrenamientos_realizados WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 10',
      [clienteId]
    ).rows as any[];
    for (const log of logs) {
      let arr: any[] = [];
      try {
        const parsed = JSON.parse(log.ejercicios);
        arr = Array.isArray(parsed) ? parsed : [];
      } catch {
        continue;
      }
      for (const er of arr) {
        const completadas = (Array.isArray(er?.series) ? er.series : []).filter(
          (s: any) => s?.completada && Number(s.peso) > 0
        );
        if (completadas.length > 0 && er.ejercicioRutinaId && !mapa.has(er.ejercicioRutinaId)) {
          mapa.set(er.ejercicioRutinaId, Number(completadas[completadas.length - 1].peso));
        }
      }
    }
  } catch {
    // sin historial: seguimos con pesos estimados
  }
  return mapa;
}

/** Construye el estado editable de un ejercicio a partir de lo prescrito en la rutina. */
function crearEstadoEjercicio(
  ej: EjercicioRutina,
  indice: number,
  catalogo: CatalogoEjercicio[],
  ultimoPeso: number | null
): EstadoEjercicio {
  const meta = catalogo.find((c) => c.id === ej.ejercicioId);
  const grupo = meta?.grupoMuscular ?? '';
  const peso = clamp(ultimoPeso ?? PESO_INICIAL_POR_GRUPO[grupo] ?? 20, LIM.peso.min, LIM.peso.max);
  const reps = clamp(getRepsObjetivo(ej.repeticiones) || 8, LIM.reps.min, LIM.reps.max);
  const rpe = clamp(Math.round(Number(ej.rpeObjetivo)) || 8, LIM.rpe.min, LIM.rpe.max);
  const nSeries = clamp(Math.round(Number(ej.series)) || 1, 1, 20);
  return {
    ejercicioRutinaId: ej.id,
    nombre: meta?.nombre ?? 'Ejercicio',
    grupo,
    colapsado: indice > 1,
    ultimoPeso,
    series: Array.from({ length: nSeries }, (_, s) => crearSerie(s + 1, peso, reps, rpe)) };
}

interface DatosEntrenamiento {
  nombreRutina: string;
  clienteId: string | null;
  dia: DiaRutina | null;
  estado: EstadoEjercicio[];
}

/** Lee rutina + día + últimos pesos y arma el estado inicial del logger. */
function leerEntrenamiento(rutinaId: string, diaId: string, clienteSeleccionado: string | null): DatosEntrenamiento {
  const vacio: DatosEntrenamiento = { nombreRutina: '', clienteId: clienteSeleccionado, dia: null, estado: [] };
  try {
    const rutinaRow = getDatabase().executeSync(
      'SELECT nombre, cliente_id, dias FROM rutinas_semanales WHERE id = ?',
      [rutinaId]
    ).rows[0] as any;
    if (!rutinaRow) return vacio;

    const clienteId: string | null = rutinaRow.cliente_id ?? clienteSeleccionado;
    const parsed = JSON.parse(rutinaRow.dias ?? '[]');
    const dias: DiaRutina[] = Array.isArray(parsed) ? parsed : [];
    const diaRaw = dias.find((d) => d?.id === diaId);
    if (!diaRaw) return { ...vacio, nombreRutina: rutinaRow.nombre ?? '', clienteId };

    const dia: DiaRutina = {
      ...diaRaw,
      ejercicios: (Array.isArray(diaRaw.ejercicios) ? diaRaw.ejercicios : []).filter((e) => e && e.id),
    };
    const catalogo = leerCatalogo();
    const ultimoPorEjercicio = leerUltimosPesos(clienteId);

    return {
      nombreRutina: rutinaRow.nombre ?? '',
      clienteId,
      dia,
      estado: dia.ejercicios.map((ej, i) => crearEstadoEjercicio(ej, i, catalogo, ultimoPorEjercicio.get(ej.id) ?? null)) };
  } catch (error) {
    console.error('[logger] no se pudo leer el entrenamiento:', error);
    return vacio;
  }
}

/**
 * Las pantallas de las tabs quedan montadas: la `key` fuerza un logger nuevo al
 * cambiar de rutina/día y después de guardar o descartar.
 */
export default function EntrenamientoScreen() {
  const { rutinaId = '', diaId = '' } = useLocalSearchParams<Params>();
  const [sesion, setSesion] = useState(0);
  return (
    <Logger
      key={`${rutinaId}/${diaId}/${sesion}`}
      rutinaId={rutinaId}
      diaId={diaId}
      onTerminar={() => setSesion((s) => s + 1)}
    />
  );
}

function Logger({ rutinaId, diaId, onTerminar }: { rutinaId: string; diaId: string; onTerminar: () => void }) {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { addToast } = useUIStore();
  const selectedClienteId = useClientesStore((s) => s.selectedClienteId);
  const addEntrenamiento = useEntrenamientosStore((s) => s.addEntrenamiento);

  // Datos de la sesión: se leen una vez por montaje (la key del padre resetea).
  const [datos] = useState(() => leerEntrenamiento(rutinaId, diaId, selectedClienteId));
  const { dia, nombreRutina, clienteId } = datos;

  const [estado, setEstado] = useState<EstadoEjercicio[]>(datos.estado);
  const [saving, setSaving] = useState(false);

  // Cronómetro de sesión: basado en timestamps para no atrasarse en segundo plano.
  const [segundos, setSegundos] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const acumuladoMsRef = useRef(0);
  const inicioMsRef = useRef<number | null>(null);

  // Descanso
  const [descanso, setDescanso] = useState<{ fin: number; total: number } | null>(null);
  const [descansoRestante, setDescansoRestante] = useState(0);

  const [rpeElegido, setRpeElegido] = useState<number | null>(null);
  const [notas, setNotas] = useState('');

  // ============================================
  // Cronómetros
  // ============================================
  useEffect(() => {
    if (!corriendo) return;
    const inicio = Date.now();
    inicioMsRef.current = inicio;
    const id = setInterval(() => {
      setSegundos(Math.floor((acumuladoMsRef.current + Date.now() - inicio) / 1000));
    }, 1000);
    return () => {
      clearInterval(id);
      acumuladoMsRef.current += Date.now() - inicio;
      inicioMsRef.current = null;
    };
  }, [corriendo]);

  useEffect(() => {
    if (!descanso) return;
    const avisados = new Set<number>();
    const id = setInterval(() => {
      const restante = Math.max(0, Math.ceil((descanso.fin - Date.now()) / 1000));
      setDescansoRestante(restante);
      if (restante <= 0) {
        vibrar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        setDescanso(null);
      } else if (restante <= 3 && !avisados.has(restante)) {
        avisados.add(restante);
        vibrar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
      }
    }, 250);
    return () => clearInterval(id);
  }, [descanso]);

  const pararDescanso = () => {
    setDescanso(null);
    setDescansoRestante(0);
  };

  const iniciarDescanso = (seg: number) => {
    const total = clamp(Math.round(seg) || 90, 1, 3600);
    setDescanso({ fin: Date.now() + total * 1000, total });
    setDescansoRestante(total);
  };

  const duracionActualMs = () =>
    acumuladoMsRef.current + (inicioMsRef.current != null ? Date.now() - inicioMsRef.current : 0);

  // ============================================
  // Mutaciones de series
  // ============================================
  const actualizarSerie = (ejIdx: number, serieIdx: number, patch: Partial<SerieEditable>) => {
    setEstado((prev) =>
      prev.map((e, i) => {
        if (i !== ejIdx) return e;
        return { ...e, series: e.series.map((s, j) => (j === serieIdx ? { ...s, ...patch } : s)) };
      })
    );
  };

  const cambiarPeso = (ejIdx: number, serieIdx: number, texto: string) => {
    const pesoTxt = limpiarDecimal(texto);
    actualizarSerie(ejIdx, serieIdx, { pesoTxt, peso: clamp(parseDecimal(pesoTxt) ?? 0, LIM.peso.min, LIM.peso.max) });
  };

  const cambiarReps = (ejIdx: number, serieIdx: number, texto: string) => {
    const repsTxt = soloDigitos(texto).slice(0, 3);
    const n = parseInt(repsTxt, 10);
    actualizarSerie(ejIdx, serieIdx, { repsTxt, repeticiones: clamp(Number.isFinite(n) ? n : 0, LIM.reps.min, LIM.reps.max) });
  };

  const cambiarRpe = (ejIdx: number, serieIdx: number, texto: string) => {
    const rpeTxt = soloDigitos(texto).slice(0, 2);
    const n = parseInt(rpeTxt, 10);
    if (Number.isFinite(n)) actualizarSerie(ejIdx, serieIdx, { rpeTxt, rpe: clamp(n, LIM.rpe.min, LIM.rpe.max) });
    else actualizarSerie(ejIdx, serieIdx, { rpeTxt });
  };

  /** Al salir del campo, el texto refleja el valor numérico efectivo (acotado al rango válido). */
  const normalizarTextos = (ejIdx: number, serieIdx: number) => {
    const s = estado[ejIdx]?.series[serieIdx];
    if (!s) return;
    actualizarSerie(ejIdx, serieIdx, { pesoTxt: pesoATexto(s.peso), repsTxt: String(s.repeticiones), rpeTxt: String(s.rpe) });
  };

  const getDescansoSugerido = (ejercicioRutinaId: string): number => {
    const ej = dia?.ejercicios.find((e) => e.id === ejercicioRutinaId);
    return Number(ej?.descansoSeg) || 0;
  };

  const alternarSerie = (ejIdx: number, serieIdx: number) => {
    const ejercicio = estado[ejIdx];
    const serieActual = ejercicio?.series[serieIdx];
    if (!ejercicio || !serieActual) return;
    const nuevoValor = !serieActual.completada;
    actualizarSerie(ejIdx, serieIdx, { completada: nuevoValor });
    if (nuevoValor) {
      vibrar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      if (!corriendo) setCorriendo(true);
      const descansoSeg = getDescansoSugerido(ejercicio.ejercicioRutinaId);
      if (descansoSeg > 0) iniciarDescanso(descansoSeg);
    }
  };

  const quitarSerie = (ejIdx: number) => {
    setEstado((prev) =>
      prev.map((e, i) => (i !== ejIdx || e.series.length <= 1 ? e : { ...e, series: e.series.slice(0, -1) }))
    );
  };

  const copiarUltimaSerie = (ejIdx: number) => {
    setEstado((prev) =>
      prev.map((e, i) => {
        if (i !== ejIdx) return e;
        const ultima = e.series[e.series.length - 1];
        const nueva = ultima
          ? crearSerie(e.series.length + 1, ultima.peso, ultima.repeticiones, ultima.rpe)
          : crearSerie(1, PESO_INICIAL_POR_GRUPO[e.grupo] ?? 20, 8, 8);
        return { ...e, series: [...e.series, nueva] };
      })
    );
    addToast('Serie agregada con el mismo peso', 'info');
  };

  const toggleColapso = (ejIdx: number) => {
    setEstado((prev) => prev.map((e, i) => (i === ejIdx ? { ...e, colapsado: !e.colapsado } : e)));
  };

  // ============================================
  // Métricas
  // ============================================
  const volumenTotal = useMemo(
    () => calculateSessionVolume(estado.map((e) => ({ series: e.series.filter((s) => s.completada) }))),
    [estado]
  );

  const seriesCompletadas = useMemo(
    () => estado.reduce((acc, e) => acc + e.series.filter((s) => s.completada).length, 0),
    [estado]
  );

  const mejor1RM = useMemo(() => {
    let max = 0;
    let ejercicio = '';
    for (const e of estado) {
      for (const s of e.series) {
        if (!s.completada || s.peso <= 0) continue;
        const r = estimate1RM(s.peso, s.repeticiones);
        if (r > max) {
          max = r;
          ejercicio = e.nombre;
        }
      }
    }
    return { max, ejercicio };
  }, [estado]);

  const rpePromedio = useMemo(
    () => calculateAverageRPE(estado.flatMap((e) => e.series.filter((s) => s.completada))),
    [estado]
  );

  const rpeMostrado = rpeElegido ?? (rpePromedio > 0 ? clamp(Math.round(rpePromedio), LIM.rpe.min, LIM.rpe.max) : null);

  // ============================================
  // Salir / Guardar
  // ============================================
  const salir = () => (router.canGoBack() ? router.back() : router.replace('/rutinas'));

  const cerrar = () => {
    if (seriesCompletadas === 0) {
      onTerminar();
      salir();
      return;
    }
    Alert.alert('Salir del entrenamiento', 'Las series marcadas no se guardarán.', [
      { text: 'Seguir entrenando', style: 'cancel' },
      {
        text: 'Descartar',
        style: 'destructive',
        onPress: () => {
          onTerminar();
          salir();
        } },
    ]);
  };

  // Sin deps: se re-suscribe en cada render para que `cerrar` vea las series actuales.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (saving) return true;
      cerrar();
      return true;
    });
    return () => sub.remove();
  });

  const onFinish = () => {
    if (seriesCompletadas === 0) {
      Alert.alert('Nada registrado', 'Marca al menos una serie como completada antes de guardar.');
      return;
    }
    Alert.alert(
      'Finalizar entrenamiento',
      `${seriesCompletadas} series · ${Math.round(volumenTotal)} kg de volumen\nDuración: ${formatCronometro(Math.floor(duracionActualMs() / 1000))}\n\n¿Guardar el entrenamiento?`,
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Guardar', onPress: guardar },
      ]
    );
  };

  const guardar = () => {
    if (!clienteId) {
      Alert.alert('Sin cliente', 'No se pudo determinar el cliente de esta rutina.');
      return;
    }

    const ejercicios = estado
      .filter((e) => e.series.some((s) => s.completada))
      .map((e) => ({
        ejercicioRutinaId: e.ejercicioRutinaId,
        series: e.series
          .filter((s) => s.completada)
          .map((s) => ({
            numero: s.numero,
            peso: Math.round(clamp(s.peso, LIM.peso.min, LIM.peso.max) * 100) / 100,
            repeticiones: clamp(Math.round(s.repeticiones), LIM.reps.min, LIM.reps.max),
            rpe: clamp(Math.round(s.rpe), LIM.rpe.min, LIM.rpe.max),
            completada: true })) }));

    const duracionMin = clamp(Math.round(duracionActualMs() / 60000), LIM.duracion.min, LIM.duracion.max);
    const rpeGlobal = rpeMostrado ?? 7;

    const resultado = entrenamientoRealizadoSchema.safeParse({
      clienteId,
      rutinaSemanalId: rutinaId,
      diaRutinaId: diaId,
      fecha: new Date().toISOString(),
      duracionMin,
      ejercicios,
      rpeGlobal,
      notas: notas.trim() });

    if (!resultado.success) {
      Alert.alert('No se pudo guardar', resultado.error.issues.map((i) => `• ${i.path.join('.')}: ${i.message}`).join('\n'));
      return;
    }

    const data = resultado.data;
    setSaving(true);
    try {
      const id = generateId();
      runTransaction((tx) => {
        tx.executeSync(
          `INSERT INTO entrenamientos_realizados (id, cliente_id, rutina_semanal_id, dia_rutina_id, fecha, duracion_min, ejercicios, rpe_global, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.clienteId,
            data.rutinaSemanalId,
            data.diaRutinaId,
            data.fecha,
            data.duracionMin,
            JSON.stringify(data.ejercicios),
            data.rpeGlobal ?? null,
            data.notas ?? '',
          ]
        );
      });

      const registro: EntrenamientoRealizado = {
        id,
        clienteId: data.clienteId,
        rutinaSemanalId: data.rutinaSemanalId,
        diaRutinaId: data.diaRutinaId,
        fecha: data.fecha,
        duracionMin: data.duracionMin,
        ejercicios: data.ejercicios,
        rpeGlobal: data.rpeGlobal as EntrenamientoRealizado['rpeGlobal'],
        notas: data.notas ?? '' };
      addEntrenamiento(data.clienteId, registro);

      vibrar(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      addToast('Entrenamiento guardado', 'success');
      onTerminar();
      salir();
    } catch (error: any) {
      setSaving(false);
      Alert.alert('Error', error?.message ?? 'No se pudo guardar');
    }
  };

  // ============================================
  // Render
  // ============================================
  if (!dia) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="alert-circle-outline" size={48} color={t.colors.textSubtle} />
        <Text style={styles.loadingText}>No se pudo cargar el entrenamiento</Text>
        <Text style={styles.loadingSubtext}>La rutina o el día seleccionados ya no existen.</Text>
        <Button variant="accent" onPress={salir} style={{ marginTop: 16 }}>
          Volver
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <Stack.Screen options={{ gestureEnabled: false }} />
      {/* Barra superior fija con cronómetro */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={cerrar} style={styles.closeBtn} hitSlop={12} accessibilityLabel="Cerrar entrenamiento">
          <Ionicons name="close" size={24} color={t.colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.topTitle} numberOfLines={1}>
            {dia.nombre}
          </Text>
          <Text style={styles.topSubtitle} numberOfLines={1}>
            {nombreRutina} · {estado.length} ejercicios
          </Text>
        </View>
        <View style={styles.timerBox}>
          <Text style={styles.timerText}>{formatCronometro(segundos)}</Text>
          <Text style={styles.timerLabel}>{corriendo ? 'en curso' : 'pausado'}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 130 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Control del cronómetro */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.ctrlBtn, corriendo ? styles.ctrlBtnStop : styles.ctrlBtnPlay]}
            onPress={() => {
              setCorriendo((c) => !c);
              vibrar(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
            }}
          >
            <Ionicons name={corriendo ? 'pause' : 'play'} size={18} color={t.colors.textInverse} />
            <Text style={styles.ctrlBtnText}>{corriendo ? 'Pausar' : 'Iniciar'}</Text>
          </TouchableOpacity>

          <View style={styles.statChip}>
            <Text style={styles.statChipValue}>{seriesCompletadas}</Text>
            <Text style={styles.statChipLabel}>series</Text>
          </View>
          <View style={styles.statChip}>
            <Text style={styles.statChipValue}>{Math.round(volumenTotal / 100) / 10}t</Text>
            <Text style={styles.statChipLabel}>volumen</Text>
          </View>
          {mejor1RM.max > 0 && (
            <View style={styles.statChip}>
              <Text style={styles.statChipValue}>{Math.round(mejor1RM.max)}kg</Text>
              <Text style={styles.statChipLabel}>1RM</Text>
            </View>
          )}
        </View>

        {estado.length === 0 && (
          <Card style={styles.ejCard}>
            <CardContent>
              <Text style={styles.loadingSubtext}>
                {dia.esDescanso ? 'Este día es de descanso.' : 'Este día no tiene ejercicios cargados.'}
              </Text>
            </CardContent>
          </Card>
        )}

        {/* Ejercicios */}
        {estado.map((e, ejIdx) => {
          const ejRutina = dia.ejercicios.find((x) => x.id === e.ejercicioRutinaId);
          const volEjercicio = calculateVolume(e.series.filter((s) => s.completada));
          const completadas = e.series.filter((s) => s.completada).length;
          const descansoEj = Number(ejRutina?.descansoSeg) || 90;

          return (
            <Card key={e.ejercicioRutinaId} style={styles.ejCard}>
              <TouchableOpacity onPress={() => toggleColapso(ejIdx)} style={styles.ejHeader}>
                <View style={styles.ejHeaderLeft}>
                  <View style={[styles.checkCircle, completadas === e.series.length && e.series.length > 0 && styles.checkCircleFull]}>
                    {completadas === e.series.length && e.series.length > 0 && (
                      <Ionicons name="checkmark" size={14} color={t.colors.textInverse} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ejNombre}>{e.nombre}</Text>
                    <Text style={styles.ejMeta}>
                      {ejRutina ? `${ejRutina.series}x${ejRutina.repeticiones} · RPE ${ejRutina.rpeObjetivo} · ${ejRutina.descansoSeg}s` : ''}
                    </Text>
                    {ejRutina?.progresion?.tipo ? (
                      <Text style={styles.ejProgresion}>
                        {getProgresionLabel(ejRutina.progresion)}
                        {e.ultimoPeso ? ` · última vez: ${pesoATexto(e.ultimoPeso)}kg` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.ejVolumen}>
                    <Text style={styles.ejVolumenValue}>{Math.round(volEjercicio)}</Text>
                    <Text style={styles.ejVolumenLabel}>kg vol</Text>
                  </View>
                  <Ionicons name={e.colapsado ? 'chevron-down' : 'chevron-up'} size={18} color={t.colors.textSubtle} />
                </View>
              </TouchableOpacity>

              {!e.colapsado && (
                <View style={styles.ejBody}>
                  <View style={styles.seriesHeader}>
                    <Text style={[styles.colLabel, styles.colNum]}>#</Text>
                    <Text style={[styles.colLabel, styles.colPeso]}>Peso (kg)</Text>
                    <Text style={[styles.colLabel, styles.colReps]}>Reps</Text>
                    <Text style={[styles.colLabel, styles.colRpe]}>RPE</Text>
                    <View style={styles.colCheck} />
                  </View>

                  {e.series.map((s, sIdx) => (
                    <View key={sIdx} style={[styles.serieRow, s.completada && styles.serieRowDone]}>
                      <Text style={styles.serieNum}>{s.numero}</Text>
                      <TextInput
                        style={[styles.inputSmall, styles.colPeso]}
                        value={s.pesoTxt}
                        onChangeText={(v) => cambiarPeso(ejIdx, sIdx, v)}
                        onBlur={() => normalizarTextos(ejIdx, sIdx)}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={t.colors.placeholder}
                        selectTextOnFocus
                      />
                      <TextInput
                        style={[styles.inputSmall, styles.colReps]}
                        value={s.repsTxt}
                        onChangeText={(v) => cambiarReps(ejIdx, sIdx, v)}
                        onBlur={() => normalizarTextos(ejIdx, sIdx)}
                        keyboardType="number-pad"
                        placeholder="0"
                        placeholderTextColor={t.colors.placeholder}
                        selectTextOnFocus
                      />
                      <TextInput
                        style={[styles.inputSmall, styles.colRpe]}
                        value={s.rpeTxt}
                        onChangeText={(v) => cambiarRpe(ejIdx, sIdx, v)}
                        onBlur={() => normalizarTextos(ejIdx, sIdx)}
                        keyboardType="number-pad"
                        placeholder="8"
                        placeholderTextColor={t.colors.placeholder}
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={[styles.serieCheck, s.completada && styles.serieCheckDone]}
                        onPress={() => alternarSerie(ejIdx, sIdx)}
                        accessibilityLabel={s.completada ? 'Desmarcar serie' : 'Marcar serie completada'}
                      >
                        {s.completada && <Ionicons name="checkmark" size={18} color={t.colors.textInverse} />}
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.seriesActions}>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => copiarUltimaSerie(ejIdx)}>
                      <Ionicons name="add" size={14} color={t.colors.primary} />
                      <Text style={styles.miniBtnText}>Serie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => iniciarDescanso(descansoEj)}>
                      <Ionicons name="timer-outline" size={14} color={t.colors.primary} />
                      <Text style={styles.miniBtnText}>Descanso {descansoEj}s</Text>
                    </TouchableOpacity>
                    {e.series.length > 1 && (
                      <TouchableOpacity style={[styles.miniBtn, styles.miniBtnDanger]} onPress={() => quitarSerie(ejIdx)}>
                        <Ionicons name="remove" size={14} color={t.colors.danger} />
                        <Text style={[styles.miniBtnText, { color: t.colors.danger }]}>Quitar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
            </Card>
          );
        })}

        {/* RPE global + notas */}
        <Card style={styles.ejCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Sensación de la sesión</Text>
            <View style={styles.rpeRow}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.rpeBtn, rpeMostrado === n && styles.rpeBtnActive]}
                  onPress={() => setRpeElegido(rpeElegido === n ? null : n)}
                >
                  <Text style={[styles.rpeBtnText, rpeMostrado === n && styles.rpeBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rpePromedio > 0 && (
              <Text style={styles.rpeHint}>
                RPE promedio real de las series marcadas: {rpePromedio.toFixed(1)}
                {rpeElegido != null ? ' · RPE de sesión elegido manualmente' : ''}
              </Text>
            )}
            <View style={{ marginTop: 12 }}>
              <Input
                placeholder="Notas del entrenamiento (sensación, dolor, técnica…)"
                value={notas}
                onChange={setNotas}
                maxLength={2000}
                multiline
                numberOfLines={3}
              />
            </View>
          </CardContent>
        </Card>

        <Button
          variant="primary"
          onPress={onFinish}
          loading={saving}
          style={styles.finishBtn}
          leftIcon={<Ionicons name="flag-outline" size={20} color={t.colors.onPrimary} />}
        >
          Finalizar y guardar
        </Button>
      </ScrollView>

      {/* Flotante: insertarlo en el scroll desplaza las series y provoca toques errados */}
      {descanso && descansoRestante > 0 && (
        <Card style={[styles.descansoCard, { bottom: insets.bottom + 12 }]}>
          <CardContent>
            <View style={styles.descansoRow}>
              <Ionicons name="timer-outline" size={22} color={t.colors.primary} />
              <Text style={styles.descansoText}>Descanso</Text>
              <Text style={styles.descansoTiempo}>{formatSeconds(descansoRestante)}</Text>
              <TouchableOpacity onPress={pararDescanso} style={styles.descansoSkip}>
                <Text style={styles.descansoSkipText}>Saltar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (descansoRestante / Math.max(1, descanso.total)) * 100)}%` },
                ]}
              />
            </View>
          </CardContent>
        </Card>
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
  loadingText: { color: t.colors.textMuted, marginTop: 12 },
  loadingSubtext: { color: t.colors.textSubtle, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingBottom: 12, backgroundColor: t.colors.surface,
    borderBottomWidth: 1, borderBottomColor: t.colors.border },
  closeBtn: { padding: 4 },
  topInfo: { flex: 1 },
  topTitle: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  topSubtitle: { fontSize: 11, color: t.colors.textSubtle, marginTop: 1 },
  timerBox: { alignItems: 'flex-end' },
  timerText: { fontSize: 20, fontWeight: '700', color: t.colors.text, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 9, color: t.colors.textSubtle },
  scrollContent: { padding: 12, gap: 12 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctrlBtnPlay: { backgroundColor: t.colors.success },
  ctrlBtnStop: { backgroundColor: t.colors.warning },
  ctrlBtnText: { color: t.colors.textInverse, fontWeight: '600', fontSize: 13 },
  statChip: {
    flex: 1, alignItems: 'center', backgroundColor: t.colors.surface,
    borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: t.colors.border },
  statChipValue: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  statChipLabel: { fontSize: 9, color: t.colors.textSubtle },
  descansoCard: {
    position: 'absolute', left: 16, right: 16,
    borderWidth: 1, borderColor: t.colors.primary, backgroundColor: t.colors.surface,
    elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  descansoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  descansoText: { flex: 1, fontSize: 14, fontWeight: '600', color: t.colors.primaryDark },
  descansoTiempo: { fontSize: 22, fontWeight: '700', color: t.colors.primary, fontVariant: ['tabular-nums'] },
  descansoSkip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: t.colors.surface },
  descansoSkipText: { fontSize: 11, fontWeight: '600', color: t.colors.primaryDark },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: t.colors.surface, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: t.colors.primary },
  ejCard: { borderWidth: 1, borderColor: t.colors.border },
  ejHeader: { padding: 14 },
  ejHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.colors.borderStrong,
    alignItems: 'center', justifyContent: 'center' },
  checkCircleFull: { backgroundColor: t.colors.success, borderColor: t.colors.success },
  ejNombre: { fontSize: 14, fontWeight: '600', color: t.colors.text },
  ejMeta: { fontSize: 11, color: t.colors.textMuted, marginTop: 2 },
  ejProgresion: { fontSize: 10, color: t.colors.success, marginTop: 2 },
  ejVolumen: { alignItems: 'flex-end' },
  ejVolumenValue: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  ejVolumenLabel: { fontSize: 9, color: t.colors.textSubtle },
  ejBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  seriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  colLabel: { fontSize: 10, color: t.colors.textSubtle, fontWeight: '600', textAlign: 'center' },
  colNum: { width: 22 },
  colPeso: { flex: 1 },
  colReps: { width: 54 },
  colRpe: { width: 54 },
  colCheck: { width: 34 },
  serieRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serieRowDone: { opacity: 0.75 },
  serieNum: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '600', color: t.colors.textMuted },
  inputSmall: {
    backgroundColor: t.colors.input, borderRadius: 8, borderWidth: 1, borderColor: t.colors.border,
    paddingVertical: 8, paddingHorizontal: 6, textAlign: 'center',
    fontSize: 14, fontWeight: '600', color: t.colors.text
  },
  serieCheck: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: t.colors.borderStrong,
    alignItems: 'center', justifyContent: 'center' },
  serieCheckDone: { backgroundColor: t.colors.success, borderColor: t.colors.success },
  seriesActions: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  miniBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: t.colors.primarySoft },
  miniBtnDanger: { backgroundColor: t.colors.dangerSoft },
  miniBtnText: { fontSize: 11, fontWeight: '600', color: t.colors.primary },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: t.colors.text, marginBottom: 10 },
  rpeRow: { flexDirection: 'row', gap: 4 },
  rpeBtn: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: t.colors.surfaceAlt },
  rpeBtnActive: { backgroundColor: t.colors.primary },
  rpeBtnText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted },
  rpeBtnTextActive: { color: t.colors.onPrimary },
  rpeHint: { fontSize: 11, color: t.colors.textMuted, marginTop: 8 },
  finishBtn: { marginTop: 4 } });
