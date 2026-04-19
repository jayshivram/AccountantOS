import React, { useState, useEffect } from 'react';
import { AppProvider, useApp, useSyncStatus } from './context/AppContext.jsx';
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
import Login          from './components/Login.jsx';
import {
  exportData, importData, requestNotificationPermission, cn, getLastSyncTs, clearState
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
};
// ─── Sync Status Badge ───────────────────────────────────────────────────────────────

function SyncBadge() {
  const status = useSyncStatus();
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

  const { manualSync } = useApp();

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

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ currentView, onNavigate, onSettings, mobileOpen, onMobileClose, userEmail }) {
  const { state } = useApp();

  const navItems = [
    { key: 'dashboard',     label: 'Dashboard',      Icon: Icons.Dashboard     },
    { key: 'clients',       label: 'Clients',         Icon: Icons.Clients       },
    { key: 'focus',         label: 'Focus Mode',      Icon: Icons.Focus         },
    { key: 'calendar',      label: 'Calendar',        Icon: Icons.Calendar      },
    { key: 'tasks',         label: 'Tasks',           Icon: Icons.Tasks         },
    { key: 'tally',         label: 'Tally Tracker',   Icon: Icons.Tally         },
    { key: 'cancellations', label: 'Cancellations',   Icon: Icons.Cancellations },    { key: 'workinghours',  label: 'Working Hours',    Icon: Icons.WorkingHours  },    { key: 'history',       label: 'History',         Icon: Icons.History       },
    { key: 'export',        label: 'Export',          Icon: Icons.Export        },
  ];

  // Badge counts
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = state.tasks.filter(t => t.dueDate && t.dueDate.slice(0, 10) < today && t.status !== 'completed').length;
  const pendingTasks = state.tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
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
      <nav className="flex-1 px-3 py-4 space-y-1">
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
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

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
  };

  // Render current page
  function renderPage() {
    switch (currentView) {
      case 'dashboard': return <Dashboard onNavigate={navigate} />;
      case 'clients':   return <Clients />;
      case 'calendar':  return <Calendar />;
      case 'tasks':     return <Tasks />;
      case 'history':   return <History />;
      case 'tally':     return <TallyTracker />;
      case 'focus':     return <FocusMode onNavigate={navigate} />;
      case 'export':        return <ExportPage />;
      case 'cancellations': return <Cancellations />;
      case 'workinghours':   return <WorkingHours />;
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
            {renderPage()}
          </div>
        </main>
      </div>

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
