import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';
import { Modal } from '../components/UI.jsx';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = ['General', 'Double Entry', 'Client Files', 'Payments', 'Accounting', 'Reminders'];

const NOTE_COLORS = [
  {
    id:     'yellow',
    label:  'Yellow',
    dot:    'bg-yellow-400',
    card:   'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40',
    header: 'bg-yellow-100/80 dark:bg-yellow-800/30',
    badge:  'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50',
  },
  {
    id:     'blue',
    label:  'Blue',
    dot:    'bg-blue-400',
    card:   'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40',
    header: 'bg-blue-100/80 dark:bg-blue-800/30',
    badge:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50',
  },
  {
    id:     'green',
    label:  'Green',
    dot:    'bg-green-400',
    card:   'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40',
    header: 'bg-green-100/80 dark:bg-green-800/30',
    badge:  'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/50',
  },
  {
    id:     'pink',
    label:  'Pink',
    dot:    'bg-pink-400',
    card:   'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-700/40',
    header: 'bg-pink-100/80 dark:bg-pink-800/30',
    badge:  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700/50',
  },
  {
    id:     'purple',
    label:  'Purple',
    dot:    'bg-purple-400',
    card:   'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/40',
    header: 'bg-purple-100/80 dark:bg-purple-800/30',
    badge:  'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50',
  },
  {
    id:     'orange',
    label:  'Orange',
    dot:    'bg-orange-400',
    card:   'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/40',
    header: 'bg-orange-100/80 dark:bg-orange-800/30',
    badge:  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/50',
  },
];

const BLANK_NOTE = { title: '', content: '', color: 'yellow', category: 'General', pinned: false };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  const wks  = Math.floor(days / 7);
  if (wks  < 5)   return `${wks}w ago`;
  const mos  = Math.floor(days / 30);
  return `${mos}mo ago`;
}

function getColor(id) {
  return NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0];
}

// ─── NoteCard ─────────────────────────────────────────────────────────────────

