/**
 * Ajustes Screen - Settings
 */

import React from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { STORAGE_KEYS, UNITS } from '@/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  exportAndShare,
  pickAndImport,
  runAutoBackup,
  getCounts,
  clearAllData,
  listAutoBackups,
  getLastBackupAt } from '@/services/backup';

const TABLE_LABELS: Record<string, string> = {
  clientes: 'Clientes',
  fichas_iniciales: 'Fichas',
  checkins_semanales: 'Check-ins',
  ejercicios: 'Ejercicios',
  rutinas_semanales: 'Rutinas',
  entrenamientos_realizados: 'Entrenamientos',
  metas: 'Metas' };

export default function AjustesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { theme, setTheme, addToast } = useUIStore();
  const [autoBackup, setAutoBackup] = React.useState(false);
  const [backupFrequency, setBackupFrequency] = React.useState<'daily' | 'weekly' | 'never'>('never');
  const [units, setUnits] = React.useState<'metric' | 'imperial'>('metric');
  const [language, setLanguage] = React.useState<'es' | 'en'>('es');
  const [conteos, setConteos] = React.useState<Record<string, number>>({});
  const [ocupado, setOcupado] = React.useState<string | null>(null);

  React.useEffect(() => {
    const cargar = async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEYS.units);
      if (saved) setUnits(saved as 'metric' | 'imperial');
      const savedLang = await AsyncStorage.getItem(STORAGE_KEYS.language);
      if (savedLang) setLanguage(savedLang as 'es' | 'en');
      const savedBackup = await AsyncStorage.getItem(STORAGE_KEYS.autoBackup);
      if (savedBackup) setAutoBackup(savedBackup === 'true');
      const savedFreq = await AsyncStorage.getItem(STORAGE_KEYS.backupFrequency);
      if (savedFreq) setBackupFrequency(savedFreq as any);
      setConteos(getCounts());
    };
    cargar();
  }, []);

  const refreshCounts = () => setConteos(getCounts());

  const saveSetting = async (key: string, value: string) => {
    await AsyncStorage.setItem(key, value);
  };

  const handleToggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    setTheme(newTheme);
  };

  const handleUnitsToggle = async () => {
    const newUnits = units === 'metric' ? 'imperial' : 'metric';
    setUnits(newUnits);
    await saveSetting(STORAGE_KEYS.units, newUnits);
    addToast(`Unidades: ${newUnits === 'metric' ? 'Métricas (kg/cm)' : 'Imperiales (lb/in)'}`, 'success');
  };

  const handleLanguageToggle = async () => {
    const newLang = language === 'es' ? 'en' : 'es';
    setLanguage(newLang);
    await saveSetting(STORAGE_KEYS.language, newLang);
    addToast(`Idioma: ${newLang === 'es' ? 'Español' : 'English'}`, 'success');
  };

  const handleAutoBackupToggle = async (value: boolean) => {
    setAutoBackup(value);
    await saveSetting(STORAGE_KEYS.autoBackup, value.toString());
    if (value) {
      if (backupFrequency === 'never') {
        setBackupFrequency('daily');
        await saveSetting(STORAGE_KEYS.backupFrequency, 'daily');
      }
      setOcupado('Generando backup...');
      const uri = runAutoBackup();
      setOcupado(null);
      addToast(uri ? 'Backup automático activado' : 'No hay datos para respaldar', uri ? 'success' : 'info');
    } else {
      addToast('Backup automático desactivado', 'info');
    }
  };

  const handleBackupFrequencyChange = async (freq: 'daily' | 'weekly' | 'never') => {
    setBackupFrequency(freq);
    await saveSetting(STORAGE_KEYS.backupFrequency, freq);
    if (freq === 'never') {
      setAutoBackup(false);
      await saveSetting(STORAGE_KEYS.autoBackup, 'false');
    } else {
      setAutoBackup(true);
      await saveSetting(STORAGE_KEYS.autoBackup, 'true');
    }
  };

  const handleExportData = () => {
    const total = Object.values(conteos).reduce((a, b) => a + b, 0);
    if (total === 0) {
      addToast('No hay datos para exportar', 'warning');
      return;
    }
    Alert.alert(
      'Exportar datos',
      `Se generará un archivo JSON con ${total} registros:\n\n` +
        Object.entries(conteos)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `• ${TABLE_LABELS[t] || t}: ${n}`)
          .join('\n'),
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Exportar',
          onPress: async () => {
            setOcupado('Generando archivo...');
            try {
              const { total } = await exportAndShare();
              addToast(`Backup exportado (${total} registros)`, 'success');
            } catch (e: any) {
              addToast(`Error al exportar: ${e?.message ?? 'desconocido'}`, 'error');
            } finally {
              setOcupado(null);
            }
          } },
      ]
    );
  };

  const handleImportData = () => {
    Alert.alert(
      'Importar datos',
      'Elige cómo aplicar el archivo de backup:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Fusionar',
          onPress: () => doImport('merge') },
        {
          text: 'Restaurar',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              '¿Restaurar?',
              'Se eliminará TODA la información actual y se reemplazará por el backup. No se puede deshacer.',
              [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Restaurar', style: 'destructive', onPress: () => doImport('replace') },
              ]
            ) },
      ]
    );
  };

  const doImport = async (modo: 'replace' | 'merge') => {
    setOcupado('Importando...');
    try {
      const { cancelado, resultado } = await pickAndImport(modo);
      if (cancelado) return;
      if (!resultado) {
        addToast('No se pudo leer el archivo', 'error');
        return;
      }
      if (!resultado.ok) {
        Alert.alert('Error al importar', resultado.error ?? 'Archivo inválido');
        return;
      }
      const total = Object.values(resultado.conteos).reduce((a, b) => a + b, 0);
      refreshCounts();
      addToast(`Importados ${total} registros`, 'success');
      Alert.alert(
        'Importación completa',
        Object.entries(resultado.conteos)
          .filter(([, n]) => n > 0)
          .map(([t, n]) => `• ${TABLE_LABELS[t] || t}: ${n}`)
          .join('\n'),
        [{ text: 'OK' }]
      );
    } catch (e: any) {
      addToast(`Error: ${e?.message ?? 'desconocido'}`, 'error');
    } finally {
      setOcupado(null);
    }
  };

  const handleClearData = () => {
    const total = Object.values(conteos).reduce((a, b) => a + b, 0);
    Alert.alert(
      'Limpiar todos los datos',
      `¡ATENCIÓN! Se eliminarán ${total} registros de forma permanente.\n\nTe recomendamos exportar un backup antes.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar todo',
          style: 'destructive',
          onPress: () =>
            Alert.alert('¿Seguro?', 'Esta acción no se puede deshacer.', [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Sí, eliminar',
                style: 'destructive',
                onPress: () => {
                  try {
                    clearAllData();
                    refreshCounts();
                    addToast('Todos los datos fueron eliminados', 'warning');
                  } catch (e: any) {
                    addToast(`Error: ${e?.message ?? 'desconocido'}`, 'error');
                  }
                } },
            ]) },
      ]
    );
  };

  const handleBackupsList = async () => {
    const archivos = listAutoBackups();
    const last = await getLastBackupAt();
    if (archivos.length === 0) {
      Alert.alert('Backups', last ? `Último backup: ${last}` : 'No hay backups automáticos todavía.');
      return;
    }
    Alert.alert(
      'Backups automáticos',
      `${archivos.length} guardado(s) en el dispositivo\nÚltimo: ${last ?? '—'}\n\nSe conservan los 7 más recientes.`
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'Personal Trainer',
      'Versión 1.0.0\n\nApp para entrenadores personales especializada en hipertrofia.\n\nDesarrollado con React Native + Expo',
      [{ text: 'OK' }]
    );
  };

  const sections = [
    {
      title: 'Apariencia',
      icon: 'color-palette-outline',
      items: [
        {
          label: 'Tema',
          value: theme === 'light' ? 'Claro' : theme === 'dark' ? 'Oscuro' : 'Sistema',
          action: handleToggleTheme,
          type: 'toggle' as const },
      ] },
    {
      title: 'Preferencias',
      icon: 'options-outline',
      items: [
        {
          label: 'Unidades',
          value: units === 'metric' ? 'kg / cm' : 'lb / in',
          action: handleUnitsToggle,
          type: 'toggle' as const },
        {
          label: 'Idioma',
          value: language === 'es' ? 'Español' : 'English',
          action: handleLanguageToggle,
          type: 'toggle' as const },
      ] },
    {
      title: 'Backup y Datos',
      icon: 'cloud-upload-outline',
      items: [
        {
          label: 'Backup Automático',
          value: autoBackup ? 'Activado' : 'Desactivado',
          action: () => handleAutoBackupToggle(!autoBackup),
          type: 'switch' as const,
          switchValue: autoBackup },
        {
          label: 'Frecuencia',
          value: backupFrequency === 'daily' ? 'Diario' : backupFrequency === 'weekly' ? 'Semanal' : 'Nunca',
          action: () => {
            const options = ['daily', 'weekly', 'never'];
            const currentIdx = options.indexOf(backupFrequency);
            const next = options[(currentIdx + 1) % options.length];
            handleBackupFrequencyChange(next as any);
          },
          type: 'toggle' as const },
        {
          label: 'Almacenamiento',
          value: `${Object.values(conteos).reduce((a, b) => a + b, 0)} registros`,
          action: () => {},
          type: 'info' as const },
        {
          label: 'Backups automáticos',
          value: 'Ver historial',
          action: handleBackupsList,
          type: 'button' as const },
        {
          label: 'Exportar Datos',
          value: 'JSON',
          action: handleExportData,
          type: 'button' as const },
        {
          label: 'Importar Datos',
          value: 'JSON',
          action: handleImportData,
          type: 'button' as const },
        {
          label: 'Limpiar Todos los Datos',
          value: '',
          action: handleClearData,
          type: 'danger' as const },
      ] },
    {
      title: 'Información',
      icon: 'information-circle-outline',
      items: [
        {
          label: 'Versión',
          value: '1.0.0',
          action: () => {},
          type: 'info' as const },
        {
          label: 'Acerca de',
          value: '',
          action: handleAbout,
          type: 'button' as const },
        {
          label: 'Documentos Legales',
          value: '',
          action: () => addToast('Próximamente', 'info'),
          type: 'button' as const },
      ] },
  ];

  return (
    <View style={[styles.container, { backgroundColor: t.colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + t.spacing.xl }]}>
        <Text style={[t.typography.display, { color: t.colors.text }]}>Ajustes</Text>
        <Text style={[t.typography.small, { color: t.colors.textMuted, marginTop: 2, marginBottom: 6 }]}>
          Preferencias, respaldos y datos de la app
        </Text>

        {sections.map((section, idx) => (
          <Card key={idx}>
            <CardHeader
              title={section.title}
              action={<Ionicons name={section.icon as any} size={18} color={t.colors.textSubtle} />}
            />
            <CardContent>
              {section.items.map((item, itemIdx) => {
                const esInfo = item.type === 'info';
                const ultimo = itemIdx === section.items.length - 1;
                return (
                  <Pressable
                    key={itemIdx}
                    onPress={esInfo ? undefined : item.action}
                    disabled={esInfo}
                    accessibilityRole={esInfo ? 'text' : 'button'}
                    accessibilityLabel={
                      item.value ? `${item.label}, ${item.value}` : item.label
                    }
                    android_ripple={esInfo ? undefined : { color: t.colors.surfaceAlt }}
                    style={[
                      styles.itemRow,
                      {
                        borderBottomWidth: ultimo ? 0 : 1,
                        borderBottomColor: t.colors.border,
                        opacity: esInfo ? 0.65 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text
                        style={[
                          t.typography.body,
                          { color: item.type === 'danger' ? t.colors.danger : t.colors.text },
                        ]}
                      >
                        {item.label}
                      </Text>
                      {item.value ? (
                        <Text style={[t.typography.caption, { color: t.colors.textMuted }]}>
                          {item.value}
                        </Text>
                      ) : null}
                    </View>

                    {item.type === 'switch' ? (
                      <Switch
                        value={item.switchValue}
                        onValueChange={item.action}
                        trackColor={{ false: t.colors.borderStrong, true: t.colors.primary }}
                        thumbColor={t.colors.surface}
                        accessibilityLabel={item.label}
                      />
                    ) : null}

                    {item.type === 'danger' ? (
                      <Ionicons name="trash-outline" size={18} color={t.colors.danger} />
                    ) : item.type === 'info' ? null : (
                      <Ionicons name="chevron-forward" size={18} color={t.colors.textSubtle} />
                    )}
                  </Pressable>
                );
              })}
            </CardContent>
          </Card>
        ))}

        <Text style={[t.typography.caption, { color: t.colors.textSubtle, textAlign: 'center', paddingVertical: 12 }]}>
          Personal Trainer v1.0.0
        </Text>
      </ScrollView>

      {ocupado && (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.overlay }]}>
          <View
            style={[
              styles.overlayBox,
              { backgroundColor: t.colors.surface, borderColor: t.colors.border },
              t.shadow(3),
            ]}
          >
            <Ionicons name="sync" size={28} color={t.colors.primary} />
            <Text style={[t.typography.small, { color: t.colors.text }]}>{ocupado}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 100 },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8 },
  sectionCard: { borderWidth: 1, borderColor: '#e2e8f0' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13 },
  itemLeft: { flex: 1 },
  itemLabel: {
    fontSize: 16,
    color: '#0f172a'
  },
  itemValue: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center' },
  overlayBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12 },
  overlayText: { fontSize: 14, color: '#0f172a'} });
