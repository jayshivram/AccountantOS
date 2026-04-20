import React, { useMemo, useState } from 'react';
import { useApp, useTasks, useClients } from '../context/AppContext.jsx';
import { cn, getUpcomingDeadlines, daysUntil, formatDate, TAX_TYPES, TAX_COLORS } from '../utils/index.js';
import { EmptyState } from '../components/UI.jsx';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function dayLabel(days) {
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `In ${days} days`;
}

function urgencyClass(days) {
  if (days < 0)  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700/50';
  if (days <= 2) return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50';
  if (days <= 5) return 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700/50';
  return 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
}

function taxBadgeClass(type) {
  const c = TAX_COLORS[type];
  return c
    ? `${c.bg} ${c.text} border ${c.border}`
    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600';
}

// ─── Tax Deadline Card ─────────────────────────────────────────────────────────

function DeadlineCard({ deadline, clients, taxReturns }) {
  const [open, setOpen] = useState(false);
  const days = deadline.daysRemaining;

  // Clients who have this tax type (WHT is on-demand: only clients with actual records)
  const relevantClients = useMemo(() => {
    if (deadline.type === 'WHT') {
      return clients.filter(c =>
        taxReturns.some(tr => tr.clientId === c.id && tr.taxType === 'WHT' && tr.period === deadline.period)
      );
    }
    return clients.filter(c => c.taxTypes && c.taxTypes.includes(deadline.type));
  }, [clients, taxReturns, deadline.type, deadline.period]);

  // Which have a completed return for this period?
  const completedIds = useMemo(() => {
    return new Set(
      taxReturns
        .filter(r => r.taxType === deadline.type && r.period === deadline.period && r.status === 'completed')
        .map(r => r.clientId)
    );
  }, [taxReturns, deadline.type, deadline.period]);

  const pending = relevantClients.filter(c => !completedIds.has(c.id));
  const done    = relevantClients.filter(c => completedIds.has(c.id));

  return (
    <div className={cn('rounded-xl border p-4 transition-all', urgencyClass(days))}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full border', taxBadgeClass(deadline.type))}>
            {TAX_TYPES[deadline.type] ?? deadline.type}
          </span>
          <span className="text-sm font-semibold">{deadline.periodLabel}</span>
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold whitespace-nowrap">
          <span>{deadline.dueDateFormatted}</span>
          <span className={cn(
            'px-2 py-0.5 rounded-full font-bold',
            days < 0 ? 'bg-red-600 text-white'
              : days <= 2 ? 'bg-red-500 text-white'
              : days <= 5 ? 'bg-amber-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
          )}>
            {dayLabel(days)}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/50 dark:bg-black/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-current opacity-60 rounded-full transition-all"
            style={{ width: relevantClients.length > 0 ? `${(done.length / relevantClients.length) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs font-bold">
          {done.length}/{relevantClients.length} clients done
        </span>
      </div>

      {/* Pending clients summary */}
      {pending.length > 0 && (
        <button
          className="mt-2 w-full text-left text-xs font-medium hover:underline flex items-center gap-1"
          onClick={() => setOpen(o => !o)}
        >
          <span>{open ? '▲' : '▼'}</span>
          {pending.length} pending: {pending.slice(0, 3).map(c => c.name.split(' ')[0]).join(', ')}{pending.length > 3 ? ` +${pending.length - 3}` : ''}
        </button>
      )}

      {open && (
        <ul className="mt-2 space-y-0.5">
          {pending.map(c => (
            <li key={c.id} className="flex items-center gap-1.5 text-xs py-0.5">
              <span className="w-2 h-2 rounded-full bg-current opacity-50 flex-shrink-0" />
              {c.name}
            </li>
          ))}
          {done.map(c => (
            <li key={c.id} className="flex items-center gap-1.5 text-xs py-0.5 opacity-50 line-through">
              <span className="w-2 h-2 rounded-full bg-current flex-shrink-0" />
              {c.name}
            </li>
          ))}
        </ul>
      )}

      {pending.length === 0 && relevantClients.length > 0 && (
        <p className="mt-2 text-xs font-semibold opacity-70">✓ All clients done</p>
      )}
    </div>
  );
}

// ─── Personal Task Row ─────────────────────────────────────────────────────────

function FocusTaskRow({ task, clients }) {
  const { dispatch, showToast } = useApp();
  const client = clients.find(c => c.id === task.clientId);
  const isComplete = task.status === 'completed';

  function toggleDone() {
    const nextStatus = isComplete ? 'pending' : 'completed';
    dispatch({
      type: 'EDIT_TASK',
      payload: {
        ...task,
        status: nextStatus,
        completedAt: isComplete ? null : new Date().toISOString(),
      },
    });

    if (nextStatus === 'completed') {
      showToast('Task marked completed', 'Undo', () => {
        dispatch({ type: 'REOPEN_TASK', payload: task.id });
      });
    }
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-lg border transition-all',
      isComplete
        ? 'opacity-50 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
    )}>
      <button
        onClick={toggleDone}
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded-full border-2 mt-0.5 transition-all flex items-center justify-center',
          isComplete
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-400 dark:border-gray-500 hover:border-green-400'
        )}
      >
        {isComplete && <span className="text-xs">✓</span>}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium text-gray-800 dark:text-gray-100', isComplete && 'line-through text-gray-400')}>
          {task.title}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-0.5">
          {client && (
            <span className="text-xs text-gray-500">{client.name}</span>
          )}
          {task.category && (
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 px-1.5 py-0.5 rounded-full font-medium">
              {task.category}
            </span>
          )}
          {task.priority && task.priority !== 'medium' && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full font-medium',
              task.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
            )}>
              {task.priority}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Focus Mode Page ───────────────────────────────────────────────────────────

export default function FocusMode({ onNavigate }) {
  const { state } = useApp();
  const tasks   = useTasks();
  const clients = useClients();

  // ── Tax deadlines (next 7 days + overdue) — skip zero-client and fully-complete overdue ──
  const taxDeadlines = useMemo(() => {
    return getUpcomingDeadlines(7)
      .filter(d => d.daysRemaining <= 7)
      .filter(d => {
        // WHT is on-demand: only show if actual records exist for this period
        const total = d.type === 'WHT'
          ? state.taxReturns.filter(tr => tr.taxType === 'WHT' && tr.period === d.period).length
          : state.clients.filter(c => c.taxTypes && c.taxTypes.includes(d.type)).length;
        if (total === 0) return false;
        // For overdue entries, also hide if every client is already done
        if (d.daysRemaining < 0) {
          const completed = state.taxReturns.filter(
            tr => tr.taxType === d.type && tr.period === d.period && tr.status === 'completed'
          ).length;
          if (completed >= total) return false;
        }
        return true;
      });
  }, [state.clients, state.taxReturns]);

  // ── Personal tasks (due within 7 days OR overdue) ──
  const focusTasks = useMemo(() => {
    return tasks
      .filter(t => {
        if (!t.dueDate) return false;
        if (t.status === 'completed') {
          if (!t.completedAt) return false;
          const hoursSinceCompletion = (Date.now() - new Date(t.completedAt).getTime()) / (1000 * 60 * 60);
          if (hoursSinceCompletion > 24) return false;
        }
        const days = daysUntil(t.dueDate);
        return days <= 7;
      })
      .sort((a, b) => daysUntil(a.dueDate) - daysUntil(b.dueDate));
  }, [tasks]);

  // Group personal tasks by bucket
  const taskGroups = useMemo(() => {
    const groups = { overdue: [], today: [], tomorrow: [], week: [], completed: [] };
    focusTasks.forEach(t => {
      if (t.status === 'completed') {
        groups.completed.push(t);
        return;
      }
      const d = daysUntil(t.dueDate);
      if (d < 0)       groups.overdue.push(t);
      else if (d === 0) groups.today.push(t);
      else if (d === 1) groups.tomorrow.push(t);
      else              groups.week.push(t);
    });
    return groups;
  }, [focusTasks]);

  const hasTax   = taxDeadlines.length > 0;
  const hasTasks = focusTasks.length > 0;
  const allClear = !hasTax && !hasTasks;

  // Overdue count badge
  const overdueCount = taxDeadlines.filter(d => d.daysRemaining < 0).length + taskGroups.overdue.length;

  return (
    <div className="space-y-8 animate-fade-in max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            🎯 Focus Mode
            {overdueCount > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2 py-0.5 rounded-full">
                {overdueCount} overdue
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Tax deadlines and tasks due in the next 7 days
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('tasks')}
            className="btn-secondary text-sm px-3 py-1.5"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* All Clear */}
      {allClear && (
        <EmptyState
          icon="🎉"
          title="You're all caught up!"
          message="No tax deadlines or tasks due in the next 7 days. Great work!"
        />
      )}

      {/* ── Tax Deadlines Section ── */}
      {hasTax && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            📅 Tax Deadlines
          </h2>
          <div className="space-y-3">
            {taxDeadlines.map(d => (
              <DeadlineCard
                key={d.id}
                deadline={d}
                clients={clients}
                taxReturns={state.taxReturns}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Personal Tasks Section ── */}
      {hasTasks && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
            ✅ Tasks Due Soon
          </h2>
          <div className="space-y-5">
            {taskGroups.overdue.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">
                  ⚠ Overdue
                </p>
                <div className="space-y-2">
                  {taskGroups.overdue.map(t => (
                    <FocusTaskRow key={t.id} task={t} clients={clients} />
                  ))}
                </div>
              </div>
            )}
            {taskGroups.today.length > 0 && (
              <div>
                <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-2">
                  Today
                </p>
                <div className="space-y-2">
                  {taskGroups.today.map(t => (
                    <FocusTaskRow key={t.id} task={t} clients={clients} />
                  ))}
                </div>
              </div>
            )}
            {taskGroups.tomorrow.length > 0 && (
              <div>
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
                  Tomorrow
                </p>
                <div className="space-y-2">
                  {taskGroups.tomorrow.map(t => (
                    <FocusTaskRow key={t.id} task={t} clients={clients} />
                  ))}
                </div>
              </div>
            )}
            {taskGroups.week.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">
                  This Week
                </p>
                <div className="space-y-2">
                  {taskGroups.week.map(t => (
                    <FocusTaskRow key={t.id} task={t} clients={clients} />
                  ))}
                </div>
              </div>
            )}
            {taskGroups.completed.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2 mt-4">
                  ✓ Recently Completed
                </p>
                <div className="space-y-2">
                  {taskGroups.completed.map(t => (
                    <FocusTaskRow key={t.id} task={t} clients={clients} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
