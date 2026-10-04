/**
 * Logger de Entrenamiento
 * Registro de series en vivo con cronómetro, descanso, RPE y cálculo de volumen/1RM.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useClientesStore, useEntrenamientosStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { getDatabase, runTransaction } from '@/db/database';
import {
  generateId,
  calculateVolume,
  calculateSessionVolume,
  calculateAverageRPE,
  estimate1RM,
  getRepsObjetivo,
  formatCronometro,
  formatSeconds,
  getProgresionLabel,
  getGrupoMuscularLabel } from '@/utils/helpers';
import type { DiaRutina, EjercicioRutina, SerieReal } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

type Params = { rutinaId: string; diaId: string };

interface EstadoEjercicio {
  ejercicioRutinaId: string;
  nombre: string;
  grupo: string;
  series: SerieReal[];
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

// ============================================
// Lecturas síncronas (op-sqlite es sync: no hace falta un efecto de carga)
// ============================================
interface CatalogoEjercicio {
  id: string;
  nombre: string;
  grupoMuscular: string;
}

let cacheCatalogo: CatalogoEjercicio[] | null = null;

/** Catálogo de ejercicios, cacheado en memoria durante toda la sesión. */
function leerCatalogo(): CatalogoEjercicio[] {
  if (cacheCatalogo) return cacheCatalogo;
  try {
    const db = getDatabase();
    const r = db.executeSync('SELECT id, nombre, grupo_muscular FROM ejercicios');
    cacheCatalogo = r.rows.map((row: any) => ({
      id: row.id,
      nombre: row.nombre,
      grupoMuscular: row.grupo_muscular }));
  } catch {
    cacheCatalogo = [];
  }
  return cacheCatalogo;
}

