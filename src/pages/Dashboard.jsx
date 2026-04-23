import React, { useMemo, useState } from 'react';
import { format, isToday, parseISO, isBefore } from 'date-fns';
import { useApp, useCompletionStats } from '../context/AppContext.jsx';
import {
  getUpcomingDeadlines, TAX_TYPES, TAX_COLORS, cn,
  countdownLabel, daysUntil, formatDate,
} from '../utils/index.js';
import { ProgressBar, CountdownBadge, TaxTypeBadge, EmptyState, KeyboardHint } from '../components/UI.jsx';

// ─── Deadline Card ─────────────────────────────────────────────────────────────

function DeadlineCard({ deadline }) {
  const { type, periodLabel, dueDateFormatted, daysRemaining } = deadline;
  const colors = TAX_COLORS[type] || TAX_COLORS.VAT;
  const stats = useCompletionStats(type, deadline.period);

  const borderCls = daysRemaining < 0 ? 'border-red-400 dark:border-red-700/60'
    : daysRemaining <= 3              ? 'border-red-400 dark:border-red-700/40'
    : daysRemaining <= 7              ? 'border-amber-400 dark:border-amber-700/40'
    : colors.border;

  const topCls = daysRemaining < 0 ? 'bg-red-50 dark:bg-red-500/10'
    : daysRemaining <= 3             ? 'bg-red-50 dark:bg-red-500/10'
    : daysRemaining <= 7             ? 'bg-amber-50 dark:bg-amber-500/10'
    : colors.bg;

  return (
    <div className={cn('card border-l-4 overflow-hidden transition-all hover:scale-[1.01]', borderCls)}>
      <div className={cn('px-5 py-3 flex items-center justify-between', topCls)}>
        <div className="flex items-center gap-2">
          <TaxTypeBadge type={type} />
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{periodLabel}</span>
        </div>
        <CountdownBadge days={daysRemaining} />
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Due Date</p>
            <p className={cn('text-lg font-bold', colors.text)}>{dueDateFormatted}</p>
          </div>
          {stats.total > 0 && (
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Completion</p>
              <p className="text-lg font-bold text-gray-700 dark:text-gray-200">
                <span className="text-green-600 dark:text-green-400">{stats.completed}</span>
                <span className="text-gray-500 dark:text-gray-400"> / {stats.total}</span>
              </p>
            </div>
          )}
        </div>
        {stats.total > 0 && (
          <ProgressBar completed={stats.completed} total={stats.total} size="md" />
        )}
      </div>
    </div>
  );
}

// ─── Today's Tasks Widget ─────────────────────────────────────────────────────

