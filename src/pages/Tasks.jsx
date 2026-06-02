import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { useApp, useClients } from '../context/AppContext.jsx';
import {
  TAX_TYPES, TAX_TYPE_KEYS, uuid, cn, daysUntil, formatDate,
  TASK_STATUS, PRIORITY, getStatusColor,
} from '../utils/index.js';
import {
  Modal, ConfirmDialog, TaxTypeBadge, StatusBadge, CountdownBadge,
  EmptyState, KeyboardHint,
} from '../components/UI.jsx';

// â”€â”€â”€ ISO Week Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getMondayOfISOWeek(year, week) {
  const jan4      = new Date(year, 0, 4);
  const dow       = jan4.getDay() || 7;
  const week1Mon  = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow + 1);
  const monday    = new Date(week1Mon);
  monday.setDate(week1Mon.getDate() + (week - 1) * 7);
  return monday;
}

function isoWeeksInYear(year) {
  const dec28    = new Date(year, 11, 28);
  const dow      = dec28.getDay() || 7;
  const lastMon  = new Date(dec28);
  lastMon.setDate(dec28.getDate() - dow + 1);
  const jan4     = new Date(year, 0, 4);
  const dow4     = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow4 + 1);
  return Math.round((lastMon - week1Mon) / 604800000) + 1;
}

function currentISOWeek() {
  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const dow      = today.getDay() || 7;
  const thu      = new Date(today);
  thu.setDate(today.getDate() - dow + 4);
  const year     = thu.getFullYear();
  const jan4     = new Date(year, 0, 4);
  const dow4     = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow4 + 1);
  const week     = Math.round((thu - week1Mon) / 604800000) + 1;
  return { week, year };
}

function getISOWeekOfDate(dateStr) {
  if (!dateStr) return null;
  const d        = new Date(dateStr + 'T00:00:00');
  const dow      = d.getDay() || 7;
  const thu      = new Date(d);
  thu.setDate(d.getDate() - dow + 4);
  const year     = thu.getFullYear();
  const jan4     = new Date(year, 0, 4);
  const dow4     = jan4.getDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow4 + 1);
  const week     = Math.round((thu - week1Mon) / 604800000) + 1;
  return { week, year };
}

function getWeeksForMonth(year, month) {
  const total  = isoWeeksInYear(year);
  const result = [];
  for (let w = 1; w <= total; w++) {
    const mon = getMondayOfISOWeek(year, w);
    if (mon.getFullYear() === year && mon.getMonth() === month) {
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      result.push({ week: w, mon, sun });
    }
  }
  return result;
}

function fmtShortDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// â”€â”€â”€ Quick Jump Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuickJumpPicker({ currentYear, currentWeek, onNavigate, onClose }) {
  const [pickerYear, setPickerYear]       = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function handlePointer(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handlePointer);
    return () => document.removeEventListener('mousedown', handlePointer);
  }, [onClose]);

  const weeksForMonth = useMemo(
    () => selectedMonth !== null ? getWeeksForMonth(pickerYear, selectedMonth) : [],
    [pickerYear, selectedMonth]
  );

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-72 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => { setPickerYear(y => y - 1); setSelectedMonth(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="font-bold text-sm text-gray-900 dark:text-white">{pickerYear}</span>
        <button onClick={() => { setPickerYear(y => y + 1); setSelectedMonth(null); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1 mb-1">
        {MONTHS_SHORT.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i === selectedMonth ? null : i)}
            className={cn(
              'py-1.5 text-xs font-semibold rounded-lg transition',
              selectedMonth === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600'
            )}
          >{m}</button>
        ))}
      </div>
      {selectedMonth !== null ? (
        <div className="border-t border-gray-100 dark:border-gray-800 mt-3 pt-3 space-y-0.5 max-h-44 overflow-y-auto">
          {weeksForMonth.length === 0
            ? <p className="text-xs text-gray-400 text-center py-2">No weeks</p>
            : weeksForMonth.map(({ week: w, mon, sun }) => (
              <button
                key={w}
                onClick={() => { onNavigate(pickerYear, w); onClose(); }}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition',
                  currentYear === pickerYear && currentWeek === w
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                <span className="font-bold">Wk {w}</span>
                <span className="opacity-70 tabular-nums">{fmtShortDate(mon)} – {fmtShortDate(sun)}</span>
              </button>
            ))
          }
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 text-center mt-2">Pick a month to browse its weeks</p>
      )}
    </div>
  );
}

