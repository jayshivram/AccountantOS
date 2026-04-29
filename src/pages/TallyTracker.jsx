import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, useClients, useTallyRecord } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';
import { EmptyState } from '../components/UI.jsx';

// ─── Tally Task Definitions ────────────────────────────────────────────────────

const FULL_TASKS = [
  { key: 'tallyUpdated',       label: 'Tally Data Updated',            icon: '📥' },
  { key: 'bankReconciled',     label: 'Bank Reconciliation Done',       icon: '🏦' },
  { key: 'adjustmentsPassed',  label: 'Adjustments Passed',            icon: '✏️' },
  { key: 'accountsFinalized',  label: 'Accounts Finalized',            icon: '✅' },
  { key: 'financialsPrep',     label: 'Financial Statements Prepared', icon: '📊' },
];

const DRAFT_TASKS = FULL_TASKS.slice(0, 3); // Tally Updated, Bank Rec, Adjustments

function tasksForScope(scope) {
  return scope === 'draft' ? DRAFT_TASKS : FULL_TASKS;
}

function getStatus(rec, tasks) {
  if (!rec) return 'not_started';
  const done = tasks.filter(t => rec[t.key]).length;
  if (done === 0) return 'not_started';
  if (done === tasks.length) return 'completed';
  return 'in_progress';
}

