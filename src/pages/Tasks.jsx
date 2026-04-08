import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import {
  TAX_TYPES, TAX_TYPE_KEYS, uuid, cn, daysUntil, formatDate,
  TASK_STATUS, PRIORITY, getPriorityColor, getStatusColor,
} from '../utils/index.js';
import {
  Modal, ConfirmDialog, TaxTypeBadge, StatusBadge, CountdownBadge,
  EmptyState, KeyboardHint,
} from '../components/UI.jsx';

// ─── Task Form ─────────────────────────────────────────────────────────────────

function TaskForm({ initial, isOpen, onClose, onSave, clients }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState(() => initial || {
    title: '', description: '', dueDate: today, clientId: '',
    taxType: '', status: 'pending', priority: 'medium', category: '',
  });

  // Reset when initial changes
  useEffect(() => {
    setForm(initial || {
      title: '', description: '', dueDate: today, clientId: '',
      taxType: '', status: 'pending', priority: 'medium', category: '',
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
              <option value="">— General Task —</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tax Type (optional)</label>
            <select className="input" value={form.taxType || ''} onChange={e => set('taxType', e.target.value)}>
              <option value="">— None —</option>
              {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
            </select>
          </div>
        </div>

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

// ─── Task Card ─────────────────────────────────────────────────────────────────

function TaskCard({ task, clients, onEdit, onDelete, onComplete, onReopen, selected, onSelect }) {
  const client = clients.find(c => c.id === task.clientId);
  const days   = task.dueDate ? daysUntil(task.dueDate) : null;
  const isDone = task.status === 'completed';

  const priorityBorder = {
    high:   'border-l-red-500',
    medium: 'border-l-amber-500',
    low:    'border-l-gray-600',
  };

  return (
    <div
      className={cn(
        'card border-l-4 p-4 transition-all group hover:border-r-gray-700',
        isDone ? 'opacity-60' : '',
        priorityBorder[task.priority] || 'border-l-gray-600',
        selected ? 'ring-2 ring-blue-500' : ''
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => isDone ? onReopen(task.id) : onComplete(task.id)}
          title={isDone ? 'Reopen task' : 'Mark done (D)'}
          className={cn(
            'flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-all flex items-center justify-center',
            isDone
              ? 'bg-green-600 border-green-500 text-white'
              : 'border-gray-600 hover:border-green-500 hover:bg-green-500/20'
          )}
        >
          {isDone && <span className="text-xs text-white leading-none">✓</span>}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
            <h3 className={cn('font-semibold text-sm', isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100')}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              {task.category && (
                <span className="badge bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700/40 text-[10px]">
                  {task.category}
                </span>
              )}
              {task.taxType && <TaxTypeBadge type={task.taxType} size="xs" />}
              {!isDone && days !== null && <CountdownBadge days={days} />}
              {isDone && <StatusBadge status="completed" />}
            </div>
          </div>

          {task.description && (
            <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-gray-500">
            {client && <span>👤 {client.name}</span>}
            {task.dueDate && <span>📅 {formatDate(task.dueDate)}</span>}
            <span className={getPriorityColor(task.priority)}>
              {task.priority?.toUpperCase()} priority
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="btn-ghost text-xs py-1 px-2">✏️</button>
          <button onClick={() => onDelete(task.id)} className="btn-ghost text-xs py-1 px-2 hover:text-red-400">🗑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks Page ────────────────────────────────────────────────────────────────

export default function Tasks() {
  const { state, dispatch } = useApp();
  const clients = useClients();

  const [showAdd, setShowAdd]       = useState(false);
  const [editing, setEditing]       = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter]         = useState('all');
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [search, setSearch]             = useState('');
  const [selectedId, setSelectedId]     = useState(null);

  const today = new Date().toISOString().slice(0, 10);

  // Global keyboard shortcut: D = mark selected/first pending task done
  useEffect(() => {
    function handler(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        if (selectedId) {
          dispatch({ type: 'COMPLETE_TASK', payload: selectedId });
          setSelectedId(null);
        }
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setShowAdd(true);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, dispatch]);

  const allTasks = useMemo(() => {
    return [...state.tasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    });
  }, [state.tasks]);

  const filtered = useMemo(() => {
    return allTasks.filter(t => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterClient && t.clientId !== filterClient) return false;
      if (filterType && t.taxType !== filterType) return false;
      if (filterCategory && !(t.category || '').toLowerCase().includes(filterCategory.toLowerCase())) return false;
      if (filter === 'today')    return t.dueDate?.slice(0, 10) === today && t.status !== 'completed';
      if (filter === 'overdue')  return t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'completed';
      if (filter === 'pending')  return t.status === 'pending';
      if (filter === 'in_progress') return t.status === 'in_progress';
      if (filter === 'completed') return t.status === 'completed';
      if (filter === 'non_tax')  return !t.taxType && (t.category || !t.clientId);
      return true;
    });
  }, [allTasks, filter, filterClient, filterType, filterCategory, search, today]);

  // Counts for tabs
  const counts = useMemo(() => ({
    all:         allTasks.length,
    today:       allTasks.filter(t => t.dueDate?.slice(0, 10) === today && t.status !== 'completed').length,
    overdue:     allTasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'completed').length,
    pending:     allTasks.filter(t => t.status === 'pending').length,
    in_progress: allTasks.filter(t => t.status === 'in_progress').length,
    completed:   allTasks.filter(t => t.status === 'completed').length,
    non_tax:     allTasks.filter(t => !t.taxType && (t.category || !t.clientId)).length,
  }), [allTasks, today]);

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today', urgent: counts.today > 0 },
    { key: 'overdue', label: 'Overdue', urgent: counts.overdue > 0 },
    { key: 'non_tax', label: 'Non-Tax' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Tasks</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{counts.pending + counts.in_progress} active tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <KeyboardHint shortcut="N" label="new task" />
          <KeyboardHint shortcut="D" label="mark done" />
          <button onClick={() => setShowAdd(true)} className="btn-primary">+ New Task</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-gray-200 dark:border-gray-800 pb-3">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              filter === tab.key
                ? 'bg-blue-600 text-white'
                : tab.urgent
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-800/50 hover:bg-red-200 dark:hover:bg-red-800/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className="ml-1.5 text-[10px] opacity-80">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input className="input flex-1 min-w-[180px]" placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} />
        <input className="input w-full sm:w-44" placeholder="Filter by category..." value={filterCategory} onChange={e => setFilterCategory(e.target.value)} />
        <select className="input w-full sm:w-44" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-full sm:w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Tax Types</option>
          {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
        </select>
      </div>

      {/* Task List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No tasks found"
          message="Create a task or adjust your filters."
          action={<button onClick={() => setShowAdd(true)} className="btn-primary">New Task</button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}>
              <TaskCard
                task={t}
                clients={clients}
                onEdit={setEditing}
                onDelete={setDeletingId}
                onComplete={id => dispatch({ type: 'COMPLETE_TASK', payload: id })}
                onReopen={id => dispatch({ type: 'REOPEN_TASK', payload: id })}
                selected={selectedId === t.id}
                onSelect={setSelectedId}
              />
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
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
