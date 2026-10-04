/**
 * Ficha Inicial - Nueva/Editar
 * Multi-step form: Antropometría → Perímetros → Fotos → Notas
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input, Modal } from '@/components/ui';
import { fichaInicialSchema, validateOrThrow } from '@/schemas/validation';
import * as ImagePicker from 'expo-image-picker';
import { generateId, createEmptyPerimetros, createEmptyFotos, formatDate, getPerimetroLabel, checkAsymmetry } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

type Params = { id: string };

const STEPS = [
  { key: 'antropometria', title: 'Antropometría', icon: 'body-outline' },
  { key: 'perimetros', title: 'Perímetros', icon: 'resize-outline' },
  { key: 'fotos', title: 'Fotos', icon: 'images-outline' },
  { key: 'notas', title: 'Notas', icon: 'document-text-outline' },
];

export default function FichaFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<Params>();
  const { addToast } = useUIStore();
  const { setFicha: setFichaStore } = useProgresoStore();
  const [currentStep, setCurrentStep] = useState(0);
  const [perimetros, setPerimetros] = useState(createEmptyPerimetros());
  const [fotos, setFotos] = useState(createEmptyFotos());

  const pickFoto = async (tipo: keyof typeof fotos) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      setFotos({ ...fotos, [tipo]: result.assets[0].uri });
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
    }
  };
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors } } = useForm({
    resolver: zodResolver(fichaInicialSchema),
    defaultValues: {
      clienteId: id,
      fecha: new Date().toISOString().split('T')[0],
      peso: 70,
      grasaCorporal: undefined,
      musculatura: undefined,
      perimetros: createEmptyPerimetros(),
      fotos: createEmptyFotos(),
      observaciones: '',
      lesionLimitaciones: '' } });

  const updatePerimetro = (key: keyof typeof perimetros, value: string) => {
    const num = parseFloat(value) || 0;
    const newPerimetros = { ...perimetros, [key]: num };
    setPerimetros(newPerimetros);
    setValue('perimetros', newPerimetros);
  };

  const checkAsymmetries = () => {
    const asymmetries = checkAsymmetry(perimetros, 2);
    if (asymmetries.length > 0) {
      Alert.alert(
        'Alerta de Asimetría',
        asymmetries.map(a => `${a.pair}: diferencia de ${a.diff.toFixed(1)} cm`).join('\n') + '\n\n¿Deseas continuar?',
        [{ text: 'Sí, continuar', onPress: () => {} }]
      );
    }
  };

  const onSubmit = async (data: any) => {
    setSubmitting(true);
    try {
      const validated = validateOrThrow(fichaInicialSchema, {
        ...data,
        perimetros,
        fotos,
        clienteId: id });

      const now = new Date().toISOString();
      const fichaId = generateId();
      const db = getDatabase();

      runTransaction((tx) => {
        tx.executeSync(
          `INSERT INTO fichas_iniciales (id, cliente_id, fecha, peso, grasa_corporal, musculatura, perimetros, pliegues, fotos, observaciones, lesion_limitaciones, creado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fichaId, id, validated.fecha, validated.peso,
            validated.grasaCorporal ?? null, validated.musculatura ?? null,
            JSON.stringify(perimetros), null, JSON.stringify(fotos),
            validated.observaciones, validated.lesionLimitaciones, now,
          ]
        );
      });

      // Update store
      setFichaStore(id, {
        id: fichaId,
        clienteId: id,
        fecha: validated.fecha,
        peso: validated.peso,
        grasaCorporal: validated.grasaCorporal,
        musculatura: validated.musculatura,
        perimetros,
        fotos,
        observaciones: validated.observaciones,
        lesionLimitaciones: validated.lesionLimitaciones,
        creadoEn: now });

      addToast('Ficha inicial guardada', 'success');
      router.replace(`/clientes/${id}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Error al guardar ficha');
    } finally {
      setSubmitting(false);
    }
  };

  const allPerimetrosValid = Object.values(perimetros).every(v => v > 0);

  return (
    <View style={styles.container}>
      {/* Step Indicator */}
      <View style={styles.stepBar}>
        {STEPS.map((step, i) => (
          <TouchableOpacity
            key={step.key}
            style={[
              styles.stepItem,
              i <= currentStep && styles.stepItemActive,
              i === currentStep && styles.stepItemCurrent,
            ]}
            onPress={() => i < currentStep && setCurrentStep(i)}
          >
            <View style={[
              styles.stepCircle,
              i < currentStep && styles.stepCircleDone,
              i === currentStep && styles.stepCircleCurrent,
            ]}>
              <Ionicons
                name={(i < currentStep ? 'checkmark' : step.icon) as any}
                size={16}
                color={i <= currentStep ? '#fff' : '#94a3b8'}
              />
            </View>
            <Text style={[
              styles.stepLabel,
              i <= currentStep && styles.stepLabelActive,
            ]}>{step.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Step 1: Antropometría */}
        {currentStep === 0 && (
          <Card style={styles.formCard}>
            <CardContent>
              <Text style={styles.formTitle}>Antropometría</Text>
              <Text style={styles.formSubtitle}>Medidas básicas del cliente</Text>

              <Input label="Peso (kg)" placeholder="70.5" control={control} name="peso" error={errors.peso?.message} keyboardType="decimal-pad" style={{ marginTop: 16 }} />
              <Input label="Grasa Corporal (%)" placeholder="15.0" control={control} name="grasaCorporal" error={errors.grasaCorporal?.message} keyboardType="decimal-pad" style={{ marginTop: 16 }} />
              <Input label="Masa Muscular (kg)" placeholder="30.0" control={control} name="musculatura" error={errors.musculatura?.message} keyboardType="decimal-pad" style={{ marginTop: 16 }} />

              <View style={styles.tipBox}>
                <Ionicons name="information-circle-outline" size={20} color="#0ea5e9" />
                <Text style={styles.tipText}>Asegúrate de medir en las mismas condiciones siempre: misma hora, en ayunas, post-baño.</Text>
              </View>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Perímetros */}
        {currentStep === 1 && (
          <Card style={styles.formCard}>
            <CardContent>
              <Text style={styles.formTitle}>Perímetros (cm)</Text>
              <Text style={styles.formSubtitle}>Medidas en cm</Text>

              {Object.entries(perimetros).map(([key, value]) => (
                <View key={key} style={styles.perimetroRow}>
                  <Text style={styles.perimetroLabel}>{getPerimetroLabel(key as any)}</Text>
                  <View style={styles.perimetroInputWrapper}>
                    <Input
                      placeholder="0"
                      value={value > 0 ? value.toString() : ''}
                      onChangeText={(v) => updatePerimetro(key as any, v)}
                      keyboardType="decimal-pad"
                      style={styles.perimetroInput}
                    />
                    <Text style={styles.perimetroUnit}>cm</Text>
                  </View>
                </View>
              ))}

              {!allPerimetrosValid && (
                <Text style={styles.warningText}>⚠️ Completa todos los perímetros</Text>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Fotos */}
        {currentStep === 2 && (
          <Card style={styles.formCard}>
            <CardContent>
              <Text style={styles.formTitle}>Fotos de Progreso</Text>
              <Text style={styles.formSubtitle}>Toma 3, fotos: frontal, lateral y posterior</Text>

              {(['frontal', 'lateral', 'posterior'] as const).map((tipo) => (
                <View key={tipo} style={styles.fotoSlot}>
                  <Text style={styles.fotoLabel}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</Text>
                  <View style={[styles.fotoButton, fotos[tipo] ? styles.fotoButtonCaptured : undefined]}>
                    {fotos[tipo] ? (
                      <Image source={{ uri: fotos[tipo] }} style={styles.fotoImage} />
                    ) : (
                      <View style={styles.fotoVacio}>
                        <Ionicons name="image-outline" size={32} color="#cbd5e1" />
                        <Text style={styles.fotoPlaceholder}>Sin foto</Text>
                      </View>
                    )}
                    <View style={styles.fotoActions}>
                      <TouchableOpacity style={styles.fotoActionBtn} onPress={() => tomarFoto(tipo)}>
                        <Ionicons name="camera-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.fotoActionBtn} onPress={() => pickFoto(tipo)}>
                        <Ionicons name="images-outline" size={18} color="#fff" />
                      </TouchableOpacity>
                      {fotos[tipo] && (
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
              ))}

              <Text style={styles.tipText}>📏 Asegúrate de que la iluminación sea consistente y el fondo neutro.</Text>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Notas */}
        {currentStep === 3 && (
          <Card style={styles.formCard}>
            <CardContent>
              <Text style={styles.formTitle}>Notas y Observaciones</Text>
              <Text style={styles.formSubtitle}>Información adicional</Text>

              <Input
                label="Observaciones generales"
                placeholder="Historia de entrenamiento, objetivos, etc."
                control={control}
                name="observaciones"
                multiline
                numberOfLines={4}
                style={{ marginTop: 16 }}
              />
              <Input
                label="Lesiones / Limitaciones"
                placeholder="Restricciones médicas, lesiones pasadas o actuales..."
                control={control}
                name="lesionLimitaciones"
                multiline
                numberOfLines={4}
                style={{ marginTop: 16 }}
              />
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonRow}>
          {currentStep > 0 && (
            <Button variant="outline" onPress={() => setCurrentStep(currentStep - 1)} style={styles.navButton}>
              ← Anterior
            </Button>
          )}
          {currentStep < STEPS.length - 1 ? (
            <Button
              variant="primary"
              onPress={() => {
                if (currentStep === 1) checkAsymmetries();
                setCurrentStep(currentStep + 1);
              }}
              style={styles.navButton}
              disabled={currentStep === 1 && !allPerimetrosValid}
            >
              Siguiente →
            </Button>
          ) : (
            <Button
              variant="primary"
              onPress={handleSubmit(onSubmit)}
              loading={submitting}
              style={styles.navButton}
              leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
            >
              Guardar Ficha
            </Button>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  stepBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: t.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border },
  stepItem: { alignItems: 'center', gap: 4, flex: 1 },
  stepItemActive: {},
  stepItemCurrent: {},
  stepCircle: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: t.colors.border },
  stepCircleDone: { backgroundColor: t.colors.success },
  stepCircleCurrent: { backgroundColor: t.colors.primary },
  stepLabel: { fontSize: 10, fontWeight: '500', color: t.colors.textSubtle, textAlign: 'center' },
  stepLabelActive: { color: t.colors.primary },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  formCard: { borderWidth: 1, borderColor: t.colors.border },
  formTitle: { fontSize: 20, fontWeight: '700', color: t.colors.text, marginBottom: 4 },
  formSubtitle: { fontSize: 14, color: t.colors.textMuted, marginBottom: 16 },
  tipBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: 'rgba(14, 165, 233, 0.08)', borderRadius: 10, padding: 12, marginTop: 16 },
  tipText: { flex: 1, fontSize: 13, color: t.colors.text, lineHeight: 20},
  perimetroRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  perimetroLabel: { fontSize: 14, color: t.colors.text, flex: 1 },
  perimetroInputWrapper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perimetroInput: { width: 80, textAlign: 'right' },
  perimetroUnit: { fontSize: 14, color: t.colors.textSubtle},
  warningText: { fontSize: 13, color: t.colors.warning, marginTop: 16},
  fotoSlot: { marginBottom: 20 },
  fotoLabel: { fontSize: 14, fontWeight: '500', color: t.colors.text, marginBottom: 8 },
  fotoButton: {
    width: '100%', height: 160, borderRadius: 12,
    borderWidth: 2, borderColor: t.colors.border, borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: t.colors.bg },
  fotoPlaceholder: { fontSize: 13, color: t.colors.textSubtle},
  fotoButtonCaptured: { borderColor: t.colors.success, borderStyle: 'solid', backgroundColor: t.colors.successSoft },
  fotoVacio: { alignItems: 'center', gap: 6 },
  fotoImage: { width: '100%', height: '100%', borderRadius: 10 },
  fotoActions: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 6 },
  fotoActionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.75)', alignItems: 'center', justifyContent: 'center' },
  fotoActionDelete: { backgroundColor: 'rgba(239,68,68,0.85)' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  navButton: { flex: 1 } });