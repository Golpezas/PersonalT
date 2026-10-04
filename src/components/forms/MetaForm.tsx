/**
 * MetaForm — crear / editar una meta de un cliente.
 * Se reutiliza desde las rutas `meta/nueva` y `meta/[metaId]`.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DatePicker from '@react-native-community/datetimepicker';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { useUIStore } from '@/stores';
import { useMetas } from '@/hooks/useMetas';
import {
  guardarMeta,
  leerMeta,
  nuevaMeta,
  eliminarMeta,
  labelTipoMeta,
  unidadPorTipo,
  type ContextoProgreso } from '@/services/metas';
import { formatDate } from '@/utils/helpers';
import type { Meta } from '@/types';
import type { EstadoMeta, TipoMeta } from '@/db/schema';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';

const TIPOS: TipoMeta[] = ['peso', 'grasa', 'musculo', 'fuerza', 'perimetro', 'habito'];
const ESTADOS: { key: EstadoMeta; label: string }[] = [
  { key: 'activa', label: 'Activa' },
  { key: 'lograda', label: 'Lograda' },
  { key: 'pausada', label: 'Pausada' },
  { key: 'cancelada', label: 'Cancelada' },
];
const UNIDADES: Meta['unidad'][] = ['kg', '%', 'cm', 'reps', 'dias'];

const ICONO_TIPO: Record<TipoMeta, string> = {
  peso: 'scale-outline',
  grasa: 'water-outline',
  musculo: 'fitness-outline',
  fuerza: 'barbell-outline',
  perimetro: 'resize-outline',
  habito: 'checkmark-done-outline' };

export function MetaForm({ clienteId, metaId }: { clienteId: string; metaId?: string }) {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { addToast } = useUIStore();
  const { ctx, reload, sincronizarStore } = useMetas(clienteId);

  // Datos precargados (síncronos desde SQLite) — lazy initializer.
  const inicial = useMemo<Meta>(() => {
    const existente = metaId ? leerMeta(metaId) : null;
    return existente ?? nuevaMeta(clienteId);
  }, [clienteId, metaId]);

  const editando = !!metaId;

  const [tipo, setTipo] = useState<TipoMeta>(inicial.tipo);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [valorInicial, setValorInicial] = useState(
    inicial.valorInicial > 0 ? String(inicial.valorInicial) : ''
  );
  const [valorObjetivo, setValorObjetivo] = useState(
    inicial.valorObjetivo > 0 ? String(inicial.valorObjetivo) : ''
  );
  const [unidad, setUnidad] = useState<Meta['unidad']>(inicial.unidad);
  const [fechaInicio, setFechaInicio] = useState(inicial.fechaInicio);
  const [fechaObjetivo, setFechaObjetivo] = useState(inicial.fechaObjetivo);
  const [estado, setEstado] = useState<EstadoMeta>(inicial.estado);
  const [picker, setPicker] = useState<'inicio' | 'objetivo' | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Valor actual observado, para mostrarlo mientras se edita. */
  const valorActualSugerido = useMemo(() => valorInicialDe(ctx, tipo), [ctx, tipo]);

  const cambiarTipo = (t: TipoMeta) => {
    setTipo(t);
    setUnidad(unidadPorTipo(t));
    if (!descripcion) setDescripcion(labelTipoMeta(t));
  };

  const validar = (): boolean => {
    const e: Record<string, string> = {};
    if (descripcion.trim().length < 5) e.descripcion = 'Mínimo 5 caracteres';
    const vi = Number(valorInicial);
    const vo = Number(valorObjetivo);
    if (valorInicial === '' || Number.isNaN(vi)) e.valorInicial = 'Valor inicial obligatorio';
    if (valorObjetivo === '' || Number.isNaN(vo)) e.valorObjetivo = 'Objetivo obligatorio';
    else if (vo <= 0) e.valorObjetivo = 'El objetivo debe ser mayor que 0';
    if (typeof vi === 'number' && typeof vo === 'number' && !Number.isNaN(vi) && !Number.isNaN(vo) && vi === vo) {
      e.valorObjetivo = 'El objetivo debe diferir del valor inicial';
    }
    if (fechaObjetivo < fechaInicio) e.fechaObjetivo = 'La fecha objetivo debe ser posterior al inicio';
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const guardar = () => {
    if (!validar()) {
      addToast('Revisa los campos marcados', 'error');
      return;
    }
    setSaving(true);
    try {
      const meta: Meta = {
        ...inicial,
        tipo,
        descripcion: descripcion.trim(),
        valorInicial: Number(valorInicial),
        valorObjetivo: Number(valorObjetivo),
        unidad,
        fechaInicio,
        fechaObjetivo,
        estado };
      guardarMeta(meta);
      reload();
      sincronizarStore();
      addToast(editando ? 'Meta actualizada' : 'Meta creada', 'success');
      router.back();
    } catch (error: any) {
      console.error(error);
      addToast(error?.message ?? 'No se pudo guardar la meta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = () => {
    if (!metaId) return;
    Alert.alert(
      'Eliminar meta',
      `¿Seguro que quieres eliminar "${descripcion || 'esta meta'}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            try {
              eliminarMeta(metaId);
              reload();
              sincronizarStore();
              addToast('Meta eliminada', 'success');
              router.back();
            } catch (error: any) {
              console.error(error);
              addToast(error?.message ?? 'No se pudo eliminar la meta', 'error');
            }
          } },
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{editando ? 'Editar meta' : 'Nueva meta'}</Text>
      <Text style={styles.subtitle}>
        Define un objetivo medible. El avance se calcula contra la última medición registrada.
      </Text>

      {/* Tipo */}
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Tipo de objetivo</Text>
          <View style={styles.tipoGrid}>
            {TIPOS.map((t) => {
              const activo = tipo === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => cambiarTipo(t)}
                  style={[styles.tipoChip, activo && styles.tipoChipActive]}
                >
                  <Ionicons
                    name={ICONO_TIPO[t] as any}
                    size={16}
                    color={activo ? '#fff' : '#64748b'}
                  />
                  <Text style={[styles.tipoChipText, activo && styles.tipoChipTextActive]}>
                    {labelTipoMeta(t)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </CardContent>
      </Card>

      {/* Descripción */}
      <Card style={styles.card}>
        <CardContent>
          <Input
            label="Descripción"
            required
            value={descripcion}
            onChange={(v: string) => setDescripcion(v)}
            placeholder="Ej. Bajar a 78 kg conservando músculo"
            error={errores.descripcion}
            helperText="Para metas de perímetro, menciona el perímetro (cintura, pecho, brazo…)"
          />
        </CardContent>
      </Card>

      {/* Valores */}
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Valores</Text>
          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Input
                label="Valor inicial"
                required
                keyboardType="decimal-pad"
                value={valorInicial}
                onChange={(v: string) => setValorInicial(v)}
                error={errores.valorInicial}
                placeholder={valorActualSugerido != null ? String(valorActualSugerido) : '0'}
                rightIcon={
                  valorInicial === '' && valorActualSugerido != null ? (
                    <TouchableOpacity
                      onPress={() => setValorInicial(String(valorActualSugerido))}
                      style={styles.usarActual}
                    >
                      <Text style={styles.usarActualText}>Usar {valorActualSugerido}</Text>
                    </TouchableOpacity>
                  ) : undefined
                }
              />
            </View>
            <View style={styles.rowItem}>
              <Input
                label="Objetivo"
                required
                keyboardType="decimal-pad"
                value={valorObjetivo}
                onChange={(v: string) => setValorObjetivo(v)}
                error={errores.valorObjetivo}
                placeholder="78"
              />
            </View>
          </View>

          <Text style={styles.subLabel}>Unidad</Text>
          <View style={styles.unidadRow}>
            {UNIDADES.map((u) => {
              const activo = unidad === u;
              return (
                <TouchableOpacity
                  key={u}
                  onPress={() => setUnidad(u)}
                  style={[styles.unidadChip, activo && styles.unidadChipActive]}
                >
                  <Text style={[styles.unidadChipText, activo && styles.unidadChipTextActive]}>
                    {u === '%' ? '%' : u === 'dias' ? 'días' : u}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card style={styles.card}>
        <CardContent>
          <Text style={styles.sectionTitle}>Plazos</Text>
          <Text style={styles.subLabel}>Fecha de inicio</Text>
          <TouchableOpacity style={styles.dateRow} onPress={() => setPicker('inicio')}>
            <Ionicons name="calendar-outline" size={18} color="#64748b" />
            <Text style={styles.dateText}>{formatDate(fechaInicio)}</Text>
            <Ionicons name="chevron-down" size={16} color="#94a3b8" />
          </TouchableOpacity>

          <Text style={[styles.subLabel, { marginTop: 14 }]}>Fecha objetivo</Text>
          <TouchableOpacity style={styles.dateRow} onPress={() => setPicker('objetivo')}>
            <Ionicons name="flag-outline" size={18} color="#64748b" />
            <Text style={styles.dateText}>{formatDate(fechaObjetivo)}</Text>
            <Ionicons name="chevron-down" size={16} color="#94a3b8" />
          </TouchableOpacity>
          {errores.fechaObjetivo && <Text style={styles.error}>{errores.fechaObjetivo}</Text>}
        </CardContent>
      </Card>

      {/* Estado */}
      {editando && (
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.sectionTitle}>Estado</Text>
            <View style={styles.unidadRow}>
              {ESTADOS.map((s) => {
                const activo = estado === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setEstado(s.key)}
                    style={[styles.unidadChip, activo && styles.estadoChipActive]}
                  >
                    <Text style={[styles.unidadChipText, activo && styles.unidadChipTextActive]}>
                      {s.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CardContent>
        </Card>
      )}

      <Button
        onPress={guardar}
        loading={saving}
        size="lg"
        fullWidth
        leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color="#fff" />}
      >
        {editando ? 'Guardar cambios' : 'Crear meta'}
      </Button>

      {editando && (
        <Button
          variant="danger"
          onPress={eliminar}
          fullWidth
          leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}
        >
          Eliminar meta
        </Button>
      )}

      {picker && (
        <DatePicker
          value={new Date(picker === 'inicio' ? fechaInicio : fechaObjetivo)}
          mode="date"
          onValueChange={(_e, date) => {
            const iso = date ? date.toISOString().slice(0, 10) : null;
            setPicker(null);
            if (!iso) return;
            if (picker === 'inicio') setFechaInicio(iso);
            else setFechaObjetivo(iso);
          }}
        />
      )}
    </ScrollView>
  );
}

/** Valor inicial sugerido según el tipo (última medición conocida). */
function valorInicialDe(ctx: ContextoProgreso, tipo: TipoMeta): number | null {
  const v =
    tipo === 'peso'
      ? ctx.peso
      : tipo === 'grasa'
        ? ctx.grasaCorporal
        : tipo === 'musculo'
          ? ctx.musculatura
          : tipo === 'fuerza'
            ? ctx.fuerza
            : tipo === 'perimetro'
              ? (ctx.perimetros?.cintura ?? null)
              : null;
  return typeof v === 'number' && v > 0 ? Math.round(v * 10) / 10 : null;
}

const createStyles = (t: Theme) => StyleSheet.create({
  scroll: { padding: 16, gap: 16, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '700', color: t.colors.text},
  subtitle: { fontSize: 14, color: t.colors.textMuted, marginTop: -8 },
  card: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 12 },
  subLabel: { fontSize: 13, fontWeight: '500', color: t.colors.text, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border },
  tipoChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  tipoChipText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted},
  tipoChipTextActive: { color: t.colors.textInverse },
  unidadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unidadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: t.colors.surfaceAlt },
  unidadChipActive: { backgroundColor: t.colors.primary },
  estadoChipActive: { backgroundColor: t.colors.accent },
  unidadChipText: { fontSize: 13, fontWeight: '600', color: t.colors.textMuted},
  unidadChipTextActive: { color: t.colors.textInverse },
  dateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: t.colors.surface, borderWidth: 1, borderColor: t.colors.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  dateText: { flex: 1, fontSize: 15, color: t.colors.text},
  error: { fontSize: 12, color: t.colors.danger, marginTop: 6 },
  usarActual: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(14,165,233,0.12)' },
  usarActualText: { fontSize: 11, fontWeight: '600', color: t.colors.primary} });