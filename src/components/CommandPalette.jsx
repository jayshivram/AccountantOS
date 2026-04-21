import React, { useState, useEffect, useRef, useMemo } from 'react';
import { cn } from '../utils/index.js';

// ─── Command Palette ──────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'nav-dashboard',     label: 'Dashboard',      view: 'dashboard',     icon: 'grid' },
  { id: 'nav-clients',       label: 'Clients',         view: 'clients',       icon: 'people' },
  { id: 'nav-tasks',         label: 'Tasks',           view: 'tasks',         icon: 'check' },
  { id: 'nav-calendar',      label: 'Calendar',        view: 'calendar',      icon: 'calendar' },
  { id: 'nav-notes',         label: 'Notes',           view: 'notes',         icon: 'pencil' },
  { id: 'nav-tally',         label: 'Tally Tracker',   view: 'tally',         icon: 'tally' },
  { id: 'nav-workinghours',  label: 'Working Hours',   view: 'workinghours',  icon: 'clock' },
  { id: 'nav-history',       label: 'History',         view: 'history',       icon: 'history' },
  { id: 'nav-cancellations', label: 'Cancellations',   view: 'cancellations', icon: 'file' },
  { id: 'nav-focus',         label: 'Focus Mode',      view: 'focus',         icon: 'bolt' },
  { id: 'nav-export',        label: 'Export',          view: 'export',        icon: 'export' },
];

const ACTION_ITEMS = [
  { id: 'act-new-note',     label: 'New Note',          subtitle: 'Create a note',         icon: 'note',     type: 'action' },
  { id: 'act-new-task',     label: 'New Task',          subtitle: 'Go to Tasks',           icon: 'task',     type: 'action' },
  { id: 'act-brain-dump',   label: 'Quick Capture',     subtitle: 'Brain dump — backtick', icon: 'capture',  type: 'action' },
  { id: 'act-settings',     label: 'Settings',          subtitle: 'App preferences',       icon: 'settings', type: 'action' },
];

function ItemIcon({ type }) {
  const cls = 'w-4 h-4 flex-shrink-0';
  switch (type) {
    case 'grid':     return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" /></svg>;
    case 'people':   return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" /></svg>;
    case 'check':    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    case 'calendar': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    case 'pencil':   return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
    case 'tally':    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>;
    case 'clock':    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case 'history':  return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>;
    case 'file':     return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4m-1-9H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V7l-4-4z" /></svg>;
    case 'bolt':     return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case 'export':   return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case 'note':     return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
    case 'task':     return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>;
    case 'capture':  return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
    case 'settings': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case 'client':   return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;
    case 'search-task': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    case 'search-note': return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    default:         return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" strokeWidth={2} /></svg>;
  }
}