// â”€â”€â”€ Task Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TaskForm({ initial, isOpen, onClose, onSave, clients }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => initial || {
    title: '', description: '', dueDate: today, clientId: '',
    taxType: '', status: 'pending', priority: 'medium', category: '', person: '',
  });

  // Reset when initial changes
  useEffect(() => {
    setForm(initial || {
      title: '', description: '', dueDate: today, clientId: '',
      taxType: '', status: 'pending', priority: 'medium', category: '', person: '',
    });
  }, [initial, isOpen]);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form, title: form.title.trim() });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Task' : 'New Task'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Task Title *</label>
          <input
            className="input"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Submit PAYE payslip"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Due Date</label>
            <input type="date" className="input" value={form.dueDate || ''} onChange={e => set('dueDate', e.target.value)} />
          </div>
          <div>
            <label className="label">Priority</label>
            <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Client (optional)</label>
            <select className="input" value={form.clientId || ''} onChange={e => set('clientId', e.target.value)}>
              <option value="">– General Task –</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tax Type (optional)</label>
            <select className="input" value={form.taxType || ''} onChange={e => set('taxType', e.target.value)}>
              <option value="">– None –</option>
              {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
            </select>
          </div>
        </div>

        {!form.clientId && (
          <div>
            <label className="label">Who is it for? (optional)</label>
            <input
              className="input"
              value={form.person || ''}
              onChange={e => set('person', e.target.value)}
              placeholder="e.g. Ahmed – payroll team, Office manager"
            />
          </div>
        )}

        <div>
          <label className="label">Category (optional)</label>
          <input
            className="input"
            value={form.category || ''}
            onChange={e => set('category', e.target.value)}
            placeholder="e.g. TRA Letter, Prior Year Payslip, Correspondence"
          />
        </div>

        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className="label">Description / Notes</label>
          <textarea
            className="input h-20 resize-none"
            value={form.description || ''}
            onChange={e => set('description', e.target.value)}
            placeholder="Additional details..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">{initial ? 'Save' : 'Create Task'}</button>
        </div>
      </form>
    </Modal>
  );
}

