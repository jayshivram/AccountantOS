import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={ref}
        className={cn(
          'relative w-full rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl animate-fade-in flex flex-col max-h-[90vh]',
          sizes[size]
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <h2 id="modal-title" className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

export function ProgressBar({ completed, total, showLabel = true, colorClass = 'bg-blue-500', size = 'md' }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3' };
  const color = pct === 100 ? 'bg-green-500' : pct >= 50 ? colorClass : 'bg-amber-500';

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
          <span>{completed} / {total} clients</span>
          <span className={pct === 100 ? 'text-green-500 dark:text-green-400 font-semibold' : ''}>{pct}%</span>
        </div>
      )}
      <div className={cn('w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden', heights[size])}>
        <div
          className={cn('progress-bar rounded-full', color, heights[size])}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}

// ─── CountdownBadge ───────────────────────────────────────────────────────────

export function CountdownBadge({ days, large = false }) {
  let statusClass, label;

  if (days < 0) {
    statusClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/60';
    label = `Overdue ${Math.abs(days)}d`;
  } else if (days === 0) {
    statusClass = 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/60 animate-pulse';
    label = 'Due Today!';
  } else if (days <= 3) {
    statusClass = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-800/50';
    label = `${days}d left`;
  } else if (days <= 7) {
    statusClass = 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50';
    label = `${days}d left`;
  } else {
    statusClass = 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800/40';
    label = `${days}d left`;
  }

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-semibold',
      large ? 'text-sm px-3 py-1' : 'text-xs px-2 py-0.5',
      statusClass
    )}>
      {label}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

