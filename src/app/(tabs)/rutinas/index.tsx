/**
 * Rutinas — pantalla raíz de la tab "Rutinas".
 *
 * Muestra la rutina del mesociclo activo, permite saltar entre semanas y
 * lanzar el logger de un día con un toque. El diseño prioriza leer la
 * prescripción de un vistazo: series × reps en grande, RPE y descanso como
 * metadatos, y color por grupo muscular.
 */

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useClientesStore, useRutinasStore, useUIStore } from '@/stores';
import { Button, Card, CardHeader, CardContent, Chip, Badge, EmptyState, Avatar } from '@/components/ui';
import { getProgresionLabel } from '@/utils/helpers';
import { getDatabase } from '@/db/database';
import { useGuardFicha } from '@/hooks/useGuardFicha';
import { GRUPOS_MUSCULARES } from '@/constants';

const colorGrupo = (nombre?: string) =>
  GRUPOS_MUSCULARES.find((g) => g.label === nombre || g.id === nombre)?.color;

export default function RutinasScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { selectedClienteId, getSelectedCliente } = useClientesStore();
  const { getRutinasByCliente } = useRutinasStore();
  const addToast = useUIStore((s) => s.addToast);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const { tieneFicha } = useGuardFicha(selectedClienteId, false);

  const cliente = getSelectedCliente();
  const rutinas = selectedClienteId ? getRutinasByCliente(selectedClienteId) : [];

  const activeRutina = useMemo(() => {
    if (rutinas.length === 0) return undefined;
    const max = Math.max(...rutinas.map((r) => r.mesociclo));
    return rutinas.find((r) => r.mesociclo === max);
  }, [rutinas]);

  const weeksInMesociclo = activeRutina ? activeRutina.semanaFin - activeRutina.semanaInicio + 1 : 0;

  const semanaSeleccionada = Math.min(Math.max(selectedWeek, 1), Math.max(weeksInMesociclo, 1));

  const diaActual = useMemo(() => {
    if (!activeRutina) return null;
    if (semanaSeleccionada < activeRutina.semanaInicio || semanaSeleccionada > activeRutina.semanaFin) {
      return null;
    }
    return (
      activeRutina.dias.find((d) => d.orden === semanaSeleccionada - activeRutina.semanaInicio + 1) ?? null
    );
  }, [activeRutina, semanaSeleccionada]);

  const loadRutinas = useCallback(async () => {
    if (!selectedClienteId) return;
    try {
      const db = getDatabase();
      db.executeSync(
        'SELECT * FROM rutinas_semanales WHERE cliente_id = ? ORDER BY mesociclo DESC, semana_inicio DESC',
        [selectedClienteId]
      );
    } catch (error) {
      console.error('Error loading rutinas:', error);
    }
  }, [selectedClienteId]);

  useEffect(() => {
    loadRutinas();
  }, [loadRutinas]);

  // ------------------------------------------------------------------ Estados vacíos
  if (!selectedClienteId) {
    return (
      <View style={[styles.flexCenter, { backgroundColor: t.colors.bg }]}>
        <EmptyState
          icon="people-outline"
          title="Elegí un cliente"
          subtitle="Las rutinas se prescriben por cliente. Abrí la pestaña Clientes y seleccioná uno."
          action={<Button onPress={() => router.push('/clientes')}>Ir a Clientes</Button>}
        />
      </View>
    );
  }

  const header = (
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
        <Text style={[t.typography.display, { color: t.colors.text }]}>Rutinas</Text>
        <Text style={[t.typography.small, { color: t.colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
          {cliente ? `${cliente.nombre} ${cliente.apellido}` : '—'}
          {activeRutina ? ` · Mesociclo ${activeRutina.mesociclo}` : ''}
        </Text>
      </View>
      <Button
        size="sm"
        onPress={() => router.push('/rutinas/nuevo')}
        leftIcon={<Ionicons name="add" size={18} color={t.colors.onPrimary} />}
      >
        Nueva
      </Button>
    </View>
  );

  if (rutinas.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: t.colors.bg }}>
        {header}
        <ScrollView contentContainerStyle={styles.scroll}>
          <EmptyState
            icon={tieneFicha ? 'barbell-outline' : 'clipboard-outline'}
            title={tieneFicha ? 'Sin rutinas todavía' : 'Falta la ficha inicial'}
            subtitle={
              tieneFicha
                ? 'Diseñá la primera rutina. El editor ya viene con 75 ejercicios del catálogo y progresión automática.'
                : 'Sin ficha inicial no se puede prescribir con criterio. Cargá peso, perímetros y fotos primero.'
            }
            action={
              <Button
                onPress={() =>
                  router.push(tieneFicha ? '/rutinas/nuevo' : `/clientes/${selectedClienteId}/ficha/nueva`)
                }
                leftIcon={
                  <Ionicons
                    name={tieneFicha ? 'add' : 'clipboard-outline'}
                    size={18}
                    color={t.colors.onPrimary}
                  />
                }
              >
                {tieneFicha ? 'Crear rutina' : 'Crear ficha inicial'}
              </Button>
            }
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.bg }]}>
      {header}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ------------------------------------------------ Aviso ficha inicial */}
        {!tieneFicha && (
          <Pressable
            onPress={() => router.push(`/clientes/${selectedClienteId}/ficha/nueva`)}
            style={[
              styles.banner,
              { backgroundColor: t.colors.warningSoft, borderColor: t.colors.warning },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="alert-circle" size={20} color={t.colors.warning} />
            <Text style={[t.typography.small, { color: t.colors.text, flex: 1 }]}>
              Este cliente no tiene ficha inicial. Tocá para crearla antes de prescribir.
            </Text>
            <Ionicons name="chevron-forward" size={16} color={t.colors.warning} />
          </Pressable>
        )}

        {/* ------------------------------------------------ Selector de semana */}
        {weeksInMesociclo > 0 && (
          <View style={styles.weekRow}>
            {Array.from({ length: weeksInMesociclo }, (_, i) => i + 1).map((w) => {
              const dia = activeRutina?.dias.find((d) => d.orden === w);
              const activo = semanaSeleccionada === w;
              return (
                <Pressable
                  key={w}
                  onPress={() => setSelectedWeek(w)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activo }}
                  style={[
                    styles.weekCard,
                    {
                      backgroundColor: activo ? t.colors.primary : t.colors.surface,
                      borderColor: activo ? t.colors.primary : t.colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      t.typography.micro,
                      { color: activo ? t.colors.onPrimary : t.colors.textSubtle },
                    ]}
                  >
                    SEM {w}
                  </Text>
                  <Text
                    style={[
                      t.typography.smallStrong,
                      {
                        color: activo ? t.colors.onPrimary : t.colors.text,
                        marginTop: 1,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {dia?.nombre ?? '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ------------------------------------------------ Día seleccionado */}
        {diaActual ? (
          <Card>
            <CardHeader
              title={diaActual.nombre}
              subtitle={
                diaActual.esDescanso
                  ? 'Descanso programado'
                  : `${diaActual.ejercicios.length} ejercicio${diaActual.ejercicios.length !== 1 ? 's' : ''}`
              }
              action={
                !diaActual.esDescanso && activeRutina ? (
                  <Button
                    size="xs"
                    onPress={() => router.push(`/entrenamiento/${activeRutina.id}/${diaActual.id}`)}
                    leftIcon={<Ionicons name="play" size={14} color={t.colors.onPrimary} />}
                  >
                    Empezar
                  </Button>
                ) : undefined
              }
            />
            <CardContent>
              {diaActual.esDescanso || diaActual.ejercicios.length === 0 ? (
                <View style={styles.descanso}>
                  <Ionicons name="moon-outline" size={28} color={t.colors.textSubtle} />
                  <Text style={[t.typography.small, { color: t.colors.textMuted, textAlign: 'center' }]}>
                    {diaActual.esDescanso
                      ? 'Día de descanso. Buen momento para mobilidad o caminata.'
                      : 'Este día todavía no tiene ejercicios.'}
                  </Text>
                </View>
              ) : (
                diaActual.ejercicios.map((ej: any, idx: number) => {
                  const color = colorGrupo(ej.grupoMuscular);
                  const ultimo = idx === diaActual.ejercicios.length - 1;
                  return (
                    <View
                      key={ej.id}
                      style={[
                        styles.ejercicio,
                        { borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: t.colors.border },
                      ]}
                    >
                      {/* Barra de color del grupo muscular: identificacion visual rapida */}
                      <View style={[styles.ejercicioBar, { backgroundColor: color ?? t.colors.border }]} />

                      <View style={{ flex: 1, gap: 5 }}>
                        <Text style={[t.typography.bodyStrong, { color: t.colors.text }]} numberOfLines={2}>
                          {ej.nombre || 'Ejercicio'}
                        </Text>

                        {/* Prescripción en grande */}
                        <View style={styles.prescripcion}>
                          <View style={[styles.prescChip, { backgroundColor: t.colors.primarySoft }]}>
                            <Text style={[styles.prescChipValue, { color: t.colors.primaryDark }]}>
                              {ej.series}×{ej.repeticiones}
                            </Text>
                          </View>
                          <View style={[styles.prescChip, { backgroundColor: t.colors.surfaceAlt }]}>
                            <Text style={[styles.prescChipValue, { color: t.colors.textMuted }]}>
                              RPE {ej.rpeObjetivo}
                            </Text>
                          </View>
                          <View style={[styles.prescChip, { backgroundColor: t.colors.surfaceAlt }]}>
                            <Text style={[styles.prescChipValue, { color: t.colors.textMuted }]}>
                              {ej.descansoSeg}s
                            </Text>
                          </View>
                        </View>

                        <View style={styles.ejercicioMeta}>
                          {ej.grupoMuscular ? (
                            <Text style={[t.typography.caption, { color: t.colors.textMuted }]}>
                              {ej.grupoMuscular}
                            </Text>
                          ) : null}
                          {ej.progresion ? (
                            <Text style={[t.typography.caption, { color: t.colors.textSubtle }]}>
                              · {getProgresionLabel(ej.progresion)}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      {activeRutina && (
                        <Pressable
                          onPress={() => router.push(`/entrenamiento/${activeRutina.id}/${diaActual.id}`)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Registrar ${ej.nombre}`}
                          style={[styles.playBtn, { backgroundColor: t.colors.primarySoft }]}
                        >
                          <Ionicons name="play" size={18} color={t.colors.primaryDark} />
                        </Pressable>
                      )}
                    </View>
                  );
                })
              )}
            </CardContent>
          </Card>
        ) : null}

        {/* ------------------------------------------------ Todas las rutinas */}
        <Card>
          <CardHeader
            title="Historial de rutinas"
            subtitle={`${rutinas.length} rutina${rutinas.length !== 1 ? 's' : ''}`}
          />
          <CardContent>
            {rutinas.map((rutina, i) => {
              const ultimo = i === rutinas.length - 1;
              const dias = rutina.dias.filter((d: any) => !d.esDescanso).length;
              return (
                <Pressable
                  key={rutina.id}
                  onPress={() => router.push(`/rutinas/${rutina.id}`)}
                  style={({ pressed }) => [
                    styles.rutinaRow,
                    {
                      borderBottomWidth: ultimo ? 0 : 1,
                      borderBottomColor: t.colors.border,
                      opacity: pressed ? 0.6 : 1,
                    },
                  ]}
                >
                  <Avatar name={rutina.nombre} size={38} />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={[t.typography.bodyStrong, { color: t.colors.text }]} numberOfLines={1}>
                      {rutina.nombre}
                    </Text>
                    <View style={styles.ejercicioMeta}>
                      <Badge label={`Mesociclo ${rutina.mesociclo}`} tone="primary" />
                      <Badge label={`S${rutina.semanaInicio}–${rutina.semanaFin}`} tone="neutral" />
                      <Badge label={`${dias} días`} tone="neutral" />
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={t.colors.textSubtle} />
                </Pressable>
              );
            })}
          </CardContent>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexCenter: { flex: 1, justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 40, gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  weekRow: { flexDirection: 'row', gap: 8 },
  weekCard: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  descanso: { alignItems: 'center', gap: 10, paddingVertical: 16 },
  ejercicio: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  ejercicioBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  prescripcion: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  prescChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prescChipValue: { fontSize: 12, fontWeight: '700' },
  ejercicioMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rutinaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
});