/**
 * Crear Rutina
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  BackHandler,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useClientesStore, useProgresoStore, useUIStore } from '@/stores';
import { Button, Card, CardContent, Input, Modal } from '@/components/ui';
import { rutinaSemanalSchema } from '@/schemas/validation';
import { generateId, getGrupoMuscularLabel } from '@/utils/helpers';
import { getDatabase, runTransaction } from '@/db/database';
import { useTheme } from '@/hooks/useTheme';
import type { Theme } from '@/constants/theme';
import type { ProgresionPlan } from '@/types';
import {
  SILUETAS,
  SOMATOTIPOS,
  generarPlantilla,
  getEnfoquesSilueta,
  type Silueta,
  type Somatotipo,
} from '@/constants/plantillasRutina';

interface EjercicioCatalogo {
  id: string;
  nombre: string;
  grupoMuscular: string;
}

/** Ejercicio en edición: los numéricos se guardan como texto para no perder lo que se está tipeando. */
interface EjercicioEditable {
  id: string;
  ejercicioId: string;
  nombre: string;
  grupo: string;
  seriesTxt: string;
  repeticiones: string;
  rpeTxt: string;
  descansoTxt: string;
  notas?: string;
  progresion?: ProgresionPlan;
}

interface DiaEditable {
  id: string;
  orden: number;
  nombre: string;
  esDescanso: boolean;
  ejercicios: EjercicioEditable[];
}

const LIMITES = {
  series: { min: 1, max: 20, def: 3 },
  rpe: { min: 6, max: 10, def: 8 },
  descanso: { min: 30, max: 600, def: 90 },
} as const;

/** Mismo formato que `ejercicioRutinaSchema.repeticiones`. */
const REPS_REGEX = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$|^AMRAP$/i;

const crearDias = (): DiaEditable[] => [
  { id: 'd1', orden: 1, nombre: 'Lunes', esDescanso: false, ejercicios: [] },
  { id: 'd2', orden: 2, nombre: 'Martes', esDescanso: false, ejercicios: [] },
  { id: 'd3', orden: 3, nombre: 'Miércoles', esDescanso: true, ejercicios: [] },
  { id: 'd4', orden: 4, nombre: 'Jueves', esDescanso: false, ejercicios: [] },
  { id: 'd5', orden: 5, nombre: 'Viernes', esDescanso: false, ejercicios: [] },
  { id: 'd6', orden: 6, nombre: 'Sábado', esDescanso: true, ejercicios: [] },
  { id: 'd7', orden: 7, nombre: 'Domingo', esDescanso: true, ejercicios: [] },
];

const soloDigitos = (v: string): string => v.replace(/\D/g, '');

/** Texto -> entero dentro de [min, max]; vacío/inválido -> def. */
const enteroAcotado = (txt: string, lim: { min: number; max: number; def: number }): number => {
  const n = parseInt(txt, 10);
  if (!Number.isFinite(n)) return lim.def;
  return Math.min(lim.max, Math.max(lim.min, n));
};

/** "8 - 12" -> "8-12", "10, 8 ,6" -> "10,8,6", "amrap" -> "AMRAP". */
const normalizarReps = (txt: string): string => {
  const limpio = txt.trim().replace(/\s*-\s*/g, '-').replace(/\s*,\s*/g, ',');
  return /^amrap$/i.test(limpio) ? 'AMRAP' : limpio;
};

function leerCatalogo(): EjercicioCatalogo[] {
  try {
    const rows = getDatabase().executeSync(
      'SELECT id, nombre, grupo_muscular FROM ejercicios ORDER BY grupo_muscular, nombre'
    ).rows as any[];
    return rows.map((r) => ({ id: String(r.id), nombre: String(r.nombre ?? ''), grupoMuscular: String(r.grupo_muscular ?? '') }));
  } catch (error) {
    console.error('[rutinas/nuevo] error al leer catálogo:', error);
    return [];
  }
}

/** La ficha vive en SQLite; el store de progreso no se persiste entre sesiones. */
function clienteTieneFicha(clienteId: string): boolean {
  try {
    return getDatabase().executeSync('SELECT 1 FROM fichas_iniciales WHERE cliente_id = ? LIMIT 1', [clienteId]).rows.length > 0;
  } catch {
    return false;
  }
}

