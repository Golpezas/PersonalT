/**
 * Crear/Editar Rutina
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useClientesStore, useRutinasStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input, Modal } from '@/components/ui';
import { rutinaSemanalSchema, validateOrThrow } from '@/schemas/validation';
import { generateId } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import { useGuardFicha } from '@/hooks/useGuardFicha';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

export default function RutinaFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { selectedClienteId } = useClientesStore();
  const { setRutinaActual, rutinaActual, clearRutinaActual, addDiaToRutinaActual, removeDiaFromRutinaActual, ejercicios, setEjercicios } = useRutinasStore();
  const { addToast } = useUIStore();
  const { tieneFicha } = useGuardFicha(selectedClienteId);

  const [nombre, setNombre] = useState('');
  const [mesociclo, setMesociclo] = useState('1');
  const [semanaInicio, setSemanaInicio] = useState('1');
  const [semanaFin, setSemanaFin] = useState('4');
  const [notasGenerales, setNotasGenerales] = useState('');
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [selectedDiaId, setSelectedDiaId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');

  const loadEjercicios = useCallback(async () => {
    try {
      const db = getDatabase();
      const result = db.executeSync('SELECT * FROM ejercicios ORDER BY grupo_muscular, nombre');
      const loaded = result.rows.map((row: any) => ({
        id: row.id, nombre: row.nombre, grupoMuscular: row.grupo_muscular, patron: row.patron,
        equipo: JSON.parse(row.equipo || '[]'), descripcion: row.descripcion, esCompuesto: row.es_compuesto === 1,
        creadoEn: row.creado_en }));
      setEjercicios(loaded);
    } catch (e) { console.error(e); }
  }, [setEjercicios]);

  useEffect(() => {
    // Load ejercicios from DB if not loaded
    if (ejercicios.length === 0) {
      loadEjercicios();
    }
  }, []);

  const dias = [
    { id: 'd1', orden: 1, nombre: 'Lunes', esDescanso: false, ejercicios: [] as any[] },
    { id: 'd2', orden: 2, nombre: 'Martes', esDescanso: false, ejercicios: [] as any[] },
    { id: 'd3', orden: 3, nombre: 'Miércoles', esDescanso: true, ejercicios: [] as any[] },
    { id: 'd4', orden: 4, nombre: 'Jueves', esDescanso: false, ejercicios: [] as any[] },
    { id: 'd5', orden: 5, nombre: 'Viernes', esDescanso: false, ejercicios: [] as any[] },
    { id: 'd6', orden: 6, nombre: 'Sábado', esDescanso: true, ejercicios: [] as any[] },
    { id: 'd7', orden: 7, nombre: 'Domingo', esDescanso: true, ejercicios: [] as any[] },
  ];

  const [diasLocal, setDiasLocal] = useState(dias);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);

  const addEjercicioToDia = (diaIndex: number, ejercicio: any) => {
    const newDias = [...diasLocal];
    newDias[diaIndex].ejercicios.push({
      id: generateId(),
      ejercicioId: ejercicio.id,
      orden: newDias[diaIndex].ejercicios.length + 1,
      series: 3,
      repeticiones: '8-12',
      rpeObjetivo: 8,
      tempo: '3-0-1-0',
      descansoSeg: 90,
      notas: '',
      progresion: { tipo: 'lineal', incrementoPeso: 2.5, frecuenciaSemanas: 1 },
      _nombre: ejercicio.nombre,
      _grupo: ejercicio.grupoMuscular });
    setDiasLocal(newDias);
  };

  const removeEjercicioFromDia = (diaIndex: number, ejIndex: number) => {
    const newDias = [...diasLocal];
    newDias[diaIndex].ejercicios.splice(ejIndex, 1);
    newDias[diaIndex].ejercicios = newDias[diaIndex].ejercicios.map((e, i) => ({ ...e, orden: i + 1 }));
    setDiasLocal(newDias);
  };

  const updateEjercicioEnDia = (diaIndex: number, ejIndex: number, field: string, value: any) => {
    const newDias = [...diasLocal];
    (newDias[diaIndex].ejercicios[ejIndex] as any)[field] = value;
    setDiasLocal(newDias);
  };

  const onSubmit = async () => {
    if (!selectedClienteId) {
      Alert.alert('Error', 'Debes tener un cliente seleccionado');
      return;
    }
    if (!tieneFicha) {
      Alert.alert('Falta la ficha inicial', 'Crea la ficha inicial del cliente antes de diseñar la rutina.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Crear ficha', onPress: () => router.replace(`/clientes/${selectedClienteId}/ficha/nueva`) },
      ]);
      return;
    }
    setSubmitting(true);
    try {
      const rutinaId = generateId();
      const now = new Date().toISOString();
      const diasSerializados = diasLocal.map(d => ({
        id: d.id,
        orden: d.orden,
        nombre: d.nombre,
        esDescanso: d.esDescanso,
        ejercicios: d.ejercicios.map((e: any) => ({
          id: e.id, ejercicioId: e.ejercicioId, orden: e.orden, series: e.series,
          repeticiones: e.repeticiones, rpeObjetivo: e.rpeObjetivo, tempo: e.tempo,
          descansoSeg: e.descansoSeg, notas: e.notas, progresion: e.progresion })) }));

      const data = {
        clienteId: selectedClienteId,
        nombre,
        mesociclo: parseInt(mesociclo),
        semanaInicio: parseInt(semanaInicio),
        semanaFin: parseInt(semanaFin),
        dias: diasSerializados,
        notasGenerales };

      validateOrThrow(rutinaSemanalSchema, data);

      const db = getDatabase();
      runTransaction(() => {
        db.executeSync(
          `INSERT INTO rutinas_semanales (id, cliente_id, nombre, mesociclo, semana_inicio, semana_fin, dias, notas_generales, creado_en, actualizado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rutinaId, selectedClienteId, nombre, parseInt(mesociclo), parseInt(semanaInicio), parseInt(semanaFin), JSON.stringify(diasSerializados), notasGenerales, now, now]
        );
      });

      addToast('Rutina creada', 'success');
      router.replace('/(tabs)/rutinas');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al guardar rutina');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEjercicios = ejercicios.filter(e =>
    e.nombre.toLowerCase().includes(exerciseSearch.toLowerCase()) ||
    e.grupoMuscular.toLowerCase().includes(exerciseSearch.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.formTitle}>Nueva Rutina</Text>

        {/* Datos básicos */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Datos</Text>
            <Input label="Nombre de la rutina" placeholder="Push/Pull/Legs" value={nombre} onChangeText={setNombre} style={{ marginTop: 8 }} />
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Input label="Mesociclo #" placeholder="1" keyboardType="numeric" value={mesociclo} onChangeText={setMesociclo} style={{ marginTop: 8 }} />
              </View>
              <View style={styles.halfWidth}>
                <Input label="Semanas" placeholder="1-4" value={`${semanaInicio}-${semanaFin}`} onChangeText={v => {
                  const parts = v.split('-');
                  if (parts.length === 2) { setSemanaInicio(parts[0]); setSemanaFin(parts[1]); }
                }} style={{ marginTop: 8 }} />
              </View>
            </View>
            <Input label="Notas generales (opcional)" placeholder="Indicaciones generales..." value={notasGenerales} onChangeText={setNotasGenerales} multiline numberOfLines={2} style={{ marginTop: 8 }} />
          </CardContent>
        </Card>

        {/* Editor de días */}
        {diasLocal.map((dia, idx) => (
          <Card key={dia.id} style={styles.formCard}>
            <TouchableOpacity onPress={() => setDiaExpandido(diaExpandido === dia.id ? null : dia.id)}>
              <View style={styles.diaHeader}>
                <View style={styles.diaHeaderLeft}>
                  <View style={[styles.diaOrden, dia.esDescanso && styles.diaOrdenDescanso]}>
                    <Text style={styles.diaOrdenText}>{dia.orden}</Text>
                  </View>
                  <View>
                    <Text style={styles.diaNombre}>{dia.nombre}</Text>
                    <Text style={styles.diaSubtitle}>{dia.esDescanso ? 'Descanso' : `${dia.ejercicios.length} ejercicios`}</Text>
                  </View>
                </View>
                <View style={styles.diaActions}>
                  {!dia.esDescanso && (
                    <TouchableOpacity onPress={() => {
                      const newDias = [...diasLocal];
                      newDias[idx].esDescanso = !newDias[idx].esDescanso;
                      setDiasLocal(newDias);
                    }} style={styles.diaActionBtn}>
                      <Ionicons name="moon-outline" size={18} color="#64748b" />
                    </TouchableOpacity>
                  )}
                  {dia.esDescanso && (
                    <TouchableOpacity onPress={() => {
                      const newDias = [...diasLocal];
                      newDias[idx].esDescanso = false;
                      setDiasLocal(newDias);
                    }} style={styles.diaActionBtn}>
                      <Ionicons name="barbell-outline" size={18} color="#0ea5e9" />
                    </TouchableOpacity>
                  )}
                  <Ionicons name={diaExpandido === dia.id ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" />
                </View>
              </View>
            </TouchableOpacity>

            {diaExpandido === dia.id && !dia.esDescanso && (
              <View style={styles.diaBody}>
                {dia.ejercicios.map((ej: any, ejIdx: number) => (
                  <View key={ej.id} style={styles.ejercicioItem}>
                    <Text style={styles.ejercicioNombre}>{ej._nombre}</Text>
                    <View style={styles.ejercicioConfig}>
                      <View style={styles.configRow}>
                        <Input value={ej.series.toString()} onChangeText={v => updateEjercicioEnDia(idx, ejIdx, 'series', parseInt(v) || 3)} style={styles.configInput} keyboardType="numeric" />
                        <Text style={styles.configX}>×</Text>
                        <Input value={ej.repeticiones} onChangeText={v => updateEjercicioEnDia(idx, ejIdx, 'repeticiones', v)} style={styles.configInput} />
                        <Text style={styles.configLabel}>reps</Text>
                      </View>
                      <View style={styles.configRow}>
                        <Input value={ej.rpeObjetivo.toString()} onChangeText={v => updateEjercicioEnDia(idx, ejIdx, 'rpeObjetivo', parseInt(v) || 8)} style={styles.configInput} keyboardType="numeric" />
                        <Text style={styles.configLabel}>RPE</Text>
                        <Input value={ej.descansoSeg.toString()} onChangeText={v => updateEjercicioEnDia(idx, ejIdx, 'descansoSeg', parseInt(v) || 90)} style={styles.configInput} keyboardType="numeric" />
                        <Text style={styles.configLabel}>s</Text>
                      </View>
                      <TouchableOpacity onPress={() => removeEjercicioFromDia(idx, ejIdx)} style={styles.removeBtn}>
                        <Ionicons name="trash-outline" size={18} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => {
                    setSelectedDiaId(dia.id);
                    setShowEjercicioModal(true);
                  }}
                  leftIcon={<Ionicons name="add" size={16} color="#0ea5e9" />}
                  style={styles.addEjercicioBtn}
                >
                  Añadir Ejercicio
                </Button>
              </View>
            )}

            {diaExpandido === dia.id && dia.esDescanso && (
              <View style={styles.diaBody}>
                <Text style={styles.descansoText}>🛌 Día de descanso y recuperación</Text>
              </View>
            )}
          </Card>
        ))}

        <Button
          variant="primary"
          onPress={onSubmit}
          loading={submitting}
          disabled={!nombre.trim()}
          style={styles.submitButton}
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
        >
          Guardar Rutina
        </Button>
      </ScrollView>

      {/* Modal selector de ejercicio */}
      <Modal visible={showEjercicioModal} onClose={() => setShowEjercicioModal(false)} title="Seleccionar Ejercicio" size="lg">
        <View style={{ padding: 16, gap: 12 }}>
          <Input placeholder="Buscar..." value={exerciseSearch} onChangeText={setExerciseSearch} leftIcon={<Ionicons name="search" size={18} color="#94a3b8" />} />
          <FlatList
            data={filteredEjercicios.slice(0, 20)}
            keyExtractor={item => item.id}
            style={{ maxHeight: 400 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.ejercicioModalItem}
                onPress={() => {
                  const diaIndex = diasLocal.findIndex(d => d.id === selectedDiaId);
                  if (diaIndex >= 0) addEjercicioToDia(diaIndex, item);
                  setShowEjercicioModal(false);
                  setExerciseSearch('');
                }}
              >
                <Text style={styles.ejercicioModalNombre}>{item.nombre}</Text>
                <Text style={styles.ejercicioModalGrupo}>{item.grupoMuscular}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  formTitle: { fontSize: 24, fontWeight: '700', color: t.colors.text},
  formCard: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  diaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  diaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  diaOrden: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  diaOrdenDescanso: { backgroundColor: t.colors.warning },
  diaOrdenText: { fontSize: 14, fontWeight: '700', color: t.colors.textInverse},
  diaNombre: { fontSize: 16, fontWeight: '600', color: t.colors.text},
  diaSubtitle: { fontSize: 12, color: t.colors.textSubtle},
  diaActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diaActionBtn: { padding: 6 },
  diaBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  ejercicioItem: { backgroundColor: t.colors.bg, borderRadius: 10, padding: 12, gap: 8 },
  ejercicioNombre: { fontSize: 14, fontWeight: '600', color: t.colors.text},
  ejercicioConfig: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  configRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  configInput: { width: 50, textAlign: 'center', fontSize: 14, paddingVertical: 6 },
  configX: { fontSize: 14, color: t.colors.textSubtle, fontWeight: '600' },
  configLabel: { fontSize: 12, color: t.colors.textSubtle},
  removeBtn: { marginLeft: 'auto', padding: 6 },
  addEjercicioBtn: { marginTop: 4 },
  descansoText: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center', padding: 16},
  submitButton: { marginTop: 8 },
  ejercicioModalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.colors.border, flexDirection: 'row', justifyContent: 'space-between' },
  ejercicioModalNombre: { fontSize: 15, color: t.colors.text, flex: 1 },
  ejercicioModalGrupo: { fontSize: 12, color: t.colors.textSubtle} });