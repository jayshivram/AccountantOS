import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { INITIAL_CLIENTS, INITIAL_TAX_RETURNS, INITIAL_TASKS } from '../data/initialData.js';
import { saveState, loadState, uuid, getUpcomingDeadlines, checkAndNotify, getLastSyncTs, setLastSyncTs } from '../utils/index.js';
import { supabase } from '../lib/supabase.js';

// The shared row ID for team-wide cancellations (all users read/write this)
const TEAM_ROW_ID = 'team_cancellations';

// ─── Initial State ─────────────────────────────────────────────────────────────

function getInitialState() {
  const saved = loadState();
  if (saved) {
    return {
      ...saved,
      tallyProgress: saved.tallyProgress || [],
      cancellations: saved.cancellations  || [],
      currentView:   'dashboard',
      currentMonth:  new Date().getFullYear() * 100 + new Date().getMonth(),
    };
  }
  return {
    clients:       INITIAL_CLIENTS,
    taxReturns:    INITIAL_TAX_RETURNS,
    tasks:         INITIAL_TASKS,
    tallyProgress: [],
    cancellations: [],
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
    case 'TOGGLE_CLIENT_HIDDEN':
      return { ...state, clients: state.clients.map(c => c.id === action.payload ? { ...c, hidden: !c.hidden } : c) };
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
      const { currentView, currentMonth, cancellations: _c, ...rest } = action.payload;
      // Never overwrite cancellations with a personal backup; they're managed separately.
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

    // ── Cancellations (team-shared, synced to the TEAM_ROW_ID row) ──
    case 'ADD_CANCELLATION':
      return {
        ...state,
        cancellations: [
          ...state.cancellations,
          {
            id:          uuid(),
            status:      'pending',
            createdAt:   new Date().toISOString(),
            completedAt: null,
            completedBy: null,
            ...action.payload,
          },
        ],
      };
    case 'COMPLETE_CANCELLATION':
      return {
        ...state,
        cancellations: state.cancellations.map(c =>
          c.id === action.payload.id
            ? { ...c, status: 'completed', completedAt: new Date().toISOString(), completedBy: action.payload.completedBy }
            : c
        ),
      };
    case 'REOPEN_CANCELLATION':
      return {
        ...state,
        cancellations: state.cancellations.map(c =>
          c.id === action.payload
            ? { ...c, status: 'pending', completedAt: null, completedBy: null }
            : c
        ),
      };
    case 'DELETE_CANCELLATION':
      return { ...state, cancellations: state.cancellations.filter(c => c.id !== action.payload) };

    // Fires when a remote real-time update arrives for the team cancellations row
    case 'SYNC_CANCELLATIONS':
      return { ...state, cancellations: action.payload || [] };

    default:
      return state;
  }
}

const AppContext  = createContext(null);
const SyncContext = createContext(null);

/**
 * AppProvider now accepts `userId` and `userEmail` props set by the auth layer
 * in App.jsx. Each user's personal data is synced to an `app_state` row keyed
 * by their user ID. Cancellations are synced to the shared `team_cancellations` row.
 */