function TodayTasksWidget({ onNavigate }) {
  const { state, dispatch } = useApp();
  const today = new Date().toLocaleDateString('en-CA');  // local YYYY-MM-DD

  const hiddenClientIds = useMemo(() => new Set(
    state.clients.filter(c => c.hidden).map(c => c.id)
  ), [state.clients]);

  const todayTasks = useMemo(() =>
    state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === today && t.status !== 'completed' && !hiddenClientIds.has(t.clientId))
  , [state.tasks, today, hiddenClientIds]);

  const overdueTasks = useMemo(() =>
    state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'completed' && !hiddenClientIds.has(t.clientId))
  , [state.tasks, today, hiddenClientIds]);

  function completeTask(id) {
    dispatch({ type: 'COMPLETE_TASK', payload: id });
  }

  if (todayTasks.length === 0 && overdueTasks.length === 0) {
    return (
      <div className="card p-5">
        <h3 className="section-title">Today's Tasks</h3>
        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
          <div className="text-4xl mb-3">🎉</div>
          <p>No tasks due today!</p>
          <button onClick={() => onNavigate('tasks')} className="btn-ghost mt-3 text-xs">Add a task →</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Today's Tasks</h3>
        <button onClick={() => onNavigate('tasks')} className="btn-ghost text-xs py-1">View all</button>
      </div>

      {overdueTasks.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-widest mb-2">⚠ Overdue</p>
          <div className="space-y-2">
            {overdueTasks.slice(0, 3).map(task => (
              <TaskRow key={task.id} task={task} onComplete={completeTask} />
            ))}
          </div>
        </div>
      )}

      {todayTasks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-2">Due Today</p>
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map(task => (
              <TaskRow key={task.id} task={task} onComplete={completeTask} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, onComplete }) {
  const { state } = useApp();
  const client = state.clients.find(c => c.id === task.clientId);
  const days = task.dueDate ? daysUntil(task.dueDate) : null;
  const priorityDot = { high: 'bg-red-400', medium: 'bg-amber-400', low: 'bg-gray-500' };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 transition-all group">
      <button
        onClick={() => onComplete(task.id)}
        title="Mark done (D)"
        className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-400 dark:border-gray-600 hover:border-green-500 hover:bg-green-500/20 transition-all flex items-center justify-center group-hover:scale-110"
      >
        <span className="text-transparent group-hover:text-green-400 text-xs">✓</span>
      </button>
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', priorityDot[task.priority] || 'bg-gray-500')} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{task.title}</p>
        {client && <p className="text-xs text-gray-500 truncate">{client.name}</p>}
      </div>
      {days !== null && <CountdownBadge days={days} />}
    </div>
  );
}

// ─── Quick Stats ──────────────────────────────────────────────────────────────

function QuickStats() {
  const { state } = useApp();
  const deadlines = useMemo(() => {
    const all = getUpcomingDeadlines(365);
    return all.filter(d => {
      if (d.type === 'WHT') {
        // WHT is on-demand: only show if at least one actual WHT record exists for this period
        return state.taxReturns.some(tr => tr.taxType === 'WHT' && tr.period === d.period);
      }
      return state.clients.some(c => !c.hidden && c.taxTypes.includes(d.type));
    });
  }, [state.clients, state.taxReturns]);

  const totalClients   = state.clients.filter(c => !c.hidden).length;
  const hiddenClients  = state.clients.filter(c => c.hidden).length;
  const pendingTasks   = state.tasks.filter(t => t.status !== 'completed').length;
  const today          = new Date().toLocaleDateString('en-CA');  // local YYYY-MM-DD
  // Count truly overdue deadlines: past due AND at least one client still pending
  const overdueDeadlines = deadlines.filter(d => {
    if (d.daysRemaining >= 0) return false;
    const total = d.type === 'WHT'
      ? state.taxReturns.filter(tr => tr.taxType === 'WHT' && tr.period === d.period).length
      : state.clients.filter(c => !c.hidden && c.taxTypes.includes(d.type)).length;
    const completed = state.taxReturns.filter(
      tr => tr.taxType === d.type && tr.period === d.period && tr.status === 'completed'
    ).length;
    return completed < total;
  }).length;
  const completedToday = state.tasks.filter(t => t.completedAt && t.completedAt.slice(0, 10) === today).length;

  const clientLabel = hiddenClients > 0 ? `Clients (${hiddenClients} hidden)` : 'Total Clients';

  const stats = [
    { label: clientLabel,     value: totalClients,     icon: '👥', color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Pending Tasks', value: pendingTasks,     icon: '📋', color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Overdue',       value: overdueDeadlines, icon: '⚠️', color: overdueDeadlines > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400' },
    { label: 'Done Today',    value: completedToday,   icon: '✅', color: 'text-green-600 dark:text-green-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="card p-4 flex items-center gap-3">
          <span className="text-2xl">{s.icon}</span>
          <div>
            <p className={cn('text-2xl font-extrabold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Heatmap / Client Summary ─────────────────────────────────────────────────

function ClientHeatmap({ deadlines }) {
  const { state } = useApp();
  const [selected, setSelected] = useState(deadlines[0]?.id || null);
  const activeDeadline = deadlines.find(d => d.id === selected) || deadlines[0];

  if (!activeDeadline) return null;

  // WHT is on-demand: relevantClients = those with actual records, not just registered
  const relevantClients = activeDeadline.type === 'WHT'
    ? state.clients.filter(c =>
        !c.hidden && state.taxReturns.some(tr => tr.clientId === c.id && tr.taxType === 'WHT' && tr.period === activeDeadline.period)
      )
    : state.clients.filter(c => !c.hidden && c.taxTypes.includes(activeDeadline.type));
  const completedSet = new Set(
    state.taxReturns
      .filter(tr => tr.taxType === activeDeadline.type && tr.period === activeDeadline.period && tr.status === 'completed')
      .map(tr => tr.clientId)
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title mb-0">Client Status Heatmap</h3>
        <select
          className="input w-auto text-xs py-1"
          value={selected || ''}
          onChange={e => setSelected(e.target.value)}
        >
          {deadlines.slice(0, 8).map(d => (
            <option key={d.id} value={d.id}>{TAX_TYPES[d.type]} — {d.periodLabel}</option>
          ))}
        </select>
      </div>

      {relevantClients.length === 0 ? (
        <p className="text-sm text-gray-500">No clients assigned to this tax type.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {relevantClients.map(c => {
            const done = completedSet.has(c.id);
            return (
              <div
                key={c.id}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium border transition-all',
                  done
                    ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700/50 text-green-700 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                )}
              >
                <span className="mr-1">{done ? '✓' : '○'}</span>
                {c.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Deadline Section ────────────────────────────────────────────

function CollapsibleSection({ title, dotColor, dotAnimate, titleColor, badgeColor, count, isCollapsed, onToggle, deadlines, emptyText }) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 mb-3 group text-left"
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor, dotAnimate && 'animate-pulse')} />
          <h2 className={cn('text-base font-bold uppercase tracking-wide', titleColor)}>{title}</h2>
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', badgeColor)}>{count}</span>
        </div>
        <span className={cn(
          'text-gray-400 text-xs font-bold transition-transform duration-200 select-none',
          isCollapsed ? '' : 'rotate-180'
        )}>▾</span>
      </button>

      {!isCollapsed && (
        deadlines.length === 0
          ? <p className="text-sm text-gray-400 dark:text-gray-600 pl-4 py-2 italic">{emptyText}</p>
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {deadlines.map(d => <DeadlineCard key={d.id} deadline={d} />)}
            </div>
          )
      )}
    </section>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard({ onNavigate }) {
  const { state } = useApp();

  // Only show deadlines for tax types that at least one client has
  // WHT is on-demand: only show if actual WHT records exist for that period
  const deadlines = useMemo(() => {
    const all = getUpcomingDeadlines(365);
    return all.filter(d => {
      if (d.type === 'WHT') {
        return state.taxReturns.some(tr => tr.taxType === 'WHT' && tr.period === d.period);
      }
      return state.clients.some(c => !c.hidden && c.taxTypes.includes(d.type));
    });
  }, [state.clients, state.taxReturns]);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();

  // Overdue = past due + at least one client still pending
  const overdue = useMemo(() => deadlines.filter(d => {
    if (d.daysRemaining >= 0) return false;
    const total = d.type === 'WHT'
      ? state.taxReturns.filter(tr => tr.taxType === 'WHT' && tr.period === d.period).length
      : state.clients.filter(c => !c.hidden && c.taxTypes.includes(d.type)).length;
    if (total === 0) return false;
    const completed = state.taxReturns.filter(
      tr => tr.taxType === d.type && tr.period === d.period && tr.status === 'completed'
    ).length;
    return completed < total;
  }), [deadlines, state.clients, state.taxReturns]);

  const currentDeadlines = useMemo(() => deadlines.filter(d => {
    if (d.daysRemaining < 0) return false;
    const due = new Date(d.dueDate);
    return due.getMonth() === currentMonth && due.getFullYear() === currentYear;
  }), [deadlines, currentMonth, currentYear]);

  const upcomingDeadlines = useMemo(() => deadlines.filter(d => {
    if (d.daysRemaining < 0) return false;
    const due = new Date(d.dueDate);
    return !(due.getMonth() === currentMonth && due.getFullYear() === currentYear);
  }), [deadlines, currentMonth, currentYear]);

  const [collapsed, setCollapsed] = useState({ overdue: false, current: false, upcoming: true });
  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  const today = format(new Date(), 'EEEE, dd MMMM yyyy');
  const currentMonthName = format(now, 'MMMM yyyy');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tax Calendar Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-3">
          <KeyboardHint shortcut="D" label="mark task done" />
          <button onClick={() => onNavigate('tasks')} className="btn-primary text-sm">
            + New Task
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Overdue Deadlines */}
      {overdue.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">No overdue deadlines — all on track!</p>
        </div>
      ) : (
        <CollapsibleSection
          title="Overdue Deadlines"
          dotColor="bg-red-500"
          dotAnimate={true}
          titleColor="text-red-600 dark:text-red-400"
          badgeColor="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          count={overdue.length}
          isCollapsed={collapsed.overdue}
          onToggle={() => toggle('overdue')}
          deadlines={overdue}
          emptyText="No overdue deadlines — great work!"
        />
      )}

      {/* Current Month Deadlines */}
      <CollapsibleSection
        title={`Current Deadlines — ${currentMonthName}`}
        dotColor="bg-amber-400"
        dotAnimate={false}
        titleColor="text-amber-600 dark:text-amber-400"
        badgeColor={currentDeadlines.length > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}
        count={currentDeadlines.length}
        isCollapsed={collapsed.current}
        onToggle={() => toggle('current')}
        deadlines={currentDeadlines}
        emptyText="No deadlines due this month."
      />

      {/* Upcoming Deadlines */}
      <CollapsibleSection
        title="Upcoming Deadlines"
        dotColor="bg-blue-400"
        dotAnimate={false}
        titleColor="text-blue-600 dark:text-blue-400"
        badgeColor={upcomingDeadlines.length > 0 ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}
        count={upcomingDeadlines.length}
        isCollapsed={collapsed.upcoming}
        onToggle={() => toggle('upcoming')}
        deadlines={upcomingDeadlines}
        emptyText="No upcoming deadlines beyond this month."
      />

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        <TodayTasksWidget onNavigate={onNavigate} />
        <ClientHeatmap deadlines={deadlines} />
      </div>
    </div>
  );
}
