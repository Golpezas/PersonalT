/**
 * Check-in Semanal - Nueva
 */

import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity, Pressable, Image, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input } from '@/components/ui';
import { checkinSemanalSchema } from '@/schemas/validation';
import { generateId, createEmptyPerimetros, createEmptyFotos, formatDate, getPerimetroLabel } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { FotosProgreso, Perimetros } from '@/types';

type Params = { id: string };
type Rating = 1 | 2 | 3 | 4 | 5;
type RatingKey = 'energia' | 'sueno' | 'estres' | 'adherencia';
type AnguloFoto = keyof FotosProgreso;
type Row = any;

const PERIMETRO_KEYS = Object.keys(createEmptyPerimetros()) as (keyof Perimetros)[];
const ANGULOS: AnguloFoto[] = ['frontal', 'lateral', 'posterior'];

const ESCALAS: { key: RatingKey; titulo: string; opciones: { label: string; icon: string }[] }[] = [
  {
    key: 'energia',
    titulo: 'Energía',
    opciones: [
      { label: 'Muy baja', icon: 'battery-dead' },
      { label: 'Baja', icon: 'battery-half' },
      { label: 'Normal', icon: 'battery-half' },
      { label: 'Alta', icon: 'battery-full' },
      { label: 'Muy alta', icon: 'battery-charging' },
    ],
  },
  {
    key: 'sueno',
    titulo: 'Sueño',
    opciones: [
      { label: 'Muy mal', icon: 'moon' },
      { label: 'Mal', icon: 'cloudy-night' },
      { label: 'Normal', icon: 'moon-outline' },
      { label: 'Bueno', icon: 'sunny-outline' },
      { label: 'Muy bueno', icon: 'sunny' },
    ],
  },
  {
    key: 'estres',
    titulo: 'Estrés',
    opciones: [
      { label: 'Muy bajo', icon: 'leaf' },
      { label: 'Bajo', icon: 'partly-sunny' },
      { label: 'Normal', icon: 'cloudy' },
      { label: 'Alto', icon: 'rainy' },
      { label: 'Muy alto', icon: 'thunderstorm' },
    ],
  },
  {
    key: 'adherencia',
    titulo: 'Adherencia',
    opciones: [
      { label: 'Muy baja', icon: 'close-circle' },
      { label: 'Baja', icon: 'remove-circle' },
      { label: 'Media', icon: 'help-circle' },
      { label: 'Alta', icon: 'checkmark-circle' },
      { label: 'Muy alta', icon: 'trophy' },
    ],
  },
];

/** Mensaje legible para cada campo del schema (los mensajes por defecto de zod están en inglés). */
const MENSAJE_POR_CAMPO: Record<string, string> = {
  peso: 'Peso: ingresá un valor entre 30 y 300 kg',
  grasaCorporal: 'Grasa corporal: valor entre 3 y 50 %',
  musculatura: 'Masa muscular: valor entre 10 y 150 kg',
  fecha: 'Fecha inválida',
  semana: 'Número de semana inválido',
  clienteId: 'Cliente inválido',
  notas: 'Las notas superan los 2000 caracteres',
};

/** "70,5" | "70.5" -> 70.5; vacío o inválido -> undefined. */
const parseDecimal = (texto: string): number | undefined => {
  const n = parseFloat(texto.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
};

/** Deja solo dígitos y un separador decimal mientras se escribe. */
const limpiarDecimal = (texto: string): string => texto.replace(/[^\d.,]/g, '').replace(/([.,].*)[.,]/g, '$1');

const numeroOpcional = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : undefined;
};

const aTexto = (n: number | undefined): string => (n !== undefined && n > 0 ? String(n) : '');

/** Fecha local YYYY-MM-DD (toISOString usa UTC y corre el día de noche). */
const fechaLocalISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Mediodía local para que el picker no muestre el día anterior por zona horaria. */
const fechaDesdeISO = (iso: string): Date => new Date(`${iso}T12:00:00`);