function fuzzy(text, query) {
  if (!query) return true;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export default function CommandPalette({ isOpen, onClose, state, dispatch, onBrainDump, onSettings }) {
  const [query,         setQuery]     = useState('');
  const [highlighted,   setHighlighted] = useState(0);
  const inputRef   = useRef(null);
  const listRef    = useRef(null);
  const itemRefs   = useRef([]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setHighlighted(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const allItems = useMemo(() => {
    const q = query.trim();
    const items = [];

    // 1 — Actions (always first when no query, fuzzy match when querying)
    const actions = ACTION_ITEMS.filter(a => !q || fuzzy(a.label, q) || fuzzy(a.subtitle || '', q));
    if (actions.length) {
      items.push({ type: 'header', label: 'Actions', id: 'h-actions' });
      actions.forEach(a => items.push({ ...a, group: 'action' }));
    }

    // 2 — Navigate
    const navs = NAV_ITEMS.filter(n => !q || fuzzy(n.label, q));
    if (navs.length) {
      items.push({ type: 'header', label: 'Navigate', id: 'h-nav' });
      navs.forEach(n => items.push({ ...n, group: 'nav' }));
    }

    // 3 — Clients (dynamic, only when query present)
    if (q) {
      const clients = (state.clients || []).filter(c => !c.hidden && fuzzy(c.name, q)).slice(0, 6);
      if (clients.length) {
        items.push({ type: 'header', label: 'Clients', id: 'h-clients' });
        clients.forEach(c => items.push({
          id: `client-${c.id}`,
          label: c.name,
          subtitle: `${(c.taxTypes || []).join(' · ')}`,
          icon: 'client',
          group: 'client',
          clientId: c.id,
        }));
      }

      // 4 — Tasks (pending/in_progress)
      const tasks = (state.tasks || [])
        .filter(t => t.status !== 'completed' && fuzzy(t.title, q))
        .slice(0, 5);
      if (tasks.length) {
        items.push({ type: 'header', label: 'Tasks', id: 'h-tasks' });
        tasks.forEach(t => items.push({
          id: `task-${t.id}`,
          label: t.title,
          subtitle: t.dueDate ? `Due ${t.dueDate}` : t.priority,
          icon: 'search-task',
          group: 'task',
          priority: t.priority,
        }));
      }

      // 5 — Notes
      const notes = (state.notes || []).filter(n => fuzzy(n.title || n.content || '', q)).slice(0, 5);
      if (notes.length) {
        items.push({ type: 'header', label: 'Notes', id: 'h-notes' });
        notes.forEach(n => items.push({
          id: `note-${n.id}`,
          label: n.title || '(untitled)',
          subtitle: n.category,
          icon: 'search-note',
          group: 'note',
        }));
      }
    }

    return items;
  }, [query, state.clients, state.tasks, state.notes]);

  // Only selectable items (not headers)
  const selectableItems = allItems.filter(i => i.type !== 'header');

  // Keep highlighted in range when list changes
  useEffect(() => {
    setHighlighted(h => Math.min(h, Math.max(0, selectableItems.length - 1)));
  }, [selectableItems.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = itemRefs.current[highlighted];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlighted]);

  function execute(item) {
    if (!item) return;
    onClose();

    if (item.group === 'nav') {
      dispatch({ type: 'SET_VIEW', payload: item.view });
      return;
    }
    if (item.group === 'client' || item.group === 'task' || item.group === 'note') {
      const view = item.group === 'client' ? 'clients' : item.group === 'task' ? 'tasks' : 'notes';
      dispatch({ type: 'SET_VIEW', payload: view });
      return;
    }
    if (item.group === 'action') {
      switch (item.id) {
        case 'act-new-note':   dispatch({ type: 'SET_VIEW', payload: 'notes' });  break;
        case 'act-new-task':   dispatch({ type: 'SET_VIEW', payload: 'tasks' });  break;
        case 'act-brain-dump': onBrainDump(); break;
        case 'act-settings':   onSettings(); break;
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, selectableItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      execute(selectableItems[highlighted]);
    }
  }

  if (!isOpen) return null;

  // Map selectable index per item
  let selectableIdx = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden animate-fade-in">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHighlighted(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, clients, tasks, notes…"
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono text-gray-400 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto max-h-[60vh] py-2">
          {allItems.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
              No results for "{query}"
            </div>
          )}

          {allItems.map((item, idx) => {
            if (item.type === 'header') {
              return (
                <div key={item.id} className="px-4 pt-3 pb-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-600">
                    {item.label}
                  </span>
                </div>
              );
            }

            const selIdx = selectableIdx++;
            const isHighlighted = selIdx === highlighted;

            return (
              <div
                key={item.id}
                ref={el => itemRefs.current[selIdx] = el}
                onMouseEnter={() => setHighlighted(selIdx)}
                onClick={() => execute(item)}
                className={cn(
                  'flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                  isHighlighted
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <span className={cn(
                  'flex-shrink-0',
                  isHighlighted ? 'text-white' : 'text-gray-400 dark:text-gray-500'
                )}>
                  <ItemIcon type={item.icon} />
                </span>

                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{item.label}</span>
                  {item.subtitle && (
                    <span className={cn(
                      'block text-[11px] truncate',
                      isHighlighted ? 'text-blue-100' : 'text-gray-400 dark:text-gray-600'
                    )}>
                      {item.subtitle}
                    </span>
                  )}
                </span>

                {item.priority && (
                  <span className={cn(
                    'flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md',
                    isHighlighted
                      ? 'bg-blue-500 text-blue-100'
                      : item.priority === 'high'   ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                      : item.priority === 'medium' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      :                              'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  )}>
                    {item.priority}
                  </span>
                )}

                {isHighlighted && (
                  <kbd className="flex-shrink-0 text-[10px] font-mono text-blue-200 bg-blue-500 px-1.5 py-0.5 rounded-md">
                    ↵
                  </kbd>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-[10px] text-gray-400 dark:text-gray-600">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
          <span className="ml-auto">Ctrl+K to reopen</span>
        </div>
      </div>
    </div>
  );
}
