import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AppProvider, useApp, useSyncStatus } from './context/AppContext.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import Dashboard      from './pages/Dashboard.jsx';
import Clients        from './pages/Clients.jsx';
import Tasks          from './pages/Tasks.jsx';
import Calendar       from './pages/Calendar.jsx';
import History        from './pages/History.jsx';
import TallyTracker   from './pages/TallyTracker.jsx';
import FocusMode      from './pages/FocusMode.jsx';
import ExportPage     from './pages/Export.jsx';
import Cancellations  from './pages/Cancellations.jsx';
import WorkingHours   from './pages/WorkingHours.jsx';
import Notes          from './pages/Notes.jsx';
import AIAssistant    from './pages/AIAssistant.jsx';
import Filings        from './pages/Filings.jsx';
import MonthlyWork    from './pages/MonthlyWork.jsx';
import TaxTool        from './pages/TaxTool.jsx';
import Documents      from './pages/Documents.jsx';
import Login          from './components/Login.jsx';
import ErrorBoundary  from './components/ErrorBoundary.jsx';
import PdfViewer      from './components/PdfViewer.jsx';

// ─── Work Guide Page ──────────────────────────────────────────────────────────

const WORK_GUIDE_TABS = [
  { key: 'guide', label: 'Accounting Guide', type: 'html', src: '/guide.html' },
  { key: 'rsm',    label: 'RSM Tax Guide 25/26', type: 'pdf', src: encodeURI('/RSMTZ_Tanzania Tax Guide 2025-26 (1).pdf') },
  { key: 'glance', label: 'Taxes at a Glance',   type: 'pdf', src: encodeURI('/TAXES_AND_DUTIES_AT_A_GLANCE_2025_2026 (2).pdf') },
  { key: 'card',   label: 'Tax Datacard',        type: 'pdf', src: encodeURI('/tanzania-tax-datacard-2025-2026.pdf') },
];

function WorkGuidePage() {
  const [tab, setTab] = useState('guide');
  // PDFs render via the browser's native viewer by default (simple, with built-in
  // text selection). Some embedded/GPU-disabled browsers paint PDFs black — the
  // "built-in viewer" fallback swaps in our pdf.js canvas renderer, which always works.
  const [builtInPdf, setBuiltInPdf] = useState(false);
  const active = WORK_GUIDE_TABS.find(t => t.key === tab) || WORK_GUIDE_TABS[0];
  const isPdf = active.type === 'pdf';

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      <div className="px-4 sm:px-6 pt-4 pb-2 flex-shrink-0 overflow-x-auto">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl w-fit min-w-max">
          {WORK_GUIDE_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl transition whitespace-nowrap',
                tab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* flex-1 + relative gives the wrapper a resolved size synchronously, avoiding a
          layout-timing issue where content sized by flex-grow can initialize at 0x0. */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 flex flex-col">
          {isPdf && builtInPdf ? (
            <PdfViewer key={active.key} src={active.src} title={active.label} />
          ) : (
            <>
              {isPdf && (
                <div className="flex items-center justify-between gap-3 px-4 py-1.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
                  <span className="text-xs text-gray-400 dark:text-gray-500">PDF not showing?</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setBuiltInPdf(true)} className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      Use built-in viewer
                    </button>
                    <a href={active.src} download className="text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                      Download
                    </a>
                  </div>
                </div>
              )}
              <iframe
                key={active.key}
                src={active.src}
                title={active.label}
                className="w-full flex-1 border-0 block"
                style={{ colorScheme: 'light' }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
import {
  exportData, importData, requestNotificationPermission, cn, getLastSyncTs, clearState, listBackups, loadBackup
} from './utils/index.js';
import { isInstallable, promptInstall, isRunningStandalone, clearAppCache } from './lib/pwa.js';
import { Toggle, Modal, BatteryWidget, LiveClock, ToastContainer } from './components/UI.jsx';
import { supabase } from './lib/supabase.js';

// ─── Nav Icons (inline SVG) ───────────────────────────────────────────────────

const Icons = {
  Dashboard: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z" />
    </svg>
  ),
  Clients: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" />
    </svg>
  ),
  Calendar: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Tasks: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  History: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Tally: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  Focus: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  Export: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Cancellations: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l2 2 4-4m-1-9H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V7l-4-4z" />
    </svg>
  ),
  WorkingHours: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Logout: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Menu: () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Close: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  Notes: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  AI: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  Filings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
    </svg>
  ),
  MonthlyWork: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
  TaxTool: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  WorkGuide: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  Documents: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z M13 3v5a1 1 0 001 1h5" />
    </svg>
  ),
};
// ─── Sync Status Badge ───────────────────────────────────────────────────────────────

