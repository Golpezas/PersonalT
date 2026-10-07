/**
 * Guard: no se puede diseñar una rutina sin ficha inicial completa.
 * Regla de negocio SPEC.md §1.9 — la ficha es la base paraPrescribir volumen/RPE.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useProgresoStore } from '@/stores';
import { leerFichaInicial } from '@/db/database';

/**
 * Devuelve si el cliente tiene ficha inicial, leyendo `fichas_iniciales` en
 * SQLite (fuente de verdad). Se relee al enfocar la pantalla y cuando el store
 * de sesión registra una ficha nueva.
 */
export function useGuardFicha(clienteId: string | null, autoRedirect = true) {
  const fichaSesion = useProgresoStore((s) => (clienteId ? s.fichas[clienteId] : undefined));
  const [focusTick, setFocusTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setFocusTick((v) => v + 1);
    }, [])
  );

  const ficha = useMemo(
    () => (clienteId ? leerFichaInicial(clienteId) ?? fichaSesion ?? null : null),
    // `focusTick` fuerza la relectura de SQLite al volver a la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clienteId, fichaSesion, focusTick]
  );
  const tieneFicha = !!clienteId && !!ficha;

  const evaluadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (tieneFicha || !autoRedirect || !clienteId || evaluadoPara.current === clienteId) return;
    evaluadoPara.current = clienteId;
    Alert.alert(
      'Falta la ficha inicial',
      'Para diseñar una rutina necesitamos la ficha inicial del cliente (antropometría, perímetros y objetivos).',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Crear ficha',
          onPress: () => router.replace(`/clientes/${clienteId}/ficha/nueva`) },
      ],
      { cancelable: false }
    );
  }, [tieneFicha, autoRedirect, clienteId]);

  return { tieneFicha, ficha: ficha ?? undefined };
}
