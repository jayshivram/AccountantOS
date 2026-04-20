import React, { useState, useMemo } from 'react';
import { useApp, useClients, useTallyRecord } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';
import { EmptyState, ProgressBar } from '../components/UI.jsx';

// ─── Tally Task Definitions ────────────────────────────────────────────────────

const TALLY_TASKS = [
  { key: 'tallyUpdated',       label: 'Tally Data Updated',           icon: '📥' },
  { key: 'bankReconciled',     label: 'Bank Reconciliation Done',      icon: '🏦' },
  { key: 'adjustmentsPassed',  label: 'Adjustments Passed',           icon: '✏️' },
  { key: 'accountsFinalized',  label: 'Accounts Finalized',           icon: '✅' },
  { key: 'financialsPrep',     label: 'Financial Statements Prepared', icon: '📊' },
];

const YEARS = [2024, 2025, 2026];

function getStatus(rec) {
  if (!rec) return 'not_started';
  const done = TALLY_TASKS.filter(t => rec[t.key]).length;
  if (done === 0) return 'not_started';
  if (done === TALLY_TASKS.length) return 'completed';
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

// ─── Client Tally Card ─────────────────────────────────────────────────────────

function ClientTallyCard({ client, year }) {
  const { dispatch } = useApp();
  const rec = useTallyRecord(client.id, year);
  const [expanded, setExpanded] = useState(false);

  const done   = TALLY_TASKS.filter(t => rec?.[t.key]).length;
  const status = getStatus(rec);

  function toggle(key, value) {
    dispatch({
      type: 'UPSERT_TALLY_PROGRESS',
      payload: {
        clientId: client.id,
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
      <button
        className="w-full p-4 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-tight">{client.name}</h3>
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
              style={{ width: `${(done / TALLY_TASKS.length) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 tabular-nums flex-shrink-0">{done}/{TALLY_TASKS.length}</span>
        </div>

        {/* Compact task dots (always visible) */}
        <div className="flex gap-1.5 mt-2">
          {TALLY_TASKS.map(t => (
            <div
              key={t.key}
              className={cn(
                'w-2 h-2 rounded-full transition-colors',
                rec?.[t.key] ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
              )}
              title={t.label}
            />
          ))}
        </div>
      </button>

      {/* Expanded checklist */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
          {TALLY_TASKS.map(t => {
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

function YearSummary({ clients, year }) {
  const { state } = useApp();

  const stats = useMemo(() => {
    let completed = 0, inProgress = 0, notStarted = 0;
    clients.forEach(c => {
      const rec = state.tallyProgress.find(tp => tp.clientId === c.id && tp.year === year);
      const s = getStatus(rec);
      if (s === 'completed')   completed++;
      else if (s === 'in_progress') inProgress++;
      else notStarted++;
    });
    return { completed, inProgress, notStarted };
  }, [clients, year, state.tallyProgress]);

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {[
        { label: 'Completed',   value: stats.completed,   color: 'text-green-600 dark:text-green-400' },
        { label: 'In Progress', value: stats.inProgress,  color: 'text-blue-600 dark:text-blue-400'   },
        { label: 'Not Started', value: stats.notStarted,  color: 'text-gray-500 dark:text-gray-400'   },
      ].map(s => (
        <div key={s.label} className="card p-3 text-center">
          <p className={cn('text-2xl font-extrabold', s.color)}>{s.value}</p>
          <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Tally Tracker Page ───────────────────────────────────────────────────────

export default function TallyTracker() {
  const clients = useClients();
  const [year, setYear] = useState(2026);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  }, [clients, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tally Accounting Tracker</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track accounting work progress per client and year</p>
      </div>

      {/* Year Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {YEARS.map(y => (
          <button
            key={y}
            onClick={() => setYear(y)}
            className={cn(
              'px-5 py-2 rounded-lg text-sm font-semibold border transition-all',
              year === y
                ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-blue-400'
            )}
          >
            {y}
          </button>
        ))}

        <input
          className="input ml-auto w-full sm:w-56"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Summary */}
      <YearSummary clients={clients} year={year} />

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span className="font-semibold text-gray-600 dark:text-gray-400">Tasks tracked:</span>
        {TALLY_TASKS.map(t => (
          <span key={t.key}>{t.icon} {t.label}</span>
        ))}
      </div>

      {/* Client Grid */}
      {filtered.length === 0 ? (
        <EmptyState icon="📊" title="No clients found" message="Try a different search." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientTallyCard key={`${c.id}-${year}`} client={c} year={year} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
        Click any client card to expand and tick off accounting tasks
      </p>
    </div>
  );
}
