import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { INITIAL_CLIENTS, INITIAL_TAX_RETURNS, INITIAL_TASKS } from '../data/initialData.js';
import { saveState, loadState, uuid } from '../utils/index.js';
import { supabase, SYNC_ROW_ID } from '../lib/supabase.js';

// ─── Initial State ─────────────────────────────────────────────────────────────

function getInitialState() {
  const saved = loadState();
  if (saved) {
    return {
      ...saved,
      tallyProgress: saved.tallyProgress || [],
      currentView: 'dashboard',
      currentMonth: new Date().getFullYear() * 100 + new Date().getMonth(),
    };
  }
  return {
    clients:       INITIAL_CLIENTS,
    taxReturns:    INITIAL_TAX_RETURNS,
    tasks:         INITIAL_TASKS,
    tallyProgress: [],
    darkMode:      true,
    notifications: false,
    currentView:   'dashboard',
    currentMonth:  new Date().getFullYear() * 100 + new Date().getMonth(),
  };
}

// ─── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    // ── Navigation ──
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'SET_MONTH':
      return { ...state, currentMonth: action.payload };

    // ── Settings ──
    case 'TOGGLE_DARK_MODE':
      return { ...state, darkMode: !state.darkMode };
    case 'TOGGLE_NOTIFICATIONS':
      return { ...state, notifications: !state.notifications };

    // ── Clients ──
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, { ...action.payload, id: uuid() }] };
    case 'EDIT_CLIENT':
      return { ...state, clients: state.clients.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients:    state.clients.filter(c => c.id !== action.payload),
        taxReturns: state.taxReturns.filter(tr => tr.clientId !== action.payload),
        tasks:      state.tasks.filter(t => t.clientId !== action.payload),
      };

    // ── Tax Returns ──
    case 'ADD_TAX_RETURN':
      return { ...state, taxReturns: [...state.taxReturns, { ...action.payload, id: action.payload.id || uuid() }] };
    case 'UPDATE_TAX_RETURN':
      return { ...state, taxReturns: state.taxReturns.map(tr => tr.id === action.payload.id ? action.payload : tr) };
    case 'DELETE_TAX_RETURN':
      return { ...state, taxReturns: state.taxReturns.filter(tr => tr.id !== action.payload) };

    // Upsert: create or update by (clientId + taxType + period)
    case 'UPSERT_TAX_RETURN': {
      const { clientId, taxType, period } = action.payload;
      const existingIndex = state.taxReturns.findIndex(
        tr => tr.clientId === clientId && tr.taxType === taxType && tr.period === period
      );
      if (existingIndex >= 0) {
        const updated = [...state.taxReturns];
        updated[existingIndex] = { ...updated[existingIndex], ...action.payload };
        return { ...state, taxReturns: updated };
      }
      return { ...state, taxReturns: [...state.taxReturns, { id: uuid(), ...action.payload }] };
    }

    // ── Tasks ──
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, { ...action.payload, id: uuid(), createdAt: new Date().toISOString() }] };
    case 'EDIT_TASK':
      return { ...state, tasks: state.tasks.map(t => t.id === action.payload.id ? action.payload : t) };
    case 'DELETE_TASK':
      return { ...state, tasks: state.tasks.filter(t => t.id !== action.payload) };
    case 'COMPLETE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload
            ? { ...t, status: 'completed', completedAt: new Date().toISOString() }
            : t
        ),
      };
    case 'REOPEN_TASK':
      return {
        ...state,
        tasks: state.tasks.map(t =>
          t.id === action.payload
            ? { ...t, status: 'pending', completedAt: null }
            : t
        ),
      };

    // ── Import ──
    case 'IMPORT_DATA': {
      const { currentView, currentMonth, ...rest } = action.payload;
      return { ...state, ...rest, tallyProgress: rest.tallyProgress || [] };
    }

    // ── Tally Progress ──
    case 'UPSERT_TALLY_PROGRESS': {
      const { clientId, year } = action.payload;
      const existingIndex = state.tallyProgress.findIndex(
        tp => tp.clientId === clientId && tp.year === year
      );
      if (existingIndex >= 0) {
        const updated = [...state.tallyProgress];
        updated[existingIndex] = { ...updated[existingIndex], ...action.payload };
        return { ...state, tallyProgress: updated };
      }
      return { ...state, tallyProgress: [...state.tallyProgress, { id: uuid(), ...action.payload }] };
    }
    case 'DELETE_TALLY_PROGRESS':
      return { ...state, tallyProgress: state.tallyProgress.filter(tp => tp.id !== action.payload) };

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AppContext  = createContext(null);
const SyncContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch]       = useReducer(reducer, undefined, getInitialState);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle'|'syncing'|'synced'|'error'
  const pushTimerRef   = useRef(null);
  const skipPushRef    = useRef(false); // true when a remote update just set state

  // ── Apply dark mode ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // ── Push to Supabase (debounced 1.5 s) ──
  const pushToSupabase = useCallback(async (data) => {
    setSyncStatus('syncing');
    try {
      const { error } = await supabase
        .from('app_state')
        .upsert({ id: SYNC_ROW_ID, data, updated_at: new Date().toISOString() });
      setSyncStatus(error ? 'error' : 'synced');
    } catch {
      setSyncStatus('error');
    }
  }, []);

  // ── Persist to localStorage + schedule Supabase push on every state change ──
  useEffect(() => {
    const { currentView, currentMonth, ...persisted } = state;
    saveState(persisted);

    if (skipPushRef.current) {
      skipPushRef.current = false;
      return;
    }
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => pushToSupabase(persisted), 1500);
  }, [state, pushToSupabase]);

  // ── On mount: pull from Supabase and start real-time subscription ──
  useEffect(() => {
    async function pullFromSupabase() {
      setSyncStatus('syncing');
      try {
        const { data: rows, error } = await supabase
          .from('app_state')
          .select('data, updated_at')
          .eq('id', SYNC_ROW_ID)
          .single();

        if (!error && rows?.data) {
          // Use remote data if it's newer than what's in localStorage
          const localRaw = localStorage.getItem('accountant-os-v1');
          const localUpdated = localRaw ? JSON.parse(localRaw)?._syncedAt || 0 : 0;
          const remoteUpdated = new Date(rows.updated_at).getTime();

          if (remoteUpdated > localUpdated) {
            skipPushRef.current = true;
            dispatch({ type: 'IMPORT_DATA', payload: rows.data });
          }
        }
        setSyncStatus('synced');
      } catch {
        setSyncStatus('error');
      }
    }

    pullFromSupabase();

    // Real-time: when another device saves, update this device
    const channel = supabase
      .channel('app_state_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `id=eq.${SYNC_ROW_ID}` },
        (payload) => {
          if (payload.new?.data) {
            skipPushRef.current = true;
            dispatch({ type: 'IMPORT_DATA', payload: payload.new.data });
            setSyncStatus('synced');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider value={syncStatus}>
      <AppContext.Provider value={{ state, dispatch }}>
        {children}
      </AppContext.Provider>
    </SyncContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function useSyncStatus() {
  return useContext(SyncContext);
}

// ─── Selector Hooks ────────────────────────────────────────────────────────────

/** Returns all clients sorted by name. */
export function useClients() {
  const { state } = useApp();
  return [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns a single client by id. */
export function useClient(id) {
  const { state } = useApp();
  return state.clients.find(c => c.id === id);
}

/** Returns tax returns for a given client (optionally filtered by taxType/period). */
export function useClientTaxReturns(clientId, taxType, period) {
  const { state } = useApp();
  return state.taxReturns.filter(
    tr => tr.clientId === clientId
      && (taxType ? tr.taxType === taxType : true)
      && (period  ? tr.period  === period  : true)
  );
}

/** Get the tax return record for a specific client+type+period combination. */
export function useTaxReturnRecord(clientId, taxType, period) {
  const { state } = useApp();
  return state.taxReturns.find(
    tr => tr.clientId === clientId && tr.taxType === taxType && tr.period === period
  ) || null;
}

/** Returns all tasks sorted by due date. */
export function useTasks() {
  const { state } = useApp();
  return [...state.tasks].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });
}

/** Completion stats for a given taxType+period. */
export function useCompletionStats(taxType, period) {
  const { state } = useApp();
  const relevantClients = state.clients.filter(c => c.taxTypes.includes(taxType));
  const completedIds = new Set(
    state.taxReturns
      .filter(tr => tr.taxType === taxType && tr.period === period && tr.status === 'completed')
      .map(tr => tr.clientId)
  );
  return {
    total:    relevantClients.length,
    completed: completedIds.size,
    pending:  relevantClients.length - completedIds.size,
    clients:  relevantClients,
    completedClientIds: completedIds,
  };
}

/** Returns tally progress record for a specific client+year, or null. */
export function useTallyRecord(clientId, year) {
  const { state } = useApp();
  return state.tallyProgress.find(tp => tp.clientId === clientId && tp.year === year) || null;
}
