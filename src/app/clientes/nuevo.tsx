/**
 * Crear/Editar Cliente Screen
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useClientesStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input, SegmentedControl } from '@/components/ui';
import { clienteSchema, validateOrThrow, ClienteFormData } from '@/schemas/validation';
import { generateId } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

type Params = { id?: string };

const EDAD_MIN = 14;
const EDAD_MAX = 100;

/** "04101982" | "04/10/1982" -> "04/10/1982" mientras se escribe. */
const enmascararFecha = (texto: string): string => {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** "DD/MM/AAAA" -> "AAAA-MM-DD", o null si la fecha no existe o está fuera de rango. */
const fechaTextoAIso = (texto: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const fecha = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (fecha.getFullYear() !== Number(yyyy) || fecha.getMonth() !== Number(mm) - 1 || fecha.getDate() !== Number(dd)) {
    return null;
  }
  const hoy = new Date();
  const min = new Date(hoy.getFullYear() - EDAD_MAX, hoy.getMonth(), hoy.getDate());
  const max = new Date(hoy.getFullYear() - EDAD_MIN, hoy.getMonth(), hoy.getDate());
  if (fecha < min || fecha > max) return null;
  return `${yyyy}-${mm}-${dd}`;
};

const isoAFechaTexto = (iso: string): string => {
  const [yyyy, mm, dd] = iso.split('-');
  return yyyy && mm && dd ? `${dd}/${mm}/${yyyy}` : '';
};

const VALORES_VACIOS: ClienteFormData = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  fechaNacimiento: '',
  sexo: 'M',
  altura: NaN };

/** Datos del cliente a editar (op-sqlite es sync), o el formulario vacío. */
function leerValoresIniciales(id?: string): ClienteFormData {
  if (!id) return VALORES_VACIOS;
  try {
    const cliente = getDatabase().executeSync('SELECT * FROM clientes WHERE id = ?', [id]).rows[0] as any;
    if (!cliente) return VALORES_VACIOS;
    return {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email || '',
      telefono: cliente.telefono || '',
      fechaNacimiento: cliente.fecha_nacimiento,
      sexo: cliente.sexo,
      altura: cliente.altura };
  } catch (error) {
    console.error('Error loading cliente:', error);
    return VALORES_VACIOS;
  }
}