function SyncBadge() {
  const status = useSyncStatus();
  const { manualSync } = useApp();
  const [, tick] = useState(0);

  // Re-render every 30 s so the relative time stays fresh
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!status || status === 'idle') return null;

  const map = {
    syncing: { dot: 'bg-blue-500 animate-pulse', text: 'Syncing…',  cls: 'text-blue-600 dark:text-blue-400' },
    synced:  { dot: 'bg-green-500',              text: '\u2713 Synced',  cls: 'text-green-600 dark:text-green-400' },
    error:   { dot: 'bg-red-500',                text: '\u26a0 Sync err', cls: 'text-red-600 dark:text-red-400'   },
  };
  const { dot, text, cls } = map[status] || map.synced;

  // Build tooltip
  let tooltip = text;
  if (status === 'synced') {
    const ts = getLastSyncTs();
    if (ts) {
      const diffSec = Math.round((Date.now() - ts) / 1000);
      if (diffSec < 60)           tooltip = `Last synced ${diffSec}s ago`;
      else if (diffSec < 3600)    tooltip = `Last synced ${Math.round(diffSec / 60)}m ago`;
      else                        tooltip = `Last synced ${Math.round(diffSec / 3600)}h ago`;
    }
  }

  return (
    <button
      onClick={manualSync}
      disabled={status === 'syncing'}
      className={cn('flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 px-2 py-1 rounded transition-colors', cls, status === 'syncing' && 'opacity-75 cursor-wait')} 
      title={tooltip + " (Click to force sync)"}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dot)} />
      <span className="hidden sm:inline">{text}</span>
    </button>
  );
}// ─── PWA Install Hook ───────────────────────────────────────────────────────────────

function useInstallPWA() {
  const [canInstall, setCanInstall] = useState(isInstallable);

  useEffect(() => {
    const onReady     = () => setCanInstall(true);
    const onInstalled = () => setCanInstall(false);
    window.addEventListener('pwa:installable', onReady);
    window.addEventListener('pwa:installed',   onInstalled);
    return () => {
      window.removeEventListener('pwa:installable', onReady);
      window.removeEventListener('pwa:installed',   onInstalled);
    };
  }, []);

  return { canInstall, install: promptInstall, isStandalone: isRunningStandalone() };
}
// ─── Brain Dump Modal ────────────────────────────────────────────────────────

const BD_COLORS = [
  { id: 'yellow', dot: 'bg-yellow-400' },
  { id: 'blue',   dot: 'bg-blue-400'   },
  { id: 'green',  dot: 'bg-green-400'  },
  { id: 'pink',   dot: 'bg-pink-400'   },
  { id: 'purple', dot: 'bg-purple-400' },
  { id: 'orange', dot: 'bg-orange-400' },
];