// â”€â”€â”€ Task Row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TaskRow({ task, clients, onEdit, onDelete, onComplete, onReopen, selected, onSelect }) {
  const client = clients.find(c => c.id === task.clientId);
  const days   = task.dueDate ? daysUntil(task.dueDate) : null;
  const isDone = task.status === 'completed';

  const priorityChip = {
    high:   'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/40',
    medium: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700/40',
    low:    'text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700/40',
  };

  const borderLeft = {
    high:   'border-l-red-500',
    medium: 'border-l-amber-400',
    low:    'border-l-gray-400',
  };

  return (
    <tr
      onClick={() => onSelect(task.id)}
      className={cn(
        'group border-b border-gray-100 dark:border-gray-800/80 transition-colors cursor-pointer border-l-4',
        isDone ? 'opacity-55' : '',
        selected ? 'bg-blue-50/60 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
        borderLeft[task.priority] || 'border-l-gray-400'
      )}
    >
      {/* Checkbox */}
      <td className="pl-3 pr-1 py-3 w-8 align-middle">
        <button
          onClick={e => { e.stopPropagation(); isDone ? onReopen(task.id) : onComplete(task.id); }}
          title={isDone ? 'Reopen task' : 'Mark done'}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
            isDone
              ? 'bg-green-600 border-green-500 text-white'
              : 'border-gray-400 hover:border-green-500 hover:bg-green-500/20'
          )}
        >
          {isDone && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
        </button>
      </td>

      {/* Title + description + category */}
      <td className="px-3 py-2.5 align-middle">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={cn(
            'font-semibold text-sm leading-snug',
            isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
          )}>
            {task.title}
          </span>
          {task.description && (
            <span className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{task.description}</span>
          )}
          {task.category && (
            <span className="self-start text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/40 leading-tight">
              {task.category}
            </span>
          )}
          {!client && task.person && (
            <span className="text-xs text-teal-600 dark:text-teal-400 truncate">{task.person}</span>
          )}
        </div>
      </td>

      {/* Client */}
      <td className="px-3 py-2.5 w-36 align-middle">
        {client
          ? <span className="text-xs text-gray-600 dark:text-gray-400 truncate block max-w-[130px]">{client.name}</span>
          : <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-700/40">General</span>}
      </td>

      {/* Due date + countdown */}
      <td className="px-3 py-2.5 w-36 align-middle">
        {task.dueDate ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 tabular-nums">{formatDate(task.dueDate)}</span>
            {!isDone && days !== null && <CountdownBadge days={days} />}
          </div>
        ) : <span className="text-gray-300 dark:text-gray-600 text-xs">–</span>}
      </td>

      {/* Tax Type */}
      <td className="px-3 py-2.5 w-20 align-middle">
        {task.taxType
          ? <TaxTypeBadge type={task.taxType} size="xs" />
          : <span className="text-gray-300 dark:text-gray-600 text-xs">–</span>}
      </td>

      {/* Priority */}
      <td className="px-3 py-2.5 w-24 align-middle">
        <span className={cn(
          'text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide',
          priorityChip[task.priority] || priorityChip.low
        )}>
          {task.priority}
        </span>
      </td>

      {/* Status */}
      <td className="px-3 py-2.5 w-28 align-middle">
        {isDone
          ? <StatusBadge status="completed" />
          : <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{(task.status || 'pending').replace('_', ' ')}</span>}
      </td>

      {/* Actions */}
      <td className="pr-3 py-2.5 w-16 align-middle">
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); onEdit(task); }}
            title="Edit"
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(task.id); }}
            title="Delete"
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </td>
    </tr>
  );
}