export default function ClienteFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<Params>();
  const isEditing = !!id;
  const { addCliente, updateCliente, setLoading } = useClientesStore();
  const { addToast } = useUIStore();
  const [valoresIniciales] = useState(() => leerValoresIniciales(id));
  const [fechaTexto, setFechaTexto] = useState(() => isoAFechaTexto(valoresIniciales.fechaNacimiento));

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isValid } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: valoresIniciales,
    mode: 'onChange' });

  const onSubmit = async (data: ClienteFormData) => {
    setLoading(true);
    try {
      const validatedData = validateOrThrow(clienteSchema, data);
      const now = new Date().toISOString();

      if (isEditing && id) {
        const db = getDatabase();
        runTransaction((tx) => {
          tx.executeSync(
            `UPDATE clientes SET nombre=?, apellido=?, email=?, telefono=?, fecha_nacimiento=?, sexo=?, altura=?, actualizado_en=? WHERE id=?`,
            [validatedData.nombre, validatedData.apellido, validatedData.email || null, validatedData.telefono || null, validatedData.fechaNacimiento, validatedData.sexo, validatedData.altura, now, id]
          );
        });
        updateCliente(id, { ...validatedData, actualizadoEn: now });
        addToast('Cliente actualizado', 'success');
      } else {
        const newId = generateId();
        const newCliente = { ...validatedData, id: newId, creadoEn: now, actualizadoEn: now };
        const db = getDatabase();
        runTransaction((tx) => {
          tx.executeSync(
            `INSERT INTO clientes (id, nombre, apellido, email, telefono, fecha_nacimiento, sexo, altura, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newId, validatedData.nombre, validatedData.apellido, validatedData.email || null, validatedData.telefono || null, validatedData.fechaNacimiento, validatedData.sexo, validatedData.altura, now, now]
          );
        });
        addCliente(newCliente);
        addToast('Cliente creado', 'success');
        // replace: al guardar la ficha, "atrás" no debe volver al alta del cliente
        router.replace(`/clientes/${newId}/ficha/nueva`);
        return;
      }
      router.back();
    } catch (error: any) {
      console.error('Error saving cliente:', error);
      addToast(error.message || 'Error al guardar', 'error');
    } finally {
      setLoading(false);
    }
  };

  const onFechaChange = (texto: string) => {
    const enmascarado = enmascararFecha(texto);
    setFechaTexto(enmascarado);
    setValue('fechaNacimiento', fechaTextoAIso(enmascarado) ?? '', { shouldValidate: true });
  };

  const fechaCompleta = fechaTexto.length === 10;
  const fechaError =
    fechaCompleta && !fechaTextoAIso(fechaTexto)
      ? `Fecha inválida (edad entre ${EDAD_MIN} y ${EDAD_MAX} años)`
      : undefined;

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={26} color={t.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Card style={styles.sectionCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Datos Personales</Text>

            <Input
              label="Nombre"
              placeholder="Juan"
              control={control}
              name="nombre"
              error={errors.nombre?.message}
              required
              autoCapitalize="words"
              style={{ marginTop: 16 }}
            />

            <Input
              label="Apellido"
              placeholder="Pérez"
              control={control}
              name="apellido"
              error={errors.apellido?.message}
              required
              autoCapitalize="words"
              style={{ marginTop: 16 }}
            />

            <Input
              label="Email"
              placeholder="juan@ejemplo.com"
              control={control}
              name="email"
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ marginTop: 16 }}
            />

            <View style={styles.row}>
              <View style={styles.sexoCol}>
                <Text style={styles.selectLabel}>Sexo</Text>
                <Controller
                  control={control}
                  name="sexo"
                  render={({ field }) => (
                    <SegmentedControl
                      options={[
                        { key: 'M', label: 'M' },
                        { key: 'F', label: 'F' },
                      ]}
                      value={field.value === 'F' ? 'F' : 'M'}
                      onChange={field.onChange}
                      style={styles.sexoSelector}
                    />
                  )}
                />
              </View>

              <View style={styles.fechaCol}>
                <Input
                  label="Fecha de nacimiento"
                  placeholder="DD/MM/AAAA"
                  value={fechaTexto}
                  onChange={onFechaChange}
                  keyboardType="number-pad"
                  maxLength={10}
                  required
                  error={fechaError}
                />
              </View>
            </View>

            <View style={{ marginTop: 16 }}>
              <Controller
                control={control}
                name="altura"
                render={({ field }) => (
                  <Input
                    label="Altura (cm)"
                    placeholder="175"
                    value={field.value ? String(field.value) : ''}
                    onChange={(v) => {
                      const digitos = v.replace(/\D/g, '');
                      // undefined haría que react-hook-form vuelva al defaultValue
                      field.onChange(digitos ? Number(digitos) : NaN);
                    }}
                    onBlur={field.onBlur}
                    keyboardType="number-pad"
                    maxLength={3}
                    required
                    error={errors.altura?.message}
                  />
                )}
              />
            </View>
          </CardContent>
        </Card>

        <View style={styles.buttonRow}>
          <Button variant="outline" onPress={() => router.back()} style={styles.cancelButton}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting || !isValid}
            loading={isSubmitting}
            style={styles.saveButton}
          >
            {isEditing ? 'Guardar Cambios' : 'Crear Cliente'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
    backgroundColor: t.colors.surface },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
    color: t.colors.text
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40 },
  sectionCard: {
    borderWidth: 1,
    borderColor: t.colors.border },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16 },
  sexoCol: { width: 110, gap: 6 },
  fechaCol: { flex: 1 },
  selectLabel: {
    ...t.typography.smallStrong,
    color: t.colors.textMuted },
  sexoSelector: { minHeight: 48, alignItems: 'center' },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8 },
  cancelButton: { flex: 1 },
  saveButton: { flex: 1 } });