function BrainDumpModal({ isOpen, onClose, dispatch }) {
  const [mode,    setMode]    = useState('note'); // 'note' | 'task'
  const [text,    setText]    = useState('');
  const [color,   setColor]   = useState('yellow');
  const [priority,setPriority] = useState('high');
  const [dueDate, setDueDate]  = useState('');
  const taRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const today = new Date().toISOString().slice(0, 10);
      setMode('note'); setText(''); setColor('yellow'); setPriority('high'); setDueDate(today);
      setTimeout(() => taRef.current?.focus(), 30);
    }
  }, [isOpen]);

  function handleSave() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const lines = trimmed.split('\n');
    const firstLine = lines[0].slice(0, 60);
    const now = new Date();
    const hhmm = now.toTimeString().slice(0, 5);
    const title = firstLine || `Quick Capture – ${hhmm}`;
    const rest  = lines.slice(1).join('\n').trim();

    if (mode === 'note') {
      dispatch({ type: 'ADD_NOTE', payload: { title, content: trimmed, color, category: 'General', pinned: false } });
    } else {
      dispatch({ type: 'ADD_TASK', payload: {
        title,
        description: rest,
        dueDate,
        status:   'pending',
        priority,
        category: 'Brain Dump',
        clientId: '',
        taxType:  '',
      }});
    }
    onClose();
  }

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  }

  const wc = text.trim() ? text.trim().split(/\s+/).length : 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {[['note', '📝 Note'], ['task', '✓ Task']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition',
                  mode === m
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Textarea */}
        <div className="px-5 pb-3">
          <textarea
            ref={taRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'note'
              ? "Get it out of your head...\n\nFirst line becomes the title. Supports **bold**, *italic*, - lists."
              : "What needs to be done?\n\nFirst line becomes the task title."}
            rows={6}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none leading-relaxed font-mono transition"
          />
          <p className="text-[10px] text-gray-400 mt-1">{wc} word{wc !== 1 ? 's' : ''} · Ctrl+Enter to save · Esc to cancel</p>
        </div>

        {/* Mode-specific extras */}
        <div className="px-5 pb-4 flex items-center gap-3 flex-wrap">
          {mode === 'note' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Color:</span>
              {BD_COLORS.map(c => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    'w-5 h-5 rounded-full transition-all',
                    c.dot,
                    color === c.id ? 'ring-2 ring-offset-1 ring-gray-500 dark:ring-gray-400 dark:ring-offset-gray-900 scale-125' : 'opacity-60 hover:opacity-100'
                  )}
                />
              ))}
            </div>
          )}
          {mode === 'task' && (
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
                {[['low','Low'],['medium','Med'],['high','High']].map(([p, label]) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-xs font-semibold transition',
                      priority === p
                        ? p === 'high' ? 'bg-red-600 text-white shadow-sm'
                          : p === 'medium' ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-gray-500 text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">Due:</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="btn btn-primary px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Save {mode === 'note' ? 'Note' : 'Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Storage Usage Bar ────────────────────────────────────────────────────────

function StorageUsageSection() {
  const [dbBytes,  setDbBytes]  = useState(null);
  const [rowBytes, setRowBytes] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [rpcMissing, setRpcMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_storage_stats');
      if (cancelled) return;
      if (error || !data) {
        setRpcMissing(true);
      } else {
        setDbBytes(data.db_bytes);
        setRowBytes(data.row_bytes);
        setRpcMissing(false);
      }
      setLoading(false);
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  function fmtSize(b) {
    if (b == null)          return '—';
    if (b < 1024)           return `${b} B`;
    if (b < 1024 * 1024)    return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  }

  const SUPABASE_LIMIT = 500 * 1024 * 1024;
  const dbPct  = dbBytes  != null ? (dbBytes  / SUPABASE_LIMIT) * 100 : 0;
  const rowPct = rowBytes != null ? (rowBytes / SUPABASE_LIMIT) * 100 : 0;

  let lsBytes = 0;
  try {
    const raw = localStorage.getItem('accountant-os-v1');
    if (raw) lsBytes = new Blob([raw]).size;
  } catch {}
  const LS_LIMIT = 5 * 1024 * 1024;
  const lsPct = (lsBytes / LS_LIMIT) * 100;

  function Bar({ pct, colorClass, indeterminate }) {
    return (
      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        {indeterminate ? (
          <div className="h-full w-1/3 rounded-full bg-gray-400 dark:bg-gray-500 animate-pulse" />
        ) : (
          <div
            className={cn('h-full rounded-full transition-all duration-700', colorClass)}
            style={{ width: `${Math.max(pct, 0.12)}%` }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Storage Usage</p>
        {loading && (
          <span className="text-[10px] text-blue-500 dark:text-blue-400 animate-pulse">Fetching live data…</span>
        )}
      </div>

      {rpcMissing && (
        <div className="text-[10px] leading-relaxed text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg px-3 py-2">
          Live DB stats unavailable. Run <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">get_storage_stats()</code> function in your Supabase SQL Editor to enable accurate tracking.
        </div>
      )}

      {/* Total database size */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Total Database Size</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-500">
            {fmtSize(dbBytes)} <span className="text-gray-300 dark:text-gray-700">/</span> 500 MB
          </span>
        </div>
        <Bar pct={dbPct} colorClass="bg-blue-500" indeterminate={loading} />
        <p className="text-[10px] text-gray-400 dark:text-gray-600">
          {!loading && dbBytes != null
            ? `${dbPct < 0.01 ? '< 0.01' : dbPct.toFixed(4)}% — real PostgreSQL measurement`
            : 'Measured directly from PostgreSQL'}
        </p>
      </div>

      {/* User's data row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Your Data Row (JSONB)</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-500">
            {fmtSize(rowBytes)}
          </span>
        </div>
        <Bar pct={rowPct} colorClass="bg-indigo-500" indeterminate={loading} />
        <p className="text-[10px] text-gray-400 dark:text-gray-600">Actual column size in the database</p>
      </div>

      {/* localStorage */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 dark:text-gray-400 font-medium">Local Storage</span>
          <span className="tabular-nums text-gray-500 dark:text-gray-500">
            {fmtSize(lsBytes)} <span className="text-gray-300 dark:text-gray-700">/</span> ~5 MB
          </span>
        </div>
        <Bar pct={lsPct} colorClass={lsPct > 80 ? 'bg-red-500' : lsPct > 50 ? 'bg-amber-500' : 'bg-green-500'} />
        <p className="text-[10px] text-gray-400 dark:text-gray-600">{lsPct.toFixed(2)}% used</p>
      </div>
    </div>
  );
}

// ─── Tax Rates Settings Section ────────────────────────────────────────────────

const WHT_LABELS = {
  rent: 'Rent',
  dividend_resident: 'Dividend (Resident)',
  dividend_non_resident: 'Dividend (Non-Resident)',
  interest_resident: 'Interest (Resident)',
  interest_non_resident: 'Interest (Non-Resident)',
  royalty_resident: 'Royalty (Resident)',
  royalty_non_resident: 'Royalty (Non-Resident)',
  service_fee_resident: 'Service Fee (Resident)',
  service_fee_non_resident: 'Service Fee (Non-Resident)',
  technical_fee_resident: 'Technical Fee (Resident)',
  technical_fee_non_resident: 'Technical Fee (Non-Resident)',
  commission_resident: 'Commission (Resident)',
  commission_non_resident: 'Commission (Non-Resident)',
  insurance_premium: 'Insurance Premium',
  pension_lump_sum: 'Pension Lump Sum',
  natural_resource: 'Natural Resource',
  aircraft_lease: 'Aircraft Lease',
  ship_lease: 'Ship Lease',
  other_non_resident: 'Other (Non-Resident)',
};

function TaxRatesSection() {
  const { state, dispatch } = useApp();
  const rates = state.taxRates || {};
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [tab, setTab] = useState('core');

  function toggle() { setExpanded(v => !v); if (expanded) setEditMode(false); }
  function handleReset() {
    if (window.confirm('Reset ALL tax rates to Tanzania defaults?\nThis cannot be undone.')) {
      dispatch({ type: 'RESET_TAX_RATES' });
      setEditMode(false);
    }
  }

  const pct = (v, d = 2) => v != null ? `${parseFloat((v * 100).toFixed(d))}%` : '—';
  const inputCls = 'w-20 px-3 py-1.5 text-sm text-right rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition';
  const bandInputCls = 'w-full px-2.5 py-1.5 text-sm rounded-xl border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-gray-900 dark:text-white text-right focus:outline-none focus:ring-2 focus:ring-amber-500 transition';

  function RateRow({ label, description, value, children }) {
    return (
      <div className={cn('flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition',
        editMode ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-gray-50 dark:bg-gray-800/60')}>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-none">{label}</p>
          {description && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{description}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {editMode ? children : <span className="text-sm font-semibold text-gray-900 dark:text-white">{value}</span>}
        </div>
      </div>
    );
  }

  function PctInput({ stateKey, decimals = 2, multiplier = 100 }) {
    const val = rates[stateKey];
    const display = val != null ? (val * multiplier).toFixed(decimals) : '';
    return (
      <>
        <input type="number" step="any" defaultValue={display} key={display}
          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) dispatch({ type: 'SET_TAX_RATE', payload: { key: stateKey, value: v / multiplier } }); }}
          className={inputCls} />
        <span className="text-sm text-gray-400 dark:text-gray-500 w-3">%</span>
      </>
    );
  }

  function RawInput({ stateKey }) {
    const val = rates[stateKey];
    return (
      <input type="number" step="1" defaultValue={val ?? ''} key={val}
        onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) dispatch({ type: 'SET_TAX_RATE', payload: { key: stateKey, value: v } }); }}
        className={inputCls} />
    );
  }

  return (
    <div>
      {/* Collapsible header */}
      <button onClick={toggle}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Tax Rates</span>
          {!expanded && <span className="text-xs text-gray-400 dark:text-gray-500 truncate">VAT {pct(rates.VAT)} · PAYE {rates.PAYE_BANDS?.length || 0} bands · WHT {Object.keys(rates.WHT || {}).length} types</span>}
        </div>
        <svg className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200', expanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">

          {/* Lock / Unlock bar */}
          {editMode ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
              <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-amber-700 dark:text-amber-300 font-medium flex-1">Editing — changes apply immediately</span>
              <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 font-medium hover:underline transition">Reset</button>
              <button onClick={() => setEditMode(false)}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Lock
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-xs text-gray-500 dark:text-gray-400">Locked — read only</span>
              </div>
              <button onClick={() => setEditMode(true)}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-amber-400 hover:text-amber-600 dark:hover:border-amber-600 dark:hover:text-amber-400 font-medium transition">
                Unlock to Edit
              </button>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-xl">
            {[['core','Core'],['paye','PAYE'],['prov','Provisional'],['wht','WHT']].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)}
                className={cn('flex-1 py-1.5 text-xs font-semibold rounded-lg transition',
                  tab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'core' && (
            <div className="space-y-2">
              <RateRow label="VAT" description="Value Added Tax" value={pct(rates.VAT)}><PctInput stateKey="VAT" /></RateRow>
              <RateRow label="Corporate Tax" description="Company income tax" value={pct(rates.CORPORATE)}><PctInput stateKey="CORPORATE" /></RateRow>
              <RateRow label="NSSF Employee" description="Employee contribution" value={pct(rates.NSSF_EMPLOYEE)}><PctInput stateKey="NSSF_EMPLOYEE" /></RateRow>
              <RateRow label="NSSF Employer" description="Employer contribution" value={pct(rates.NSSF_EMPLOYER)}><PctInput stateKey="NSSF_EMPLOYER" /></RateRow>
              <RateRow label="SDL Rate" description="Skills Development Levy" value={pct(rates.SDL, 1)}><PctInput stateKey="SDL" decimals={1} /></RateRow>
              <RateRow label="SDL Min Employees" description="Min staff to trigger SDL" value={`${rates.SDL_MIN_EMPLOYEES ?? 10} staff`}>
                <RawInput stateKey="SDL_MIN_EMPLOYEES" />
                <span className="text-sm text-gray-400 dark:text-gray-500">staff</span>
              </RateRow>
              <RateRow label="WCF Rate" description="Workers Compensation Fund" value={pct(rates.WCF, 3)}><PctInput stateKey="WCF" decimals={3} /></RateRow>
              <RateRow label="City Levy (pre-2025 Q3)" description="Old rate" value={pct(rates.CITY_LEVY_OLD, 4)}><PctInput stateKey="CITY_LEVY_OLD" decimals={4} /></RateRow>
              <RateRow label="City Levy (2025 Q3+)" description="Current rate" value={pct(rates.CITY_LEVY_NEW, 4)}><PctInput stateKey="CITY_LEVY_NEW" decimals={4} /></RateRow>
            </div>
          )}

          {(tab === 'paye' || tab === 'prov') && (() => {
            const bandKey = tab === 'paye' ? 'PAYE_BANDS' : 'PROV_BANDS';
            const bands = rates[bandKey] || [];
            const unit = tab === 'paye' ? 'monthly' : 'annual';
            return (
              <div className="space-y-3">
                {editMode && <p className="text-xs text-amber-600 dark:text-amber-400 px-1">Thresholds in TZS ({unit}). Leave Max blank for top band.</p>}
                {bands.map((band, i) => (
                  <div key={i} className={cn('p-3 rounded-xl border transition',
                    editMode ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-700' : 'bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-800')}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Band {i + 1}</span>
                      <span className={cn('text-xs font-bold', editMode ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400')}>
                        {(band.rate * 100).toFixed(1)}% rate
                      </span>
                    </div>
                    {editMode ? (
                      <div className="grid grid-cols-2 gap-2">
                        {[['min','Min (TZS)'],['max','Max (TZS)'],['rate','Rate (%)'],['fixed','Fixed (TZS)']].map(([field, label]) => (
                          <div key={field}>
                            <label className="block text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</label>
                            <input type="number" step="any"
                              key={`${bandKey}-${i}-${field}-${band[field]}`}
                              defaultValue={field === 'rate' ? (band[field] * 100).toFixed(1) : band[field] === Infinity ? '' : band[field]}
                              placeholder={field === 'max' && band[field] === Infinity ? '∞' : ''}
                              onBlur={e => {
                                let v;
                                if (field === 'rate') v = parseFloat(e.target.value) / 100;
                                else if (e.target.value === '' && field === 'max') v = Infinity;
                                else v = parseFloat(e.target.value);
                                if (!isNaN(v)) dispatch({ type: 'SET_TAX_BAND', payload: { bandKey, index: i, field, value: v } });
                              }}
                              className={bandInputCls} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {[['Min', band.min?.toLocaleString('en-US')], ['Max', band.max === Infinity ? '∞' : band.max?.toLocaleString('en-US')],
                          ['Rate', `${(band.rate * 100).toFixed(1)}%`], ['Fixed', band.fixed?.toLocaleString('en-US')]].map(([k, v]) => (
                          <span key={k} className="text-xs text-gray-500 dark:text-gray-400">{k}: <strong className="text-gray-700 dark:text-gray-200">{v}</strong></span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}

          {tab === 'wht' && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {Object.entries(rates.WHT || {}).map(([key, val]) => (
                <div key={key} className={cn('flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition',
                  editMode ? 'bg-amber-50/50 dark:bg-amber-900/10' : 'bg-gray-50 dark:bg-gray-800/60')}>
                  <span className="text-sm text-gray-700 dark:text-gray-300 min-w-0 truncate">{WHT_LABELS[key] || key}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {editMode ? (
                      <>
                        <input type="number" step="any" defaultValue={(val * 100).toFixed(1)} key={`${key}-${val}`}
                          onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) dispatch({ type: 'SET_WHT_RATE', payload: { key, value: v / 100 } }); }}
                          className={inputCls} />
                        <span className="text-sm text-gray-400 dark:text-gray-500 w-3">%</span>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{pct(val, 1)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ─── Local Backups (restore) ──────────────────────────────────────────────────

function LocalBackupsSection({ onClose }) {
  const { dispatch, showToast } = useApp();
  const [backups, setBackups] = useState(() => listBackups());
  const [confirmKey, setConfirmKey] = useState(null);

  if (backups.length === 0) {
    return (
      <div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">Local Backups</p>
        <p className="text-xs text-gray-400 dark:text-gray-600">Automatic daily snapshots will appear here once you've used the app for a day.</p>
      </div>
    );
  }

  function fmtSize(n) {
    return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  }

  function restore(key) {
    const data = loadBackup(key);
    if (!data) { showToast('Could not read that backup'); return; }
    dispatch({ type: 'IMPORT_DATA', payload: data });
    setConfirmKey(null);
    onClose?.();
    showToast('Backup restored');
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Local Backups</p>
      <p className="text-xs text-gray-400 dark:text-gray-600 mb-3">Automatic daily snapshots on this device · last {backups.length}. Restoring replaces your current data.</p>
      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
        {backups.map(b => (
          <div key={b.key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200">{b.date}</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600">{fmtSize(b.size)}</p>
            </div>
            {confirmKey === b.key ? (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Replace all?</span>
                <button onClick={() => restore(b.key)} className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition">Yes, restore</button>
                <button onClick={() => setConfirmKey(null)} className="text-[11px] font-medium px-2 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 transition">No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmKey(b.key)} className="flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
                Restore
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Settings Modal ───────────────────────────────────────────────────────────

function SettingsModal({ isOpen, onClose, onLogout, userEmail }) {
  const { state, dispatch } = useApp();
  const { canInstall, install, isStandalone } = useInstallPWA();
  const [cacheCleared, setCacheCleared] = useState(false);

  function handleExport() {
    const { currentView, currentMonth, ...data } = state;
    exportData(data);
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await importData(file);
      dispatch({ type: 'IMPORT_DATA', payload: data });
      alert('Data imported successfully!');
      onClose();
    } catch (err) {
      alert('Failed to import: ' + err.message);
    }
    e.target.value = '';
  }

  async function enableNotifications() {
    if (!('Notification' in window)) {
      alert('Notifications are not supported in this browser.');
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      dispatch({ type: 'TOGGLE_NOTIFICATIONS' });
    } else {
      alert('Notification permission was denied. Please enable it in your browser settings.');
    }
  }

  async function handleInstall() {
    const accepted = await install();
    if (accepted) onClose();
  }

  async function handleClearCache() {
    await clearAppCache();
    setCacheCleared(true);
    setTimeout(() => window.location.reload(), 600);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="sm">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Dark Mode</p>
            <p className="text-xs text-gray-500">Toggle light/dark theme</p>
          </div>
          <Toggle checked={state.darkMode} onChange={() => dispatch({ type: 'TOGGLE_DARK_MODE' })} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Browser Notifications</p>
            <p className="text-xs text-gray-500">Deadline reminders</p>
          </div>
          <Toggle checked={state.notifications} onChange={enableNotifications} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Time Format</p>
            <p className="text-xs text-gray-500">Working Hours display</p>
          </div>
          <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {['24', '12'].map(fmt => (
              <button
                key={fmt}
                onClick={() => dispatch({ type: 'SET_HOUR_FORMAT', payload: fmt })}
                className={cn(
                  'px-3 py-1 text-xs font-semibold rounded-md transition',
                  (state.hourFormat || '24') === fmt
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                {fmt}h
              </button>
            ))}
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <StorageUsageSection />

        <hr className="border-gray-200 dark:border-gray-800" />

        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Data Backup</p>
          <div className="space-y-2">
            <button onClick={handleExport} className="btn-secondary w-full justify-center">
              ⬇️ Export JSON Backup
            </button>
            <label className="btn btn-secondary w-full justify-center cursor-pointer">
              ⬆️ Import JSON Backup
              <input type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <LocalBackupsSection onClose={onClose} />

        <hr className="border-gray-200 dark:border-gray-800" />

        <div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">App Install</p>
          <div className="space-y-2">
            {isStandalone ? (
              <p className="text-xs text-green-600 dark:text-green-400 font-semibold text-center py-1">
                ✓ Running as installed app
              </p>
            ) : canInstall ? (
              <button onClick={handleInstall} className="btn-secondary w-full justify-center">
                📲 Install App (PWA)
              </button>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-1 leading-relaxed">
                Open your browser menu and choose<br />"Install App" or "Add to Home Screen"
              </p>
            )}
            <button
              onClick={handleClearCache}
              disabled={cacheCleared}
              className={cn('btn-secondary w-full justify-center', cacheCleared && 'opacity-50 cursor-not-allowed')}
            >
              {cacheCleared ? '✓ Cleared, reloading…' : '🗑️ Clear Cache & Reload'}
            </button>
          </div>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        <div className="text-xs text-gray-400 dark:text-gray-600 space-y-0.5">
          <p>Keyboard Shortcuts:</p>
          <p><kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded border border-gray-300 dark:border-gray-700">D</kbd> Mark selected task done</p>
          <p><kbd className="bg-gray-100 dark:bg-gray-800 px-1 rounded border border-gray-300 dark:border-gray-700">N</kbd> New task (on Tasks page)</p>
        </div>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* Tax Rates */}
        <TaxRatesSection />

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* Telegram Bot */}
        <TelegramSection />

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* Hidden Clients */}
        <HiddenClientsSection userEmail={userEmail} />

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* Signed-in user + logout */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
              {userEmail ? userEmail[0].toUpperCase() : '?'}
            </div>
            <span className="text-xs text-gray-700 dark:text-gray-300 truncate min-w-0">{userEmail}</span>
          </div>
          <button
            onClick={() => { onClose(); onLogout(); }}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-xl
              text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50
              hover:bg-red-50 dark:hover:bg-red-900/20 transition"
          >
            <Icons.Logout />
            Sign Out
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Hidden Clients Section ───────────────────────────────────────────────────

function HiddenClientsSection({ userEmail }) {
  const { state, dispatch } = useApp();
  const hiddenClients = (state.clients || []).filter(c => c.hidden);

  // step: 'locked' | 'password' | 'list'
  const [step,     setStep]     = useState('locked');
  const [password, setPassword] = useState('');
  const [pwError,  setPwError]  = useState('');
  const [verifying,setVerifying]= useState(false);
  const [selected, setSelected] = useState(new Set());

  function reset() { setStep('locked'); setPassword(''); setPwError(''); setSelected(new Set()); }

  async function handleVerify(e) {
    e.preventDefault();
    if (!password) return;
    setVerifying(true); setPwError('');
    const { error } = await supabase.auth.signInWithPassword({ email: userEmail, password });
    setVerifying(false);
    if (error) {
      setPwError('Incorrect password. Please try again.');
    } else {
      setPassword('');
      setStep('list');
      setSelected(new Set(hiddenClients.map(c => c.id)));
    }
  }

  function toggleSelect(id) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleUnhide() {
    if (selected.size === 0) return;
    dispatch({ type: 'UNHIDE_CLIENTS', payload: [...selected] });
    reset();
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Hidden Clients</p>

      {hiddenClients.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-600">No hidden clients.</p>
      ) : step === 'locked' ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {hiddenClients.length} client{hiddenClients.length !== 1 ? 's' : ''} hidden
          </p>
          <button
            onClick={() => setStep('password')}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 transition flex items-center gap-1.5"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Manage ({hiddenClients.length})
          </button>
        </div>
      ) : step === 'password' ? (
        <form onSubmit={handleVerify} className="space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">Enter your password to view hidden clients:</p>
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setPwError(''); }}
            placeholder="Your login password"
            autoFocus
            className="w-full px-3 py-2 text-sm rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
          {pwError && <p className="text-xs text-red-500 dark:text-red-400">{pwError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex-1 text-xs py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
            <button
              type="submit"
              disabled={verifying || !password}
              className="flex-1 text-xs py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 transition"
            >
              {verifying ? 'Verifying…' : 'Verify'}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Select clients to unhide:</p>
            <button
              onClick={() => setSelected(prev => prev.size === hiddenClients.length ? new Set() : new Set(hiddenClients.map(c => c.id)))}
              className="text-[11px] text-blue-500 hover:underline"
            >
              {selected.size === hiddenClients.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {hiddenClients.map(c => (
              <label key={c.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer transition">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{c.name}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={reset} className="flex-1 text-xs py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition">Cancel</button>
            <button
              onClick={handleUnhide}
              disabled={selected.size === 0}
              className="flex-1 text-xs py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 transition"
            >
              Unhide {selected.size > 0 ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Telegram Settings Section ───────────────────────────────────────────────

function TelegramSection() {
  const [testing,  setTesting]  = useState(false);
  const [testMsg,  setTestMsg]  = useState(null); // 'ok' | 'error' | null
  const [open,     setOpen]     = useState(false);

  async function sendTest() {
    setTesting(true); setTestMsg(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-morning-brief`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_KEY}` },
      });
      setTestMsg(res.ok ? 'ok' : 'error');
    } catch { setTestMsg('error'); }
    finally { setTesting(false); }
    setTimeout(() => setTestMsg(null), 4000);
  }

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <svg className={cn('w-3 h-3 text-gray-400 transition-transform duration-200', open && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Telegram Bot</span>
        <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          Morning Brief
        </span>
      </button>

      {open && (
        <div className="space-y-3 pl-5">
          <button
            onClick={sendTest}
            disabled={testing}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-xl border transition',
              testMsg === 'ok'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50'
                : testMsg === 'error'
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700/50'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
              testing && 'opacity-60 cursor-wait'
            )}
          >
            {testing ? '📡 Sending…' : testMsg === 'ok' ? '✓ Message sent!' : testMsg === 'error' ? '✗ Failed — see setup' : '📱 Send Test Message'}
          </button>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3">
            <p className="font-semibold text-gray-700 dark:text-gray-200">One-time setup:</p>
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>Message <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">@BotFather</code> on Telegram → <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">/newbot</code> → copy the token</li>
              <li>Message your bot once, then visit <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> to find your Chat ID</li>
              <li>In Supabase Dashboard → Edge Functions → Secrets, add:<br />
                <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">TELEGRAM_BOT_TOKEN</code><br />
                <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">TELEGRAM_CHAT_ID</code><br />
                <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">APP_USER_ID</code> (your Supabase auth user ID)
              </li>
              <li>Deploy both Edge Functions from <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">supabase/functions/</code></li>
              <li>In Supabase SQL Editor, schedule the cron job (see README in functions folder)</li>
              <li>Register webhook: visit the URL shown in your <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">telegram-webhook</code> function logs</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ currentView, onNavigate, onSettings, mobileOpen, onMobileClose, userEmail }) {
  const { state } = useApp();

  const navItems = [
    { key: 'dashboard',     label: 'Dashboard',      Icon: Icons.Dashboard     },
    { key: 'clients',       label: 'Clients',         Icon: Icons.Clients       },
    { key: 'documents',     label: 'Documents',       Icon: Icons.Documents     },
    { key: 'filings',       label: 'Filings',         Icon: Icons.Filings       },
    { key: 'monthlywork',   label: 'Monthly Work',    Icon: Icons.MonthlyWork   },
    { key: 'taxtool',       label: 'Tax Tool',        Icon: Icons.TaxTool       },
    { key: 'workguide',     label: 'Work Guide',      Icon: Icons.WorkGuide     },
    { key: 'focus',         label: 'Focus Mode',      Icon: Icons.Focus         },
    { key: 'calendar',      label: 'Calendar',        Icon: Icons.Calendar      },
    { key: 'tasks',         label: 'Tasks',           Icon: Icons.Tasks         },
    { key: 'tally',         label: 'Tally Tracker',   Icon: Icons.Tally         },
    { key: 'cancellations', label: 'Cancellations',   Icon: Icons.Cancellations },    { key: 'workinghours',  label: 'Working Hours',    Icon: Icons.WorkingHours  },    { key: 'history',       label: 'History',         Icon: Icons.History       },
    { key: 'notes',         label: 'Notes',           Icon: Icons.Notes         },
    { key: 'export',        label: 'Export',          Icon: Icons.Export        },
    { key: 'ai',            label: 'AI Assistant',    Icon: Icons.AI            },
  ];

  // Badge counts
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'completed').length;
  const pendingTasks = state.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  // Documents needing attention: have a follow-up date in the past (or today) and aren't filed away
  const docsAttention = (state.documents || []).filter(d =>
    d.dueBackDate && d.location !== 'filed' && d.dueBackDate.slice(0, 10) <= today
  ).length;
  const badges = { tasks: pendingTasks > 0 ? pendingTasks : null };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-gray-200 dark:border-gray-800">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">A</div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm leading-none">AccountantOS</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Personal Tax Manager</p>
          <p className="text-[9px] text-gray-400 dark:text-gray-600 mt-0.5">by Jay Shivram</p>
        </div>
        {/* Mobile close */}
        <button onClick={onMobileClose} className="ml-auto lg:hidden btn-ghost p-1"><Icons.Close /></button>
      </div>

      {/* Nav */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => { onNavigate(key); onMobileClose(); }}
            className={cn(
              'w-full',
              currentView === key ? 'nav-item-active' : 'nav-item-inactive'
            )}
          >
            <Icon />
            <span>{label}</span>
            {badges[key] && (
              <span className="ml-auto text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">
                {badges[key]}
              </span>
            )}
            {key === 'tasks' && overdueTasks > 0 && (
              <span className="ml-auto text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                {overdueTasks}
              </span>
            )}
            {key === 'documents' && docsAttention > 0 && (
              <span className="ml-auto text-xs bg-red-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                {docsAttention}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Bottom: overdue alert */}
      {overdueTasks > 0 && (
        <div className="mx-3 mb-3 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700/50 rounded-xl">
          <p className="text-xs font-semibold text-red-600 dark:text-red-300">⚠️ {overdueTasks} overdue task{overdueTasks > 1 ? 's' : ''}</p>
        </div>
      )}

      {/* Settings + user */}
      <div className="px-3 pb-4 border-t border-gray-200 dark:border-gray-800 pt-3">
        <button onClick={onSettings} className="nav-item-inactive w-full">
          <Icons.Settings />
          <span>Settings &amp; Logout</span>
        </button>
        <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mt-3">Created by Jay Shivram · v1.0 · Cloud synced</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          {/* Backdrop — blocks all touch/scroll events on the bg */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onMobileClose}
            onTouchMove={e => e.preventDefault()}
          />
          {/* Sidebar panel */}
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 animate-slide-in flex flex-col overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Main App Shell ───────────────────────────────────────────────────────────

function AppShell({ onLogout, userEmail }) {
  const { state, dispatch } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen,   setSettingsOpen]   = useState(false);
  const [paletteOpen,    setPaletteOpen]    = useState(false);
  const [brainDumpOpen,  setBrainDumpOpen]  = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Global keyboard shortcuts
  useEffect(() => {
    function handler(e) {
      // Ctrl+K / Cmd+K — Command Palette (intercepts even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(v => !v);
        return;
      }
      // Backtick — Brain Dump (only when not typing in an input/textarea)
      if (e.key === '`' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;
        e.preventDefault();
        setBrainDumpOpen(true);
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const currentView = state.currentView;

  function navigate(view) {
    dispatch({ type: 'SET_VIEW', payload: view });
  }

  // Page titles
  const titles = {
    dashboard:     'Dashboard',
    clients:       'Clients',
    calendar:      'Calendar',
    tasks:         'Tasks',
    history:       'History',
    tally:         'Tally Tracker',
    focus:         'Focus Mode',
    export:        'Export',
    cancellations: 'Cancellations',
    workinghours:  'Working Hours',
    notes:         'Notes',
    ai:            'AI Assistant',
    monthlywork:   'Monthly Work',
    taxtool:       'Tax Tool',
      workguide:     'Work Guide',
    documents:     'Documents',
  };

  // Render current page
  function renderPage() {
    switch (currentView) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'clients':   return <Clients />;
      case 'filings':   return <Filings />;
      case 'calendar':  return <Calendar />;
      case 'tasks':     return <Tasks />;
      case 'history':   return <History />;
      case 'tally':     return <TallyTracker />;
      case 'focus':     return <FocusMode onNavigate={navigate} />;
      case 'export':        return <ExportPage />;
      case 'cancellations': return <Cancellations />;
      case 'workinghours':   return <WorkingHours />;
      case 'notes':          return <Notes />;
      case 'ai':             return <AIAssistant />;
      case 'monthlywork':    return <MonthlyWork />;
      case 'taxtool':        return <TaxTool />;
      case 'workguide':      return <WorkGuidePage />;
      case 'documents':      return <Documents />;
      default:               return <Dashboard onNavigate={navigate} />;
    }
  }

  return (
    <div className={cn('min-h-screen flex bg-gray-100 dark:bg-gray-950', state.darkMode ? 'dark' : '')}>
      <Sidebar
        currentView={currentView}
        onNavigate={navigate}
        onSettings={() => setSettingsOpen(true)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        userEmail={userEmail}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-3 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-30">
          {/* Left: menu + branding */}
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMobileMenuOpen(true)} className="btn-ghost p-1.5 flex-shrink-0">
              <Icons.Menu />
            </button>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 dark:text-white text-sm leading-none truncate">AccountantOS</p>
              <p className="text-[9px] text-gray-400 dark:text-gray-500 truncate">by Jay Shivram</p>
            </div>
          </div>

          {/* Right: battery · sync · dark toggle */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <BatteryWidget />
            <SyncBadge />
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className="btn-ghost p-1.5 rounded-lg"
              title={state.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {state.darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        {/* Desktop Header Bar */}
        <header className="hidden lg:flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-30">
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{titles[currentView]}</p>
          <div className="flex items-center gap-4">
            <LiveClock />
            <BatteryWidget />
            <SyncBadge />
            <button
              onClick={() => dispatch({ type: 'TOGGLE_DARK_MODE' })}
              className="btn-ghost p-1.5 rounded-lg"
              title={state.darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {state.darkMode ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button onClick={() => setSettingsOpen(true)} className="btn-ghost p-1.5 rounded-lg" title="Settings">
              <Icons.Settings />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 min-w-0">
            <ErrorBoundary resetKey={currentView}>
              {renderPage()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Floating Brain Dump button */}
      <button
        onClick={() => setBrainDumpOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-13 h-13 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-600/40 transition-all duration-150 group"
        title="Quick Capture (Backtick)"
        style={{ width: '52px', height: '52px' }}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="absolute right-full mr-2.5 px-2 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
          Quick Capture <kbd className="ml-1 font-mono opacity-70">`</kbd>
        </span>
      </button>

      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        state={state}
        dispatch={dispatch}
        onBrainDump={() => { setPaletteOpen(false); setBrainDumpOpen(true); }}
        onSettings={() => { setPaletteOpen(false); setSettingsOpen(true); }}
      />

      <BrainDumpModal
        isOpen={brainDumpOpen}
        onClose={() => setBrainDumpOpen(false)}
        dispatch={dispatch}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogout={onLogout}
        userEmail={userEmail}
      />
      <ToastContainer />
    </div>
  );
}

// ─── Auth Loading Screen ──────────────────────────────────────────────────────

function AuthLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center animate-pulse">
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-sm text-gray-500">Loading AccountantOS…</p>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [session, setSession]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on first load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // Subscribe to auth changes (login / logout from any tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) return <AuthLoader />;
  if (!session)   return <Login />;

  const handleLogout = () => {
    clearState();
    supabase.auth.signOut();
  };

  return (
    <AppProvider userId={session.user.id} userEmail={session.user.email}>
      <AppShell onLogout={handleLogout} userEmail={session.user.email} />
    </AppProvider>
  );
}
