import React, { createContext, useContext, useReducer, useEffect, useRef, useState, useCallback } from 'react';
import { INITIAL_CLIENTS, INITIAL_TAX_RETURNS, INITIAL_TASKS, DEFAULT_TAX_RATES, DEFAULT_MONTHLY_TASKS } from '../data/initialData.js';
import { saveState, saveBackup, loadState, uuid, getUpcomingDeadlines, checkAndNotify, getLastSyncTs, setLastSyncTs } from '../utils/index.js';
import { supabase } from '../lib/supabase.js';

// ─── Initial State ─────────────────────────────────────────────────────────────

function getInitialState() {
  const saved = loadState();
  if (saved) {
    return {
      ...saved,
      tallyProgress:        saved.tallyProgress        || [],
      tallyEnrollments:     saved.tallyEnrollments      || [],
      tallyAdHoc:           saved.tallyAdHoc             || [],
      cancellations:        saved.cancellations         || [],
      notes:                saved.notes                 || [],
      pastebins:            saved.pastebins             || [],
      documents:            saved.documents             || [],
      workingHours:         saved.workingHours          || {},
      hourFormat:           saved.hourFormat            || '24',
      monthlyWork:          saved.monthlyWork           || [],
      clientWorkTemplates:  saved.clientWorkTemplates   || {},
      monthlyWorkClients:   saved.monthlyWorkClients    || [],
      taxRates:             { ...DEFAULT_TAX_RATES, ...(saved.taxRates || {}), WHT: { ...DEFAULT_TAX_RATES.WHT, ...(saved.taxRates?.WHT || {}) } },
      currentView:   'dashboard',
      currentMonth:  new Date().getFullYear() * 100 + new Date().getMonth(),
    };
  }
  return {
    clients:              INITIAL_CLIENTS,
    taxReturns:           INITIAL_TAX_RETURNS,
    tasks:                INITIAL_TASKS,
    tallyProgress:        [],
    tallyEnrollments:     [],
    tallyAdHoc:           [],
    cancellations:        [],
    notes:                [],
    pastebins:            [],
    documents:            [],
    workingHours:         {},
    hourFormat:           '24',
    darkMode:             false,
    notifications:        false,
    monthlyWork:          [],
    clientWorkTemplates:  {},
    monthlyWorkClients:   [],
    taxRates:             DEFAULT_TAX_RATES,
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
    case 'HIDE_CLIENTS':
      return { ...state, clients: state.clients.map(c => action.payload.includes(c.id) ? { ...c, hidden: true } : c) };
    case 'UNHIDE_CLIENTS':
      return { ...state, clients: state.clients.map(c => action.payload.includes(c.id) ? { ...c, hidden: false } : c) };
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

    // ── Notes ──
    case 'ADD_NOTE': {
      const now = new Date().toISOString();
      return {
        ...state,
        notes: [...(state.notes || []), { ...action.payload, id: uuid(), createdAt: now, updatedAt: now }],
      };
    }
    case 'EDIT_NOTE':
      return {
        ...state,
        notes: (state.notes || []).map(n => n.id === action.payload.id ? action.payload : n),
      };
    case 'DELETE_NOTE':
      return { ...state, notes: (state.notes || []).filter(n => n.id !== action.payload) };
    case 'PIN_NOTE':
      return {
        ...state,
        notes: (state.notes || []).map(n => n.id === action.payload ? { ...n, pinned: !n.pinned } : n),
      };

    // ── Pastebins ──
    case 'ADD_PASTEBIN': {
      const now = new Date().toISOString();
      return {
        ...state,
        pastebins: [...(state.pastebins || []), { ...action.payload, id: uuid(), createdAt: now }],
      };
    }
    case 'EDIT_PASTEBIN':
      return {
        ...state,
        pastebins: (state.pastebins || []).map(p =>
          p.id === action.payload.id ? { ...p, ...action.payload } : p
        ),
      };
    case 'DELETE_PASTEBIN':
      return { ...state, pastebins: (state.pastebins || []).filter(p => p.id !== action.payload) };

    // ── Documents (physical-custody tracking, personal) ──
    case 'ADD_DOCUMENT': {
      const now = new Date().toISOString();
      const { note, ...fields } = action.payload;
      const doc = {
        id:         uuid(),
        location:   'with_me',
        otherLabel: '',
        dueBackDate: '',
        reference:  '',
        notes:      '',
        docType:    '',
        clientId:   '',
        clientName: '',
        ...fields,
        createdAt:  now,
        updatedAt:  now,
        history:    [{ location: fields.location || 'with_me', otherLabel: fields.otherLabel || '', at: now, note: note || 'Logged' }],
      };
      return { ...state, documents: [doc, ...(state.documents || [])] };
    }
    // Edit metadata only (name, type, client, reference, notes) — location/history untouched
    case 'EDIT_DOCUMENT':
      return {
        ...state,
        documents: (state.documents || []).map(d =>
          d.id === action.payload.id ? { ...d, ...action.payload, updatedAt: new Date().toISOString() } : d
        ),
      };
    // Hand-off: change current custody and append to the movement history
    case 'MOVE_DOCUMENT': {
      const now = new Date().toISOString();
      const { id, location, otherLabel = '', dueBackDate = '', note = '' } = action.payload;
      return {
        ...state,
        documents: (state.documents || []).map(d =>
          d.id === id
            ? {
                ...d,
                location,
                otherLabel,
                dueBackDate,
                updatedAt: now,
                history: [...(d.history || []), { location, otherLabel, at: now, note }],
              }
            : d
        ),
      };
    }
    case 'DELETE_DOCUMENT':
      return { ...state, documents: (state.documents || []).filter(d => d.id !== action.payload) };

    // ── Import ──
    case 'IMPORT_DATA': {
      const { currentView, currentMonth, cancellations: _c, ...rest } = action.payload;
      // Never overwrite cancellations with a personal backup; they're managed separately.
      return { ...state, ...rest, tallyProgress: rest.tallyProgress || [], tallyEnrollments: rest.tallyEnrollments || [], tallyAdHoc: rest.tallyAdHoc || [], notes: rest.notes || [], pastebins: rest.pastebins || [], documents: rest.documents || [] };
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

    // Replace all enrollments for a given year
    case 'SET_YEAR_ENROLLMENTS': {
      const { year, enrollments } = action.payload;
      const kept = (state.tallyEnrollments || []).filter(e => e.year !== year);
      const added = enrollments.map(e => ({ id: uuid(), ...e, year }));
      return { ...state, tallyEnrollments: [...kept, ...added] };
    }

    // ── Tally Ad-Hoc (external/colleague entries, not in Clients list) ──
    case 'ADD_TALLY_ADHOC':
      return { ...state, tallyAdHoc: [...(state.tallyAdHoc || []), { id: uuid(), ...action.payload }] };
    case 'DELETE_TALLY_ADHOC':
      return {
        ...state,
        tallyAdHoc:    (state.tallyAdHoc || []).filter(a => a.id !== action.payload),
        tallyProgress: state.tallyProgress.filter(tp => tp.clientId !== action.payload),
      };

    // ── Cancellations (team-shared, synced to team_cancellations table) ──
    case 'ADD_CANCELLATION': {
      const newItem = {
        id:          action.payload.id || uuid(),
        status:      'pending',
        createdAt:   new Date().toISOString(),
        completedAt: null,
        completedBy: null,
        ...action.payload,
      };
      return { ...state, cancellations: [...state.cancellations, newItem] };
    }
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

    // Fires when a remote real-time INSERT or UPDATE arrives for a single cancellation row
    case 'SYNC_CANCELLATION_UPSERT': {
      const idx = state.cancellations.findIndex(c => c.id === action.payload.id);
      if (idx >= 0) {
        const updated = [...state.cancellations];
        updated[idx] = action.payload;
        return { ...state, cancellations: updated };
      }
      return { ...state, cancellations: [...state.cancellations, action.payload] };
    }
    // Fires when a remote DELETE arrives
    case 'SYNC_CANCELLATION_DELETE':
      return { ...state, cancellations: state.cancellations.filter(c => c.id !== action.payload) };

    // Fires on initial load to set the full cancellations list
    case 'SYNC_CANCELLATIONS':
      return { ...state, cancellations: action.payload || [] };

    // ── Working Hours (personal, per-user) ──
    case 'SET_HOUR_FORMAT':
      return { ...state, hourFormat: action.payload };

    case 'SET_WORKING_HOURS_ENTRY': {
      const { weekKey, day, field, value } = action.payload;
      const week    = state.workingHours?.[weekKey] || {};
      const dayData = week[day] || {};
      return {
        ...state,
        workingHours: {
          ...state.workingHours,
          [weekKey]: { ...week, [day]: { ...dayData, [field]: value } },
        },
      };
    }

    // ── Tax Rates ──
    case 'SET_TAX_RATE':
      return { ...state, taxRates: { ...state.taxRates, [action.payload.key]: action.payload.value } };
    case 'SET_TAX_BAND': {
      const bands = state.taxRates[action.payload.bandKey].map((b, i) =>
        i === action.payload.index ? { ...b, [action.payload.field]: action.payload.value } : b
      );
      return { ...state, taxRates: { ...state.taxRates, [action.payload.bandKey]: bands } };
    }
    case 'SET_WHT_RATE':
      return { ...state, taxRates: { ...state.taxRates, WHT: { ...state.taxRates.WHT, [action.payload.key]: action.payload.value } } };
    case 'RESET_TAX_RATES':
      return { ...state, taxRates: DEFAULT_TAX_RATES };

    // ── Monthly Work ──
    case 'UPSERT_MONTHLY_WORK': {
      const exists = state.monthlyWork.find(m => m.clientId === action.payload.clientId && m.monthKey === action.payload.monthKey);
      if (exists) {
        return { ...state, monthlyWork: state.monthlyWork.map(m =>
          m.clientId === action.payload.clientId && m.monthKey === action.payload.monthKey ? { ...m, ...action.payload } : m
        )};
      }
      return { ...state, monthlyWork: [...state.monthlyWork, action.payload] };
    }
    case 'TOGGLE_MONTHLY_WORK_TASK': {
      return { ...state, monthlyWork: state.monthlyWork.map(m => {
        if (m.clientId !== action.payload.clientId || m.monthKey !== action.payload.monthKey) return m;
        const tasks = m.tasks.map(t => t.id === action.payload.taskId ? { ...t, done: !t.done } : t);
        return { ...m, tasks };
      })};
    }
    case 'ADD_MONTHLY_WORK_TASK': {
      return { ...state, monthlyWork: state.monthlyWork.map(m => {
        if (m.clientId !== action.payload.clientId || m.monthKey !== action.payload.monthKey) return m;
        return { ...m, tasks: [...m.tasks, action.payload.task] };
      })};
    }
    case 'DELETE_MONTHLY_WORK_TASK': {
      return { ...state, monthlyWork: state.monthlyWork.map(m => {
        if (m.clientId !== action.payload.clientId || m.monthKey !== action.payload.monthKey) return m;
        return { ...m, tasks: m.tasks.filter(t => t.id !== action.payload.taskId) };
      })};
    }
    case 'UPDATE_MONTHLY_WORK_NOTES': {
      return { ...state, monthlyWork: state.monthlyWork.map(m => {
        if (m.clientId !== action.payload.clientId || m.monthKey !== action.payload.monthKey) return m;
        return { ...m, notes: action.payload.notes };
      })};
    }
    case 'DELETE_MONTHLY_WORK':
      return { ...state, monthlyWork: state.monthlyWork.filter(m =>
        !(m.clientId === action.payload.clientId && m.monthKey === action.payload.monthKey)
      )};
    case 'SET_CLIENT_WORK_TEMPLATE':
      return { ...state, clientWorkTemplates: { ...state.clientWorkTemplates, [action.payload.clientId]: action.payload.tasks } };
    case 'SET_MONTHLY_WORK_CLIENTS':
      return { ...state, monthlyWorkClients: action.payload };

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
  const [toast, setToast]           = useState(null);

  const showToast = useCallback((message, actionLabel, onAction) => {
    setToast({ message, actionLabel, onAction });
  }, []);

  // ── Personal sync refs ──────────────────────────────────────────────────────
  const pushTimerRef   = useRef(null);
  const skipPushRef    = useRef(false);
  const isPullingRef   = useRef(true);


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

  // ── Manual Sync Trigger ──────────────────────────────────────────────────────
  const manualSync = useCallback(async () => {
    setSyncStatus('syncing');
    try {
      const { data: rows, error } = await supabase.from('app_state').select('data, updated_at').eq('id', userId).single();
      if (!error && rows?.data) {
        const lastSync = getLastSyncTs();
        const remoteUpdated = new Date(rows.updated_at).getTime();
        if (remoteUpdated > lastSync) {
           skipPushRef.current = true;
           dispatch({ type: 'IMPORT_DATA', payload: rows.data });
           setLastSyncTs(remoteUpdated);
           setSyncStatus('synced');
           return;
        }
      }
      const { currentView, currentMonth, cancellations: _c, ...personalData } = stateRef.current;
      await pushPersonalData(personalData);
      pullPersonalData();
    } catch {
       setSyncStatus('error');
    }
  }, [userId, pushPersonalData, pullPersonalData]);

  // ── Persist to localStorage + schedule personal Supabase push ───────────────
  useEffect(() => {
    const { currentView, currentMonth, ...persisted } = state;
    saveState(persisted);
    saveBackup(persisted); // rolling daily snapshot (no-ops after the first write each day)

    const { cancellations: _c, ...personalData } = persisted;

    clearTimeout(pushTimerRef.current);
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    if (isPullingRef.current) return;
    pushTimerRef.current = setTimeout(() => pushPersonalData(personalData), 1500);
  }, [state, pushPersonalData]);

  // ── Immediate push when tab is hidden ────────────────────────────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(pushTimerRef.current);
        const { currentView, currentMonth, cancellations: _c, ...personalData } = stateRef.current;
        pushPersonalData(personalData);
      } else if (document.visibilityState === 'visible') {
        pullPersonalData();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pushPersonalData, pullPersonalData]);

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
            setLastSyncTs(new Date(payload.new?.updated_at ?? Date.now()).getTime());
            setSyncStatus('synced');
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(personalChannel); };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Converts a team_cancellations DB row to the app model ───────────────────
  function rowToItem(row) {
    return {
      id:          row.id,
      clientId:    row.client_id,
      clientName:  row.client_name,
      taxType:     row.tax_type,
      notes:       row.notes,
      status:      row.status,
      createdAt:   row.created_at,
      createdBy:   row.created_by,
      completedAt: row.completed_at,
      completedBy: row.completed_by,
      assignedTo:  row.assigned_to,
    };
  }

  // ── syncedDispatch: intercepts cancellation actions for row-level Supabase ops
  const syncedDispatch = useCallback((action) => {
    switch (action.type) {
      case 'ADD_CANCELLATION': {
        const id      = uuid();
        const payload = { ...action.payload, id };
        dispatch({ type: 'ADD_CANCELLATION', payload });
        supabase.from('team_cancellations').insert({
          id,
          client_id:    payload.clientId,
          client_name:  payload.clientName,
          tax_type:     payload.taxType   || null,
          notes:        payload.notes     || null,
          status:       'pending',
          created_by:   payload.createdBy,
          assigned_to:  payload.assignedTo || null,
        }).then(({ error }) => { if (error) console.error('cancellation insert:', error); });
        break;
      }
      case 'COMPLETE_CANCELLATION': {
        dispatch(action);
        const now = new Date().toISOString();
        supabase.from('team_cancellations').update({
          status:       'completed',
          completed_at: now,
          completed_by: action.payload.completedBy,
        }).eq('id', action.payload.id)
          .then(({ error }) => { if (error) console.error('cancellation complete:', error); });
        break;
      }
      case 'REOPEN_CANCELLATION': {
        dispatch(action);
        supabase.from('team_cancellations').update({
          status:       'pending',
          completed_at: null,
          completed_by: null,
        }).eq('id', action.payload)
          .then(({ error }) => { if (error) console.error('cancellation reopen:', error); });
        break;
      }
      case 'DELETE_CANCELLATION': {
        dispatch(action);
        supabase.from('team_cancellations').delete().eq('id', action.payload)
          .then(({ error }) => { if (error) console.error('cancellation delete:', error); });
        break;
      }
      default:
        dispatch(action);
    }
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: pull team_cancellations rows + real-time subscribe ─────────────
  useEffect(() => {
    supabase
      .from('team_cancellations')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          dispatch({ type: 'SYNC_CANCELLATIONS', payload: data.map(rowToItem) });
        }
      });

    const teamChannel = supabase
      .channel('team_cancellations_realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'team_cancellations' },
        ({ new: row }) => dispatch({ type: 'SYNC_CANCELLATION_UPSERT', payload: rowToItem(row) })
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'team_cancellations' },
        ({ new: row }) => dispatch({ type: 'SYNC_CANCELLATION_UPSERT', payload: rowToItem(row) })
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'team_cancellations' },
        ({ old: row }) => dispatch({ type: 'SYNC_CANCELLATION_DELETE', payload: row.id })
      )
      .subscribe();

    return () => { supabase.removeChannel(teamChannel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider value={syncStatus}>
      <AppContext.Provider value={{ state, dispatch: syncedDispatch, userId, userEmail, manualSync, toast, setToast, showToast }}>
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
  // WHT is on-demand — only clients with actual WHT records count, not all registered clients
  const relevantClients = taxType === 'WHT'
    ? state.clients.filter(c =>
        state.taxReturns.some(tr => tr.clientId === c.id && tr.taxType === 'WHT' && tr.period === period)
      )
    : state.clients.filter(c => c.taxTypes.includes(taxType));
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

/** Returns all tracked documents, most-recently-updated first. */
export function useDocuments() {
  const { state } = useApp();
  return [...(state.documents || [])].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

