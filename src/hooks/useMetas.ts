/**
 * useMetas — lee las metas de SQLite y calcula su avance contra la última
 * medición disponible (ficha + check-in + logs de entrenamiento).
 *
 * Lecturas síncronas: op-sqlite es sync, así que no hace falta efecto de carga.
 * Para forzar un re-render tras crear/editar/borrar, llamar `reload()`.
 */

import { useCallback, useMemo, useState } from 'react';
import { useProgresoStore, useEntrenamientosStore } from '@/stores';
import { estimate1RM } from '@/utils/helpers';
import { leerMetas, calcularProgresoMeta, type ContextoProgreso, type ProgresoMeta } from '@/services/metas';
import type { Meta } from '@/types';

export interface MetaConProgreso {
  meta: Meta;
  progreso: ProgresoMeta;
}

export function useMetas(clienteId: string | null) {
  const getFicha = useProgresoStore((s) => s.getFicha);
  const getLatestCheckin = useProgresoStore((s) => s.getLatestCheckin);
  const getEntrenamientos = useEntrenamientosStore((s) => s.getEntrenamientos);
  const setMetas = useProgresoStore((s) => s.setMetas);

  // Bump para forzar la relectura tras una mutación.
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  const ficha = clienteId ? getFicha(clienteId) : undefined;
  const checkin = clienteId ? getLatestCheckin(clienteId) : undefined;
  const logs = useMemo(
    () => (clienteId ? getEntrenamientos(clienteId) : []),
    [clienteId, getEntrenamientos, version]
  );

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
      for (const ej of e.ejercicios) {
        for (const s of ej.series) {
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

  const metas = useMemo(() => (clienteId ? leerMetas(clienteId) : []), [clienteId, version]);

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