/**
 * useMetas — lee las metas de SQLite y calcula su avance contra la última
 * medición disponible (ficha + check-in + logs de entrenamiento).
 *
 * Todo se lee de SQLite (fuente de verdad); los stores de Zustand no se
 * hidratan desde la base, así que no sirven como origen. Se relee al enfocar
 * la pantalla; para forzar la relectura tras una mutación, llamar `reload()`.
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useProgresoStore } from '@/stores';
import { estimate1RM } from '@/utils/helpers';
import { leerFichaInicial, leerCheckins, leerEntrenamientos } from '@/db/database';
import { leerMetas, calcularProgresoMeta, type ContextoProgreso, type ProgresoMeta } from '@/services/metas';
import type { Meta } from '@/types';

export interface MetaConProgreso {
  meta: Meta;
  progreso: ProgresoMeta;
}

export function useMetas(clienteId: string | null) {
  const setMetas = useProgresoStore((s) => s.setMetas);

  // Bump para forzar la relectura tras una mutación o al volver a la pantalla.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useFocusEffect(reload);

  /* eslint-disable react-hooks/exhaustive-deps -- `version` fuerza la relectura de SQLite */
  const datos = useMemo(() => {
    if (!clienteId) return { ficha: null, checkin: undefined, logs: [], metas: [] as Meta[] };
    const checkins = leerCheckins(clienteId);
    return {
      ficha: leerFichaInicial(clienteId),
      checkin: checkins.length > 0 ? checkins[checkins.length - 1] : undefined,
      logs: leerEntrenamientos(clienteId),
      metas: leerMetas(clienteId),
    };
  }, [clienteId, version]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const { ficha, checkin, logs, metas } = datos;

  const ctx: ContextoProgreso = useMemo(() => {
    const perimetrosBase: Record<string, number> = {};
    const p = (checkin?.perimetros ?? ficha?.perimetros) as unknown as Record<string, number> | undefined;
    if (p) {
      perimetrosBase.pecho = Number(p.pecho) || 0;
      perimetrosBase.cintura = Number(p.cintura) || 0;
      perimetrosBase.cadera = Number(p.cadera) || 0;
      perimetrosBase.brazo = ((Number(p.brazoIzq) || 0) + (Number(p.brazoDer) || 0)) / 2;
      perimetrosBase.antebrazo = ((Number(p.antebrazoIzq) || 0) + (Number(p.antebrazoDer) || 0)) / 2;
      perimetrosBase.pierna = ((Number(p.piernaIzq) || 0) + (Number(p.piernaDer) || 0)) / 2;
      perimetrosBase.pantorrilla = ((Number(p.pantorrillaIzq) || 0) + (Number(p.pantorrillaDer) || 0)) / 2;
    }

    let mejor1RM = 0;
    for (const e of logs) {
      for (const ej of e.ejercicios ?? []) {
        for (const s of ej.series ?? []) {
          if (s.completada && s.peso > 0) mejor1RM = Math.max(mejor1RM, estimate1RM(s.peso, s.repeticiones));
        }
      }
    }

    return {
      peso: checkin?.peso ?? ficha?.peso,
      grasaCorporal: checkin?.grasaCorporal ?? ficha?.grasaCorporal,
      musculatura: checkin?.musculatura ?? ficha?.musculatura,
      fuerza: mejor1RM > 0 ? Math.round(mejor1RM) : undefined,
      perimetros: perimetrosBase };
  }, [ficha, checkin, logs]);

  const conProgreso = useMemo<MetaConProgreso[]>(
    () => metas.map((meta) => ({ meta, progreso: calcularProgresoMeta(meta, ctx) })),
    [metas, ctx]
  );

  /** Refleja las metas de SQLite en el store (cache de sesión). */
  const sincronizarStore = useCallback(() => {
    if (clienteId) setMetas(clienteId, metas);
  }, [clienteId, metas, setMetas]);

  return { metas, conProgreso, ctx, reload, sincronizarStore };
}
