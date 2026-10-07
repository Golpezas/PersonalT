/**
 * MetaForm — crear / editar una meta de un cliente.
 * Se reutiliza desde las rutas `meta/nueva` y `meta/[metaId]`.
 */

import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, KeyboardAvoidingView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { useProgresoStore, useUIStore } from '@/stores';
import { useMetas } from '@/hooks/useMetas';
import {
  guardarMeta,
  leerMeta,
  leerMetas,
  nuevaMeta,
  eliminarMeta,
  labelTipoMeta,
  unidadPorTipo,
  type ContextoProgreso } from '@/services/metas';
import { metaSchema } from '@/schemas/validation';
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

/** Campo del schema -> clave de error que se muestra en el formulario. */
const CAMPO_ERROR: Record<string, string> = {
  descripcion: 'descripcion',
  valorInicial: 'valorInicial',
  valorObjetivo: 'valorObjetivo',
  fechaInicio: 'fechaInicio',
  fechaObjetivo: 'fechaObjetivo' };

/** "70,5" | "70.5" -> 70.5; vacío o inválido -> undefined. */
const parseDecimal = (texto: string): number | undefined => {
  const n = parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Deja solo dígitos y un separador decimal mientras se escribe. */
const limpiarDecimal = (texto: string): string => texto.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');

/** "04102026" | "04/10/2026" -> "04/10/2026" mientras se escribe. */
const enmascararFecha = (texto: string): string => {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
};

/** "DD/MM/AAAA" -> "AAAA-MM-DD", o null si la fecha no existe. */
const fechaTextoAIso = (texto: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const fecha = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (fecha.getFullYear() !== Number(yyyy) || fecha.getMonth() !== Number(mm) - 1 || fecha.getDate() !== Number(dd)) {
    return null;
  }
  if (Number(yyyy) < 1990 || Number(yyyy) > 2100) return null;
  return `${yyyy}-${mm}-${dd}`;
};

const isoAFechaTexto = (iso: string): string => {
  const [yyyy, mm, dd] = (iso ?? '').slice(0, 10).split('-');
  return yyyy && mm && dd ? `${dd}/${mm}/${yyyy}` : '';
};

const formatearValor = (n: number): string => String(n).replace('.', ',');

export function MetaForm({ clienteId, metaId }: { clienteId: string; metaId?: string }) {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { addToast } = useUIStore();
  const setMetasStore = useProgresoStore((s) => s.setMetas);
  const { ctx } = useMetas(clienteId || null);

  const editando = !!metaId;

  // Datos precargados (síncronos desde SQLite).
  const existente = useMemo(() => (metaId ? leerMeta(metaId) : null), [metaId]);
  const inicial = useMemo<Meta>(() => existente ?? nuevaMeta(clienteId), [existente, clienteId]);

  const [tipo, setTipo] = useState<TipoMeta>(inicial.tipo);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [valorInicial, setValorInicial] = useState(
    existente ? formatearValor(inicial.valorInicial) : ''
  );
  const [valorObjetivo, setValorObjetivo] = useState(
    inicial.valorObjetivo > 0 ? formatearValor(inicial.valorObjetivo) : ''
  );
  const [unidad, setUnidad] = useState<Meta['unidad']>(inicial.unidad);
  const [fechaInicioTexto, setFechaInicioTexto] = useState(isoAFechaTexto(inicial.fechaInicio));
  const [fechaObjetivoTexto, setFechaObjetivoTexto] = useState(isoAFechaTexto(inicial.fechaObjetivo));
  const [estado, setEstado] = useState<EstadoMeta>(inicial.estado);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  /** Valor actual observado, para mostrarlo mientras se edita. */
  const valorActualSugerido = useMemo(() => valorInicialDe(ctx, tipo), [ctx, tipo]);

  const volver = () => (router.canGoBack() ? router.back() : router.replace(`/clientes/${clienteId}`));

  const sincronizarStore = () => {
    if (clienteId) setMetasStore(clienteId, leerMetas(clienteId));
  };

  const cambiarTipo = (nuevo: TipoMeta) => {
    setTipo(nuevo);
    setUnidad(unidadPorTipo(nuevo));
    if (!descripcion.trim()) setDescripcion(labelTipoMeta(nuevo));
  };

  const guardar = () => {
    const vi = parseDecimal(valorInicial);
    const vo = parseDecimal(valorObjetivo);
    const fechaInicio = fechaTextoAIso(fechaInicioTexto);
    const fechaObjetivo = fechaTextoAIso(fechaObjetivoTexto);

    const e: Record<string, string> = {};
    if (vi === undefined) e.valorInicial = 'Valor inicial obligatorio';
    if (vo === undefined) e.valorObjetivo = 'Objetivo obligatorio';
    else if (vi !== undefined && vi === vo) e.valorObjetivo = 'El objetivo debe diferir del valor inicial';
    if (!fechaInicio) e.fechaInicio = 'Fecha inválida (DD/MM/AAAA)';
    if (!fechaObjetivo) e.fechaObjetivo = 'Fecha inválida (DD/MM/AAAA)';

    const meta: Meta = {
      ...inicial,
      clienteId,
      tipo,
      descripcion: descripcion.trim(),
      valorInicial: vi ?? 0,
      valorObjetivo: vo ?? 0,
      unidad,
      fechaInicio: fechaInicio ?? '',
      fechaObjetivo: fechaObjetivo ?? '',
      estado: editando ? estado : 'activa' };

    // creadoEn queda fuera: filas antiguas pueden no tener formato ISO con offset.
    const { creadoEn: _creadoEn, ...aValidar } = meta;
    const resultado = metaSchema.safeParse(aValidar);
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        const clave = CAMPO_ERROR[String(issue.path[0])];
        if (clave && !e[clave]) e[clave] = issue.message;
      }
    }

    setErrores(e);
    if (Object.keys(e).length > 0 || !resultado.success) {
      const mensajes = Object.values(e);
      if (!resultado.success && mensajes.length === 0) {
        mensajes.push(...resultado.error.issues.map((i) => i.message));
      }
      Alert.alert('Revisá la meta', mensajes.map((m) => `• ${m}`).join('\n'));
      return;
    }

    setSaving(true);
    try {
      guardarMeta(meta);
      sincronizarStore();
      addToast(editando ? 'Meta actualizada' : 'Meta creada', 'success');
      volver();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error?.message ?? 'No se pudo guardar la meta');
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
              sincronizarStore();
              addToast('Meta eliminada', 'success');
              volver();
            } catch (error: any) {
              console.error(error);
              addToast(error?.message ?? 'No se pudo eliminar la meta', 'error');
            }
          } },
      ]
    );
  };

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={volver} style={styles.backBtn} hitSlop={12} accessibilityLabel="Volver">
        <Ionicons name="chevron-back" size={24} color={t.colors.text} />
      </TouchableOpacity>
      <Text style={styles.title}>{editando ? 'Editar meta' : 'Nueva meta'}</Text>
    </View>
  );

  if (!clienteId || (editando && !existente)) {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={t.colors.textSubtle} />
          <Text style={styles.subtitle}>
            {clienteId ? 'La meta no existe o fue eliminada.' : 'No se encontró el cliente.'}
          </Text>
          <Button variant="outline" onPress={volver} style={{ marginTop: 16 }}>
            Volver
          </Button>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {header}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 100 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.subtitle}>
          Define un objetivo medible. El avance se calcula contra la última medición registrada.
        </Text>

        {/* Tipo */}
        <Card style={styles.card}>
          <CardContent>
            <Text style={styles.sectionTitle}>Tipo de objetivo</Text>
            <View style={styles.tipoGrid}>
              {TIPOS.map((tp) => {
                const activo = tipo === tp;
                return (
                  <TouchableOpacity
                    key={tp}
                    onPress={() => cambiarTipo(tp)}
                    style={[styles.tipoChip, activo && styles.tipoChipActive]}
                  >
                    <Ionicons
                      name={ICONO_TIPO[tp] as any}
                      size={16}
                      color={activo ? t.colors.onPrimary : t.colors.textMuted}
                    />
                    <Text style={[styles.tipoChipText, activo && styles.tipoChipTextActive]}>
                      {labelTipoMeta(tp)}
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
              onChange={setDescripcion}
              maxLength={200}
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
                  onChange={(v) => setValorInicial(limpiarDecimal(v))}
                  error={errores.valorInicial}
                  placeholder={valorActualSugerido != null ? formatearValor(valorActualSugerido) : '0'}
                  rightIcon={
                    valorInicial === '' && valorActualSugerido != null ? (
                      <TouchableOpacity
                        onPress={() => setValorInicial(formatearValor(valorActualSugerido))}
                        style={styles.usarActual}
                      >
                        <Text style={styles.usarActualText}>Usar {formatearValor(valorActualSugerido)}</Text>
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
                  onChange={(v) => setValorObjetivo(limpiarDecimal(v))}
                  error={errores.valorObjetivo}
                  placeholder="78"
                />
              </View>
            </View>

            <Text style={[styles.subLabel, { marginTop: 14 }]}>Unidad</Text>
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
                      {u === 'dias' ? 'días' : u}
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
            <View style={styles.campos}>
              <Input
                label="Fecha de inicio"
                required
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
                value={fechaInicioTexto}
                onChange={(v) => setFechaInicioTexto(enmascararFecha(v))}
                error={errores.fechaInicio}
                leftIcon={<Ionicons name="calendar-outline" size={18} color={t.colors.textMuted} />}
              />
              <Input
                label="Fecha objetivo"
                required
                placeholder="DD/MM/AAAA"
                keyboardType="number-pad"
                maxLength={10}
                value={fechaObjetivoTexto}
                onChange={(v) => setFechaObjetivoTexto(enmascararFecha(v))}
                error={errores.fechaObjetivo}
                leftIcon={<Ionicons name="flag-outline" size={18} color={t.colors.textMuted} />}
              />
            </View>
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
                      <Text style={[styles.unidadChipText, activo && styles.estadoChipTextActive]}>
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
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color={t.colors.onPrimary} />}
        >
          {editando ? 'Guardar cambios' : 'Crear meta'}
        </Button>

        {editando && (
          <Button
            variant="danger"
            onPress={eliminar}
            fullWidth
            leftIcon={<Ionicons name="trash-outline" size={18} color="#FFFFFF" />}
          >
            Eliminar meta
          </Button>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  container: { flex: 1, backgroundColor: t.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: t.colors.chrome, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  backBtn: { padding: 4 },
  scroll: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '700', color: t.colors.text },
  subtitle: { fontSize: 14, color: t.colors.textMuted, textAlign: 'left' },
  card: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 12 },
  subLabel: { fontSize: 13, fontWeight: '500', color: t.colors.text, marginBottom: 6 },
  campos: { gap: 14 },
  row: { flexDirection: 'row', gap: 12 },
  rowItem: { flex: 1 },
  tipoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    backgroundColor: t.colors.surfaceAlt, borderWidth: 1, borderColor: t.colors.border },
  tipoChipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  tipoChipText: { fontSize: 12, fontWeight: '600', color: t.colors.textMuted },
  tipoChipTextActive: { color: t.colors.onPrimary },
  unidadRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  unidadChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: t.colors.surfaceAlt },
  unidadChipActive: { backgroundColor: t.colors.primary },
  estadoChipActive: { backgroundColor: t.colors.accent },
  unidadChipText: { fontSize: 13, fontWeight: '600', color: t.colors.textMuted },
  unidadChipTextActive: { color: t.colors.onPrimary },
  estadoChipTextActive: { color: '#FFFFFF' },
  usarActual: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: t.colors.primarySoft },
  usarActualText: { fontSize: 11, fontWeight: '600', color: t.colors.primary } });
