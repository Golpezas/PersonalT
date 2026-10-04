/**
 * Zustand Stores - Global State Management
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Cliente, FichaInicial, CheckinSemanal, RutinaSemanal, Ejercicio, Meta, EntrenamientoRealizado, Perimetros, FotosProgreso } from '@/types';

// ============================================
// UI STORE (Theme, Modals, Loading)
// ============================================
interface UIState {
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>;
  addToast: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      isLoading: false,
      setLoading: (loading) => set({ isLoading: loading }),
      toasts: [],
      addToast: (message, type = 'info') => {
        const id = Date.now().toString();
        set({ toasts: [...get().toasts, { id, message, type }] });
        setTimeout(() => get().removeToast(id), 4000);
      },
      removeToast: (id) => set({ toasts: get().toasts.filter(t => t.id !== id) }) }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ theme: state.theme }) }
  )
);

// ============================================
// CLIENTES STORE
// ============================================
interface ClientesState {
  clientes: Cliente[];
  selectedClienteId: string | null;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setClientes: (clientes: Cliente[]) => void;
  addCliente: (cliente: Cliente) => void;
  updateCliente: (id: string, data: Partial<Cliente>) => void;
  deleteCliente: (id: string) => void;
  selectCliente: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearAll: () => void;
  
  // Computed
  getSelectedCliente: () => Cliente | undefined;
  getFilteredClientes: () => Cliente[];
}

export const useClientesStore = create<ClientesState>()(
  persist(
    (set, get) => ({
      clientes: [],
      selectedClienteId: null,
      searchQuery: '',
      isLoading: false,
      error: null,
      
      setClientes: (clientes) => set({ clientes }),
      addCliente: (cliente) => set({ clientes: [cliente, ...get().clientes] }),
      updateCliente: (id, data) => set({
        clientes: get().clientes.map(c => c.id === id ? { ...c, ...data, actualizadoEn: new Date().toISOString() } : c)
      }),
      deleteCliente: (id) => set({
        clientes: get().clientes.filter(c => c.id !== id),
        selectedClienteId: get().selectedClienteId === id ? null : get().selectedClienteId }),
      selectCliente: (id) => set({ selectedClienteId: id }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      clearAll: () => set({ clientes: [], selectedClienteId: null, searchQuery: '' }),
      
      getSelectedCliente: () => get().clientes.find(c => c.id === get().selectedClienteId),
      getFilteredClientes: () => {
        const { clientes, searchQuery } = get();
        if (!searchQuery.trim()) return clientes;
        const q = searchQuery.toLowerCase();
        return clientes.filter(c => 
          c.nombre.toLowerCase().includes(q) ||
          c.apellido.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
        );
      } }),
    {
      name: 'clientes-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ selectedClienteId: state.selectedClienteId }) }
  )
);

// ============================================
// FICHAS & CHECK-INS STORE
// ============================================
interface ProgresoState {
  fichas: Record<string, FichaInicial>; // clienteId -> ficha
  checkins: Record<string, CheckinSemanal[]>; // clienteId -> checkins[],
  metas: Record<string, Meta[]>; // clienteId -> metas[],
  
  setFicha: (clienteId: string, ficha: FichaInicial) => void;
  getFicha: (clienteId: string) => FichaInicial | undefined;
  addCheckin: (clienteId: string, checkin: CheckinSemanal) => void;
  updateCheckin: (clienteId: string, checkinId: string, data: Partial<CheckinSemanal>) => void;
  deleteCheckin: (clienteId: string, checkinId: string) => void;
  getCheckins: (clienteId: string) => CheckinSemanal[];
  getLatestCheckin: (clienteId: string) => CheckinSemanal | undefined;
  setMetas: (clienteId: string, metas: Meta[]) => void;
  addMeta: (clienteId: string, meta: Meta) => void;
  updateMeta: (clienteId: string, metaId: string, data: Partial<Meta>) => void;
  deleteMeta: (clienteId: string, metaId: string) => void;
  getMetas: (clienteId: string) => Meta[];
  getActiveMetas: (clienteId: string) => Meta[];
  
  // Computed deltas
  calculateDeltas: (clienteId: string) => {
    peso: number;
    grasaCorporal?: number;
    musculatura?: number;
    perimetros: Partial<Record<keyof Perimetros, number>>;
  } | null;
}

export const useProgresoStore = create<ProgresoState>((set, get) => ({
  fichas: {},
  checkins: {},
  metas: {},
  
  setFicha: (clienteId, ficha) => set({ fichas: { ...get().fichas, [clienteId]: ficha } }),
  getFicha: (clienteId) => get().fichas[clienteId],
  
  addCheckin: (clienteId, checkin) => set({
    checkins: {
      ...get().checkins,
      [clienteId]: [...(get().checkins[clienteId] || []), checkin].sort((a, b) => a.semana - b.semana)
    }
  }),
  updateCheckin: (clienteId, checkinId, data) => set({
    checkins: {
      ...get().checkins,
      [clienteId]: (get().checkins[clienteId] || []).map(c => 
        c.id === checkinId ? { ...c, ...data } : c
      )
    }
  }),
  deleteCheckin: (clienteId, checkinId) => set({
    checkins: {
      ...get().checkins,
      [clienteId]: (get().checkins[clienteId] || []).filter(c => c.id !== checkinId)
    }
  }),
  getCheckins: (clienteId) => get().checkins[clienteId] || [],
  getLatestCheckin: (clienteId) => {
    const checks = get().checkins[clienteId] || [];
    return checks.length > 0 ? checks[checks.length - 1] : undefined;
  },
  
  setMetas: (clienteId, metas) => set({ metas: { ...get().metas, [clienteId]: metas } }),
  addMeta: (clienteId, meta) => set({
    metas: { ...get().metas, [clienteId]: [...(get().metas[clienteId] || []), meta] }
  }),
  updateMeta: (clienteId, metaId, data) => set({
    metas: {
      ...get().metas,
      [clienteId]: (get().metas[clienteId] || []).map(m => m.id === metaId ? { ...m, ...data } : m)
    }
  }),
  deleteMeta: (clienteId, metaId) => set({
    metas: {
      ...get().metas,
      [clienteId]: (get().metas[clienteId] || []).filter(m => m.id !== metaId)
    }
  }),
  getMetas: (clienteId) => get().metas[clienteId] || [],
  getActiveMetas: (clienteId) => (get().metas[clienteId] || []).filter(m => m.estado === 'activa'),
  
  calculateDeltas: (clienteId) => {
    const ficha = get().fichas[clienteId];
    const latest = get().getLatestCheckin(clienteId);
    if (!ficha || !latest) return null;
    
    const perimetrosDelta: Partial<Record<keyof Perimetros, number>> = {};
    (Object.keys(ficha.perimetros) as Array<keyof Perimetros>).forEach(key => {
      perimetrosDelta[key] = Number((latest.perimetros[key] - ficha.perimetros[key]).toFixed(1));
    });
    
    return {
      peso: Number((latest.peso - ficha.peso).toFixed(1)),
      grasaCorporal: latest.grasaCorporal && ficha.grasaCorporal 
        ? Number((latest.grasaCorporal - ficha.grasaCorporal).toFixed(1)) 
        : undefined,
      musculatura: latest.musculatura && ficha.musculatura
        ? Number((latest.musculatura - ficha.musculatura).toFixed(1))
        : undefined,
      perimetros: perimetrosDelta };
  } }));

// ============================================
// RUTINAS STORE
// ============================================
interface RutinasState {
  ejercicios: Ejercicio[];
  rutinaActual: RutinaSemanal | null; // Being edited
  rutinasPorCliente: Record<string, RutinaSemanal[]>; // clienteId -> rutinas[]
  
  // Catálogo
  setEjercicios: (ejercicios: Ejercicio[]) => void;
  addEjercicio: (ejercicio: Ejercicio) => void;
  updateEjercicio: (id: string, data: Partial<Ejercicio>) => void;
  deleteEjercicio: (id: string) => void;
  getEjerciciosByGrupo: (grupo: string) => Ejercicio[];
  searchEjercicios: (query: string) => Ejercicio[];
  
  // Editor
  setRutinaActual: (rutina: RutinaSemanal | null) => void;
  updateRutinaActual: (data: Partial<RutinaSemanal>) => void;
  addDiaToRutinaActual: (dia: any) => void;
  removeDiaFromRutinaActual: (diaId: string) => void;
  reorderDias: (dias: any[]) => void;
  addEjercicioToDia: (diaId: string, ejercicio: any) => void;
  removeEjercicioFromDia: (diaId: string, ejercicioId: string) => void;
  reorderEjerciciosInDia: (diaId: string, ejercicios: any[]) => void;
  
  // Persisted
  saveRutina: (clienteId: string, rutina: RutinaSemanal) => void;
  getRutinasByCliente: (clienteId: string) => RutinaSemanal[];
  getRutinaById: (clienteId: string, rutinaId: string) => RutinaSemanal | undefined;
  deleteRutina: (clienteId: string, rutinaId: string) => void;
  setRutinasForCliente: (clienteId: string, rutinas: RutinaSemanal[]) => void;
  
  clearRutinaActual: () => void;
}

export const useRutinasStore = create<RutinasState>()(
  persist(
    (set, get) => ({
      ejercicios: [],
      rutinaActual: null,
      rutinasPorCliente: {},
      
      // Catálogo
      setEjercicios: (ejercicios) => set({ ejercicios }),
      addEjercicio: (ejercicio) => set({ ejercicios: [...get().ejercicios, ejercicio] }),
      updateEjercicio: (id, data) => set({
        ejercicios: get().ejercicios.map(e => e.id === id ? { ...e, ...data } : e)
      }),
      deleteEjercicio: (id) => set({ ejercicios: get().ejercicios.filter(e => e.id !== id) }),
      getEjerciciosByGrupo: (grupo) => get().ejercicios.filter(e => e.grupoMuscular === grupo),
      searchEjercicios: (query) => {
        const q = query.toLowerCase();
        return get().ejercicios.filter(e => 
          e.nombre.toLowerCase().includes(q) ||
          e.grupoMuscular.toLowerCase().includes(q) ||
          e.patron.toLowerCase().includes(q)
        );
      },
      
      // Editor
      setRutinaActual: (rutina) => set({ rutinaActual: rutina }),
      updateRutinaActual: (data) => set({ 
        rutinaActual: get().rutinaActual ? { ...get().rutinaActual!, ...data, actualizadoEn: new Date().toISOString() } : null 
      }),
      addDiaToRutinaActual: (dia) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: [...get().rutinaActual!.dias, dia].sort((a, b) => a.orden - b.orden),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      removeDiaFromRutinaActual: (diaId) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: get().rutinaActual!.dias.filter(d => d.id !== diaId),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      reorderDias: (dias) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: dias.map((d, i) => ({ ...d, orden: i + 1 })),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      addEjercicioToDia: (diaId, ejercicio) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: get().rutinaActual!.dias.map(d => 
            d.id === diaId ? { ...d, ejercicios: [...d.ejercicios, ejercicio] } : d
          ),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      removeEjercicioFromDia: (diaId, ejercicioId) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: get().rutinaActual!.dias.map(d => 
            d.id === diaId ? { ...d, ejercicios: d.ejercicios.filter(e => e.id !== ejercicioId) } : d
          ),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      reorderEjerciciosInDia: (diaId, ejercicios) => set({
        rutinaActual: get().rutinaActual ? {
          ...get().rutinaActual!,
          dias: get().rutinaActual!.dias.map(d => 
            d.id === diaId ? { ...d, ejercicios: ejercicios.map((e, i) => ({ ...e, orden: i + 1 })) } : d
          ),
          actualizadoEn: new Date().toISOString()
        } : null
      }),
      
      // Persisted
      saveRutina: (clienteId, rutina) => set({
        rutinasPorCliente: {
          ...get().rutinasPorCliente,
          [clienteId]: [...(get().rutinasPorCliente[clienteId] || []).filter(r => r.id !== rutina.id), rutina]
            .sort((a, b) => b.mesociclo - a.mesociclo || b.semanaInicio - a.semanaInicio)
        }
      }),
      getRutinasByCliente: (clienteId) => get().rutinasPorCliente[clienteId] || [],
      getRutinaById: (clienteId, rutinaId) => get().rutinasPorCliente[clienteId]?.find(r => r.id === rutinaId),
      deleteRutina: (clienteId, rutinaId) => set({
        rutinasPorCliente: {
          ...get().rutinasPorCliente,
          [clienteId]: (get().rutinasPorCliente[clienteId] || []).filter(r => r.id !== rutinaId)
        }
      }),
      setRutinasForCliente: (clienteId, rutinas) => set({
        rutinasPorCliente: { ...get().rutinasPorCliente, [clienteId]: rutinas }
      }),
      
      clearRutinaActual: () => set({ rutinaActual: null }) }),
    {
      name: 'rutinas-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        ejercicios: state.ejercicios,
        rutinasPorCliente: state.rutinasPorCliente }) }
  )
);

// ============================================
// ENTRENAMIENTOS STORE (Logs)
// ============================================
interface EntrenamientosState {
  entrenamientos: Record<string, EntrenamientoRealizado[]>; // clienteId -> logs[],
  entrenamientoActivo: EntrenamientoRealizado | null; // Currently logging
  
  addEntrenamiento: (clienteId: string, entrenamiento: EntrenamientoRealizado) => void;
  getEntrenamientos: (clienteId: string) => EntrenamientoRealizado[];
  getEntrenamientosByRutina: (clienteId: string, rutinaId: string) => EntrenamientoRealizado[];
  getEntrenamientosByEjercicio: (clienteId: string, ejercicioRutinaId: string) => EntrenamientoRealizado[];
  setEntrenamientoActivo: (entrenamiento: EntrenamientoRealizado | null) => void;
  updateEntrenamientoActivo: (data: Partial<EntrenamientoRealizado>) => void;
  addSerieToActivo: (ejercicioRutinaId: string, serie: any) => void;
}

export const useEntrenamientosStore = create<EntrenamientosState>()(
  persist(
    (set, get) => ({
      entrenamientos: {},
      entrenamientoActivo: null,
      
      addEntrenamiento: (clienteId, entrenamiento) => set({
        entrenamientos: {
          ...get().entrenamientos,
          [clienteId]: [...(get().entrenamientos[clienteId] || []), entrenamiento]
            .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
        }
      }),
      getEntrenamientos: (clienteId) => get().entrenamientos[clienteId] || [],
      getEntrenamientosByRutina: (clienteId, rutinaId) => 
        (get().entrenamientos[clienteId] || []).filter(e => e.rutinaSemanalId === rutinaId),
      getEntrenamientosByEjercicio: (clienteId, ejercicioRutinaId) =>
        (get().entrenamientos[clienteId] || []).flatMap(e => 
          e.ejercicios.filter(ej => ej.ejercicioRutinaId === ejercicioRutinaId).map(ej => ({ ...ej, fecha: e.fecha, id: e.id, clienteId: e.clienteId, rutinaSemanalId: e.rutinaSemanalId, diaRutinaId: e.diaRutinaId, duracionMin: e.duracionMin, rpeGlobal: e.rpeGlobal, notas: e.notas, ejercicios: [ej] }))
        ),
      setEntrenamientoActivo: (entrenamiento) => set({ entrenamientoActivo: entrenamiento }),
      updateEntrenamientoActivo: (data) => set({
        entrenamientoActivo: get().entrenamientoActivo ? { ...get().entrenamientoActivo!, ...data } : null
      }),
      addSerieToActivo: (ejercicioRutinaId, serie) => set({
        entrenamientoActivo: get().entrenamientoActivo ? {
          ...get().entrenamientoActivo!,
          ejercicios: get().entrenamientoActivo!.ejercicios.map(ej => 
            ej.ejercicioRutinaId === ejercicioRutinaId 
              ? { ...ej, series: [...ej.series, serie] }
              : ej
          )
        } : null
      }) }),
    {
      name: 'entrenamientos-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entrenamientos: state.entrenamientos }) }
  )
);

// ============================================
// HOOKS DE CONVENIENCIA
// ============================================
export const useSelectedCliente = () => useClientesStore(state => state.getSelectedCliente());
export const useClientesList = () => useClientesStore(state => state.getFilteredClientes());
export const useTheme = () => useUIStore(state => state.theme);
export const useToasts = () => useUIStore(state => state.toasts);
export const useAddToast = () => useUIStore(state => state.addToast);