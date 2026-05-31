import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn, uuid, format } from '../utils/index.js';
import { DEFAULT_MONTHLY_TASKS } from '../data/initialData.js';
import { Modal } from '../components/UI.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function periodKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function monthLabel(year, month) {
  return format(new Date(year, month, 1), 'MMMM yyyy');
}

// ─── Client Card ──────────────────────────────────────────────────────────────

function ClientCard({ client, period, record, templateTasks, onToggle, onAddTask, onDeleteTask, onNotes, onReset, onEditTemplate }) {
  const [expanded, setExpanded] = useState(true);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesVal, setNotesVal] = useState(record?.notes || '');
  const addInputRef = useRef(null);

  useEffect(() => {
    if (addingTask) setTimeout(() => addInputRef.current?.focus(), 30);
  }, [addingTask]);

  const tasks = record?.tasks || [];
  const done = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const allDone = total > 0 && done === total;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  function handleAddTask(e) {
    e.preventDefault();
    const label = newTaskLabel.trim();
    if (!label) return;
    onAddTask(label);
    setNewTaskLabel('');
    setAddingTask(false);
  }

  function handleSaveNotes() {
    onNotes(notesVal);
    setNotesOpen(false);
  }

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 rounded-2xl border shadow-sm transition-all',
      allDone
        ? 'border-green-400 dark:border-green-700/60'
        : 'border-gray-200 dark:border-gray-800'
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(v => !v)}
      >
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
          allDone ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
        )}>
          {allDone ? '✓' : client.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{client.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', allDone ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
              {done}/{total}
            </span>
          </div>
        </div>
        <svg
          className={cn('w-4 h-4 text-gray-400 transition-transform flex-shrink-0', expanded ? 'rotate-180' : '')}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Task list */}
      {expanded && (
        <div className="px-4 pb-4 space-y-1 border-t border-gray-100 dark:border-gray-800 pt-3">
          {tasks.length === 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-600 py-2 text-center">No tasks yet. Add some below.</p>
          )}
          {tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2.5 group">
              <button
                onClick={() => onToggle(task.id)}
                className={cn(
                  'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition',
                  task.done
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-400 dark:hover:border-green-600'
                )}
              >
                {task.done && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className={cn(
                'flex-1 text-sm transition',
                task.done ? 'line-through text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
              )}>
                {task.label}
              </span>
              {task.done && task.doneAt && (
                <span className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums hidden sm:inline">
                  {format(new Date(task.doneAt), 'dd/MM HH:mm')}
                </span>
              )}
              <button
                onClick={() => onDeleteTask(task.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition"
                title="Remove task"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Add task */}
          {addingTask ? (
            <form onSubmit={handleAddTask} className="flex gap-2 pt-1">
              <input
                ref={addInputRef}
                value={newTaskLabel}
                onChange={e => setNewTaskLabel(e.target.value)}
                placeholder="Task name…"
                onKeyDown={e => { if (e.key === 'Escape') { setAddingTask(false); setNewTaskLabel(''); } }}
                className="flex-1 px-3 py-1.5 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
              <button type="submit" className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition">Add</button>
              <button type="button" onClick={() => { setAddingTask(false); setNewTaskLabel(''); }} className="px-3 py-1.5 text-xs text-gray-500 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition">Cancel</button>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                onClick={() => setAddingTask(true)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add task
              </button>
              <button
                onClick={() => setNotesOpen(true)}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {record?.notes ? 'Edit notes' : 'Notes'}
              </button>
              <button
                onClick={onEditTemplate}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
                </svg>
                Template
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400 hover:underline ml-auto"
              >
                Reset
              </button>
            </div>
          )}

          {/* Inline notes display */}
          {record?.notes && !notesOpen && (
            <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-xl">
              <p className="text-xs text-amber-800 dark:text-amber-300 whitespace-pre-wrap">{record.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Notes modal */}
      <Modal isOpen={notesOpen} onClose={() => setNotesOpen(false)} title={`Notes — ${client.name}`} size="sm">
        <div className="space-y-3">
          <textarea
            value={notesVal}
            onChange={e => setNotesVal(e.target.value)}
            placeholder="Any notes for this client this month…"
            rows={5}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none transition"
          />
          <div className="flex gap-2">
            <button onClick={() => setNotesOpen(false)} className="flex-1 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
            <button onClick={handleSaveNotes} className="flex-1 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition">Save</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Template Editor Modal ────────────────────────────────────────────────────

function TemplateModal({ isOpen, onClose, client, currentTemplate, onSave }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setItems([...(currentTemplate || DEFAULT_MONTHLY_TASKS)]);
      setNewItem('');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [isOpen, currentTemplate]);

  function addItem(e) {
    e?.preventDefault();
    const label = newItem.trim();
    if (!label || items.includes(label)) return;
    setItems(v => [...v, label]);
    setNewItem('');
  }

  function removeItem(i) {
    setItems(v => v.filter((_, idx) => idx !== i));
  }

  function moveItem(i, dir) {
    setItems(v => {
      const arr = [...v];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Task Template — ${client?.name || ''}`} size="sm">
      <div className="space-y-4">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          This template is used when creating a new month record for this client.
          Existing month records are not affected.
        </p>

        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 group">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveItem(i, -1)} disabled={i === 0} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-20 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                </button>
                <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} className="p-0.5 text-gray-300 dark:text-gray-600 hover:text-gray-500 disabled:opacity-20 transition">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </div>
              <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{item}</span>
              <button onClick={() => removeItem(i)} className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={addItem} className="flex gap-2">
          <input
            ref={inputRef}
            value={newItem}
            onChange={e => setNewItem(e.target.value)}
            placeholder="Add task to template…"
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          <button type="submit" className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition">Add</button>
        </form>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setItems([...DEFAULT_MONTHLY_TASKS])}
            className="flex-1 py-2 text-xs rounded-xl border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            Reset to Default
          </button>
          <button
            onClick={() => { onSave(items); onClose(); }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Save Template
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Manage Clients Modal ─────────────────────────────────────────────────────

function ManageClientsModal({ isOpen, onClose, allClients, activeClientIds, onSave }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set(activeClientIds));
      setSearch('');
    }
  }, [isOpen, activeClientIds]);

  const filtered = allClients.filter(c =>
    !c.hidden && c.name.toLowerCase().includes(search.toLowerCase())
  );

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Clients" size="sm">
      <div className="space-y-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Select which clients appear in the Monthly Work tracker.</p>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          autoFocus
        />
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500">{selected.size} selected</span>
          <button
            onClick={() => setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)))}
            className="text-xs text-blue-500 hover:underline"
          >
            {selected.size === filtered.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>
        <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
          {filtered.map(c => (
            <label key={c.id} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition">
              <input
                type="checkbox"
                checked={selected.has(c.id)}
                onChange={() => toggle(c.id)}
                className="w-4 h-4 rounded accent-blue-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{c.name}</span>
            </label>
          ))}
          {filtered.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No clients found</p>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
          <button
            onClick={() => { onSave([...selected]); onClose(); }}
            className="flex-1 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Save ({selected.size})
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MonthlyWork() {
  const { state, dispatch, showToast } = useApp();
  const now = new Date();

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [manageOpen, setManageOpen]         = useState(false);
  const [templateClient, setTemplateClient] = useState(null);

  const period = periodKey(year, month);
  const allClients = state.clients || [];
  const activeClientIds = state.monthlyWorkClients || [];
  const activeClients = allClients.filter(c => !c.hidden && activeClientIds.includes(c.id));
  const clientTemplates = state.clientWorkTemplates || {};
  const monthlyWork = state.monthlyWork || [];

  // Overall progress
  const fullyDone = activeClients.filter(c => {
    const rec = monthlyWork.find(r => r.clientId === c.id && r.period === period);
    if (!rec || rec.tasks.length === 0) return false;
    return rec.tasks.every(t => t.done);
  }).length;

  function navigateMonth(dir) {
    let m = month + dir;
    let y = year;
    if (m < 0)  { m = 11; y -= 1; }
    if (m > 11) { m = 0;  y += 1; }
    setMonth(m);
    setYear(y);
  }

  function getOrCreateRecord(clientId) {
    const existing = monthlyWork.find(r => r.clientId === clientId && r.period === period);
    if (existing) return existing;
    // Create from template
    const template = clientTemplates[clientId] || DEFAULT_MONTHLY_TASKS;
    const tasks = template.map(label => ({ id: uuid(), label, done: false, doneAt: null }));
    const newRecord = { clientId, period, tasks, notes: '' };
    dispatch({ type: 'UPSERT_MONTHLY_WORK', payload: newRecord });
    return { ...newRecord, id: 'pending' }; // will be in state after re-render
  }

  function ensureRecord(clientId) {
    const existing = monthlyWork.find(r => r.clientId === clientId && r.period === period);
    if (!existing) {
      const template = clientTemplates[clientId] || DEFAULT_MONTHLY_TASKS;
      const tasks = template.map(label => ({ id: uuid(), label, done: false, doneAt: null }));
      dispatch({ type: 'UPSERT_MONTHLY_WORK', payload: { clientId, period, tasks, notes: '' } });
    }
    return existing;
  }

  function handleToggle(clientId, taskId) {
    ensureRecord(clientId);
    dispatch({ type: 'TOGGLE_MONTHLY_WORK_TASK', payload: { clientId, period, taskId } });
  }

  function handleAddTask(clientId, label) {
    ensureRecord(clientId);
    dispatch({ type: 'ADD_MONTHLY_WORK_TASK', payload: { clientId, period, label } });
  }

  function handleDeleteTask(clientId, taskId) {
    dispatch({ type: 'DELETE_MONTHLY_WORK_TASK', payload: { clientId, period, taskId } });
  }

  function handleNotes(clientId, notes) {
    ensureRecord(clientId);
    dispatch({ type: 'UPDATE_MONTHLY_WORK_NOTES', payload: { clientId, period, notes } });
  }

  function handleReset(clientId) {
    if (!confirm('Clear all tasks for this client this month?')) return;
    dispatch({ type: 'DELETE_MONTHLY_WORK', payload: { clientId, period } });
  }

  function handleSaveTemplate(clientId, tasks) {
    dispatch({ type: 'SET_CLIENT_WORK_TEMPLATE', payload: { clientId, tasks } });
    showToast('Template saved. New months will use this template.');
  }

  function handleSaveClients(ids) {
    dispatch({ type: 'SET_MONTHLY_WORK_CLIENTS', payload: ids });
  }

  const templateClientObj = allClients.find(c => c.id === templateClient);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Monthly Work</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track recurring client tasks per month</p>
        </div>
        <button
          onClick={() => setManageOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" />
          </svg>
          Manage Clients
        </button>
      </div>

      {/* Month picker */}
      <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-4 py-3 shadow-sm">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <p className="text-base font-bold text-gray-900 dark:text-white">{monthLabel(year, month)}</p>
        </div>
        <button
          onClick={() => navigateMonth(1)}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Overall progress */}
      {activeClients.length > 0 && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl border',
          fullyDone === activeClients.length
            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700/50'
            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50'
        )}>
          <div className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
            fullyDone === activeClients.length ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'
          )}>
            {fullyDone === activeClients.length ? '✓' : fullyDone}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-semibold', fullyDone === activeClients.length ? 'text-green-800 dark:text-green-300' : 'text-blue-800 dark:text-blue-300')}>
              {fullyDone === activeClients.length
                ? `All ${activeClients.length} clients complete for ${monthLabel(year, month)}`
                : `${fullyDone} of ${activeClients.length} clients fully complete`}
            </p>
            <div className="h-1.5 bg-white/60 dark:bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className={cn('h-full rounded-full transition-all duration-700', fullyDone === activeClients.length ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: activeClients.length === 0 ? '0%' : `${Math.round((fullyDone / activeClients.length) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {activeClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">No clients added yet</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Click "Manage Clients" to select which clients appear here.</p>
          <button
            onClick={() => setManageOpen(true)}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Manage Clients
          </button>
        </div>
      )}

      {/* Client cards */}
      <div className="space-y-3">
        {activeClients.map(client => {
          const record = monthlyWork.find(r => r.clientId === client.id && r.period === period);
          // Auto-create record from template if it doesn't exist yet (show template tasks)
          const templateTasks = clientTemplates[client.id] || DEFAULT_MONTHLY_TASKS;
          const displayRecord = record || { tasks: templateTasks.map(l => ({ id: l, label: l, done: false, doneAt: null })), notes: '' };

          return (
            <ClientCard
              key={client.id}
              client={client}
              period={period}
              record={displayRecord}
              templateTasks={templateTasks}
              onToggle={taskId => handleToggle(client.id, taskId)}
              onAddTask={label => handleAddTask(client.id, label)}
              onDeleteTask={taskId => handleDeleteTask(client.id, taskId)}
              onNotes={notes => handleNotes(client.id, notes)}
              onReset={() => handleReset(client.id)}
              onEditTemplate={() => setTemplateClient(client.id)}
            />
          );
        })}
      </div>

      {/* Manage Clients Modal */}
      <ManageClientsModal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        allClients={allClients}
        activeClientIds={activeClientIds}
        onSave={handleSaveClients}
      />

      {/* Template Modal */}
      <TemplateModal
        isOpen={!!templateClient}
        onClose={() => setTemplateClient(null)}
        client={templateClientObj}
        currentTemplate={templateClient ? clientTemplates[templateClient] : null}
        onSave={tasks => handleSaveTemplate(templateClient, tasks)}
      />
    </div>
  );
}
