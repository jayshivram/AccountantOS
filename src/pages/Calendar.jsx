import React, { useState, useMemo } from 'react';
import { format, addMonths, subMonths, isSameDay, isToday, parseISO } from 'date-fns';
import { useApp } from '../context/AppContext.jsx';
import {
  getCalendarDays, getDeadlinesForDate, TAX_COLORS, cn, formatDate, daysUntil,
} from '../utils/index.js';
import { CountdownBadge, TaxTypeBadge, Modal } from '../components/UI.jsx';

// ─── Day Detail Modal ─────────────────────────────────────────────────────────

function DayDetailModal({ date, deadlines, tasks, clients, isOpen, onClose }) {
  if (!date) return null;
  const dateStr = format(date, 'dd MMMM yyyy, EEEE');
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={dateStr} size="md">
      <div className="space-y-4">
        {deadlines.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tax Deadlines</p>
            <div className="space-y-2">
              {deadlines.map((d, i) => (
                <div key={i} className={cn('flex items-center gap-2 p-2 rounded-lg', TAX_COLORS[d.type]?.bg)}>
                  <TaxTypeBadge type={d.type} />
                  <span className="text-sm text-gray-800 dark:text-gray-200">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Tasks Due</p>
            <div className="space-y-2">
              {tasks.map(t => {
                const client = clients.find(c => c.id === t.clientId);
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                    <span className={cn('w-1.5 h-1.5 rounded-full', t.status === 'completed' ? 'bg-green-400' : 'bg-amber-400')} />
                    <div className="flex-1">
                      <p className={cn('text-sm', t.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-800 dark:text-gray-200')}>{t.title}</p>
                      {client && <p className="text-xs text-gray-500">{client.name}</p>}
                    </div>
                    {t.taxType && <TaxTypeBadge type={t.taxType} size="xs" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {deadlines.length === 0 && tasks.length === 0 && (
          <p className="text-center text-gray-500 py-4">Nothing scheduled for this day.</p>
        )}
      </div>
    </Modal>
  );
}

// ─── Calendar Page ─────────────────────────────────────────────────────────────

export default function Calendar() {
  const { state } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { days, startPad } = useMemo(() => getCalendarDays(year, month), [year, month]);

  function prevMonth() { setCurrentDate(d => subMonths(d, 1)); }
  function nextMonth() { setCurrentDate(d => addMonths(d, 1)); }
  function goToday()   { setCurrentDate(new Date()); }

  function getDayData(date) {
    const dateIso = format(date, 'yyyy-MM-dd');
    const taxDeadlines = getDeadlinesForDate(date);
    const tasks = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === dateIso);
    return { taxDeadlines, tasks };
  }

  function handleDayClick(date) {
    setSelectedDay(date);
    setModalOpen(true);
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Render a single calendar cell
  function CalendarDay({ date }) {
    const { taxDeadlines, tasks } = getDayData(date);
    const today  = isToday(date);
    const hasItems = taxDeadlines.length > 0 || tasks.length > 0;
    const hasOverdue = tasks.some(t => t.status !== 'completed' && daysUntil(t.dueDate) < 0);
    const hasPending = tasks.some(t => t.status !== 'completed');

    return (
      <button
        onClick={() => handleDayClick(date)}
        className={cn(
          'relative min-h-[64px] sm:min-h-[80px] p-1 sm:p-1.5 rounded-md sm:rounded-lg border transition-all hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800/50 text-left w-full overflow-hidden',
          today ? 'border-blue-500 bg-blue-900/20' : 'border-gray-200 dark:border-gray-800',
          hasItems ? 'cursor-pointer' : ''
        )}
      >
        {/* Day number */}
        <div className={cn(
          'w-6 h-6 text-xs font-bold mb-1 flex items-center justify-center rounded-full',
          today ? 'bg-blue-500 text-white' : 'text-gray-700 dark:text-gray-400'
        )}>
          {format(date, 'd')}
        </div>

        {/* Deadline dots */}
        <div className="flex flex-wrap gap-0.5 mb-1">
          {taxDeadlines.slice(0, 3).map((d, i) => (
            <div
              key={i}
              style={{ backgroundColor: TAX_COLORS[d.type]?.hex || '#888' }}
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              title={d.label}
            />
          ))}
        </div>

        {/* Task labels (desktop only) */}
        <div className="hidden sm:block space-y-0.5">
          {taxDeadlines.slice(0, 1).map((d, i) => (
            <div
              key={i}
              className={cn('text-[9px] font-semibold px-1 rounded truncate', TAX_COLORS[d.type]?.text, TAX_COLORS[d.type]?.bg)}
            >
              {d.label.replace(' ' + format(date, 'MMM yyyy'), '')}
            </div>
          ))}
          {tasks.slice(0, 2).map(t => (
            <div
              key={t.id}
              className={cn(
                'text-[9px] px-1 rounded truncate',
                t.status === 'completed' ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20' : 'text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20'
              )}
            >
              {t.title}
            </div>
          ))}
          {(taxDeadlines.length + tasks.length) > 3 && (
            <div className="text-[9px] text-gray-500">+{taxDeadlines.length + tasks.length - 3} more</div>
          )}
        </div>

        {/* Overdue indicator */}
        {hasOverdue && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        )}
      </button>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in min-w-0">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Calendar</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Tax deadlines and task due dates</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={goToday} className="btn-secondary text-xs py-1.5">Today</button>
          <button onClick={prevMonth} className="btn-ghost p-2">‹</button>
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100 min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} className="btn-ghost p-2">›</button>
        </div>
      </div>

      {/* Legend */}
      <div>
        <button
          className="flex sm:hidden items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 mb-1 select-none"
          onClick={() => setLegendOpen(v => !v)}
        >
          <span className="font-medium">Legend</span>
          <span className="text-gray-500">{legendOpen ? '▲' : '▼'}</span>
        </button>
        <div className={cn('flex flex-wrap gap-2 sm:gap-3 text-xs text-gray-600 dark:text-gray-400 overflow-hidden', !legendOpen && 'hidden sm:flex')}>
          {Object.entries(TAX_COLORS).map(([key, colors]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.hex }} />
              {key}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Tasks
          </span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card p-2 sm:p-4 overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
          {dayNames.map(d => (
            <div key={d} className="text-center text-[10px] sm:text-xs font-semibold text-gray-500 py-1">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {/* Padding cells */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="min-h-[64px] sm:min-h-[80px]" />
          ))}
          {/* Real cells */}
          {days.map(date => (
            <CalendarDay key={format(date, 'yyyy-MM-dd')} date={date} />
          ))}
        </div>
      </div>

      {/* Day Detail Modal */}
      {selectedDay && (
        <DayDetailModal
          date={selectedDay}
          deadlines={getDeadlinesForDate(selectedDay)}
          tasks={state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === format(selectedDay, 'yyyy-MM-dd'))}
          clients={state.clients.filter(c => !c.hidden)}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Mobile Agenda — fills the empty space below the calendar grid */}
      <div className="block sm:hidden">
        <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
          {format(currentDate, 'MMMM yyyy')} — Deadlines
        </h2>
        {(() => {
          const agendaItems = [];
          days.forEach(date => {
            const taxDeadlines = getDeadlinesForDate(date);
            const dayTasks = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) === format(date, 'yyyy-MM-dd'));
            const dayNum = format(date, 'd MMM');
            taxDeadlines.forEach(d => agendaItems.push({ key: `${d.type}-${format(date,'yyyy-MM-dd')}`, type: d.type, label: d.label, day: dayNum, isTask: false }));
            dayTasks.forEach(t => agendaItems.push({ key: t.id, type: 'TASK', label: t.title, day: dayNum, isTask: true }));
          });
          if (agendaItems.length === 0) {
            return <p className="text-sm text-gray-500 dark:text-gray-600 italic">No deadlines or tasks this month.</p>;
          }
          return (
            <div className="space-y-1.5">
              {agendaItems.map(item => (
                <div key={item.key} className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg border',
                  item.isTask
                    ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700/30'
                    : (TAX_COLORS[item.type]?.bg + ' ' + TAX_COLORS[item.type]?.border || 'bg-gray-800 border-gray-700')
                )}>
                  <span className="text-xs font-bold text-gray-500 dark:text-gray-400 w-10 flex-shrink-0">{item.day}</span>
                  {!item.isTask && <TaxTypeBadge type={item.type} />}
                  {item.isTask && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800/40 text-amber-800 dark:text-amber-300">Task</span>}
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{item.label}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