/** Último peso usado por cada ejercicio de rutina, para precargar las series. */
function leerUltimosPesos(clienteId: string | null): Map<string, number> {
  const mapa = new Map<string, number>();
  if (!clienteId) return mapa;
  try {
    const db = getDatabase();
    const logs = db.executeSync(
      'SELECT ejercicios FROM entrenamientos_realizados WHERE cliente_id = ? ORDER BY fecha DESC LIMIT 10',
      [clienteId]
    ).rows as any[];
    for (const log of logs) {
      let arr: any[] = [];
      try {
        arr = JSON.parse(log.ejercicios);
      } catch {
        continue;
      }
      for (const er of arr) {
        const completadas = (er.series ?? []).filter((s: any) => s.completada && s.peso > 0);
        if (completadas.length > 0 && !mapa.has(er.ejercicioRutinaId)) {
          mapa.set(er.ejercicioRutinaId, completadas[completadas.length - 1].peso);
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
  const peso = ultimoPeso ?? PESO_INICIAL_POR_GRUPO[grupo] ?? 20;
  const reps = getRepsObjetivo(ej.repeticiones);
  return {
    ejercicioRutinaId: ej.id,
    nombre: meta?.nombre ?? 'Ejercicio',
    grupo,
    colapsado: indice > 1,
    ultimoPeso,
    series: Array.from({ length: Math.max(1, ej.series) }, (_, s) => ({
      numero: s + 1,
      peso,
      repeticiones: reps,
      rpe: ej.rpeObjetivo,
      completada: false })) };
}

interface DatosEntrenamiento {
  nombreRutina: string;
  dia: DiaRutina | null;
  estado: EstadoEjercicio[];
}

/** Lee rutina + día + últimos pesos y arma el estado inicial del logger. */
function leerEntrenamiento(rutinaId: string, diaId: string, clienteId: string | null): DatosEntrenamiento {
  const catalogo = leerCatalogo();
  const ultimoPorEjercicio = leerUltimosPesos(clienteId);

  try {
    const db = getDatabase();
    const rutinaRow = db.executeSync('SELECT nombre, dias FROM rutinas_semanales WHERE id = ?', [rutinaId]).rows[0] as any;
    if (!rutinaRow) return { nombreRutina: '', dia: null, estado: [] };

    const dias: DiaRutina[] = JSON.parse(rutinaRow.dias);
    const dia = dias.find((d) => d.id === diaId) ?? null;
    if (!dia) return { nombreRutina: rutinaRow.nombre ?? '', dia: null, estado: [] };

    return {
      nombreRutina: rutinaRow.nombre ?? '',
      dia,
      estado: dia.ejercicios.map((ej, i) => crearEstadoEjercicio(ej, i, catalogo, ultimoPorEjercicio.get(ej.id) ?? null)) };
  } catch (error) {
    console.error('[logger] no se pudo leer el entrenamiento:', error);
    return { nombreRutina: '', dia: null, estado: [] };
  }
}

export default function EntrenamientoScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { rutinaId = '', diaId = '' } = useLocalSearchParams<Params>();
  const { addToast } = useUIStore();
  const { selectedClienteId } = useClientesStore();
  const addEntrenamiento = useEntrenamientosStore((s) => s.addEntrenamiento);

  // Datos de la sesión: derivados (síncronos) — solo las series son estado editable.
  const datos = useMemo(() => leerEntrenamiento(rutinaId, diaId, selectedClienteId), [rutinaId, diaId, selectedClienteId]);
  const { dia, nombreRutina } = datos;

  const [estado, setEstado] = useState<EstadoEjercicio[]>(datos.estado);
  const [saving, setSaving] = useState(false);

  // Cronómetro de sesión
  const [segundos, setSegundos] = useState(0);
  const [corriendo, setCorriendo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Descanso
  const [descansoRestante, setDescansoRestante] = useState(0);
  const [descansoTotal, setDescansoTotal] = useState(0);
  const descansoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [rpeGlobal, setRpeGlobal] = useState<number>(7);
  const [notas, setNotas] = useState('');

  // ============================================
  // Cronómetros
  // ============================================
  useEffect(() => {
    if (corriendo) {
      timerRef.current = setInterval(() => setSegundos((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [corriendo]);

  const pararDescanso = useCallback(() => {
    if (descansoRef.current) {
      clearInterval(descansoRef.current);
      descansoRef.current = null;
    }
    setDescansoRestante(0);
  }, []);

  useEffect(() => () => pararDescanso(), [pararDescanso]);

  const iniciarDescanso = (seg: number) => {
    pararDescanso();
    setDescansoTotal(seg);
    setDescansoRestante(seg);
    descansoRef.current = setInterval(() => {
      setDescansoRestante((prev) => {
        if (prev <= 1) {
          if (descansoRef.current) clearInterval(descansoRef.current);
          descansoRef.current = null;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          return 0;
        }
        if (prev <= 4) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev - 1;
      });
    }, 1000);
  };

  // ============================================
  // Mutaciones de series
  // ============================================
  const actualizarSerie = (ejIdx: number, serieIdx: number, patch: Partial<SerieReal>) => {
    setEstado((prev) =>
      prev.map((e, i) => {
        if (i !== ejIdx) return e;
        return { ...e, series: e.series.map((s, j) => (j === serieIdx ? { ...s, ...patch } : s)) };
      })
    );
  };

  const alternarSerie = (ejIdx: number, serieIdx: number) => {
    const serieActual = estado[ejIdx].series[serieIdx];
    const nuevoValor = !serieActual.completada;
    actualizarSerie(ejIdx, serieIdx, { completada: nuevoValor });
    if (nuevoValor) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      // Auto-arrancar descanso con la última serie completada
      const todas = estado[ejIdx].series;
      if (serieIdx === todas.length - 1) {
        const descanso = getDescansoSugerido(estado[ejIdx].ejercicioRutinaId);
        if (descanso > 0) iniciarDescanso(descanso);
      }
    }
  };

  const getDescansoSugerido = (ejercicioRutinaId: string): number => {
    if (!dia) return 0;
    const ej = dia.ejercicios.find((e) => e.id === ejercicioRutinaId);
    return ej?.descansoSeg ?? 0;
  };

  const agregarSerie = (ejIdx: number) => {
    setEstado((prev) =>
      prev.map((e, i) => {
        if (i !== ejIdx) return e;
        const ultima = e.series[e.series.length - 1];
        return {
          ...e,
          series: [
            ...e.series,
            { numero: e.series.length + 1, peso: ultima.peso, repeticiones: ultima.repeticiones, rpe: ultima.rpe, completada: false },
          ] };
      })
    );
  };

  const quitarSerie = (ejIdx: number) => {
    setEstado((prev) =>
      prev.map((e, i) => (i !== ejIdx ? e : { ...e, series: e.series.slice(0, -1) }))
    );
  };

  const copiarUltimaSerie = (ejIdx: number) => {
    setEstado((prev) =>
      prev.map((e, i) => {
        if (i !== ejIdx) return e;
        const ultima = e.series[e.series.length - 1];
        return {
          ...e,
          series: [
            ...e.series,
            { numero: e.series.length + 1, peso: ultima.peso, repeticiones: ultima.repeticiones, rpe: ultima.rpe, completada: false },
          ] };
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

  // ============================================
  // Guardar
  // ============================================
  const onFinish = () => {
    if (seriesCompletadas === 0) {
      Alert.alert('Nada registrado', 'Marca al menos una serie como completada antes de guardar.');
      return;
    }
    setCorriendo(false);
    pararDescanso();

    const payload = estado
      .filter((e) => e.series.some((s) => s.completada))
      .map((e) => ({
        ejercicioRutinaId: e.ejercicioRutinaId,
        series: e.series.filter((s) => s.completada) }));

    Alert.alert(
      'Finalizar entrenamiento',
      `${seriesCompletadas} series · ${Math.round(volumenTotal).toLocaleString('es')} kg de volumen\nDuración: ${formatCronometro(segundos)}\n\n¿Guardar el entrenamiento?`,
      [
        { text: 'Seguir entrenando', style: 'cancel' },
        { text: 'Guardar', onPress: () => guardar(payload) },
      ]
    );
  };

  const guardar = (payload: any[]) => {
    try {
      setSaving(true);
      const id = generateId();
      const db = getDatabase();
      const fecha = new Date().toISOString().split('T')[0];

      runTransaction(() => {
        db.executeSync(
          `INSERT INTO entrenamientos_realizados (id, cliente_id, rutina_semanal_id, dia_rutina_id, fecha, duracion_min, ejercicios, rpe_global, notas)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            selectedClienteId,
            rutinaId,
            diaId,
            fecha,
            Math.max(1, Math.round(segundos / 60)),
            JSON.stringify(payload),
            Math.round(rpePromedio) || rpeGlobal,
            notas,
          ]
        );
      });

      if (selectedClienteId) {
        addEntrenamiento(selectedClienteId, {
          id,
          clienteId: selectedClienteId,
          rutinaSemanalId: rutinaId,
          diaRutinaId: diaId,
          fecha,
          duracionMin: Math.max(1, Math.round(segundos / 60)),
          ejercicios: payload,
          rpeGlobal: Math.round(rpePromedio) || (rpeGlobal as any),
          notas });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addToast('Entrenamiento guardado', 'success');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Render
  // ============================================
  if (!dia) {
    return (
      <View style={styles.center}>
        <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
        <Text style={styles.loadingText}>No se pudo cargar el entrenamiento</Text>
        <Text style={styles.loadingSubtext}>La rutina o el día seleccionados ya no existen.</Text>
        <Button variant="accent" onPress={() => router.back()} style={{ marginTop: 16 }}>
          Volver
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Barra superior fija con cronómetro */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={24} color="#64748b" />
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

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Control del cronómetro */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.ctrlBtn, corriendo ? styles.ctrlBtnStop : styles.ctrlBtnPlay]}
            onPress={() => {
              setCorriendo((c) => !c);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name={corriendo ? 'pause' : 'play'} size={18} color="#fff" />
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

        {/* Descanso activo */}
        {descansoRestante > 0 && (
          <Card style={styles.descansoCard}>
            <CardContent>
              <View style={styles.descansoRow}>
                <Ionicons name="timer-outline" size={22} color="#0ea5e9" />
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
                    { width: `${Math.min(100, (descansoRestante / Math.max(1, descansoTotal)) * 100)}%` },
                  ]}
                />
              </View>
            </CardContent>
          </Card>
        )}

        {/* Ejercicios */}
        {estado.map((e, ejIdx) => {
          const ejRutina = dia.ejercicios.find((x) => x.id === e.ejercicioRutinaId);
          const volEjercicio = calculateVolume(e.series.filter((s) => s.completada));
          const completadas = e.series.filter((s) => s.completada).length;

          return (
            <Card key={e.ejercicioRutinaId} style={styles.ejCard}>
              <TouchableOpacity onPress={() => toggleColapso(ejIdx)} style={styles.ejHeader}>
                <View style={styles.ejHeaderLeft}>
                  <View style={[styles.checkCircle, completadas === e.series.length && e.series.length > 0 && styles.checkCircleFull]}>
                    {completadas === e.series.length && e.series.length > 0 && (
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ejNombre}>{e.nombre}</Text>
                    <Text style={styles.ejMeta}>
                      {ejRutina ? `${ejRutina.series}x${ejRutina.repeticiones} · RPE ${ejRutina.rpeObjetivo} · ${ejRutina.descansoSeg}s` : ''}
                    </Text>
                    {ejRutina && (
                      <Text style={styles.ejProgresion}>
                        📈 {getProgresionLabel(ejRutina.progresion)}
                        {e.ultimoPeso ? ` · última vez: ${e.ultimoPeso}kg` : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.ejVolumen}>
                    <Text style={styles.ejVolumenValue}>{Math.round(volEjercicio)}</Text>
                    <Text style={styles.ejVolumenLabel}>kg vol</Text>
                  </View>
                  <Ionicons name={e.colapsado ? 'chevron-down' : 'chevron-up'} size={18} color="#94a3b8" />
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
                        style={styles.inputSmall}
                        value={String(s.peso)}
                        onChangeText={(v) => actualizarSerie(ejIdx, sIdx, { peso: parseFloat(v) || 0 })}
                        keyboardType="decimal-pad"
                        selectTextOnFocus
                      />
                      <TextInput
                        style={styles.inputSmall}
                        value={String(s.repeticiones)}
                        onChangeText={(v) => actualizarSerie(ejIdx, sIdx, { repeticiones: parseInt(v) || 0 })}
                        keyboardType="number-pad"
                        selectTextOnFocus
                      />
                      <TextInput
                        style={styles.inputSmall}
                        value={String(s.rpe)}
                        onChangeText={(v) =>
                          actualizarSerie(ejIdx, sIdx, { rpe: Math.min(10, Math.max(1, parseInt(v) || 8)) })
                        }
                        keyboardType="number-pad"
                        selectTextOnFocus
                      />
                      <TouchableOpacity
                        style={[styles.serieCheck, s.completada && styles.serieCheckDone]}
                        onPress={() => alternarSerie(ejIdx, sIdx)}
                      >
                        {s.completada && <Ionicons name="checkmark" size={18} color="#fff" />}
                      </TouchableOpacity>
                    </View>
                  ))}

                  <View style={styles.seriesActions}>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => copiarUltimaSerie(ejIdx)}>
                      <Ionicons name="add" size={14} color="#0ea5e9" />
                      <Text style={styles.miniBtnText}>+ Serie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniBtn} onPress={() => iniciarDescanso(ejRutina?.descansoSeg ?? 90)}>
                      <Ionicons name="timer-outline" size={14} color="#0ea5e9" />
                      <Text style={styles.miniBtnText}>Descanso {ejRutina?.descansoSeg ?? 90}s</Text>
                    </TouchableOpacity>
                    {e.series.length > 1 && (
                      <TouchableOpacity style={styles.miniBtn} onPress={() => quitarSerie(ejIdx)}>
                        <Ionicons name="remove" size={14} color="#ef4444" />
                        <Text style={[styles.miniBtnText, { color: '#ef4444' }]}>Quitar</Text>
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
                  style={[styles.rpeBtn, Math.round(rpePromedio || rpeGlobal) === n && styles.rpeBtnActive]}
                  onPress={() => setRpeGlobal(n)}
                >
                  <Text style={[styles.rpeBtnText, Math.round(rpePromedio || rpeGlobal) === n && styles.rpeBtnTextActive]}>
                    {n}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {rpePromedio > 0 && (
              <Text style={styles.rpeHint}>RPE promedio real de las series marcadas: {rpePromedio.toFixed(1)}</Text>
            )}
            <Input
              placeholder="Notas del entrenamiento (sensación, dolor, técnica…)"
              value={notas}
              onChangeText={setNotas}
              multiline
              style={{ minHeight: 70, marginTop: 12 }}
            />
          </CardContent>
        </Card>

        <Button
          variant="primary"
          onPress={onFinish}
          loading={saving}
          style={styles.finishBtn}
          leftIcon={<Ionicons name="flag-outline" size={20} color="#fff" />}
        >
          Finalizar y guardar
        </Button>
      </ScrollView>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg },
  loadingText: { color: t.colors.textMuted, marginTop: 12 },
  loadingSubtext: { color: t.colors.textSubtle, fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 32 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: t.colors.surface,
    borderBottomWidth: 1, borderBottomColor: t.colors.border },
  closeBtn: { padding: 4 },
  topInfo: { flex: 1 },
  topTitle: { fontSize: 15, fontWeight: '700', color: t.colors.text},
  topSubtitle: { fontSize: 11, color: t.colors.textSubtle, marginTop: 1 },
  timerBox: { alignItems: 'flex-end' },
  timerText: { fontSize: 20, fontWeight: '700', color: t.colors.text, fontVariant: ['tabular-nums']},
  timerLabel: { fontSize: 9, color: t.colors.textSubtle},
  scrollContent: { padding: 12, gap: 12, paddingBottom: 130 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctrlBtnPlay: { backgroundColor: t.colors.success },
  ctrlBtnStop: { backgroundColor: t.colors.warning },
  ctrlBtnText: { color: t.colors.textInverse, fontWeight: '600', fontSize: 13},
  statChip: {
    flex: 1, alignItems: 'center', backgroundColor: t.colors.surface,
    borderRadius: 10, paddingVertical: 8, borderWidth: 1, borderColor: t.colors.border },
  statChipValue: { fontSize: 15, fontWeight: '700', color: t.colors.text},
  statChipLabel: { fontSize: 9, color: t.colors.textSubtle},
  descansoCard: { borderWidth: 1, borderColor: t.colors.primarySoft, backgroundColor: t.colors.primarySoft },
  descansoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  descansoText: { flex: 1, fontSize: 14, fontWeight: '600', color: t.colors.primaryDark},
  descansoTiempo: { fontSize: 22, fontWeight: '700', color: t.colors.primary, fontVariant: ['tabular-nums']},
  descansoSkip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: t.colors.primarySoft },
  descansoSkipText: { fontSize: 11, fontWeight: '600', color: t.colors.primaryDark},
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: t.colors.primarySoft, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: t.colors.primary },
  ejCard: { borderWidth: 1, borderColor: t.colors.border },
  ejHeader: { padding: 14 },
  ejHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: t.colors.borderStrong,
    alignItems: 'center', justifyContent: 'center' },
  checkCircleFull: { backgroundColor: t.colors.success, borderColor: t.colors.success },
  ejNombre: { fontSize: 14, fontWeight: '600', color: t.colors.text},
  ejMeta: { fontSize: 11, color: t.colors.textMuted, marginTop: 2},
  ejProgresion: { fontSize: 10, color: t.colors.success, marginTop: 2},
  ejVolumen: { alignItems: 'flex-end' },
  ejVolumenValue: { fontSize: 15, fontWeight: '700', color: t.colors.text},
  ejVolumenLabel: { fontSize: 9, color: t.colors.textSubtle},
  ejBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  seriesHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 4 },
  colLabel: { fontSize: 10, color: t.colors.textSubtle, fontWeight: '600'},
  colNum: { width: 22, textAlign: 'center' },
  colPeso: { flex: 1 },
  colReps: { width: 54, textAlign: 'center' },
  colRpe: { width: 54, textAlign: 'center' },
  colCheck: { width: 34 },
  serieRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  serieRowDone: { opacity: 0.75 },
  serieNum: { width: 22, textAlign: 'center', fontSize: 13, fontWeight: '600', color: t.colors.textMuted},
  inputSmall: {
    flex: 1, backgroundColor: t.colors.bg, borderRadius: 8, borderWidth: 1, borderColor: t.colors.border,
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
  miniBtnText: { fontSize: 11, fontWeight: '600', color: t.colors.primary},
  sectionTitle: { fontSize: 15, fontWeight: '600', color: t.colors.text, marginBottom: 10 },
  rpeRow: { flexDirection: 'row', gap: 4 },
  rpeBtn: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: t.colors.surfaceAlt },
  rpeBtnActive: { backgroundColor: t.colors.primary },
  rpeBtnText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted},
  rpeBtnTextActive: { color: t.colors.textInverse },
  rpeHint: { fontSize: 11, color: t.colors.textMuted, marginTop: 8},
  finishBtn: { marginTop: 4 } });