// â”€â”€â”€ Tasks Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Tasks() {
  const { state, dispatch, showToast } = useApp();
  const clients = useClients();

  const [showAdd, setShowAdd]           = useState(false);
  const [editing, setEditing]           = useState(null);
  const [deletingId, setDeletingId]     = useState(null);
  const [jumpTaskOpen, setJumpTaskOpen] = useState(false);
  const [search, setSearch]             = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [selectedId, setSelectedId]     = useState(null);
  const [showCleared, setShowCleared]   = useState('both'); // 'uncleared' | 'cleared' | 'both'
  const [jumpOpen, setJumpOpen]         = useState(false);
  const [activeDay, setActiveDay]       = useState(null); // null = all, 0–6 = Mon–Sun

  const { week: initWeek, year: initYear } = useMemo(() => currentISOWeek(), []);
  const [week, setWeek] = useState(initWeek);
  const [year, setYear] = useState(initYear);

  const totalWeeks    = useMemo(() => isoWeeksInYear(year), [year]);
  const isCurrentWeek = useMemo(() => {
    const now = currentISOWeek();
    return now.week === week && now.year === year;
  }, [week, year]);

  const { weekMon, weekSun, rangeLabel } = useMemo(() => {
    const mon = getMondayOfISOWeek(year, week);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { weekMon: mon, weekSun: sun, rangeLabel: `${fmtShortDate(mon)} – ${fmtShortDate(sun)}` };
  }, [year, week]);

  // 7 day objects for the tab bar (Mon–Sun)
  // Use local date parts (not toISOString which is UTC) to avoid off-by-one in UTC+ timezones
  const dayDates = useMemo(() => {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return labels.map((label, i) => {
      const d = new Date(weekMon);
      d.setDate(weekMon.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { label, dateStr, shortDate: fmtShortDate(d) };
    });
  }, [weekMon]);

  // Reset active day when the viewed week changes
  useEffect(() => { setActiveDay(null); }, [week, year]);

  function prevWeek() {
    if (week > 1) setWeek(w => w - 1);
    else { const py = year - 1; setYear(py); setWeek(isoWeeksInYear(py)); }
  }
  function nextWeek() {
    if (week < totalWeeks) setWeek(w => w + 1);
    else { setYear(y => y + 1); setWeek(1); }
  }
  function goToCurrentWeek() { const now = currentISOWeek(); setWeek(now.week); setYear(now.year); }

  // Keyboard shortcuts
  useEffect(() => {
    function handler(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (selectedId) {
          const id = selectedId;
          dispatch({ type: 'COMPLETE_TASK', payload: id });
          showToast('Task marked completed', 'Undo', () => dispatch({ type: 'REOPEN_TASK', payload: id }));
          setSelectedId(null);
        }
      }
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setShowAdd(true); }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, dispatch]);

  const allTasks = useMemo(() => [...state.tasks].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  }), [state.tasks]);

  // Tasks whose dueDate falls within viewed week (Mon–Sun)
  const weekTasks = useMemo(() => allTasks.filter(t => {
    if (!t.dueDate) return false;
    const d = new Date(t.dueDate + 'T00:00:00');
    return d >= weekMon && d <= weekSun;
  }), [allTasks, weekMon, weekSun]);

  // Tasks with no due date
  const noDueTasks = useMemo(() => allTasks.filter(t => !t.dueDate), [allTasks]);

  // Past uncleared: non-completed tasks with dueDate strictly before viewed week's Monday
  const pastUncleared = useMemo(() => allTasks.filter(t => {
    if (t.status === 'completed' || !t.dueDate) return false;
    return new Date(t.dueDate + 'T00:00:00') < weekMon;
  }), [allTasks, weekMon]);

  // Earliest week that has a past-uncleared task
  const earliestPastWeek = useMemo(() => {
    if (!pastUncleared.length) return null;
    return pastUncleared.reduce((acc, t) => {
      const wk = getISOWeekOfDate(t.dueDate);
      if (!acc) return wk;
      return (wk.year < acc.year || (wk.year === acc.year && wk.week < acc.week)) ? wk : acc;
    }, null);
  }, [pastUncleared]);

  // Apply cleared/uncleared + search + client + type filters
  function applyFilters(tasks) {
    return tasks.filter(t => {
      if (showCleared === 'cleared'   && t.status !== 'completed') return false;
      if (showCleared === 'uncleared' && t.status === 'completed') return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterClient === '__GENERAL__' && t.clientId) return false;
      if (filterClient && filterClient !== '__GENERAL__' && t.clientId !== filterClient) return false;
      if (filterType && t.taxType !== filterType) return false;
      return true;
    });
  }

  const filteredWeekTasks = useMemo(() => {
    const base = activeDay !== null
      ? weekTasks.filter(t => t.dueDate === dayDates[activeDay]?.dateStr)
      : weekTasks;
    return applyFilters(base);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekTasks, showCleared, search, filterClient, filterType, activeDay, dayDates]);
  const filteredNoDueTasks = useMemo(() => applyFilters(noDueTasks), [noDueTasks, showCleared, search, filterClient, filterType]);

  const activeTasks = allTasks.filter(t => t.status !== 'completed').length;

  function exportXLSX() {
    const wb      = XLSX.utils.book_new();
    const fmtStatus = s => (s || 'pending').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const fmtClient = t => { const c = clients.find(cl => cl.id === t.clientId); return c ? c.name : ''; };

    // Sheet 1 — Summary
    const summaryData = [['Day', 'Date', 'Total', 'Done', 'Pending / In Progress']];
    dayDates.forEach(({ label, dateStr, shortDate }) => {
      const tasks = weekTasks.filter(t => t.dueDate === dateStr);
      const done  = tasks.filter(t => t.status === 'completed').length;
      summaryData.push([label, shortDate, tasks.length, done, tasks.length - done]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'Summary');

    // Sheets 2–8 — one per day
    const dayHeaders = ['#', 'Title', 'Client', 'Tax Type', 'Status', 'Priority', 'Category', 'Person', 'Description'];
    dayDates.forEach(({ label, dateStr, shortDate }) => {
      const tasks   = weekTasks.filter(t => t.dueDate === dateStr);
      const rows    = tasks.map((t, i) => [
        i + 1,
        t.title || '',
        fmtClient(t),
        t.taxType ? (TAX_TYPES[t.taxType] || t.taxType) : '',
        fmtStatus(t.status),
        t.priority || 'medium',
        t.category || '',
        t.person || '',
        t.description || '',
      ]);
      const wsData  = [dayHeaders, ...rows];
      const ws      = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols']   = [4, 35, 22, 12, 12, 10, 18, 18, 35].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, `${label} ${shortDate}`);
    });

    XLSX.writeFile(wb, `tasks-${year}-W${String(week).padStart(2, '0')}.xlsx`);
  }

  function exportPDF() {
    const headers = ['Title', 'Client', 'Tax Type', 'Due Date', 'Status', 'Priority'];
    const colWidths = ['30%', '18%', '12%', '12%', '14%', '10%'];
    const tasksToExport = weekTasks;

    const headerRow = headers.map((h, i) => `<th style="width:${colWidths[i]};padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${h}</th>`).join('');

    const statusLabel = s => (s || 'pending').replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
    const priorityColor = p => p === 'high' ? '#dc2626' : p === 'medium' ? '#d97706' : '#6b7280';

    const bodyRows = tasksToExport.map((t, ri) => {
      const client = clients.find(c => c.id === t.clientId);
      const bg = ri % 2 === 0 ? '#ffffff' : '#f9fafb';
      const isDone = t.status === 'completed';
      const cells = [
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};${isDone ? 'text-decoration:line-through;color:#9ca3af;' : 'color:#111827;'}">${t.title}</td>`,
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};color:#374151;">${client ? client.name : '–'}</td>`,
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};color:#374151;">${t.taxType ? (TAX_TYPES[t.taxType] || t.taxType) : '–'}</td>`,
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};color:#374151;">${t.dueDate ? formatDate(t.dueDate) : '–'}</td>`,
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};color:#374151;">${statusLabel(t.status)}</td>`,
        `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};color:${priorityColor(t.priority)};font-weight:600;text-transform:uppercase;">${t.priority || 'medium'}</td>`,
      ];
      return `<tr>${cells.join('')}</tr>`;
    }).join('') || `<tr><td colspan="6" style="padding:16px;text-align:center;color:#9ca3af;font-size:12px;border:1px solid #e5e7eb;">No tasks this week</td></tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tasks – Week ${week} · ${year}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#111827;}h2{margin:0 0 4px;font-size:16px;}p{margin:0 0 14px;font-size:12px;color:#6b7280;}table{border-collapse:collapse;width:100%;}@media print{body{margin:12px;}}</style>
</head><body>
<h2>Tasks &mdash; Week ${week} &middot; ${year}</h2>
<p>${rangeLabel}</p>
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  // Shared table header
  const Thead = () => (
    <thead>
      <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
        <th className="pl-3 pr-1 py-2.5 w-8"></th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Task</th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Client</th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">Due Date</th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">Type</th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">Priority</th>
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">Status</th>
        <th className="pr-3 py-2.5 w-16"></th>
      </tr>
    </thead>
  );

  function renderRows(tasks) {
    return tasks.map(t => (
      <TaskRow
        key={t.id}
        task={t}
        clients={clients}
        onEdit={setEditing}
        onDelete={setDeletingId}
        onComplete={id => {
          dispatch({ type: 'COMPLETE_TASK', payload: id });
          showToast('Task marked completed', 'Undo', () => dispatch({ type: 'REOPEN_TASK', payload: id }));
        }}
        onReopen={id => dispatch({ type: 'REOPEN_TASK', payload: id })}
        selected={selectedId === t.id}
        onSelect={setSelectedId}
      />
    ));
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{activeTasks} active tasks</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <KeyboardHint shortcut="N" label="new task" />
          <KeyboardHint shortcut="D" label="mark done" />
          <button
            onClick={exportXLSX}
            title="Export this week's tasks as Excel (.xlsx)"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-700/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </button>
          <button
            onClick={exportPDF}
            title="Export this week's tasks as PDF"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            PDF
          </button>
          <button
            onClick={() => setJumpTaskOpen(true)}
            title="Jump to active task"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Jump
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ New Task</button>
        </div>
      </div>

      {/* â”€â”€ Past uncleared banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {pastUncleared.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
          <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800 dark:text-amber-300">
              {pastUncleared.length} uncleared task{pastUncleared.length !== 1 ? 's' : ''} from previous week{pastUncleared.length > 1 ? 's' : ''}
            </span>
            <span className="text-amber-700 dark:text-amber-400"> – still pending or in progress</span>
          </div>
          {earliestPastWeek && (
            <button
              onClick={() => { setWeek(earliestPastWeek.week); setYear(earliestPastWeek.year); setShowCleared('uncleared'); }}
              className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-200 dark:bg-amber-800/60 text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-700/60 transition"
            >
              View oldest
            </button>
          )}
        </div>
      )}

      {/* â”€â”€ Week Navigator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={prevWeek}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Prev</span>
          </button>

          <div className="flex-1 flex flex-col items-center relative">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <p className="font-bold text-gray-900 dark:text-white text-base">Week {week} &middot; {year}</p>
              {isCurrentWeek && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rangeLabel}</p>

            <div className="flex items-center gap-2 mt-2">
              {!isCurrentWeek && (
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  Go to Today
                </button>
              )}
              <div className="relative">
                <button
                  onClick={() => setJumpOpen(o => !o)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Jump to week
                  <svg className={cn('w-3 h-3 transition-transform', jumpOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {jumpOpen && (
                  <QuickJumpPicker
                    currentYear={year}
                    currentWeek={week}
                    onNavigate={(y, w) => { setYear(y); setWeek(w); }}
                    onClose={() => setJumpOpen(false)}
                  />
                )}
              </div>
            </div>
          </div>

          <button
            onClick={nextWeek}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
          >
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* ── Day of week tab bar ─────────────────────────────── */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {/* Permanent All pill */}
            <button
              onClick={() => setActiveDay(null)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none',
                activeDay === null
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              All
            </button>
            {(() => {
              const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
              return dayDates.map(({ label, dateStr, shortDate }, i) => {
                const isToday = dateStr === todayStr;
                const active  = activeDay === i;
                const count   = weekTasks.filter(t => t.dueDate === dateStr).length;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveDay(active ? null : i)}
                    title={isToday ? `Today — ${shortDate}` : shortDate}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none',
                      active
                        ? 'bg-blue-600 text-white shadow-sm'
                        : isToday
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{isToday && !active ? 'Today' : label}</span>
                      {count > 0 && (
                        <span className={cn(
                          'text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 leading-none',
                          active
                            ? 'bg-white/25 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                        )}>
                          {count}
                        </span>
                      )}
                    </div>
                    {/* Today dot — always visible even when another day is active */}
                    {isToday && (
                      <span className={cn(
                        'w-1 h-1 rounded-full flex-shrink-0',
                        active ? 'bg-white/70' : 'bg-blue-500 dark:bg-blue-400'
                      )} />
                    )}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* â”€â”€ Controls: cleared toggle + search + filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Cleared / All / Uncleared toggle */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0">
          {[
            { key: 'uncleared', label: 'Uncleared' },
            { key: 'both',      label: 'All' },
            { key: 'cleared',   label: 'Cleared' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setShowCleared(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold transition-all',
                showCleared === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >{label}</button>
          ))}
        </div>

        <input
          className="input flex-1 min-w-[180px]"
          placeholder="Search tasks..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input w-full sm:w-44" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          <option value="__GENERAL__">General Tasks only</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-full sm:w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Tax Types</option>
          {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
        </select>
      </div>

      {/* â”€â”€ This week's tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">
            {activeDay !== null ? (
              <>{dayDates[activeDay].label}<span className="font-normal text-gray-400">, </span>{dayDates[activeDay].shortDate}</>
            ) : (
              <>Tasks due this week <span className="font-normal text-gray-400 text-xs ml-1">{rangeLabel}</span></>
            )}
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-600">
            {filteredWeekTasks.length} task{filteredWeekTasks.length !== 1 ? 's' : ''}
          </span>
        </div>
        {filteredWeekTasks.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-600">
            No {showCleared === 'both' ? '' : showCleared + ' '}tasks for this week
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <Thead />
              <tbody>{renderRows(filteredWeekTasks)}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* â”€â”€ No due date tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {filteredNoDueTasks.length > 0 && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-gray-800 dark:text-gray-200">No Due Date</h2>
            <span className="text-xs text-gray-400 dark:text-gray-600">
              {filteredNoDueTasks.length} task{filteredNoDueTasks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <Thead />
              <tbody>{renderRows(filteredNoDueTasks)}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* â”€â”€ Modals â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Jump to Task Modal */}
      <Modal isOpen={jumpTaskOpen} onClose={() => setJumpTaskOpen(false)} title="Jump to Active Task" size="md">
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {(() => {
            const active = allTasks.filter(t => t.status !== 'completed' && t.dueDate);
            if (!active.length) return <p className="text-center text-gray-500 dark:text-gray-400 py-6 text-sm">No active tasks with due dates.</p>;
            return active.map(t => {
              const wk = getISOWeekOfDate(t.dueDate);
              const client = clients.find(c => c.id === t.clientId);
              const d = new Date(t.dueDate + 'T00:00:00');
              const dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
              const days = daysUntil(t.dueDate);
              return (
                <button
                  key={t.id}
                  onClick={() => { if (wk) { setYear(wk.year); setWeek(wk.week); setActiveDay(null); } setJumpTaskOpen(false); }}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition text-left"
                >
                  <span className={cn('mt-1 w-2 h-2 rounded-full flex-shrink-0', t.status === 'in_progress' ? 'bg-blue-500' : 'bg-amber-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{t.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{dateLabel}{client ? ` · ${client.name}` : ''}</p>
                  </div>
                  <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0', days < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : days === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400')}>
                    {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                  </span>
                </button>
              );
            });
          })()}
        </div>
      </Modal>
      <TaskForm isOpen={showAdd} onClose={() => setShowAdd(false)} onSave={d => dispatch({ type: 'ADD_TASK', payload: d })} clients={clients} />
      {editing && (
        <TaskForm
          isOpen={!!editing}
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={d => dispatch({ type: 'EDIT_TASK', payload: d })}
          clients={clients}
        />
      )}
      {deletingId && (
        <ConfirmDialog
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={() => dispatch({ type: 'DELETE_TASK', payload: deletingId })}
          title="Delete Task"
          message="Are you sure you want to delete this task?"
        />
      )}
    </div>
  );
}