function StatusPill({ status }) {
  const map = {
    not_started: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
    in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50',
    completed:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/50',
  };
  return (
    <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1', map[status])}>
      {status === 'not_started' && <span className="opacity-60 text-[9px]">○</span>}
      {status === 'in_progress' && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
      {status === 'completed'   && <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      {status === 'not_started' ? 'Not Started' : status === 'in_progress' ? 'In Progress' : 'Completed'}
    </span>
  );
}

// ─── Configure Year Modal ──────────────────────────────────────────────────────

function ConfigureYearModal({ isOpen, onClose, year, clients, existingEnrollments, onSave }) {
  // Local state: map of clientId → scope ('full'|'draft'|null=not enrolled)
  const [selections, setSelections] = useState({});
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');

  // Initialise from existing enrollments whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    const init = {};
    existingEnrollments.forEach(e => { init[e.clientId] = e.scope; });
    setSelections(init);
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 60);
  }, [isOpen, existingEnrollments]);

  const visibleClients = useMemo(() => {
    if (!search.trim()) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [clients, search]);

  const enrolledCount = Object.values(selections).filter(Boolean).length;

  function toggle(clientId) {
    setSelections(prev => {
      const cur = prev[clientId];
      // cycle: null → full → draft → null
      if (!cur)          return { ...prev, [clientId]: 'full' };
      if (cur === 'full') return { ...prev, [clientId]: 'draft' };
      return { ...prev, [clientId]: null };
    });
  }

  function setScope(clientId, scope) {
    setSelections(prev => ({ ...prev, [clientId]: scope }));
  }

  function handleSelectAll() {
    const allEnrolled = visibleClients.every(c => selections[c.id]);
    if (allEnrolled) {
      const next = { ...selections };
      visibleClients.forEach(c => { next[c.id] = null; });
      setSelections(next);
    } else {
      const next = { ...selections };
      visibleClients.forEach(c => { if (!next[c.id]) next[c.id] = 'full'; });
      setSelections(next);
    }
  }

  function handleSave() {
    const enrollments = Object.entries(selections)
      .filter(([, scope]) => !!scope)
      .map(([clientId, scope]) => ({ clientId, scope }));
    onSave(enrollments);
    onClose();
  }

  if (!isOpen) return null;

  const allVisibleEnrolled = visibleClients.length > 0 && visibleClients.every(c => selections[c.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col max-h-[88vh] animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Configure {year}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Select clients and their scope for this year</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scope legend */}
        <div className="px-5 pt-3 pb-2 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-gray-400 dark:text-gray-500">Scope:</span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-600/40 font-semibold">Full</span>
            <span className="text-gray-400">5 tasks (all stages)</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-600/40 font-semibold">Draft</span>
            <span className="text-gray-400">3 tasks (up to adjustments)</span>
          </span>
        </div>

        {/* Search + select-all */}
        <div className="px-5 pb-3 flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchRef}
              className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              placeholder="Search clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleSelectAll}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition font-medium flex-shrink-0"
          >
            {allVisibleEnrolled ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Client list */}
        <div className="flex-1 overflow-y-auto px-5 pb-2 space-y-1 min-h-0">
          {visibleClients.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">No clients found</p>
          )}
          {visibleClients.map(c => {
            const scope = selections[c.id] || null;
            const enrolled = !!scope;
            return (
              <div
                key={c.id}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all',
                  enrolled
                    ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-700/40'
                    : 'bg-white dark:bg-gray-800/60 border-gray-100 dark:border-gray-700/50 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggle(c.id)}
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                    enrolled
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
                  )}
                >
                  {enrolled && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>

                {/* Client name */}
                <span
                  className={cn(
                    'flex-1 text-sm font-medium truncate cursor-pointer',
                    enrolled ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'
                  )}
                  onClick={() => toggle(c.id)}
                >
                  {c.name}
                </span>

                {/* Scope toggle — only visible when enrolled */}
                {enrolled && (
                  <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0">
                    {['full', 'draft'].map(s => (
                      <button
                        key={s}
                        onClick={() => setScope(c.id, s)}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                          scope === s
                            ? s === 'full'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-violet-600 text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        )}
                      >
                        {s === 'full' ? 'Full' : 'Draft'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-200">{enrolledCount}</span> client{enrolledCount !== 1 ? 's' : ''} enrolled
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={handleSave}
              className="btn-primary px-5 py-2 text-sm flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Save {year}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Client Tally Card ─────────────────────────────────────────────────────────

function ClientTallyCard({ client, year, scope }) {
  const { dispatch } = useApp();
  const rec   = useTallyRecord(client.id, year);
  const tasks = tasksForScope(scope);
  const [expanded, setExpanded] = useState(false);

  const done   = tasks.filter(t => rec?.[t.key]).length;
  const status = getStatus(rec, tasks);

  function toggle(key, value) {
    dispatch({
      type: 'UPSERT_TALLY_PROGRESS',
      payload: {
        clientId:          client.id,
        year,
        tallyUpdated:      rec?.tallyUpdated      || false,
        bankReconciled:    rec?.bankReconciled     || false,
        adjustmentsPassed: rec?.adjustmentsPassed  || false,
        accountsFinalized: rec?.accountsFinalized  || false,
        financialsPrep:    rec?.financialsPrep     || false,
        [key]: value,
      },
    });
  }

  return (
    <div className={cn('card transition-all', expanded ? 'ring-2 ring-blue-500/40' : 'hover:border-gray-300 dark:hover:border-gray-600')}>
      {/* Card Header */}
      <button className="w-full p-4 text-left" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight truncate">{client.name}</h3>
            <span className={cn(
              'flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
              scope === 'draft'
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-700/40'
                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40'
            )}>
              {scope === 'draft' ? 'Draft' : 'Full'}
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                status === 'completed' ? 'bg-green-500' : status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
              )}
              style={{ width: `${(done / tasks.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{done}/{tasks.length}</span>
        </div>

        {/* Compact task dots */}
        <div className="flex gap-1.5 mt-2">
          {tasks.map(t => (
            <div
              key={t.key}
              className={cn('w-2 h-2 rounded-full transition-colors', rec?.[t.key] ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700')}
              title={t.label}
            />
          ))}
        </div>
      </button>

      {/* Expanded checklist */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
          {tasks.map(t => {
            const isChecked = !!rec?.[t.key];
            return (
              <div
                key={t.key}
                onClick={e => { e.stopPropagation(); toggle(t.key, !isChecked); }}
                className="flex items-center gap-3 cursor-pointer group py-1"
              >
                <button
                  type="button"
                  className={cn(
                    'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                    isChecked
                      ? 'bg-blue-500 border-blue-500 text-white'
                      : 'border-gray-400 dark:border-gray-600 group-hover:border-blue-400'
                  )}
                >
                  {isChecked && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <span className={cn(
                  'text-sm transition-colors flex-1',
                  isChecked
                    ? 'text-gray-400 dark:text-gray-500 line-through'
                    : 'text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white'
                )}>
                  {t.icon} {t.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Summary Stats ─────────────────────────────────────────────────────────────

function YearSummary({ enrollments, year }) {
  const { state } = useApp();

  const stats = useMemo(() => {
    let completed = 0, inProgress = 0, notStarted = 0;
    enrollments.forEach(({ clientId, scope }) => {
      const rec   = state.tallyProgress.find(tp => tp.clientId === clientId && tp.year === year);
      const tasks = tasksForScope(scope);
      const s     = getStatus(rec, tasks);
      if (s === 'completed')        completed++;
      else if (s === 'in_progress') inProgress++;
      else                          notStarted++;
    });
    return { completed, inProgress, notStarted };
  }, [enrollments, year, state.tallyProgress]);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Completed',   value: stats.completed,   color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/10 border-green-100 dark:border-green-800/20' },
        { label: 'In Progress', value: stats.inProgress,  color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/20'   },
        { label: 'Not Started', value: stats.notStarted,  color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/30'   },
      ].map(s => (
        <div key={s.label} className={cn('rounded-2xl p-4 text-center border', s.bg)}>
          <p className={cn('text-3xl font-extrabold tabular-nums', s.color)}>{s.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tally Tracker Page ───────────────────────────────────────────────────────

export default function TallyTracker() {
  const allClients = useClients();
  const { state, dispatch } = useApp();
  const currentCalendarYear = new Date().getFullYear();

  // Derive available years: current year + any year with enrollments
  const availableYears = useMemo(() => {
    const enrolledYears = (state.tallyEnrollments || []).map(e => e.year);
    const set = new Set([currentCalendarYear, ...enrolledYears]);
    return Array.from(set).sort((a, b) => a - b);
  }, [state.tallyEnrollments, currentCalendarYear]);

  const [year, setYear]               = useState(currentCalendarYear);
  const [search, setSearch]           = useState('');
  const [configureOpen, setConfigureOpen] = useState(false);
  const [filterStatus, setFilterStatus]   = useState('all'); // 'all'|'not_started'|'in_progress'|'completed'

  // Enrollments for the active year
  const yearEnrollments = useMemo(
    () => (state.tallyEnrollments || []).filter(e => e.year === year),
    [state.tallyEnrollments, year]
  );

  // Visible client cards — apply search + status filter
  const visibleCards = useMemo(() => {
    return yearEnrollments
      .map(e => ({ enrollment: e, client: allClients.find(c => c.id === e.clientId) }))
      .filter(({ client }) => !!client)
      .filter(({ client }) => !search || client.name.toLowerCase().includes(search.toLowerCase()))
      .filter(({ enrollment, client }) => {
        if (filterStatus === 'all') return true;
        const rec   = state.tallyProgress.find(tp => tp.clientId === client.id && tp.year === year);
        const tasks = tasksForScope(enrollment.scope);
        return getStatus(rec, tasks) === filterStatus;
      });
  }, [yearEnrollments, allClients, search, filterStatus, state.tallyProgress, year]);

  function handleSaveEnrollments(enrollments) {
    dispatch({ type: 'SET_YEAR_ENROLLMENTS', payload: { year, enrollments } });
  }

  // Counts for filter tabs
  const filterCounts = useMemo(() => {
    const counts = { all: yearEnrollments.length, not_started: 0, in_progress: 0, completed: 0 };
    yearEnrollments.forEach(e => {
      const client = allClients.find(c => c.id === e.clientId);
      if (!client) return;
      const rec   = state.tallyProgress.find(tp => tp.clientId === client.id && tp.year === year);
      const tasks = tasksForScope(e.scope);
      counts[getStatus(rec, tasks)]++;
    });
    return counts;
  }, [yearEnrollments, allClients, state.tallyProgress, year]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tally Accounting Tracker</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Per-year client work tracker — configure which clients you handle each year</p>
      </div>

      {/* Year Tabs + Configure button */}
      <div className="flex items-center gap-2 flex-wrap">
        {availableYears.map(y => (
          <button
            key={y}
            onClick={() => { setYear(y); setSearch(''); setFilterStatus('all'); }}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-semibold border transition-all',
              year === y
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
            )}
          >
            {y}
            {(state.tallyEnrollments || []).filter(e => e.year === y).length > 0 && (
              <span className={cn(
                'ml-1.5 text-[10px] font-bold tabular-nums',
                year === y ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
              )}>
                {(state.tallyEnrollments || []).filter(e => e.year === y).length}
              </span>
            )}
          </button>
        ))}

        {/* Add new year */}
        <button
          onClick={() => {
            const next = (availableYears[availableYears.length - 1] || currentCalendarYear) + 1;
            setYear(next);
            setConfigureOpen(true);
          }}
          className="px-3 py-2 rounded-lg text-sm font-semibold border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-all"
          title="Add a new year"
        >
          + Year
        </button>

        <div className="flex items-center gap-2 ml-auto">
          {/* Configure button */}
          <button
            onClick={() => setConfigureOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure {year}
            {yearEnrollments.length > 0 && (
              <span className="ml-0.5 text-xs text-gray-400 dark:text-gray-500 font-normal">({yearEnrollments.length})</span>
            )}
          </button>

          {/* Search */}
          {yearEnrollments.length > 0 && (
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                className="input pl-8 w-48"
                placeholder="Search clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {yearEnrollments.length === 0 ? (
        /* ── Empty state: year not configured ── */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">No clients configured for {year}</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 max-w-xs">
            Select which clients you're handling tally work for this year, and choose Full or Draft scope per client.
          </p>
          <button
            onClick={() => setConfigureOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Configure {year}
          </button>
        </div>
      ) : (
        <>
          {/* Summary */}
          <YearSummary enrollments={yearEnrollments} year={year} />

          {/* Status filter tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { key: 'all',          label: 'All'          },
              { key: 'not_started',  label: 'Not Started'  },
              { key: 'in_progress',  label: 'In Progress'  },
              { key: 'completed',    label: 'Completed'    },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  filterStatus === f.key
                    ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
                )}
              >
                {f.label}
                <span className={cn(
                  'tabular-nums px-1.5 py-0.5 rounded-full text-[10px]',
                  filterStatus === f.key ? 'bg-white/20 dark:bg-black/20' : 'bg-gray-100 dark:bg-gray-700'
                )}>
                  {filterCounts[f.key]}
                </span>
              </button>
            ))}

            {/* Task legend */}
            <div className="ml-auto flex flex-wrap gap-3 text-xs text-gray-400 dark:text-gray-500">
              {FULL_TASKS.map((t, i) => (
                <span key={t.key} className="flex items-center gap-1">
                  {t.icon}
                  <span className="hidden sm:inline">{t.label}</span>
                  {i >= DRAFT_TASKS.length && (
                    <span className="text-[9px] text-blue-400 dark:text-blue-500 font-bold">Full</span>
                  )}
                </span>
              ))}
            </div>
          </div>

          {/* Client Grid */}
          {visibleCards.length === 0 ? (
            <EmptyState icon="🔍" title="No clients match" message="Try a different search or filter." />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleCards.map(({ enrollment, client }) => (
                <ClientTallyCard
                  key={`${client.id}-${year}`}
                  client={client}
                  year={year}
                  scope={enrollment.scope}
                />
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
            Click any card to expand · <span className="text-blue-400 dark:text-blue-500 font-medium">Full</span> = 5 tasks · <span className="text-violet-400 dark:text-violet-500 font-medium">Draft</span> = 3 tasks
          </p>
        </>
      )}

      {/* Configure Modal */}
      <ConfigureYearModal
        isOpen={configureOpen}
        onClose={() => setConfigureOpen(false)}
        year={year}
        clients={allClients}
        existingEnrollments={yearEnrollments}
        onSave={handleSaveEnrollments}
      />
    </div>
  );
}