export function AppProvider({ userId, userEmail, children }) {
  const [state, dispatch]           = useReducer(reducer, undefined, getInitialState);
  const [syncStatus, setSyncStatus] = useState('idle');

  // ── Personal sync refs ──────────────────────────────────────────────────────
  const pushTimerRef   = useRef(null);
  const skipPushRef    = useRef(false);
  const isPullingRef   = useRef(true);

  // ── Cancellations sync refs ─────────────────────────────────────────────────
  const cancPushTimer    = useRef(null);
  const skipCancPushRef  = useRef(false);
  const isCancPullingRef = useRef(true);

  const stateRef = useRef(state);

  // ── Apply dark mode ──
  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.darkMode);
  }, [state.darkMode]);

  // ── Keep stateRef current ──
  useEffect(() => { stateRef.current = state; }, [state]);

  // ── Pull personal data (reusable) ───────────────────────────────────────────
  const pullPersonalData = useCallback(async () => {
    isPullingRef.current = true;
    setSyncStatus('syncing');
    try {
      const { data: rows, error } = await supabase
        .from('app_state')
        .select('data, updated_at')
        .eq('id', userId)
        .single();

      if (!error && rows?.data) {
        const lastSync      = getLastSyncTs();
        const remoteUpdated = new Date(rows.updated_at).getTime();
        
        // Always import if remote is newer, OR if we don't have a reliable lastSync recorded
        if (remoteUpdated > lastSync) {
          skipPushRef.current = true;
          dispatch({ type: 'IMPORT_DATA', payload: rows.data });
          setLastSyncTs(remoteUpdated);
          checkAndNotify(rows.data, getUpcomingDeadlines(365));
        } else {
          checkAndNotify(stateRef.current, getUpcomingDeadlines(365));
        }
      } else {
        checkAndNotify(stateRef.current, getUpcomingDeadlines(365));
      }
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    } finally {
      isPullingRef.current = false;
    }
  }, [userId]);

  // ── Push personal data to Supabase (row keyed by userId) ────────────────────
  const pushPersonalData = useCallback(async (data) => {
    setSyncStatus('syncing');
    const updatedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('app_state')
        .upsert({ id: userId, data, updated_at: updatedAt });
      if (!error) setLastSyncTs(new Date(updatedAt).getTime());
      setSyncStatus(error ? 'error' : 'synced');
    } catch {
      setSyncStatus('error');
    }
  }, [userId]);

  // ── Push shared cancellations to Supabase (team row) ────────────────────────
  const pushCancellations = useCallback(async (cancellations) => {
    try {
      await supabase
        .from('app_state')
        .upsert({
          id:         TEAM_ROW_ID,
          data:       { cancellations },
          updated_at: new Date().toISOString(),
        });
    } catch { /* silent */ }
  }, []);

  // ── Manual Sync Trigger ──────────────────────────────────────────────────────
  const manualSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      // 1. Pull check
      const { data: rows, error } = await supabase.from('app_state').select('data, updated_at').eq('id', userId).single();
      if (!error && rows?.data) {
        const lastSync = getLastSyncTs();
        const remoteUpdated = new Date(rows.updated_at).getTime();
        // Always import if remote is newer
        if (remoteUpdated > lastSync) {
           skipPushRef.current = true;
           dispatch({ type: 'IMPORT_DATA', payload: rows.data });
           setLastSyncTs(remoteUpdated);
           setSyncStatus('synced');
           return;
        }
      }
      
      // 2. If we reach here, local is newer or equal. Push local to Supabase.
      const { currentView, currentMonth, cancellations, ...personalData } = stateRef.current;
      await pushPersonalData(personalData);
      await pushCancellations(cancellations);
      
      // Force pull again just to ensure UI reflects 'synced' and everything is green
      pullPersonalData();
    } catch {
       setSyncStatus('error');
    }
  }, [userId, pushPersonalData, pushCancellations, pullPersonalData]);

  // ── Persist to localStorage + schedule personal Supabase push ───────────────
  useEffect(() => {
    const { currentView, currentMonth, ...persisted } = state;
    saveState(persisted);

    const { cancellations: _c, ...personalData } = persisted;

    clearTimeout(pushTimerRef.current);
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    if (isPullingRef.current) return;
    pushTimerRef.current = setTimeout(() => pushPersonalData(personalData), 1500);
  }, [state, pushPersonalData]);

  // ── Schedule cancellations push when they change ─────────────────────────────
  useEffect(() => {
    clearTimeout(cancPushTimer.current);
    if (skipCancPushRef.current) { skipCancPushRef.current = false; return; }
    if (isCancPullingRef.current) return;
    cancPushTimer.current = setTimeout(() => pushCancellations(state.cancellations), 1500);
  }, [state.cancellations, pushCancellations]);

  // ── Immediate push when tab is hidden ────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(pushTimerRef.current);
        clearTimeout(cancPushTimer.current);
        const { currentView, currentMonth, cancellations, ...personalData } = stateRef.current;
        pushPersonalData(personalData);
        pushCancellations(cancellations);
      } else if (document.visibilityState === 'visible') {
        pullPersonalData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pushPersonalData, pushCancellations, pullPersonalData]);

  // ── On mount: pull personal data + real-time subscribe ──────────────────────
  useEffect(() => {
    pullPersonalData();

    const personalChannel = supabase
      .channel(`personal_sync_${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `id=eq.${userId}` },
        (payload) => {
          if (payload.new?.data) {
            skipPushRef.current = true;
            dispatch({ type: 'IMPORT_DATA', payload: payload.new.data });
            setLastSyncTs(Date.now());
            setSyncStatus('synced');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(personalChannel); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: pull shared cancellations + real-time subscribe ────────────────
  useEffect(() => {
    async function pullCancellations() {
      try {
        const { data: rows, error } = await supabase
          .from('app_state')
          .select('data')
          .eq('id', TEAM_ROW_ID)
          .single();

        if (!error && rows?.data?.cancellations !== undefined) {
          skipCancPushRef.current = true;
          dispatch({ type: 'SYNC_CANCELLATIONS', payload: rows.data.cancellations });
        }
      } catch { /* silent */ } finally {
        isCancPullingRef.current = false;
      }
    }

    pullCancellations();

    const teamChannel = supabase
      .channel('team_cancellations_sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_state', filter: `id=eq.${TEAM_ROW_ID}` },
        (payload) => {
          if (payload.new?.data?.cancellations !== undefined) {
            skipCancPushRef.current = true;
            dispatch({ type: 'SYNC_CANCELLATIONS', payload: payload.new.data.cancellations });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(teamChannel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider value={syncStatus}>
      <AppContext.Provider value={{ state, dispatch, userId, userEmail, manualSync }}>
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

/** Returns all cancellations sorted newest-first. */
export function useCancellations() {
  const { state } = useApp();
  return [...state.cancellations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

