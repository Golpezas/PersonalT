/**
 * Check-in Semanal - Nueva
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStore } from 'zustand';
import { useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input, Modal } from '@/components/ui';
import { checkinSemanalSchema, validateOrThrow } from '@/schemas/validation';
import { generateId, createEmptyPerimetros, createEmptyFotos, formatDate, getPerimetroLabel, checkAsymmetry, getWeekNumber } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import * as ImagePicker from 'expo-image-picker';
import DatePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

type Params = { id: string };

export default function CheckinFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<Params>();
  const { addToast } = useUIStore();
  const { addCheckin, getLatestCheckin, getFicha } = useProgresoStore();

  const latestCheckin = getLatestCheckin(id);
  const ficha = getFicha(id);
  const nextSemana = latestCheckin ? latestCheckin.semana + 1 : 1;

  const [peso, setPeso] = useState(latestCheckin?.peso ?? ficha?.peso ?? 70);
  const [grasaCorporal, setGrasaCorporal] = useState(latestCheckin?.grasaCorporal?.toString() ?? ficha?.grasaCorporal?.toString() ?? '');
  const [musculatura, setMusculatura] = useState(latestCheckin?.musculatura?.toString() ?? ficha?.musculatura?.toString() ?? '');
  const [perimetros, setPerimetros] = useState(latestCheckin?.perimetros ?? createEmptyPerimetros());
  const [energia, setEnergia] = useState<1|2|3|4|5>(latestCheckin?.energia ?? 3);
  const [sueno, setSueno] = useState<1|2|3|4|5>(latestCheckin?.sueno ?? 3);
  const [estres, setEstres] = useState<1|2|3|4|5>(latestCheckin?.estres ?? 3);
  const [adherencia, setAdherencia] = useState<1|2|3|4|5>(latestCheckin?.adherencia ?? 3);
  const [notas, setNotas] = useState(latestCheckin?.notas ?? '');
  const [fotos, setFotos] = useState(latestCheckin?.fotos ?? ficha?.fotos ?? createEmptyFotos());
  const [verComparacion, setVerComparacion] = useState<keyof typeof fotos | null>(null);
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fotosAnteriores = latestCheckin?.fotos ?? ficha?.fotos ?? createEmptyFotos();
  const tieneFotosPrevias = Object.values(fotosAnteriores).some(Boolean);

  const pickFoto = async (tipo: keyof typeof fotos) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setFotos({ ...fotos, [tipo]: result.assets[0].uri });
      setVerComparacion(null);
    }
  };

  const tomarFoto = async (tipo: keyof typeof fotos) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setFotos({ ...fotos, [tipo]: result.assets[0].uri });
      setVerComparacion(null);
    }
  };

  const updatePerimetro = (key: keyof typeof perimetros, value: string) => {
    const num = parseFloat(value) || 0;
    setPerimetros({ ...perimetros, [key]: num });
  };

  const ratingButton = (value: number, selected: number, label: string, icon: string, onSelect: (v: any) => void) => (
    <TouchableOpacity
      style={[styles.ratingButton, selected === value && styles.ratingButtonActive]}
      onPress={() => onSelect(value)}
    >
      <Ionicons name={icon as any} size={20} color={selected === value ? '#fff' : '#94a3b8'} />
      <Text style={[styles.ratingLabel, selected === value && styles.ratingLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      const data = {
        clienteId: id,
        semana: nextSemana,
        fecha,
        peso,
        grasaCorporal: grasaCorporal ? parseFloat(grasaCorporal) : undefined,
        musculatura: musculatura ? parseFloat(musculatura) : undefined,
        perimetros,
        fotos,
        energia,
        sueno,
        estres,
        adherencia,
        notas };

      validateOrThrow(checkinSemanalSchema, data);

      const now = new Date().toISOString();
      const checkinId = generateId();
      const db = getDatabase();

      runTransaction(() => {
        db.executeSync(
          `INSERT INTO checkins_semanales (id, cliente_id, semana, fecha, peso, grasa_corporal, musculatura, perimetros, fotos, energia, sueno, estres, adherencia, notas, creado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [checkinId, id, nextSemana, fecha, peso, data.grasaCorporal ?? null, data.musculatura ?? null,
           JSON.stringify(perimetros), JSON.stringify(data.fotos), energia, sueno, estres, adherencia, notas, now]
        );
      });

      addCheckin(id, {
        id: checkinId,
        clienteId: id,
        semana: nextSemana,
        fecha,
        peso,
        grasaCorporal: data.grasaCorporal,
        musculatura: data.musculatura,
        perimetros,
        fotos: data.fotos,
        energia,
        sueno,
        estres,
        adherencia,
        notas,
        creadoEn: now });

      addToast('Check-in guardado', 'success');
      router.replace(`/clientes/${id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al guardar check-in');
    } finally {
      setSubmitting(false);
    }
  };

  const allPerimetrosValid = Object.values(perimetros).every(v => v > 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.formTitle}>Check-in Semana {nextSemana}</Text>
        <Text style={styles.formSubtitle}>Registra el progreso semanal del cliente</Text>

        {/* Fecha */}
        <Card style={styles.formCard}>
          <CardContent>
            <TouchableOpacity style={styles.dateRow} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={20} color="#64748b" />
              <Text style={styles.dateText}>{formatDate(fecha)}</Text>
              <Ionicons name="chevron-down" size={18} color="#94a3b8" />
            </TouchableOpacity>
          </CardContent>
        </Card>

        {/* Peso y composición */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Antropometría</Text>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.fieldLabel}>Peso (kg)</Text>
                <Input placeholder="0" keyboardType="decimal-pad" value={peso.toString()} onChangeText={v => setPeso(parseFloat(v) || 0)} style={styles.fieldInput} />
              </View>
              <View style={styles.halfWidth}>
                <Text style={styles.fieldLabel}>Grasa %</Text>
                <Input placeholder="0" keyboardType="decimal-pad" value={grasaCorporal} onChangeText={setGrasaCorporal} style={styles.fieldInput} />
              </View>
            </View>
            <View style={styles.row}>
              <View style={styles.halfWidth}>
                <Text style={styles.fieldLabel}>Músculo kg</Text>
                <Input placeholder="0" keyboardType="decimal-pad" value={musculatura} onChangeText={setMusculatura} style={styles.fieldInput} />
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Perímetros */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Perímetros (cm)</Text>
            {Object.entries(perimetros).map(([key, value]) => (
              <View key={key} style={styles.perimetroRow}>
                <Text style={styles.perimetroLabel}>{getPerimetroLabel(key as any)}</Text>
                <View style={styles.perimetroInputWrapper}>
                  <Input placeholder="0" keyboardType="decimal-pad" value={value > 0 ? value.toString() : ''} onChangeText={v => updatePerimetro(key as any, v)} style={styles.perimetroInput} />
                  <Text style={styles.perimetroUnit}>cm</Text>
                </View>
              </View>
            ))}
            {!allPerimetrosValid && <Text style={styles.warningText}>⚠️ Completa todos los perímetros</Text>}
          </CardContent>
        </Card>

        {/* Ratings subjetivos */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Bienestar Subjetivo</Text>
            <Text style={styles.ratingSectionLabel}>Energía</Text>
            <View style={styles.ratingRow}>
              {ratingButton(1, energia, 'Muy baja', 'battery-dead', setEnergia)}
              {ratingButton(2, energia, 'Baja', 'battery-quarter', setEnergia)}
              {ratingButton(3, energia, 'Normal', 'battery-half', setEnergia)}
              {ratingButton(4, energia, 'Alta', 'battery-three-quarters', setEnergia)}
              {ratingButton(5, energia, 'Muy alta', 'battery-full', setEnergia)}
            </View>

            <Text style={styles.ratingSectionLabel}>Sueño</Text>
            <View style={styles.ratingRow}>
              {ratingButton(1, sueno, 'Muy mal', 'moon', setSueno)}
              {ratingButton(2, sueno, 'Mal', 'cloudy-night', setSueno)}
              {ratingButton(3, sueno, 'Normal', 'moon-outline', setSueno)}
              {ratingButton(4, sueno, 'Bueno', 'sunny-outline', setSueno)}
              {ratingButton(5, sueno, 'Muy bueno', 'sunny', setSueno)}
            </View>

            <Text style={styles.ratingSectionLabel}>Estrés</Text>
            <View style={styles.ratingRow}>
              {ratingButton(1, estres, 'Muy bajo', 'leaf', setEstres)}
              {ratingButton(2, estres, 'Bajo', 'partly-sunny', setEstres)}
              {ratingButton(3, estres, 'Normal', 'cloudy', setEstres)}
              {ratingButton(4, estres, 'Alto', 'rainy', setEstres)}
              {ratingButton(5, estres, 'Muy alto', 'thunderstorm', setEstres)}
            </View>

            <Text style={styles.ratingSectionLabel}>Adherencia</Text>
            <View style={styles.ratingRow}>
              {ratingButton(1, adherencia, 'Muy baja', 'close-circle', setAdherencia)}
              {ratingButton(2, adherencia, 'Baja', 'remove-circle', setAdherencia)}
              {ratingButton(3, adherencia, 'Media', 'help-circle', setAdherencia)}
              {ratingButton(4, adherencia, 'Alta', 'checkmark-circle', setAdherencia)}
              {ratingButton(5, adherencia, 'Muy alta', 'trophy', setAdherencia)}
            </View>
          </CardContent>
        </Card>

        {/* Fotos con comparación */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Fotos de Progreso</Text>
            <Text style={styles.formSubtitle}>Toca para elegir entre cámara o galería</Text>

            <View style={styles.fotoGrid}>
              {(['frontal', 'lateral', 'posterior'] as const).map((tipo) => {
                const actual = fotos[tipo];
                const anterior = fotosAnteriores[tipo];
                const comparando = verComparacion === tipo && !!anterior;
                return (
                  <View key={tipo} style={styles.fotoSlot}>
                    <View style={styles.fotoHeaderRow}>
                      <Text style={styles.fotoLabel}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</Text>
                      {anterior && (
                        <TouchableOpacity
                          onPress={() => setVerComparacion(comparando ? null : tipo)}
                          style={[styles.compararBtn, comparando && styles.compararBtnActive]}
                        >
                          <Ionicons name="layers-outline" size={13} color={comparando ? '#fff' : '#0ea5e9'} />
                          <Text style={[styles.compararText, comparando && styles.compararTextActive]}>
                            Comparar
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <View style={styles.fotoBox}>
                      {actual ? (
                        <Image source={{ uri: actual }} style={styles.fotoImage} />
                      ) : (
                        <View style={styles.fotoVacio}>
                          <Ionicons name="image-outline" size={28} color="#cbd5e1" />
                          <Text style={styles.fotoVacioText}>Sin foto</Text>
                        </View>
                      )}

                      {comparando && (
                        <View style={styles.compararOverlay}>
                          <Image source={{ uri: anterior }} style={styles.fotoImage} />
                          <View style={styles.compararBadge}>
                            <Text style={styles.compararBadgeText}>
                              {latestCheckin ? `Sem ${latestCheckin.semana}` : 'Inicial'}
                            </Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.fotoActions}>
                        <TouchableOpacity style={styles.fotoActionBtn} onPress={() => tomarFoto(tipo)}>
                          <Ionicons name="camera-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.fotoActionBtn} onPress={() => pickFoto(tipo)}>
                          <Ionicons name="images-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        {actual && (
                          <TouchableOpacity
                            style={[styles.fotoActionBtn, styles.fotoActionDelete]}
                            onPress={() => setFotos({ ...fotos, [tipo]: '' })}
                          >
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            <Text style={styles.tipText}>
              📏 Misma distancia, misma luz y misma hora que la foto anterior para poder comparar.
            </Text>
          </CardContent>
        </Card>

        {/* Notas */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Notas</Text>
            <Input placeholder="Observaciones del cliente, cambios, etc." multiline numberOfLines={4} value={notas} onChangeText={setNotas} style={styles.notesInput} />
          </CardContent>
        </Card>

        <Button
          variant="primary"
          onPress={onSubmit}
          loading={submitting}
          disabled={!allPerimetrosValid}
          style={styles.submitButton}
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
        >
          Guardar Check-in
        </Button>
      </ScrollView>

      {showDatePicker && (
        <DatePicker
          value={new Date(fecha)}
          mode="date"
          onValueChange={(e, date) => { setShowDatePicker(false); if (date) setFecha(date.toISOString().split('T')[0]); }}
        />
      )}
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  formTitle: { fontSize: 24, fontWeight: '700', color: t.colors.text},
  formSubtitle: { fontSize: 14, color: t.colors.textMuted, marginTop: 4 },
  formCard: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  halfWidth: { flex: 1 },
  fieldLabel: { fontSize: 13, color: t.colors.textMuted, marginBottom: 4 },
  fieldInput: { fontSize: 18, fontWeight: '600'},
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 4 },
  dateText: { flex: 1, fontSize: 16, fontWeight: '500', color: t.colors.text},
  perimetroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  perimetroLabel: { fontSize: 14, color: t.colors.text, flex: 1 },
  perimetroInputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perimetroInput: { width: 70, textAlign: 'right' },
  perimetroUnit: { fontSize: 13, color: t.colors.textSubtle},
  warningText: { fontSize: 13, color: t.colors.warning, marginTop: 8},
  ratingSectionLabel: { fontSize: 13, color: t.colors.textMuted, marginTop: 12, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  ratingButton: { flex: 1, minWidth: 60, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 10, backgroundColor: t.colors.surfaceAlt },
  ratingButtonActive: { backgroundColor: t.colors.primary },
  ratingLabel: { fontSize: 10, fontWeight: '500', color: t.colors.textMuted, marginTop: 4, textAlign: 'center' },
  ratingLabelActive: { color: t.colors.textInverse },
  fotoGrid: { gap: 16 },
  fotoSlot: { gap: 6 },
  fotoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fotoLabel: { fontSize: 14, fontWeight: '600', color: t.colors.text},
  compararBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: t.colors.primarySoft },
  compararBtnActive: { backgroundColor: t.colors.primary },
  compararText: { fontSize: 11, fontWeight: '600', color: t.colors.primary},
  compararTextActive: { color: t.colors.textInverse },
  fotoBox: { height: 180, borderRadius: 12, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fotoVacio: { alignItems: 'center', gap: 6 },
  fotoVacioText: { fontSize: 12, color: t.colors.textSubtle},
  fotoImage: { width: '100%', height: '100%' },
  compararOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
  compararBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  compararBadgeText: { fontSize: 11, fontWeight: '600', color: t.colors.textInverse},
  fotoActions: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 6 },
  fotoActionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.75)', alignItems: 'center', justifyContent: 'center' },
  fotoActionDelete: { backgroundColor: 'rgba(239,68,68,0.85)' },
  tipText: { fontSize: 12, color: t.colors.textMuted, marginTop: 12, lineHeight: 16 },
  notesInput: { minHeight: 80 },
  submitButton: { marginTop: 8 } });