function NoteCard({ note, onEdit, onPin, onDelete }) {
  const color = getColor(note.color);

  return (
    <div
      className={cn(
        'group relative rounded-2xl border flex flex-col cursor-pointer',
        'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        color.card
      )}
      onClick={() => onEdit(note)}
    >
      {/* Pin indicator */}
      {note.pinned && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
          </svg>
        </div>
      )}

      {/* Card header: color accent bar */}
      <div className={cn('h-1.5 rounded-t-2xl w-full', color.dot)} />

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Action buttons — appear on hover */}
        <div
          className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onPin(note.id)}
            className={cn(
              'p-1.5 rounded-lg transition',
              note.pinned
                ? 'text-amber-500 bg-white/70 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900'
                : 'text-gray-400 hover:text-amber-500 hover:bg-white/70 dark:hover:bg-gray-900/60'
            )}
            title={note.pinned ? 'Unpin' : 'Pin to top'}
          >
            <svg className="w-3.5 h-3.5" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/70 dark:hover:bg-gray-900/60 transition"
            title="Delete note"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Title */}
        {note.title && (
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug pr-14 line-clamp-2">
            {note.title}
          </h3>
        )}

        {/* Content */}
        {note.content && (
          <p className={cn(
            'text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-5',
            !note.title && 'pr-14'
          )}>
            {note.content}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2">
          {note.category ? (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
              color.badge
            )}>
              {note.category}
            </span>
          ) : <span />}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
            {timeAgo(note.updatedAt || note.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── NoteModal ────────────────────────────────────────────────────────────────

function NoteModal({ note, isOpen, onClose, onSave, onDelete }) {
  const isNew = !note?.id;
  const [form, setForm] = useState(note || BLANK_NOTE);
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    setForm(note || BLANK_NOTE);
    setConfirmDelete(false);
  }, [note, isOpen]);

  const canSave = form.title.trim() || form.content.trim();

  function handleSave() {
    if (!canSave) return;
    onSave(form);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(note.id);
    onClose();
  }

  const selectedColor = getColor(form.color);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? 'New Note' : 'Edit Note'} size="md">
      <div className="space-y-4" onKeyDown={handleKeyDown}>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Title
          </label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Give your note a title…"
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              transition"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
            Content
          </label>
          <textarea
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Write anything here — double entry method, file location, payment received, who you gave files to…"
            rows={7}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              resize-none leading-relaxed transition"
          />
          <p className="text-[10px] text-gray-400 mt-1">Ctrl+Enter to save</p>
        </div>

        {/* Color picker */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
            Color
          </label>
          <div className="flex items-center gap-2.5">
            {NOTE_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c.id }))}
                className={cn(
                  'w-7 h-7 rounded-full transition-all duration-150',
                  c.dot,
                  form.color === c.id
                    ? 'ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-400 dark:ring-offset-gray-900 scale-125 shadow-md'
                    : 'hover:scale-110 opacity-70 hover:opacity-100'
                )}
                title={c.label}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1">{selectedColor.label}</span>
          </div>
        </div>

        {/* Category + Pin row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Category
            </label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                transition cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Pin to Top
            </label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
              className={cn(
                'h-10 px-4 rounded-xl border text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap',
                form.pinned
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700'
              )}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill={form.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {form.pinned ? 'Pinned' : 'Pin'}
            </button>
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between pt-1">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition',
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {confirmDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="btn btn-primary px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isNew ? 'Create Note' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirm for card trash icon ──────────────────────────────────────

function DeleteConfirmModal({ isOpen, onClose, onConfirm }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Note" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this note? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
          >
            Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Notes Page ──────────────────────────────────────────────────────────

export default function NotesPage() {
  const { state, dispatch } = useApp();
  const notes = state.notes || [];

  const [search,     setSearch]     = useState('');
  const [filterCat,  setFilterCat]  = useState('All');
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editNote,   setEditNote]   = useState(null);   // null = new, object = edit
  const [deleteId,   setDeleteId]   = useState(null);

  // ── Filtered + sorted notes ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = notes;
    if (filterCat !== 'All') result = result.filter(n => n.category === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(n =>
        n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, filterCat, search]);

  const byRecency = (a, b) =>
    new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);

  const pinned   = useMemo(() => filtered.filter(n =>  n.pinned).sort(byRecency), [filtered]);
  const unpinned = useMemo(() => filtered.filter(n => !n.pinned).sort(byRecency), [filtered]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function openNew()  { setEditNote(null); setModalOpen(true); }
  function openEdit(note) { setEditNote(note); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditNote(null); }

  function handleSave(form) {
    if (editNote?.id) {
      dispatch({
        type:    'EDIT_NOTE',
        payload: { ...editNote, ...form, updatedAt: new Date().toISOString() },
      });
    } else {
      dispatch({ type: 'ADD_NOTE', payload: form });
    }
  }

  function handleDelete(id) {
    dispatch({ type: 'DELETE_NOTE', payload: id });
  }

  function handlePin(id) {
    dispatch({ type: 'PIN_NOTE', payload: id });
  }

  // Count per category for pill badges
  const catCounts = useMemo(() => {
    const counts = { All: notes.length };
    CATEGORIES.forEach(cat => {
      counts[cat] = notes.filter(n => n.category === cat).length;
    });
    return counts;
  }, [notes]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {notes.length === 0
              ? 'Your personal notepad'
              : `${notes.length} note${notes.length !== 1 ? 's' : ''}${pinned.length > 0 ? ` · ${pinned.length} pinned` : ''}`
            }
          </p>
        </div>
        <button
          onClick={openNew}
          className="btn btn-primary flex items-center gap-2 text-sm flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Note
        </button>
      </div>

      {/* Search + Category filter */}
      <div className="card p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes by title or content…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
              bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800
              transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {['All', ...CATEGORIES].map(cat => {
            const count = catCounts[cat] ?? 0;
            const isActive = filterCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {cat}
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    isActive ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty state — no notes at all */}
      {notes.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-base mb-2">No notes yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Jot down anything — a double entry method, where a file is stored, when you received a payment, who you gave files to. Your personal notepad.
          </p>
          <button onClick={openNew} className="btn btn-primary mx-auto">
            Create your first note
          </button>
        </div>
      )}

      {/* No search/filter results */}
      {notes.length > 0 && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">No notes match your search.</p>
          <button
            onClick={() => { setSearch(''); setFilterCat('All'); }}
            className="mt-3 text-xs text-blue-500 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {/* ── Pinned section ── */}
      {pinned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
            </svg>
            <h2 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
              Pinned
            </h2>
            <span className="text-[10px] text-amber-500 dark:text-amber-500">({pinned.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={openEdit}
                onPin={handlePin}
                onDelete={id => setDeleteId(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── All / Other notes ── */}
      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3">
              Other Notes
            </h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpinned.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={openEdit}
                onPin={handlePin}
                onDelete={id => setDeleteId(id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Modals ── */}
      <NoteModal
        isOpen={modalOpen}
        note={editNote}
        onClose={closeModal}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <DeleteConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
      />
    </div>
  );
}
