/**
 * Crear/Editar Cliente Screen
 */

import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useClientesStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { clienteSchema, validateOrThrow, ClienteFormData } from '@/schemas/validation';
import { generateId } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';

type Params = { id?: string };

export default function ClienteFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { id } = useLocalSearchParams<Params>();
  const isEditing = !!id;
  const { addCliente, updateCliente, setLoading } = useClientesStore();
  const { addToast } = useUIStore();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting, isValid } } = useForm<ClienteFormData>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nombre: '',
      apellido: '',
      email: '',
      telefono: '',
      fechaNacimiento: '',
      sexo: 'M',
      altura: 170 },
    mode: 'onChange' });

  const watchedFechaNacimiento = watch('fechaNacimiento');

  useEffect(() => {
    if (isEditing && id) {
      loadCliente(id);
    }
  }, [id]);

  const loadCliente = async (clienteId: string) => {
    try {
      const db = getDatabase();
      const result = db.executeSync('SELECT * FROM clientes WHERE id = ?', [clienteId]);
      if (result.rows.length > 0) {
        const cliente = result.rows[0] as any;
        reset({
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          email: cliente.email || '',
          telefono: cliente.telefono || '',
          fechaNacimiento: cliente.fecha_nacimiento,
          sexo: cliente.sexo,
          altura: cliente.altura });
        setSelectedDate(cliente.fecha_nacimiento);
      }
    } catch (error) {
      console.error('Error loading cliente:', error);
      addToast('Error al cargar cliente', 'error');
    }
  };

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
        // Navigate to ficha inicial
        router.push(`/clientes/${newId}/ficha`);
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

  const handleDateChange = (event: any, date?: Date) => {
    if (date) {
      const formatted = date.toISOString().split('T')[0];
      setSelectedDate(formatted);
      setValue('fechaNacimiento', formatted);
    }
  };

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 14);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
          <Link href="#" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name={isDark ? 'chevron-back-sharp' : 'chevron-back-outline'} size={28} color="#0f172a" />
          </Link>
          <Text style={styles.headerTitle}>{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                style={{ marginTop: 16 }}
              />

              <Input
                label="Apellido"
                placeholder="Pérez"
                control={control}
                name="apellido"
                error={errors.apellido?.message}
                required
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

              <Input
                label="Teléfono"
                placeholder="+34 600 000 000"
                control={control}
                name="telefono"
                error={errors.telefono?.message}
                keyboardType="phone-pad"
                style={{ marginTop: 16 }}
              />

              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Controller
                    control={control}
                    name="sexo"
                    rules={ { required: 'Sexo requerido' } }
                    render={({ field }) => (
                      <View style={styles.selectWrapper}>
                        <Text style={styles.selectLabel}>Sexo</Text>
                        <View style={[
                          styles.select,
                          errors.sexo && styles.selectError,
                        ]}>
                          <Text style={styles.selectText}>{field.value === 'M' ? 'Masculino' : field.value === 'F' ? 'Femenino' : 'Otro'}</Text>
                        </View>
                      </View>
                    )}
                  />
                  {errors.sexo && <Text style={styles.errorText}>{errors.sexo.message}</Text>}
                </View>

                <View style={styles.halfWidth}>
                  <Controller
                    control={control}
                    name="fechaNacimiento"
                    rules={ { required: 'Fecha de nacimiento requerida' } }
                    render={({ field }) => (
                      <View style={styles.selectWrapper}>
                        <Text style={styles.selectLabel}>Fecha de Nacimiento</Text>
                        <TouchableOpacity
                          style={[
                            styles.select,
                            errors.fechaNacimiento && styles.selectError,
                          ]}
                          onPress={() => setShowDatePicker(true)}
                        >
                          <Text style={styles.selectText}>
                            {field.value ? formatDateForDisplay(field.value) : 'Seleccionar fecha'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {errors.fechaNacimiento && <Text style={styles.errorText}>{errors.fechaNacimiento.message}</Text>}
                </View>
              </View>

              <Input
                label="Altura (cm)"
                placeholder="175"
                control={control}
                name="altura"
                error={errors.altura?.message}
                keyboardType="numeric"
                required
                style={{ marginTop: 16 }}
                defaultValue="170"
              />
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

        {/* Date Picker Modal */}
        {showDatePicker && (
          <View style={styles.modalOverlay} onTouchStart={() => setShowDatePicker(false)}>
            <View style={styles.modalContent} onTouchStart={e => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Fecha de Nacimiento</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close-sharp" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>
              <View style={styles.datePicker}>
                <DatePicker
                  value={selectedDate ? new Date(selectedDate) : maxDate}
                  mode="date"
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  onValueChange={(e, date) => date && handleDateChange(date)}
                />
              </View>
              <Button variant="primary" onPress={() => setShowDatePicker(false)} fullWidth style={styles.modalButton}>
                Listo
              </Button>
            </View>
          </View>
        )}
    </View>
  );
}

// Need to import DatePicker
import DatePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

const formatDateForDisplay = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

const createStyles = (t: Theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
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
    paddingBottom: 100 },
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
    justifyContent: 'space-between',
    gap: 12 },
  halfWidth: { flex: 1 },
  selectWrapper: { gap: 6 },
  selectLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: t.colors.text
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: 10,
    minHeight: 48 },
  selectError: { borderColor: t.colors.danger },
  selectText: {
    fontSize: 16,
    color: t.colors.text
  },
  errorText: {
    fontSize: 12,
    color: t.colors.danger
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8 },
  cancelButton: { flex: 1 },
  saveButton: { flex: 1 },
  modalOverlay: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center' },
  modalContent: {
    backgroundColor: t.colors.surface,
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16 },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: t.colors.text
  },
  datePicker: { marginBottom: 16 },
  modalButton: { marginTop: 8 } });
