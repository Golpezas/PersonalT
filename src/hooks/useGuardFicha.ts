/**
 * Guard: no se puede diseñar una rutina sin ficha inicial completa.
 * Regla de negocio SPEC.md §1.9 — la ficha es la base paraPrescribir volumen/RPE.
 */

import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { useProgresoStore } from '@/stores';

/**
 * Devuelve si el cliente tiene ficha inicial. `tieneFicha` es un valor derivado
 * (no estado) para evitar setState dentro de un efecto.
 */
export function useGuardFicha(clienteId: string | null, autoRedirect = true) {
  const ficha = useProgresoStore((s) => (clienteId ? s.fichas[clienteId] : undefined));
  const tieneFicha = !!clienteId && !!ficha;
  const yaEvaluado = useRef(false);

  useEffect(() => {
    if (tieneFicha || !autoRedirect || !clienteId || yaEvaluado.current) return;
    yaEvaluado.current = true;
    Alert.alert(
      'Falta la ficha inicial',
      'Para diseñar una rutina necesitamos la ficha inicial del cliente (antropometría, perímetros y objetivos).',
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => router.back() },
        {
          text: 'Crear ficha',
          onPress: () => router.replace(`/clientes/${clienteId}/ficha/nueva`) },
      ]
    );
  }, [tieneFicha, autoRedirect, clienteId]);

  return { tieneFicha, ficha };
}