export default function RutinaFormScreen() {
  // Tokens de diseño + styles derivados del tema activo
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const { selectedClienteId, getSelectedCliente } = useClientesStore();
  const fichaEnStore = useProgresoStore((s) => (selectedClienteId ? s.fichas[selectedClienteId] : undefined));
  const { addToast } = useUIStore();
  const cliente = getSelectedCliente();

  const [catalogo, setCatalogo] = useState<EjercicioCatalogo[]>(leerCatalogo);
  const [nombre, setNombre] = useState('');
  const [mesociclo, setMesociclo] = useState('1');
  const [semanaInicio, setSemanaInicio] = useState('1');
  const [semanaFin, setSemanaFin] = useState('4');
  const [notasGenerales, setNotasGenerales] = useState('');
  const [diasLocal, setDiasLocal] = useState<DiaEditable[]>(crearDias);
  const [diaExpandido, setDiaExpandido] = useState<string | null>(null);
  const [showEjercicioModal, setShowEjercicioModal] = useState(false);
  const [selectedDiaId, setSelectedDiaId] = useState<string | null>(null);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPlantillaModal, setShowPlantillaModal] = useState(false);
  const [somatotipo, setSomatotipo] = useState<Somatotipo>('mesomorfo');
  const [silueta, setSilueta] = useState<Silueta>('reloj');

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/rutinas'));

  const hayCambios = nombre.trim() !== '' || diasLocal.some((d) => d.ejercicios.length > 0);
  const salirConConfirmacion = () => {
    if (!hayCambios) {
      volver();
      return;
    }
    Alert.alert('Salir sin guardar', 'La rutina que estás armando se va a perder.', [
      { text: 'Seguir editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: volver },
    ]);
  };

  // Sin deps: se re-suscribe en cada render para leer el estado actual del formulario.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting) return true;
      salirConConfirmacion();
      return true;
    });
    return () => sub.remove();
  });

  /** La pantalla queda montada dentro de las tabs: hay que limpiar a mano tras guardar. */
  const resetForm = () => {
    setNombre('');
    setMesociclo('1');
    setSemanaInicio('1');
    setSemanaFin('4');
    setNotasGenerales('');
    setDiasLocal(crearDias());
    setDiaExpandido(null);
    setSelectedDiaId(null);
    setExerciseSearch('');
  };

  // ============================================
  // Mutaciones inmutables de días / ejercicios
  // ============================================
  const actualizarDia = (diaId: string, fn: (d: DiaEditable) => DiaEditable) => {
    setDiasLocal((prev) => prev.map((d) => (d.id === diaId ? fn(d) : d)));
  };

  const addEjercicioToDia = (diaId: string, ejercicio: EjercicioCatalogo) => {
    actualizarDia(diaId, (d) => ({
      ...d,
      ejercicios: [
        ...d.ejercicios,
        {
          id: generateId(),
          ejercicioId: ejercicio.id,
          nombre: ejercicio.nombre,
          grupo: ejercicio.grupoMuscular,
          seriesTxt: String(LIMITES.series.def),
          repeticiones: '8-12',
          rpeTxt: String(LIMITES.rpe.def),
          descansoTxt: String(LIMITES.descanso.def),
        },
      ],
    }));
  };

  const removeEjercicioFromDia = (diaId: string, ejId: string) => {
    actualizarDia(diaId, (d) => ({ ...d, ejercicios: d.ejercicios.filter((e) => e.id !== ejId) }));
  };

  const updateEjercicio = (diaId: string, ejId: string, patch: Partial<EjercicioEditable>) => {
    actualizarDia(diaId, (d) => ({
      ...d,
      ejercicios: d.ejercicios.map((e) => (e.id === ejId ? { ...e, ...patch } : e)),
    }));
  };

  const toggleDescanso = (diaId: string) => {
    actualizarDia(diaId, (d) => ({ ...d, esDescanso: !d.esDescanso }));
  };

  const aplicarPlantilla = () => {
    const cat = catalogo.length > 0 ? catalogo : leerCatalogo();
    if (cat !== catalogo) setCatalogo(cat);
    const porId = new Map(cat.map((e) => [e.id, e]));
    const plantilla = generarPlantilla(somatotipo, silueta);

    setNombre(plantilla.nombre);
    setNotasGenerales(plantilla.notas);
    setDiasLocal(
      plantilla.dias.map((d) => ({
        id: `d${d.orden}`,
        orden: d.orden,
        nombre: d.nombre,
        esDescanso: d.esDescanso,
        ejercicios: d.ejercicios.flatMap((e) => {
          const ej = porId.get(e.ejercicioId);
          if (!ej) return [];
          return [{
            id: generateId(),
            ejercicioId: ej.id,
            nombre: ej.nombre,
            grupo: ej.grupoMuscular,
            seriesTxt: String(e.series),
            repeticiones: e.repeticiones,
            rpeTxt: String(e.rpe),
            descansoTxt: String(e.descanso),
            notas: e.notas,
            progresion: e.progresion,
          }];
        }),
      }))
    );
    setDiaExpandido('d1');
    setShowPlantillaModal(false);
    addToast('Plantilla cargada: ajustala al cliente', 'success');
  };

  const confirmarPlantilla = () => {
    const hayEjercicios = diasLocal.some((d) => d.ejercicios.length > 0);
    if (!hayEjercicios) {
      aplicarPlantilla();
      return;
    }
    Alert.alert('Reemplazar rutina', 'La plantilla reemplaza el nombre, las notas y todos los ejercicios cargados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reemplazar', style: 'destructive', onPress: aplicarPlantilla },
    ]);
  };

  const abrirSelector = (diaId: string) => {
    if (catalogo.length === 0) setCatalogo(leerCatalogo());
    setSelectedDiaId(diaId);
    setShowEjercicioModal(true);
  };

  // ============================================
  // Guardar
  // ============================================
  const onSubmit = () => {
    if (!selectedClienteId) {
      Alert.alert('Sin cliente', 'Elegí un cliente antes de crear la rutina.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a Clientes', onPress: () => router.dismissTo('/clientes') },
      ]);
      return;
    }
    if (!nombre.trim()) {
      Alert.alert('Falta el nombre', 'Poné un nombre a la rutina (ej. Push/Pull/Legs).');
      return;
    }
    if (!fichaEnStore && !clienteTieneFicha(selectedClienteId)) {
      Alert.alert('Falta la ficha inicial', 'Crea la ficha inicial del cliente antes de diseñar la rutina.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Crear ficha', onPress: () => router.push(`/clientes/${selectedClienteId}/ficha/nueva`) },
      ]);
      return;
    }

    const meso = parseInt(mesociclo, 10);
    const sIni = parseInt(semanaInicio, 10);
    const sFin = parseInt(semanaFin, 10);
    const erroresBase: string[] = [];
    if (!Number.isFinite(meso) || meso < 1) erroresBase.push('Mesociclo: número entero desde 1');
    if (!Number.isFinite(sIni) || sIni < 1) erroresBase.push('Semana inicio: número entero desde 1');
    if (!Number.isFinite(sFin) || sFin < 1) erroresBase.push('Semana fin: número entero desde 1');
    else if (Number.isFinite(sIni) && sFin < sIni) erroresBase.push('La semana fin debe ser mayor o igual a la de inicio');

    const totalEjercicios = diasLocal.reduce((acc, d) => acc + (d.esDescanso ? 0 : d.ejercicios.length), 0);
    if (totalEjercicios === 0) erroresBase.push('Añadí al menos un ejercicio a un día de entrenamiento');
    else {
      const vacios = diasLocal.filter((d) => !d.esDescanso && d.ejercicios.length === 0).map((d) => d.nombre);
      if (vacios.length > 0) {
        erroresBase.push(`${vacios.join(', ')}: sin ejercicios. Agregá ejercicios o marcalo como descanso (ícono de luna).`);
      }
    }

    diasLocal.forEach((d) => {
      if (d.esDescanso) return;
      d.ejercicios.forEach((e) => {
        if (!REPS_REGEX.test(normalizarReps(e.repeticiones))) {
          erroresBase.push(`${d.nombre} · ${e.nombre}: repeticiones como "8-12", "10,8,6" o "AMRAP"`);
        }
      });
    });

    if (erroresBase.length > 0) {
      Alert.alert('Revisá la rutina', erroresBase.map((m) => `• ${m}`).join('\n'));
      return;
    }

    const diasSerializados = diasLocal.map((d) => ({
      id: d.id,
      orden: d.orden,
      nombre: d.nombre,
      esDescanso: d.esDescanso,
      ejercicios: d.esDescanso
        ? []
        : d.ejercicios.map((e, i) => ({
            id: e.id,
            ejercicioId: e.ejercicioId,
            orden: i + 1,
            series: enteroAcotado(e.seriesTxt, LIMITES.series),
            repeticiones: normalizarReps(e.repeticiones),
            rpeObjetivo: enteroAcotado(e.rpeTxt, LIMITES.rpe),
            tempo: '3-0-1-0',
            descansoSeg: enteroAcotado(e.descansoTxt, LIMITES.descanso),
            notas: e.notas ?? '',
            progresion: e.progresion ?? { tipo: 'lineal' as const, incrementoPeso: 2.5, frecuenciaSemanas: 1 },
          })),
    }));

    const resultado = rutinaSemanalSchema.safeParse({
      clienteId: selectedClienteId,
      nombre: nombre.trim(),
      mesociclo: meso,
      semanaInicio: sIni,
      semanaFin: sFin,
      dias: diasSerializados,
      notasGenerales: notasGenerales.trim(),
    });

    if (!resultado.success) {
      const mensajes = resultado.error.issues.map((issue) => {
        const [raiz, diaIdx, sub, ejIdx] = issue.path;
        if (raiz === 'dias' && typeof diaIdx === 'number') {
          const dia = diasLocal[diaIdx];
          if (sub === 'ejercicios' && typeof ejIdx === 'number') {
            return `${dia?.nombre ?? 'Día'} · ${dia?.ejercicios[ejIdx]?.nombre ?? 'Ejercicio'}: ${issue.message}`;
          }
          return `${dia?.nombre ?? 'Día'}: ${issue.message}`;
        }
        return issue.message;
      });
      Alert.alert('Revisá la rutina', mensajes.map((m) => `• ${m}`).join('\n'));
      return;
    }

    setSubmitting(true);
    try {
      const data = resultado.data;
      const rutinaId = generateId();
      const now = new Date().toISOString();

      runTransaction((tx) => {
        tx.executeSync(
          `INSERT INTO rutinas_semanales (id, cliente_id, nombre, mesociclo, semana_inicio, semana_fin, dias, notas_generales, creado_en, actualizado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            rutinaId,
            data.clienteId,
            data.nombre,
            data.mesociclo,
            data.semanaInicio,
            data.semanaFin,
            JSON.stringify(data.dias),
            data.notasGenerales ?? '',
            now,
            now,
          ]
        );
      });

      addToast('Rutina creada', 'success');
      resetForm();
      volver();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Error al guardar rutina');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEjercicios = useMemo(() => {
    const q = exerciseSearch.trim().toLowerCase();
    if (!q) return catalogo;
    return catalogo.filter(
      (e) =>
        e.nombre.toLowerCase().includes(q) ||
        e.grupoMuscular.toLowerCase().includes(q) ||
        getGrupoMuscularLabel(e.grupoMuscular).toLowerCase().includes(q)
    );
  }, [catalogo, exerciseSearch]);

  const renderCampo = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    opts: { numeric?: boolean; onBlur?: () => void; flex?: number } = {}
  ) => (
    <View style={[styles.campo, { flex: opts.flex ?? 1 }]}>
      <Text style={styles.campoLabel}>{label}</Text>
      <TextInput
        style={styles.campoInput}
        value={value}
        onChangeText={onChange}
        onBlur={opts.onBlur}
        keyboardType={opts.numeric ? 'number-pad' : 'default'}
        autoCapitalize="characters"
        selectTextOnFocus
        placeholderTextColor={t.colors.placeholder}
      />
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding">
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={salirConConfirmacion} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={t.colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.formTitle}>Nueva Rutina</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {cliente ? `${cliente.nombre} ${cliente.apellido}` : 'Sin cliente seleccionado'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/rutinas/catalogo')}
          style={styles.headerBtn}
          hitSlop={12}
          accessibilityLabel="Ver catálogo de ejercicios"
        >
          <Ionicons name="library-outline" size={22} color={t.colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.plantillaCta}
          onPress={() => setShowPlantillaModal(true)}
          accessibilityLabel="Usar plantilla por morfología"
        >
          <Ionicons name="body-outline" size={24} color={t.colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.plantillaCtaTitulo}>Usar plantilla por morfología</Text>
            <Text style={styles.plantillaCtaTexto}>Rutina de 5 días según silueta y somatotipo, lista para ajustar</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.colors.textSubtle} />
        </TouchableOpacity>

        {/* Datos básicos */}
        <Card style={styles.formCard}>
          <CardContent>
            <Text style={styles.sectionTitle}>Datos</Text>
            <View style={styles.campos}>
              <Input
                label="Nombre de la rutina"
                required
                placeholder="Push/Pull/Legs"
                value={nombre}
                onChange={setNombre}
                maxLength={100}
              />
              <View style={styles.row}>
                <View style={styles.thirdWidth}>
                  <Input
                    label="Mesociclo #"
                    placeholder="1"
                    keyboardType="number-pad"
                    value={mesociclo}
                    onChange={(v) => setMesociclo(soloDigitos(v))}
                    maxLength={3}
                  />
                </View>
                <View style={styles.thirdWidth}>
                  <Input
                    label="Semana inicio"
                    placeholder="1"
                    keyboardType="number-pad"
                    value={semanaInicio}
                    onChange={(v) => setSemanaInicio(soloDigitos(v))}
                    maxLength={3}
                  />
                </View>
                <View style={styles.thirdWidth}>
                  <Input
                    label="Semana fin"
                    placeholder="4"
                    keyboardType="number-pad"
                    value={semanaFin}
                    onChange={(v) => setSemanaFin(soloDigitos(v))}
                    maxLength={3}
                  />
                </View>
              </View>
              <Input
                label="Notas generales (opcional)"
                placeholder="Indicaciones generales..."
                value={notasGenerales}
                onChange={setNotasGenerales}
                maxLength={2000}
                multiline
                numberOfLines={2}
              />
            </View>
          </CardContent>
        </Card>

        {/* Editor de días */}
        {diasLocal.map((dia) => (
          <Card key={dia.id} style={styles.formCard}>
            <TouchableOpacity onPress={() => setDiaExpandido(diaExpandido === dia.id ? null : dia.id)}>
              <View style={styles.diaHeader}>
                <View style={styles.diaHeaderLeft}>
                  <View style={[styles.diaOrden, dia.esDescanso && styles.diaOrdenDescanso]}>
                    <Text style={styles.diaOrdenText}>{dia.orden}</Text>
                  </View>
                  <View>
                    <Text style={styles.diaNombre}>{dia.nombre}</Text>
                    <Text style={styles.diaSubtitle}>
                      {dia.esDescanso ? 'Descanso' : `${dia.ejercicios.length} ejercicios`}
                    </Text>
                  </View>
                </View>
                <View style={styles.diaActions}>
                  <TouchableOpacity
                    onPress={() => toggleDescanso(dia.id)}
                    style={styles.diaActionBtn}
                    hitSlop={8}
                    accessibilityLabel={dia.esDescanso ? 'Marcar como día de entrenamiento' : 'Marcar como descanso'}
                  >
                    <Ionicons
                      name={dia.esDescanso ? 'barbell-outline' : 'moon-outline'}
                      size={18}
                      color={dia.esDescanso ? t.colors.primary : t.colors.textMuted}
                    />
                  </TouchableOpacity>
                  <Ionicons
                    name={diaExpandido === dia.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={t.colors.textSubtle}
                  />
                </View>
              </View>
            </TouchableOpacity>

            {diaExpandido === dia.id && !dia.esDescanso && (
              <View style={styles.diaBody}>
                {dia.ejercicios.map((ej) => (
                  <View key={ej.id} style={styles.ejercicioItem}>
                    <View style={styles.ejercicioTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.ejercicioNombre}>{ej.nombre}</Text>
                        <Text style={styles.ejercicioGrupo}>{getGrupoMuscularLabel(ej.grupo)}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => removeEjercicioFromDia(dia.id, ej.id)}
                        style={styles.removeBtn}
                        hitSlop={8}
                        accessibilityLabel="Quitar ejercicio"
                      >
                        <Ionicons name="trash-outline" size={18} color={t.colors.danger} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.camposRow}>
                      {renderCampo('Series', ej.seriesTxt, (v) => updateEjercicio(dia.id, ej.id, { seriesTxt: soloDigitos(v) }), {
                        numeric: true,
                        onBlur: () => updateEjercicio(dia.id, ej.id, { seriesTxt: String(enteroAcotado(ej.seriesTxt, LIMITES.series)) }),
                      })}
                      {renderCampo('Reps', ej.repeticiones, (v) => updateEjercicio(dia.id, ej.id, { repeticiones: v }), {
                        flex: 1.4,
                        onBlur: () => updateEjercicio(dia.id, ej.id, { repeticiones: normalizarReps(ej.repeticiones) }),
                      })}
                      {renderCampo('RPE', ej.rpeTxt, (v) => updateEjercicio(dia.id, ej.id, { rpeTxt: soloDigitos(v) }), {
                        numeric: true,
                        onBlur: () => updateEjercicio(dia.id, ej.id, { rpeTxt: String(enteroAcotado(ej.rpeTxt, LIMITES.rpe)) }),
                      })}
                      {renderCampo('Desc. (s)', ej.descansoTxt, (v) => updateEjercicio(dia.id, ej.id, { descansoTxt: soloDigitos(v) }), {
                        numeric: true,
                        onBlur: () => updateEjercicio(dia.id, ej.id, { descansoTxt: String(enteroAcotado(ej.descansoTxt, LIMITES.descanso)) }),
                      })}
                    </View>
                  </View>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => abrirSelector(dia.id)}
                  leftIcon={<Ionicons name="add" size={16} color={t.colors.primary} />}
                  style={styles.addEjercicioBtn}
                >
                  Añadir Ejercicio
                </Button>
                <Text style={styles.hint}>Series 1-20 · RPE 6-10 · Descanso 30-600 s · Reps: 8-12, 10,8,6 o AMRAP</Text>
              </View>
            )}

            {diaExpandido === dia.id && dia.esDescanso && (
              <View style={styles.diaBody}>
                <Text style={styles.descansoText}>Día de descanso y recuperación</Text>
              </View>
            )}
          </Card>
        ))}

        <Button
          variant="primary"
          onPress={onSubmit}
          loading={submitting}
          style={styles.submitButton}
          leftIcon={<Ionicons name="checkmark-circle-outline" size={20} color={t.colors.onPrimary} />}
        >
          Guardar Rutina
        </Button>
      </ScrollView>

      {/* Modal selector de ejercicio */}
      <Modal
        visible={showEjercicioModal}
        onClose={() => {
          setShowEjercicioModal(false);
          setExerciseSearch('');
        }}
        title="Seleccionar Ejercicio"
        size="lg"
      >
        <View style={styles.modalBody}>
          <Input
            placeholder="Buscar..."
            value={exerciseSearch}
            onChange={setExerciseSearch}
            leftIcon={<Ionicons name="search" size={18} color={t.colors.textSubtle} />}
          />
          <FlatList
            data={filteredEjercicios}
            keyExtractor={(item) => item.id}
            style={styles.modalList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={styles.descansoText}>No hay ejercicios que coincidan</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.ejercicioModalItem}
                onPress={() => {
                  if (selectedDiaId) addEjercicioToDia(selectedDiaId, item);
                  setShowEjercicioModal(false);
                  setExerciseSearch('');
                }}
              >
                <Text style={styles.ejercicioModalNombre}>{item.nombre}</Text>
                <Text style={styles.ejercicioModalGrupo}>{getGrupoMuscularLabel(item.grupoMuscular)}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Modal plantillas por morfología */}
      <Modal
        visible={showPlantillaModal}
        onClose={() => setShowPlantillaModal(false)}
        title="Plantilla por morfología"
        size="lg"
      >
        <ScrollView style={styles.modalList} contentContainerStyle={styles.modalBody}>
          <Text style={styles.plantillaLabel}>Silueta · qué zonas priorizar</Text>
          <View style={styles.chips}>
            {SILUETAS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, silueta === s.key && styles.chipActivo]}
                onPress={() => setSilueta(s.key)}
              >
                <Text style={[styles.chipTexto, silueta === s.key && styles.chipTextoActivo]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.plantillaDescripcion}>{SILUETAS.find((s) => s.key === silueta)?.descripcion}</Text>

          <Text style={styles.plantillaLabel}>Somatotipo · volumen, descansos y cardio</Text>
          <View style={styles.chips}>
            {SOMATOTIPOS.map((s) => (
              <TouchableOpacity
                key={s.key}
                style={[styles.chip, somatotipo === s.key && styles.chipActivo]}
                onPress={() => setSomatotipo(s.key)}
              >
                <Text style={[styles.chipTexto, somatotipo === s.key && styles.chipTextoActivo]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.plantillaDescripcion}>{SOMATOTIPOS.find((s) => s.key === somatotipo)?.descripcion}</Text>

          <Text style={styles.plantillaLabel}>Semana</Text>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie'].map((dia, i) => (
            <View key={dia} style={styles.previewRow}>
              <Text style={styles.previewDia}>{dia}</Text>
              <Text style={styles.previewEnfoque}>{getEnfoquesSilueta(silueta)[i]}</Text>
            </View>
          ))}
          <View style={styles.previewRow}>
            <Text style={styles.previewDia}>Sáb-Dom</Text>
            <Text style={styles.previewEnfoque}>Descanso activo</Text>
          </View>
        </ScrollView>
        <Button
          variant="primary"
          fullWidth
          onPress={confirmarPlantilla}
          style={styles.plantillaBtn}
          leftIcon={<Ionicons name="download-outline" size={18} color={t.colors.onPrimary} />}
        >
          Cargar plantilla
        </Button>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const createStyles = (t: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingBottom: 12,
    backgroundColor: t.colors.chrome, borderBottomWidth: 1, borderBottomColor: t.colors.border },
  headerBtn: { padding: 4 },
  headerSubtitle: { fontSize: 12, color: t.colors.textMuted, marginTop: 1 },
  scrollContent: { padding: 16, gap: 16 },
  formTitle: { fontSize: 22, fontWeight: '700', color: t.colors.text },
  formCard: { borderWidth: 1, borderColor: t.colors.border },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: t.colors.text, marginBottom: 8 },
  campos: { gap: 12 },
  row: { flexDirection: 'row', gap: 8 },
  thirdWidth: { flex: 1 },
  diaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  diaHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  diaOrden: { width: 32, height: 32, borderRadius: 16, backgroundColor: t.colors.primary, alignItems: 'center', justifyContent: 'center' },
  diaOrdenDescanso: { backgroundColor: t.colors.warning },
  diaOrdenText: { fontSize: 14, fontWeight: '700', color: t.colors.onPrimary },
  diaNombre: { fontSize: 16, fontWeight: '600', color: t.colors.text },
  diaSubtitle: { fontSize: 12, color: t.colors.textSubtle },
  diaActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  diaActionBtn: { padding: 6 },
  diaBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  ejercicioItem: { backgroundColor: t.colors.bg, borderRadius: 10, padding: 12, gap: 10, borderWidth: 1, borderColor: t.colors.border },
  ejercicioTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ejercicioNombre: { fontSize: 14, fontWeight: '600', color: t.colors.text },
  ejercicioGrupo: { fontSize: 11, color: t.colors.textSubtle, marginTop: 1 },
  camposRow: { flexDirection: 'row', gap: 6 },
  campo: { gap: 4 },
  campoLabel: { fontSize: 10, fontWeight: '600', color: t.colors.textSubtle, textAlign: 'center' },
  campoInput: {
    backgroundColor: t.colors.input, borderRadius: 8, borderWidth: 1, borderColor: t.colors.border,
    paddingVertical: 8, paddingHorizontal: 4, textAlign: 'center',
    fontSize: 14, fontWeight: '600', color: t.colors.text },
  removeBtn: { padding: 6 },
  addEjercicioBtn: { marginTop: 4 },
  hint: { fontSize: 11, color: t.colors.textSubtle, textAlign: 'center' },
  descansoText: { fontSize: 14, color: t.colors.textMuted, textAlign: 'center', padding: 16 },
  submitButton: { marginTop: 8 },
  modalBody: { paddingTop: 12, gap: 12 },
  modalList: { maxHeight: 400 },
  ejercicioModalItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: t.colors.border, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  ejercicioModalNombre: { fontSize: 15, color: t.colors.text, flex: 1 },
  ejercicioModalGrupo: { fontSize: 12, color: t.colors.textSubtle },
  plantillaCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12,
    borderWidth: 1, borderColor: t.colors.primary, backgroundColor: t.colors.surface },
  plantillaCtaTitulo: { fontSize: 15, fontWeight: '700', color: t.colors.text },
  plantillaCtaTexto: { fontSize: 12, color: t.colors.textMuted, marginTop: 2 },
  plantillaBtn: { marginTop: 12 },
  plantillaLabel: { fontSize: 13, fontWeight: '700', color: t.colors.text, marginTop: 4 },
  plantillaDescripcion: { fontSize: 12, color: t.colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: t.colors.border },
  chipActivo: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  chipTexto: { fontSize: 13, color: t.colors.text },
  chipTextoActivo: { color: t.colors.onPrimary, fontWeight: '600' },
  previewRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  previewDia: { width: 60, fontSize: 13, fontWeight: '600', color: t.colors.textMuted },
  previewEnfoque: { flex: 1, fontSize: 13, color: t.colors.text } });
