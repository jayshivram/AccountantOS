import React, { useState, useEffect } from 'react';
import { AppProvider, useApp, useSyncStatus } from './context/AppContext.jsx';
import Dashboard    from './pages/Dashboard.jsx';
import Clients      from './pages/Clients.jsx';
import Tasks        from './pages/Tasks.jsx';
import Calendar     from './pages/Calendar.jsx';
import History      from './pages/History.jsx';
import TallyTracker from './pages/TallyTracker.jsx';
import FocusMode    from './pages/FocusMode.jsx';
import ExportPage   from './pages/Export.jsx';
import {
  exportData, importData, requestNotificationPermission, cn,
} from './utils/index.js';
import { isInstallable, promptInstall, isRunningStandalone, clearAppCache } from './lib/pwa.js';
import { Toggle, Modal, BatteryWidget, LiveClock } from './components/UI.jsx';

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
  if (!status || status === 'idle') return null;
  const map = {
    syncing: { dot: 'bg-blue-500 animate-pulse', text: 'Syncing…',  cls: 'text-blue-600 dark:text-blue-400' },
    synced:  { dot: 'bg-green-500',              text: '\u2713 Synced',  cls: 'text-green-600 dark:text-green-400' },
    error:   { dot: 'bg-red-500',                text: '\u26a0 Sync err', cls: 'text-red-600 dark:text-red-400'   },
  };
  const { dot, text, cls } = map[status] || map.synced;
  return (
    <div className={cn('flex items-center gap-1.5 text-xs font-medium', cls)}>
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dot)} />
      <span className="hidden sm:inline">{text}</span>
    </div>
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

function SettingsModal({ isOpen, onClose }) {
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

  function enableNotifications() {
    requestNotificationPermission();
    dispatch({ type: 'TOGGLE_NOTIFICATIONS' });
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
      </div>
    </Modal>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ currentView, onNavigate, onSettings, mobileOpen, onMobileClose }) {
  const { state } = useApp();

  const navItems = [
    { key: 'dashboard', label: 'Dashboard',     Icon: Icons.Dashboard },
    { key: 'clients',   label: 'Clients',        Icon: Icons.Clients   },
    { key: 'focus',     label: 'Focus Mode',     Icon: Icons.Focus     },
    { key: 'calendar',  label: 'Calendar',       Icon: Icons.Calendar  },
    { key: 'tasks',     label: 'Tasks',          Icon: Icons.Tasks     },
    { key: 'tally',     label: 'Tally Tracker',  Icon: Icons.Tally     },
    { key: 'history',   label: 'History',        Icon: Icons.History   },
    { key: 'export',    label: 'Export',         Icon: Icons.Export    },
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

      {/* Settings */}
      <div className="px-3 pb-4 border-t border-gray-200 dark:border-gray-800 pt-3">
        <button onClick={onSettings} className="nav-item-inactive w-full">
          <Icons.Settings />
          <span>Settings</span>
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
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="relative w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 animate-slide-in">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}

// ─── Main App Shell ───────────────────────────────────────────────────────────

function AppShell() {
  const { state, dispatch } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const currentView = state.currentView;

  function navigate(view) {
    dispatch({ type: 'SET_VIEW', payload: view });
  }

  // Page titles
  const titles = {
    dashboard: 'Dashboard',
    clients:   'Clients',
    calendar:  'Calendar',
    tasks:     'Tasks',
    history:   'History',
    tally:     'Tally Tracker',
    focus:     'Focus Mode',
    export:    'Export',
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
      case 'export':    return <ExportPage />;
      default:          return <Dashboard onNavigate={navigate} />;
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
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileMenuOpen(true)} className="btn-ghost p-1.5">
              <Icons.Menu />
            </button>
            <p className="font-bold text-gray-900 dark:text-white text-sm">AccountantOS</p>
          </div>
          <div className="flex items-center gap-3">
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
            <p className="text-sm text-gray-500 dark:text-gray-400">{titles[currentView]}</p>
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
        <main className="flex-1 overflow-auto bg-gray-100 dark:bg-gray-950">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {renderPage()}
          </div>
        </main>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