export function StatusBadge({ status }) {
  const map = {
    completed:   { cls: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/50',   label: 'Done' },
    in_progress: { cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50',         label: 'In Progress' },
    pending:     { cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700',               label: 'Pending' },
    overdue:     { cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700/50',               label: 'Overdue' },
  };
  const { cls, label } = map[status] || map.pending;
  return (
    <span className={cn('badge inline-flex items-center gap-1', cls)}>
      {status === 'completed'   && <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      {status === 'in_progress' && <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
      {status === 'pending'     && <span className="text-[9px] leading-none opacity-60">●</span>}
      {status === 'overdue'     && <svg className="w-2.5 h-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>}
      {label}
    </span>
  );
}

// ─── TaxTypeBadge ─────────────────────────────────────────────────────────────

export function TaxTypeBadge({ type, size = 'sm' }) {
  const colorMap = {
    VAT:         'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/40',
    PAYE:        'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-700/40',
    SDL:         'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/40',
    WHT:         'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/40',
    NSSF:        'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/40',
    WCF:         'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700/40',
    PROVISIONAL: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-300 dark:border-orange-700/40',
    CITY_LEVY:   'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/40',
  };
  const labelMap = {
    VAT: 'VAT', PAYE: 'PAYE', SDL: 'SDL', WHT: 'WHT', NSSF: 'NSSF', WCF: 'WCF', PROVISIONAL: 'Prov.Tax', CITY_LEVY: 'City Levy',
  };
  return (
    <span className={cn(
      'badge',
      size === 'xs' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
      colorMap[type] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700'
    )}>
      {labelMap[type] || type}
    </span>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

export function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4 opacity-40">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">{title}</h3>
      {message && <p className="text-sm text-gray-400 dark:text-gray-500 mb-5 max-w-xs">{message}</p>}
      {action}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true, comparison }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      {comparison ? (
        <div className="mb-5">
          {message && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{message}</p>}
          <div className="flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            {/* FROM chip */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-sm font-mono font-semibold text-gray-700 dark:text-gray-300 shadow-sm">
              <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {comparison.from}
            </span>
            {/* Arrow */}
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
            {/* TO chip */}
            {comparison.to != null ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 text-sm font-mono font-semibold text-blue-700 dark:text-blue-300 shadow-sm">
                <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {comparison.to}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-sm font-semibold text-red-600 dark:text-red-400">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-300 mb-6">{message}</p>
      )}
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={danger ? 'btn-danger' : 'btn-primary'}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      {label && <label className="label">{label}</label>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="input"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={cn('w-10 h-6 rounded-full transition-colors', checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700')} />
        <div className={cn('absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0')} />
      </div>
      {label && <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>}
    </label>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 'sm' }) {
  const sz = size === 'sm' ? 'w-4 h-4' : size === 'md' ? 'w-6 h-6' : 'w-8 h-8';
  return (
    <svg className={cn('animate-spin text-blue-400', sz)} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ label }) {
  if (!label) return <hr className="border-gray-200 dark:border-gray-800 my-4" />;
  return (
    <div className="flex items-center gap-3 my-4">
      <div className="flex-1 border-t border-gray-200 dark:border-gray-800" />
      <span className="text-xs text-gray-400 dark:text-gray-600 uppercase tracking-widest">{label}</span>
      <div className="flex-1 border-t border-gray-200 dark:border-gray-800" />
    </div>
  );
}

// ─── KeyboardHint ─────────────────────────────────────────────────────────────

export function KeyboardHint({ shortcut, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-500">
      <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded text-gray-600 dark:text-gray-300 font-mono text-[11px]">{shortcut}</kbd>
      {label}
    </span>
  );
}

// ─── BatteryWidget ────────────────────────────────────────────────────────────

export function BatteryWidget() {
  const [battery, setBattery] = useState({ level: 1, charging: false, supported: false });

  useEffect(() => {
    let bat = null;

    async function init() {
      if (!navigator.getBattery) return;
      try {
        bat = await navigator.getBattery();
        function update() {
          setBattery({ level: bat.level, charging: bat.charging, supported: true });
        }
        update();
        bat.addEventListener('levelchange', update);
        bat.addEventListener('chargingchange', update);
      } catch {
        // Battery API not available silently
      }
    }

    init();

    return () => {
      if (bat) {
        bat.removeEventListener('levelchange', () => {});
        bat.removeEventListener('chargingchange', () => {});
      }
    };
  }, []);

  if (!battery.supported) return (
    <div className="flex items-center gap-1 text-gray-400 dark:text-gray-600" title="Battery level unavailable on this browser">
      <svg className="w-5 h-3" viewBox="0 0 20 12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="0.75" y="0.75" width="17" height="10.5" rx="1.5" />
        <rect x="18" y="3.5" width="1.5" height="5" rx="0.75" fill="currentColor" stroke="none" opacity="0.5" />
        <line x1="7" y1="3" x2="13" y2="9" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="13" y1="3" x2="7" y2="9" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );

  const pct = Math.round(battery.level * 100);
  const isLow      = pct <= 20;
  const isMedium   = pct > 20 && pct <= 60;
  const isCharging = battery.charging;

  const fillColor = isLow ? 'bg-red-500' : isMedium ? 'bg-amber-400' : 'bg-green-500';
  const textColor = isLow ? 'text-red-500 dark:text-red-400' : isMedium ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400';

  return (
    <div className={cn('flex items-center gap-1.5', textColor)} title={`Battery: ${pct}%${isCharging ? ' (Charging)' : ''}`}>
      {/* Battery body */}
      <div className="relative flex items-center">
        {/* Outer shell */}
        <div className="w-7 h-3.5 rounded-sm border-2 border-current relative overflow-hidden">
          {/* Fill */}
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-[1px] transition-all duration-700',
              fillColor,
              isCharging ? 'animate-battery-charging' : '',
              isLow && !isCharging ? 'animate-pulse' : ''
            )}
            style={{ width: `${pct}%` }}
          />
          {/* Charging bolt */}
          {isCharging && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <svg className="w-2.5 h-2.5 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 2L4.5 13.5H11L10 22L19.5 10.5H13L13 2Z" />
              </svg>
            </div>
          )}
        </div>
        {/* Nub */}
        <div className="w-1 h-1.5 rounded-r-sm bg-current opacity-70 flex-shrink-0" />
      </div>
      <span className="text-xs font-semibold tabular-nums">{pct}%</span>
    </div>
  );
}

// ─── LiveClock ────────────────────────────────────────────────────────────────

export function LiveClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dayName = now.toLocaleDateString('en-GB', { weekday: 'short' });
  const date    = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const time    = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="text-right leading-tight">
        <p className="font-semibold text-gray-700 dark:text-gray-200 tabular-nums">{dayName}, {date}</p>
        <p className="text-gray-500 dark:text-gray-400 tabular-nums font-mono">{time}</p>
      </div>
    </div>
  );
}

// ─── ClickToCopy ──────────────────────────────────────────────────────────────

export function ClickToCopy({ label, value }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers (unlikely needed in modern contexts, but good practice)
        const el = document.createElement('textarea');
        el.value = value;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); copy(); }}
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono transition-colors tracking-wide',
        copied 
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800' 
          : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
      )}
      title="Click to copy"
    >
      <span className="font-sans font-semibold opacity-70">{label}:</span>
      {value}
      {copied ? (
        <svg className="w-3 h-3 text-green-600 dark:text-green-400 ml-0.5 animate-in fade-in zoom-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3 opacity-50 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}

// ─── ActiveUsers ──────────────────────────────────────────────────────────────

export function ActiveUsers() {
  const { onlineUsers } = useApp();
  
  if (!onlineUsers || onlineUsers.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2 mr-2">
      {onlineUsers.slice(0, 3).map((user, i) => (
        <div key={user.email} className="relative group" style={{ zIndex: 10 - i }}>
          <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white dark:border-gray-950 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-1 ring-black/5 cursor-default">
            {user.email[0].toUpperCase()}
          </div>
          <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full border border-white dark:border-gray-950 bg-green-500" />
          
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-[10px] whitespace-nowrap rounded font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {user.email.split('@')[0]}
          </div>
        </div>
      ))}
      {onlineUsers.length > 3 && (
        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-800 border-2 border-white dark:border-gray-950 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-300 shadow-sm z-0">
          +{onlineUsers.length - 3}
        </div>
      )}
    </div>
  );
}

// ─── ToastContainer ───────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toast, setToast } = useApp();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast, setToast]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-800 dark:border-gray-200">
        <svg className="w-5 h-5 text-green-400 dark:text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm font-medium">{toast.message}</span>
        
        {toast.actionLabel && toast.onAction && (
          <button
            onClick={() => {
              toast.onAction();
              setToast(null);
            }}
            className="ml-2 pl-3 border-l border-gray-700 dark:border-gray-300 text-sm font-bold text-blue-400 dark:text-blue-600 hover:text-blue-300 dark:hover:text-blue-700 transition-colors uppercase tracking-wider"
          >
            {toast.actionLabel}
          </button>
        )}
        
        <button onClick={() => setToast(null)} className="ml-1 p-1 text-gray-400 hover:text-white dark:hover:text-gray-900">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