const parseJSONObjeto = (raw: unknown): Record<string, unknown> => {
  if (typeof raw !== 'string' || !raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

function leerSiguienteSemana(clienteId: string): number {
  const row = getDatabase().executeSync(
    'SELECT MAX(semana) AS max_semana FROM checkins_semanales WHERE cliente_id = ?',
    [clienteId]
  ).rows[0] as Row;
  const max = Number(row?.max_semana);
  return Number.isFinite(max) && max > 0 ? Math.floor(max) + 1 : 1;
}

interface Referencia {
  siguienteSemana: number;
  peso?: number;
  grasa?: number;
  musculo?: number;
  perimetros: Partial<Record<keyof Perimetros, number>>;
  fotosAnteriores: Record<AnguloFoto, { uri: string; etiqueta: string }>;
}

/** Último check-in (o la ficha si no hay) para precargar valores y comparar fotos. */
function leerReferencia(clienteId: string): Referencia {
  const vacia: Referencia = {
    siguienteSemana: 1,
    perimetros: {},
    fotosAnteriores: {
      frontal: { uri: '', etiqueta: '' },
      lateral: { uri: '', etiqueta: '' },
      posterior: { uri: '', etiqueta: '' },
    },
  };
  if (!clienteId) return vacia;
  try {
    const db = getDatabase();
    const checkin = db.executeSync(
      'SELECT * FROM checkins_semanales WHERE cliente_id = ? ORDER BY semana DESC, creado_en DESC LIMIT 1',
      [clienteId]
    ).rows[0] as Row | undefined;
    const ficha = db.executeSync(
      'SELECT * FROM fichas_iniciales WHERE cliente_id = ? ORDER BY creado_en DESC LIMIT 1',
      [clienteId]
    ).rows[0] as Row | undefined;
    const fuente = checkin ?? ficha;

    const perimetrosRaw = parseJSONObjeto(fuente?.perimetros);
    const perimetros: Partial<Record<keyof Perimetros, number>> = {};
    for (const k of PERIMETRO_KEYS) perimetros[k] = numeroOpcional(perimetrosRaw[k]);

    const fotosCheckin = parseJSONObjeto(checkin?.fotos);
    const fotosFicha = parseJSONObjeto(ficha?.fotos);
    const fotosAnteriores = { ...vacia.fotosAnteriores };
    for (const a of ANGULOS) {
      if (typeof fotosCheckin[a] === 'string' && fotosCheckin[a]) {
        fotosAnteriores[a] = { uri: fotosCheckin[a] as string, etiqueta: `Sem ${checkin.semana}` };
      } else if (typeof fotosFicha[a] === 'string' && fotosFicha[a]) {
        fotosAnteriores[a] = { uri: fotosFicha[a] as string, etiqueta: 'Inicial' };
      }
    }

    return {
      siguienteSemana: leerSiguienteSemana(clienteId),
      peso: numeroOpcional(fuente?.peso),
      grasa: numeroOpcional(fuente?.grasa_corporal),
      musculo: numeroOpcional(fuente?.musculatura),
      perimetros,
      fotosAnteriores,
    };
  } catch (error) {
    console.error('Error leyendo referencia de check-in:', error);
    return vacia;
  }
}

export default function CheckinFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id = '' } = useLocalSearchParams<Params>();
  const addToast = useUIStore((s) => s.addToast);
  const addCheckin = useProgresoStore((s) => s.addCheckin);

  const [referencia] = useState(() => leerReferencia(id));
  const [pesoTexto, setPesoTexto] = useState(() => aTexto(referencia.peso));
  const [grasaTexto, setGrasaTexto] = useState(() => aTexto(referencia.grasa));
  const [musculoTexto, setMusculoTexto] = useState(() => aTexto(referencia.musculo));
  const [perimetrosTexto, setPerimetrosTexto] = useState<Record<keyof Perimetros, string>>(
    () => Object.fromEntries(PERIMETRO_KEYS.map((k) => [k, aTexto(referencia.perimetros[k])])) as Record<keyof Perimetros, string>
  );
  const [ratings, setRatings] = useState<Record<RatingKey, Rating>>({ energia: 3, sueno: 3, estres: 3, adherencia: 3 });
  const [notas, setNotas] = useState('');
  const [fotos, setFotos] = useState<FotosProgreso>(createEmptyFotos());
  const [verComparacion, setVerComparacion] = useState<AnguloFoto | null>(null);
  const [fecha, setFecha] = useState(() => fechaLocalISO(new Date()));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const hoy = fechaLocalISO(new Date());
  const peso = parseDecimal(pesoTexto);
  const pesoValido = peso !== undefined && peso >= 30 && peso <= 300;

  const perimetros = useMemo(
    () => Object.fromEntries(PERIMETRO_KEYS.map((k) => [k, parseDecimal(perimetrosTexto[k]) ?? 0])) as unknown as Perimetros,
    [perimetrosTexto]
  );
  const perimetrosFaltantes = PERIMETRO_KEYS.filter((k) => !(perimetros[k] > 0));

  const volver = () => (router.canGoBack() ? router.back() : router.replace(`/clientes/${id}`));

  const setFoto = (tipo: AnguloFoto, uri: string) => {
    setFotos((prev) => ({ ...prev, [tipo]: uri }));
    setVerComparacion(null);
  };

  const pickFoto = async (tipo: AnguloFoto) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setFoto(tipo, result.assets[0].uri);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No se pudo abrir la galería');
    }
  };

  const tomarFoto = async (tipo: AnguloFoto) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar la foto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) setFoto(tipo, result.assets[0].uri);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No se pudo abrir la cámara');
    }
  };

  const moverFecha = (dias: number) => {
    const d = fechaDesdeISO(fecha);
    d.setDate(d.getDate() + dias);
    const nueva = fechaLocalISO(d);
    if (nueva <= hoy) setFecha(nueva);
  };

  const onSubmit = () => {
    if (submitting) return;

    let semana: number;
    try {
      semana = leerSiguienteSemana(id);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No se pudo leer la base de datos');
      return;
    }

    const resultado = checkinSemanalSchema.safeParse({
      clienteId: id,
      semana,
      fecha,
      peso,
      grasaCorporal: parseDecimal(grasaTexto),
      musculatura: parseDecimal(musculoTexto),
      perimetros,
      fotos,
      energia: ratings.energia,
      sueno: ratings.sueno,
      estres: ratings.estres,
      adherencia: ratings.adherencia,
      notas,
    });

    const mensajes = new Set<string>();
    if (!resultado.success) {
      for (const issue of resultado.error.issues) {
        const campo = String(issue.path[0] ?? '');
        mensajes.add(MENSAJE_POR_CAMPO[campo] ?? `${issue.path.join('.') || 'Formulario'}: ${issue.message}`);
      }
    }
    if (perimetrosFaltantes.length > 0) {
      mensajes.add(`Completá los perímetros: ${perimetrosFaltantes.map(getPerimetroLabel).join(', ')}`);
    }
    if (!resultado.success || mensajes.size > 0) {
      Alert.alert('Revisá el check-in', [...mensajes].map((m) => `• ${m}`).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const v = resultado.data;
      const now = new Date().toISOString();
      const checkinId = generateId();

      runTransaction((tx) => {
        tx.executeSync(
          `INSERT INTO checkins_semanales (id, cliente_id, semana, fecha, peso, grasa_corporal, musculatura, perimetros, fotos, energia, sueno, estres, adherencia, notas, creado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            checkinId, id, v.semana, v.fecha, v.peso,
            v.grasaCorporal ?? null, v.musculatura ?? null,
            JSON.stringify(v.perimetros), JSON.stringify(v.fotos),
            v.energia, v.sueno, v.estres, v.adherencia,
            v.notas ?? '', now,
          ]
        );
      });

      addCheckin(id, {
        id: checkinId,
        clienteId: id,
        semana: v.semana,
        fecha: v.fecha,
        peso: v.peso,
        grasaCorporal: v.grasaCorporal,
        musculatura: v.musculatura,
        perimetros: v.perimetros,
        fotos: v.fotos,
        energia: v.energia as Rating,
        sueno: v.sueno as Rating,
        estres: v.estres as Rating,
        adherencia: v.adherencia as Rating,
        notas: v.notas ?? '',
        creadoEn: now,
      });

      addToast(`Check-in semana ${v.semana} guardado`, 'success');
      router.dismissTo(`/clientes/${id}`);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error al guardar check-in');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={volver}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={20} color={t.colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.formTitle}>Check-in Semana {referencia.siguienteSemana}</Text>
          <Text style={styles.headerSubtitle}>Registra el progreso semanal del cliente</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Fecha */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Fecha</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.dateStep} onPress={() => moverFecha(-1)} accessibilityLabel="Día anterior">
                <Ionicons name="chevron-back" size={18} color={t.colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.dateCenter} onPress={() => setShowDatePicker(true)}>
                <Ionicons name="calendar-outline" size={18} color={t.colors.textMuted} />
                <Text style={styles.dateText}>{formatDate(fecha)}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateStep, fecha >= hoy && styles.dateStepDisabled]}
                onPress={() => moverFecha(1)}
                disabled={fecha >= hoy}
                accessibilityLabel="Día siguiente"
              >
                <Ionicons name="chevron-forward" size={18} color={t.colors.text} />
              </TouchableOpacity>
            </View>
          </CardContent>
        </Card>

        {/* Peso y composición */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Antropometría</Text>
            <View style={styles.campos}>
              <Input
                label="Peso (kg)"
                placeholder="70,5"
                keyboardType="decimal-pad"
                value={pesoTexto}
                onChange={(v) => setPesoTexto(limpiarDecimal(v))}
                required
                error={pesoTexto && !pesoValido ? 'Peso entre 30 y 300 kg' : undefined}
              />
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Input
                    label="Grasa (%)"
                    placeholder="15"
                    keyboardType="decimal-pad"
                    value={grasaTexto}
                    onChange={(v) => setGrasaTexto(limpiarDecimal(v))}
                    helperText="Opcional"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Input
                    label="Músculo (kg)"
                    placeholder="30"
                    keyboardType="decimal-pad"
                    value={musculoTexto}
                    onChange={(v) => setMusculoTexto(limpiarDecimal(v))}
                    helperText="Opcional"
                  />
                </View>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Perímetros */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Perímetros (cm)</Text>
            {PERIMETRO_KEYS.map((key) => (
              <View key={key} style={styles.perimetroRow}>
                <Text style={styles.perimetroLabel}>{getPerimetroLabel(key)}</Text>
                <View style={styles.perimetroInputWrapper}>
                  <Input
                    placeholder="0"
                    keyboardType="decimal-pad"
                    value={perimetrosTexto[key]}
                    onChange={(v) => setPerimetrosTexto((prev) => ({ ...prev, [key]: limpiarDecimal(v) }))}
                    maxLength={5}
                    compact
                    style={styles.perimetroInput}
                  />
                </View>
                <Text style={styles.perimetroUnit}>cm</Text>
              </View>
            ))}
            {perimetrosFaltantes.length > 0 && (
              <Text style={styles.warningText}>⚠️ Completa todos los perímetros</Text>
            )}
          </CardContent>
        </Card>

        {/* Ratings subjetivos */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Bienestar Subjetivo</Text>
            {ESCALAS.map((escala) => (
              <View key={escala.key}>
                <Text style={styles.ratingSectionLabel}>{escala.titulo}</Text>
                <View style={styles.ratingRow}>
                  {escala.opciones.map((op, i) => {
                    const valor = (i + 1) as Rating;
                    const activo = ratings[escala.key] === valor;
                    return (
                      <TouchableOpacity
                        key={op.label}
                        style={[styles.ratingButton, activo && styles.ratingButtonActive]}
                        onPress={() => setRatings((prev) => ({ ...prev, [escala.key]: valor }))}
                        accessibilityRole="button"
                        accessibilityState={{ selected: activo }}
                        accessibilityLabel={`${escala.titulo}: ${op.label}`}
                      >
                        <Ionicons
                          name={op.icon as any}
                          size={20}
                          color={activo ? t.colors.onPrimary : t.colors.textSubtle}
                        />
                        <Text style={[styles.ratingLabel, activo && styles.ratingLabelActive]} numberOfLines={2}>
                          {op.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </CardContent>
        </Card>

        {/* Fotos con comparación */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Fotos de Progreso</Text>
            <Text style={styles.formSubtitle}>Opcional: cámara o galería</Text>

            <View style={styles.fotoGrid}>
              {ANGULOS.map((tipo) => {
                const actual = fotos[tipo];
                const anterior = referencia.fotosAnteriores[tipo];
                const comparando = verComparacion === tipo && !!anterior.uri;
                return (
                  <View key={tipo} style={styles.fotoSlot}>
                    <View style={styles.fotoHeaderRow}>
                      <Text style={styles.fotoLabel}>{tipo.charAt(0).toUpperCase() + tipo.slice(1)}</Text>
                      {anterior.uri ? (
                        <TouchableOpacity
                          onPress={() => setVerComparacion(comparando ? null : tipo)}
                          style={[styles.compararBtn, comparando && styles.compararBtnActive]}
                        >
                          <Ionicons
                            name="layers-outline"
                            size={13}
                            color={comparando ? t.colors.onPrimary : t.colors.primary}
                          />
                          <Text style={[styles.compararText, comparando && styles.compararTextActive]}>
                            {comparando ? 'Ocultar anterior' : 'Ver anterior'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    <View style={styles.fotoBox}>
                      {actual ? (
                        <Image source={{ uri: actual }} style={styles.fotoImage} />
                      ) : (
                        <View style={styles.fotoVacio}>
                          <Ionicons name="image-outline" size={28} color={t.colors.textSubtle} />
                          <Text style={styles.fotoVacioText}>Sin foto</Text>
                        </View>
                      )}

                      {comparando && (
                        <View style={styles.compararOverlay}>
                          <Image source={{ uri: anterior.uri }} style={styles.fotoImage} />
                          <View style={styles.compararBadge}>
                            <Text style={styles.compararBadgeText}>{anterior.etiqueta}</Text>
                          </View>
                        </View>
                      )}

                      <View style={styles.fotoActions}>
                        <TouchableOpacity style={styles.fotoActionBtn} onPress={() => tomarFoto(tipo)} accessibilityLabel="Tomar foto">
                          <Ionicons name="camera-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.fotoActionBtn} onPress={() => pickFoto(tipo)} accessibilityLabel="Elegir de la galería">
                          <Ionicons name="images-outline" size={18} color="#fff" />
                        </TouchableOpacity>
                        {actual ? (
                          <TouchableOpacity
                            style={[styles.fotoActionBtn, styles.fotoActionDelete]}
                            onPress={() => setFoto(tipo, '')}
                            accessibilityLabel="Quitar foto"
                          >
                            <Ionicons name="trash-outline" size={18} color="#fff" />
                          </TouchableOpacity>
                        ) : null}
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
            <Input
              placeholder="Observaciones del cliente, cambios, etc."
              multiline
              numberOfLines={4}
              value={notas}
              onChange={setNotas}
            />
          </CardContent>
        </Card>

        <Button
          variant="primary"
          onPress={onSubmit}
          loading={submitting}
          style={styles.submitButton}
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color={t.colors.onPrimary} />}
        >
          Guardar Check-in
        </Button>
      </ScrollView>

      {showDatePicker && (
        <DateTimePicker
          value={fechaDesdeISO(fecha)}
          mode="date"
          maximumDate={new Date()}
          onValueChange={(_event, date) => {
            setShowDatePicker(false);
            if (date) setFecha(fechaLocalISO(date));
          }}
          onDismiss={() => setShowDatePicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: t.colors.chrome,
    borderBottomWidth: 1,
    borderBottomColor: t.colors.border,
  },
  backBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt },
  headerSubtitle: { fontSize: 13, color: t.colors.textMuted, marginTop: 2 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  formTitle: { fontSize: 20, fontWeight: '700', color: t.colors.text },
  formSubtitle: { fontSize: 14, color: t.colors.textMuted, marginBottom: 8 },
  formCard: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 12 },
  campos: { gap: 12 },
  row: { flexDirection: 'row', gap: 12 },
  halfWidth: { flex: 1 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateStep: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.surfaceAlt },
  dateStepDisabled: { opacity: 0.35 },
  dateCenter: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 40, borderRadius: 12, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.input,
  },
  dateText: { fontSize: 16, fontWeight: '500', color: t.colors.text },
  perimetroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  perimetroLabel: { fontSize: 14, color: t.colors.text, flex: 1 },
  perimetroInputWrapper: { width: 96 },
  perimetroInput: { textAlign: 'right' },
  perimetroUnit: { fontSize: 13, color: t.colors.textSubtle, width: 22 },
  warningText: { fontSize: 13, color: t.colors.warning, marginTop: 8 },
  ratingSectionLabel: { fontSize: 13, color: t.colors.textMuted, marginTop: 12, marginBottom: 8 },
  ratingRow: { flexDirection: 'row', gap: 6 },
  ratingButton: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 2, borderRadius: 10, backgroundColor: t.colors.surfaceAlt },
  ratingButtonActive: { backgroundColor: t.colors.primary },
  ratingLabel: { fontSize: 10, fontWeight: '500', color: t.colors.textMuted, marginTop: 4, textAlign: 'center' },
  ratingLabelActive: { color: t.colors.onPrimary },
  fotoGrid: { gap: 16 },
  fotoSlot: { gap: 6 },
  fotoHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fotoLabel: { fontSize: 14, fontWeight: '600', color: t.colors.text },
  compararBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: t.colors.primarySoft },
  compararBtnActive: { backgroundColor: t.colors.primary },
  compararText: { fontSize: 11, fontWeight: '600', color: t.colors.primary },
  compararTextActive: { color: t.colors.onPrimary },
  fotoBox: { height: 180, borderRadius: 12, backgroundColor: t.colors.surfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fotoVacio: { alignItems: 'center', gap: 6 },
  fotoVacioText: { fontSize: 12, color: t.colors.textSubtle },
  fotoImage: { width: '100%', height: '100%' },
  compararOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: t.colors.overlay },
  compararBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  compararBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  fotoActions: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', gap: 6 },
  fotoActionBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.75)', alignItems: 'center', justifyContent: 'center' },
  fotoActionDelete: { backgroundColor: 'rgba(239,68,68,0.85)' },
  tipText: { fontSize: 12, color: t.colors.textMuted, marginTop: 12, lineHeight: 16 },
  submitButton: { marginTop: 8 },
});
