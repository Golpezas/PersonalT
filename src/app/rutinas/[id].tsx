/**
 * Rutina — Detalle.
 *
 * Muestra la semana completa de una rutina: cada día con su prescripción
 * (series × reps, RPE, descanso, tempo), notas y acceso directo al logger.
 */

import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useRutinasStore, useUIStore } from '@/stores';
import { Button, Card, CardHeader, CardContent, Badge, EmptyState, ScreenHeader } from '@/components/ui';
import { getGrupoMuscularLabel, getProgresionLabel } from '@/utils/helpers';
import { eliminarRutina, leerRutina } from '@/services/rutinas';
import { GRUPOS_MUSCULARES } from '@/constants';

type Params = { id: string };

const colorGrupo = (grupo?: string) =>
  GRUPOS_MUSCULARES.find((g) => g.id === grupo || g.label === grupo)?.color;

export default function RutinaDetalleScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<Params>();
  const deleteRutina = useRutinasStore((s) => s.deleteRutina);
  const addToast = useUIStore((s) => s.addToast);

  const rutina = useMemo(() => leerRutina(id), [id]);

  const resumen = useMemo(() => {
    if (!rutina) return { dias: 0, ejercicios: 0, series: 0 };
    const entrenos = rutina.dias.filter((d) => !d.esDescanso);
    return {
      dias: entrenos.length,
      ejercicios: entrenos.reduce((acc, d) => acc + d.ejercicios.length, 0),
      series: entrenos.reduce((acc, d) => acc + d.ejercicios.reduce((s, e) => s + (e.series || 0), 0), 0),
    };
  }, [rutina]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/rutinas'));

  const confirmarEliminar = () => {
    if (!rutina) return;
    Alert.alert(
      'Eliminar rutina',
      `Se eliminará "${rutina.nombre}" junto con los entrenamientos registrados con ella. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            try {
              eliminarRutina(rutina.id);
              deleteRutina(rutina.clienteId, rutina.id);
              addToast('Rutina eliminada', 'success');
              volver();
            } catch (error: any) {
              addToast(error.message || 'No se pudo eliminar la rutina', 'error');
            }
          },
        },
      ]
    );
  };

  if (!rutina) {
    return (
      <View style={[styles.flex, { backgroundColor: t.colors.bg, paddingTop: insets.top }]}>
        <ScreenHeader title="Rutina" onBack={volver} />
        <View style={styles.flexCenter}>
          <EmptyState
            icon="document-text-outline"
            title="Rutina no encontrada"
            subtitle="Puede que haya sido eliminada."
            action={<Button onPress={volver}>Volver</Button>}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: t.colors.bg, paddingTop: insets.top }]}>
      <ScreenHeader
        title={rutina.nombre}
        subtitle={`Mesociclo ${rutina.mesociclo} · Semanas ${rutina.semanaInicio}–${rutina.semanaFin}`}
        onBack={volver}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badges}>
          <Badge label={`${resumen.dias} días de entreno`} tone="primary" icon="calendar-outline" />
          <Badge label={`${resumen.ejercicios} ejercicios`} tone="neutral" icon="barbell-outline" />
          <Badge label={`${resumen.series} series/semana`} tone="neutral" icon="layers-outline" />
        </View>

        {rutina.notasGenerales ? (
          <Card>
            <CardHeader title="Notas generales" />
            <CardContent>
              <Text style={[t.typography.small, { color: t.colors.textMuted }]}>{rutina.notasGenerales}</Text>
            </CardContent>
          </Card>
        ) : null}

        {rutina.dias.map((dia) => {
          const entrenable = !dia.esDescanso && dia.ejercicios.length > 0;
          return (
            <Card key={dia.id}>
              <CardHeader
                title={dia.nombre}
                subtitle={
                  dia.esDescanso
                    ? 'Descanso'
                    : `${dia.ejercicios.length} ejercicio${dia.ejercicios.length !== 1 ? 's' : ''}`
                }
                action={
                  entrenable ? (
                    <Button
                      size="xs"
                      onPress={() => router.push(`/entrenamiento/${rutina.id}/${dia.id}`)}
                      leftIcon={<Ionicons name="play" size={14} color={t.colors.onPrimary} />}
                    >
                      Empezar
                    </Button>
                  ) : undefined
                }
              />
              {!dia.esDescanso && (
                <CardContent>
                  {dia.ejercicios.length === 0 ? (
                    <Text style={[t.typography.small, { color: t.colors.textMuted }]}>
                      Este día todavía no tiene ejercicios.
                    </Text>
                  ) : (
                    dia.ejercicios.map((ej, idx) => {
                      const ultimo = idx === dia.ejercicios.length - 1;
                      return (
                        <View
                          key={ej.id}
                          style={[
                            styles.ejercicio,
                            { borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: t.colors.border },
                          ]}
                        >
                          <View
                            style={[styles.ejercicioBar, { backgroundColor: colorGrupo(ej.grupoMuscular) ?? t.colors.border }]}
                          />
                          <View style={{ flex: 1, gap: 5 }}>
                            <Text style={[t.typography.bodyStrong, { color: t.colors.text }]} numberOfLines={2}>
                              {ej.nombre}
                            </Text>

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
                              {ej.tempo ? (
                                <View style={[styles.prescChip, { backgroundColor: t.colors.surfaceAlt }]}>
                                  <Text style={[styles.prescChipValue, { color: t.colors.textMuted }]}>
                                    Tempo {ej.tempo}
                                  </Text>
                                </View>
                              ) : null}
                            </View>

                            <View style={styles.ejercicioMeta}>
                              {ej.grupoMuscular ? (
                                <Text style={[t.typography.caption, { color: t.colors.textMuted }]}>
                                  {getGrupoMuscularLabel(ej.grupoMuscular)}
                                </Text>
                              ) : null}
                              {ej.progresion ? (
                                <Text style={[t.typography.caption, { color: t.colors.textSubtle }]}>
                                  · {getProgresionLabel(ej.progresion)}
                                </Text>
                              ) : null}
                            </View>

                            {ej.notas ? (
                              <Text style={[t.typography.caption, { color: t.colors.textMuted }]}>{ej.notas}</Text>
                            ) : null}
                          </View>
                        </View>
                      );
                    })
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}

        <Button
          variant="danger"
          onPress={confirmarEliminar}
          leftIcon={<Ionicons name="trash-outline" size={18} color={t.colors.onPrimary} />}
        >
          Eliminar rutina
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexCenter: { flex: 1, justifyContent: 'center' },
  scroll: { padding: 16, gap: 14 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ejercicio: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  ejercicioBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  prescripcion: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  prescChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  prescChipValue: { fontSize: 12, fontWeight: '700' },
  ejercicioMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
});
