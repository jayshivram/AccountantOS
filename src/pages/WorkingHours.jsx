import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.jsx';
import { cn, escapeHtml } from '../utils/index.js';
import { ConfirmDialog } from '../components/UI.jsx';
// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DAYS         = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// â”€â”€â”€ Week / Date Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getMondayOfISOWeek(year, week) {
  const jan4       = new Date(year, 0, 4);
  const dayOfWeek  = jan4.getDay() || 7;
  const week1Mon   = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday     = new Date(week1Mon);
  monday.setDate(week1Mon.getDate() + (week - 1) * 7);
  return monday;
}

function isoWeeksInYear(year) {
  const dec28      = new Date(year, 11, 28);
  const dayOfWeek  = dec28.getDay() || 7;
  const lastMon    = new Date(dec28);
  lastMon.setDate(dec28.getDate() - dayOfWeek + 1);
  const jan4       = new Date(year, 0, 4);
  const dow4       = jan4.getDay() || 7;
  const week1Mon   = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow4 + 1);
  return Math.round((lastMon - week1Mon) / 604800000) + 1;
}

function currentISOWeek() {
  const today      = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek  = today.getDay() || 7;
  const thursday   = new Date(today);
  thursday.setDate(today.getDate() - dayOfWeek + 4);
  const year       = thursday.getFullYear();
  const jan4       = new Date(year, 0, 4);
  const dow4       = jan4.getDay() || 7;
  const week1Mon   = new Date(jan4);
  week1Mon.setDate(jan4.getDate() - dow4 + 1);
  const week       = Math.round((thursday - week1Mon) / 604800000) + 1;
  return { week, year };
}

/** Get all ISO weeks whose Monday falls in a given month (0-indexed). */
function getWeeksForMonth(year, month) {
  const total  = isoWeeksInYear(year);
  const result = [];
  for (let w = 1; w <= total; w++) {
    const mon = getMondayOfISOWeek(year, w);
    if (mon.getFullYear() === year && mon.getMonth() === month) {
      const sat = new Date(mon);
      sat.setDate(mon.getDate() + 5);
      result.push({ week: w, mon, sat });
    }
  }
  return result;
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function toMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return isNaN(h) || isNaN(m) ? null : h * 60 + m;
}

function calcNetMins(entry = {}) {
  const inM  = toMins(entry.timeIn);
  const outM = toMins(entry.timeOut);
  if (inM === null || outM === null) return null;
  let outAdj = outM;
  if (outAdj < inM) outAdj += 1440;   // shift crosses midnight (overnight)
  if (outAdj <= inM) return null;     // equal → nothing worked
  let net = outAdj - inM;
  const bsM = toMins(entry.breakStart);
  let   beM = toMins(entry.breakStop);
  if (bsM !== null && beM !== null) {
    if (beM < bsM) beM += 1440;       // break also crosses midnight
    if (beM > bsM) net -= beM - bsM;
  }
  return net > 0 ? net : null;
}

/** A shift whose Time Out is earlier than Time In — i.e. it runs past midnight. */
function isOvernightEntry(entry = {}) {
  const inM = toMins(entry.timeIn), outM = toMins(entry.timeOut);
  return inM !== null && outM !== null && outM < inM;
}

/** A day with exactly one of Time In / Time Out (or one of Break Start / Stop). */
function isIncompleteEntry(entry = {}) {
  const hasIn = !!entry.timeIn, hasOut = !!entry.timeOut;
  const hasBs = !!entry.breakStart, hasBe = !!entry.breakStop;
  return (hasIn !== hasOut) || (hasBs !== hasBe);
}

function isPastDate(date) {
  if (!date) return false;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  return d < t;
}

/** Sum of net minutes + days worked for a given ISO week's stored data. */
function sumWeek(workingHours, year, w) {
  const key = `${year}-W${String(w).padStart(2, '0')}`;
  const wd  = workingHours?.[key] || {};
  let total = 0, days = 0;
  DAYS.forEach(day => { const n = calcNetMins(wd[day]); if (n !== null) { total += n; days++; } });
  return { total, days };
}

function fmtMins(mins) {
  if (!mins || mins <= 0) return '\u2014';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function to12h(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  const ampm   = h >= 12 ? 'PM' : 'AM';
  const h12    = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function nowHHMM() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

// ─── Live Net Timer ───────────────────────────────────────────────────────────
// Shows a running timer for today's row when timeIn is set but timeOut is not.
// Pauses (shows "On Break") when breakStart is set but breakStop is not.

function LiveNetTimer({ timeIn, breakStart, breakStop }) {
  const [nowMins, setNowMins] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });

  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMins(n.getHours() * 60 + n.getMinutes());
    };
    tick();
    const id = setInterval(tick, 30000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  const inM  = toMins(timeIn);
  const bsM  = toMins(breakStart);
  const beM  = toMins(breakStop);

  if (inM === null) return null;

  const onBreak = bsM !== null && beM === null;
  const breakMins = onBreak && bsM !== null ? nowMins - bsM : 0;

  let netMins;
  if (onBreak) {
    // Frozen at break start minus time-in
    netMins = bsM - inM;
  } else {
    netMins = nowMins - inM;
    if (bsM !== null && beM !== null && beM > bsM) {
      netMins -= beM - bsM;
    }
  }

  if (netMins <= 0) return null;

  if (onBreak) {
    return (
      <div className="flex items-center gap-1 mt-0.5">
        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs font-semibold tabular-nums text-amber-600 dark:text-amber-400">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {fmtMins(netMins)}
        </span>
        <span className="text-gray-300 dark:text-gray-700 text-xs select-none">·</span>
        <span className="px-1.5 py-0.5 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/40 text-xs font-semibold tabular-nums text-orange-500 dark:text-orange-400">
          ☕ {breakMins > 0 ? fmtMins(breakMins) : '…'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
      <span className="text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
        {fmtMins(netMins)}
      </span>
    </div>
  );
}

// â”€â”€â”€ TimeCell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SCHEME = {
  green: {
    border:  'border-emerald-300 dark:border-emerald-700/50 hover:border-emerald-400',
    text:    'text-emerald-700 dark:text-emerald-400',
    nowBtn:  'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
  },
  amber: {
    border:  'border-amber-300 dark:border-amber-700/50 hover:border-amber-400',
    text:    'text-amber-700 dark:text-amber-400',
    nowBtn:  'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20',
  },
  red: {
    border:  'border-rose-300 dark:border-rose-700/50 hover:border-rose-400',
    text:    'text-rose-700 dark:text-rose-400',
    nowBtn:  'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20',
  },
};

function TimeCell({ value, onChange, scheme = 'green', fill = false }) {
  const s = SCHEME[scheme];

  return (
    <div className={cn('flex items-center gap-1', fill ? 'w-full min-w-0' : 'min-w-[155px]')}>
      {/* Native time input with styled border */}
      <div className={cn(
        'rounded-lg border flex-1 min-w-0 transition-colors bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:ring-offset-1',
        s.border
      )}>
        <input
          type="time"
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onChange(nowHHMM()); } }}
          className={cn(
            'w-full px-2.5 py-[7px] text-sm font-mono tabular-nums bg-transparent outline-none rounded-lg',
            value ? s.text : 'text-gray-400 dark:text-gray-600'
          )}
        />
      </div>

      {/* Now button */}
      <button
        type="button"
        onClick={() => onChange(nowHHMM())}
        title="Set to now (Ctrl+Enter)"
        className={cn('flex-shrink-0 p-1.5 rounded-lg transition', s.nowBtn)}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Clear button */}
      <button
        type="button"
        onClick={() => onChange(null)}
        title="Clear"
        disabled={!value}
        className={cn(
          'flex-shrink-0 p-1.5 rounded-lg transition',
          value
            ? 'text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500'
            : 'text-gray-200 dark:text-gray-800 pointer-events-none'
        )}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// â”€â”€â”€ Stats Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatsCards({ weekData, use12h }) {
  const { daysWorked, totalMins, avgMins, totalBreakMins, earliestIn, latestOut } = useMemo(() => {
    let daysWorked = 0, totalMins = 0, totalBreakMins = 0;
    let earliestIn = null, latestOut = null;

    DAYS.forEach(day => {
      const e   = weekData[day] || {};
      const net = calcNetMins(e);
      if (net !== null) { totalMins += net; daysWorked++; }
      if (e.timeIn  && (!earliestIn || e.timeIn  < earliestIn)) earliestIn = e.timeIn;
      if (e.timeOut && (!latestOut  || e.timeOut > latestOut))  latestOut  = e.timeOut;
      const bsM = toMins(e.breakStart);
      const beM = toMins(e.breakStop);
      if (bsM !== null && beM !== null && beM > bsM) totalBreakMins += beM - bsM;
    });

    return {
      daysWorked,
      totalMins,
      avgMins:        daysWorked > 0 ? Math.round(totalMins / daysWorked) : null,
      totalBreakMins,
      earliestIn,
      latestOut,
    };
  }, [weekData]);

  const cards = [
    {
      label: 'Total Hours',
      value: fmtMins(totalMins),
      sub:   `${daysWorked} day${daysWorked !== 1 ? 's' : ''} logged`,
      color: 'text-blue-600 dark:text-blue-400',
      bg:    'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
    {
      label: 'Avg / Day',
      value: avgMins ? fmtMins(avgMins) : '\u2014',
      sub:   'across working days',
      color: 'text-purple-600 dark:text-purple-400',
      bg:    'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      label: 'Earliest In',
      value: earliestIn ? (use12h ? to12h(earliestIn) : earliestIn) : '–',
      sub:   'earliest start',
      color: 'text-emerald-600 dark:text-emerald-400',
      bg:    'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14" /></svg>,
    },
    {
      label: 'Latest Out',
      value: latestOut ? (use12h ? to12h(latestOut) : latestOut) : '–',
      sub:   'latest finish',
      color: 'text-rose-600 dark:text-rose-400',
      bg:    'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" /></svg>,
    },
    {
      label: 'Break Time',
      value: fmtMins(totalBreakMins),
      sub:   'total breaks',
      color: 'text-amber-600 dark:text-amber-400',
      bg:    'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => (
        <div key={c.label} className={cn('rounded-2xl p-4 border', c.bg)}>
          <div className={cn('flex items-center gap-1.5 mb-2', c.color)}>
            {c.icon}
            <span className="text-[10px] font-bold uppercase tracking-wider">{c.label}</span>
          </div>
          <p className={cn('text-xl font-bold tabular-nums', c.color)}>{c.value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.sub}</p>
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ Quick Jump Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QuickJumpPicker({ currentYear, currentWeek, onNavigate, onClose }) {
  const [pickerYear, setPickerYear]   = useState(currentYear);
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
      className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-76 min-w-[288px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4"
    >
      {/* Year row */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => { setPickerYear(y => y - 1); setSelectedMonth(null); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="font-bold text-sm text-gray-900 dark:text-white">{pickerYear}</span>
        <button
          onClick={() => { setPickerYear(y => y + 1); setSelectedMonth(null); }}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Month grid */}
      <div className="grid grid-cols-4 gap-1 mb-1">
        {MONTHS_SHORT.map((m, i) => (
          <button
            key={m}
            onClick={() => setSelectedMonth(i === selectedMonth ? null : i)}
            className={cn(
              'py-1.5 text-xs font-semibold rounded-lg transition',
              selectedMonth === i
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400'
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Weeks */}
      {selectedMonth !== null ? (
        <div className="border-t border-gray-100 dark:border-gray-800 mt-3 pt-3 space-y-0.5 max-h-44 overflow-y-auto">
          {weeksForMonth.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">No weeks in this month</p>
          ) : weeksForMonth.map(({ week: w, mon, sat }) => (
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
              <span className="opacity-70 tabular-nums">{fmtDate(mon)} – {fmtDate(sat)}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center mt-2">
          Pick a month to browse its weeks
        </p>
      )}
    </div>
  );
}

// ─── Day Timeline ────────────────────────────────────────────────────────────────

const TIMELINE_START = 7 * 60;    // 07:00
const TIMELINE_END   = 20 * 60;   // 20:00
const TIMELINE_RANGE = TIMELINE_END - TIMELINE_START;

function DayTimeline({ entry, use12h }) {
  const inM  = toMins(entry.timeIn);
  const outM = toMins(entry.timeOut);
  const bsM  = toMins(entry.breakStart);
  const beM  = toMins(entry.breakStop);

  if (inM === null) return null;

  const n    = new Date();
  const nowM = n.getHours() * 60 + n.getMinutes();
  const pct  = v => `${Math.max(0, Math.min(100, ((v - TIMELINE_START) / TIMELINE_RANGE) * 100)).toFixed(2)}%`;
  const wid  = (a, b) => `${Math.max(0, Math.min(100, ((b - a) / TIMELINE_RANGE) * 100)).toFixed(2)}%`;

  const onBreak      = bsM !== null && beM === null;
  const effectiveOut = outM !== null ? outM : Math.min(nowM, TIMELINE_END);
  const fmtLabel     = t => (use12h ? to12h(t) : t) || t;

  const segments = [];
  const seg1End = bsM !== null ? bsM : effectiveOut;
  if (seg1End > inM) {
    segments.push({ left: pct(inM), width: wid(inM, seg1End), color: 'bg-emerald-400 dark:bg-emerald-500' });
  }
  if (bsM !== null) {
    const breakEffEnd = beM !== null ? beM : (onBreak ? Math.min(nowM, TIMELINE_END) : bsM);
    if (breakEffEnd > bsM) {
      segments.push({ left: pct(bsM), width: wid(bsM, breakEffEnd), color: 'bg-amber-300 dark:bg-amber-400' });
    }
    if (beM !== null) {
      const seg2End = outM !== null ? outM : Math.min(nowM, TIMELINE_END);
      if (seg2End > beM) {
        segments.push({ left: pct(beM), width: wid(beM, seg2End), color: 'bg-emerald-400 dark:bg-emerald-500' });
      }
    }
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-[4.5rem] text-right flex-shrink-0 tabular-nums">
        {fmtLabel(entry.timeIn)}
      </span>
      <div className="relative flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className={cn('absolute top-0 h-full', seg.color)}
            style={{ left: seg.left, width: seg.width }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-[4.5rem] flex-shrink-0 tabular-nums">
        {entry.timeOut
          ? fmtLabel(entry.timeOut)
          : <span className="italic opacity-60">ongoing</span>}
      </span>
    </div>
  );
}

// ─── Mini Bar Chart ──────────────────────────────────────────────────────────
// Compact bar chart. `bars` = [{ label, mins }]. Optional dashed reference line
// (e.g. daily target) drives the per-bar colour (green ≥ ref, amber ≥ 80%, else rose).

function MiniBars({ bars, refMins = 0, refLabel }) {
  const peak = Math.max(refMins, ...bars.map(b => b.mins || 0), 60);
  // With a target, keep the reference line ~60% up the plot so a day that meets
  // or beats it has clear room to rise above; otherwise just add headroom.
  const max = refMins > 0 ? Math.max(peak, refMins / 0.6) * 1.05 : peak * 1.12;
  const targetFrac = refMins > 0 ? refMins / max : 0;
  const yOf = mins => `${(mins / max) * 100}%`;

  return (
    <div>
      {/* Plot area — each column holds exactly one bar so % heights stay exact. */}
      <div className="relative h-32 flex items-end gap-2 sm:gap-3">
        {refMins > 0 && (
          <div className="absolute inset-x-0 z-10 pointer-events-none border-t border-dashed border-blue-400/70 dark:border-blue-500/60" style={{ bottom: yOf(refMins) }}>
            {refLabel && <span className="absolute right-0 -top-3.5 text-[9px] font-semibold text-blue-500 dark:text-blue-400 whitespace-nowrap">{refLabel}</span>}
          </div>
        )}
        {bars.map((b, i) => {
          const raw = b.mins > 0 ? b.mins / max : 0;
          // A day over target is nudged to clearly clear the line — 10 min over
          // 8h is only ~2%, too small to read proportionally. The exact figure
          // stays on the label above the bar.
          const frac = (refMins > 0 && b.mins > refMins) ? Math.max(raw, targetFrac + 0.09) : raw;
          const h   = b.mins > 0 ? Math.max(2, frac * 100) : 0;
          const pct = refMins > 0 ? b.mins / refMins : 1;
          const color = b.mins <= 0
            ? 'bg-gray-100 dark:bg-gray-800'
            : refMins > 0
              ? (pct >= 1 ? 'bg-emerald-500' : pct >= 0.8 ? 'bg-amber-400' : 'bg-rose-400')
              : 'bg-blue-500';
          return (
            <div key={i} className="flex-1 h-full relative flex items-end justify-center" title={b.mins > 0 ? fmtMins(b.mins) : 'No hours'}>
              {b.mins > 0 && (
                <span
                  className="absolute inset-x-0 text-center text-[9px] font-semibold tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap"
                  style={{ bottom: `calc(${h}% + 3px)` }}
                >
                  {fmtMins(b.mins)}
                </span>
              )}
              <div className={cn('w-full max-w-[2rem] rounded-t-md transition-all duration-500', color)} style={{ height: `${h}%` }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 sm:gap-3 mt-1.5">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 text-center text-[10px] font-medium text-gray-500 dark:text-gray-400 truncate">{b.label}</div>
        ))}
      </div>
    </div>
  );
}

// ─── Monthly View ────────────────────────────────────────────────────────────
// Payroll-style rollup: each ISO week whose Monday falls in the month, plus totals.

function MonthView({ year, month, weeks, totals, isCurrentMonth, onPrev, onNext, onToday }) {
  const cards = [
    { label: 'Month Total', value: fmtMins(totals.total), sub: `${totals.days} day${totals.days !== 1 ? 's' : ''} worked`, color: 'text-blue-600 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/30' },
    { label: 'Avg / Day',   value: totals.avg ? fmtMins(totals.avg) : '—',                 sub: 'across working days', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800/30' },
    { label: 'Days Worked', value: String(totals.days),                                    sub: 'this month',          color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/30' },
    { label: 'Weeks Logged', value: `${totals.weeks}/${weeks.length}`,                     sub: 'weeks with hours',    color: 'text-amber-600 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/30' },
  ];

  return (
    <>
      {/* Month navigator */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onPrev} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="hidden sm:inline">Prev</span>
          </button>
          <div className="flex-1 flex flex-col items-center">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <p className="font-bold text-gray-900 dark:text-white text-base">{MONTHS_SHORT[month]} {year}</p>
              {isCurrentMonth && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40">Current</span>
              )}
            </div>
            {!isCurrentMonth && (
              <button onClick={onToday} className="mt-2 text-xs font-medium px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                Go to This Month
              </button>
            )}
          </div>
          <button onClick={onNext} className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0">
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      {/* Month stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className={cn('rounded-2xl p-4 border', c.bg)}>
            <span className={cn('text-[10px] font-bold uppercase tracking-wider', c.color)}>{c.label}</span>
            <p className={cn('text-xl font-bold tabular-nums mt-1.5', c.color)}>{c.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Weekly-totals chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-4 shadow-sm">
        <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Weekly Totals</h3>
        {totals.total > 0
          ? <MiniBars bars={weeks.map(w => ({ label: `W${w.week}`, mins: w.total }))} />
          : <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-6">No hours logged this month yet.</p>}
      </div>

      {/* Weeks table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Week</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Range</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Days</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg / Day</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w, i) => (
                <tr key={w.week} className={cn('border-b border-gray-100 dark:border-gray-800', w.total > 0 ? '' : 'opacity-60')}>
                  <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white whitespace-nowrap">Wk {w.week}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">{fmtDate(w.mon)} – {fmtDate(w.sat)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{w.days || '—'}</td>
                  <td className={cn('px-4 py-2.5 text-right font-bold tabular-nums', w.total > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-700')}>{fmtMins(w.total)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{w.days > 0 ? fmtMins(Math.round(w.total / w.days)) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <td className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Month Total</td>
                <td className="px-4 py-3 text-xs text-gray-400 dark:text-gray-500 tabular-nums">{totals.days} day{totals.days !== 1 ? 's' : ''}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white">{totals.days}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white">{fmtMins(totals.total)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900 dark:text-white">{totals.avg ? fmtMins(totals.avg) : '—'}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
}

// â”€â”€â”€ Working Hours Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WorkingHours() {
  const { state, dispatch } = useApp();
  const use12h = (state.hourFormat || '24') === '12';

  const { week: initWeek, year: initYear } = useMemo(() => currentISOWeek(), []);
  const [week, setWeek] = useState(initWeek);
  const [year, setYear] = useState(initYear);
  const [viewMode, setViewMode] = useState('week');            // 'week' | 'month'
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [jumpOpen, setJumpOpen] = useState(false);
  const [confirmState, setConfirmState] = useState({ isOpen: false, day: null, field: null, value: null, currentValue: null });
  const [showTimeline, setShowTimeline] = useState(false);
  const dailyTargetMins = state.whDailyTarget ?? 480;

  const totalWeeks = useMemo(() => isoWeeksInYear(year), [year]);
  const weekKey    = `${year}-W${String(week).padStart(2, '0')}`;
  const weekData   = state.workingHours?.[weekKey] || {};

  const weekDates = useMemo(() => {
    const mon = getMondayOfISOWeek(year, week);
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(mon);
      d.setDate(mon.getDate() + i);
      return d;
    });
  }, [year, week]);

  const isCurrentWeek = useMemo(() => {
    const now = currentISOWeek();
    return now.week === week && now.year === year;
  }, [week, year]);

  function prevWeek() {
    if (week > 1) setWeek(w => w - 1);
    else { const py = year - 1; setYear(py); setWeek(isoWeeksInYear(py)); }
  }
  function nextWeek() {
    if (week < totalWeeks) setWeek(w => w + 1);
    else { setYear(y => y + 1); setWeek(1); }
  }
  function goToCurrentWeek() {
    const now = currentISOWeek();
    setWeek(now.week); setYear(now.year);
  }
  function adjustTarget(delta) {
    const next = Math.max(60, Math.min(720, dailyTargetMins + delta));
    dispatch({ type: 'SET_WH_DAILY_TARGET', payload: next });
  }

  // ── Month rollup (computed for the month view) ──
  const monthWeeks = useMemo(() => {
    return getWeeksForMonth(year, month).map(({ week: w, mon, sat }) => {
      const { total, days } = sumWeek(state.workingHours, year, w);
      return { week: w, mon, sat, total, days };
    });
  }, [state.workingHours, year, month]);

  const monthTotals = useMemo(() => {
    const total = monthWeeks.reduce((s, w) => s + w.total, 0);
    const days  = monthWeeks.reduce((s, w) => s + w.days, 0);
    return { total, days, avg: days > 0 ? Math.round(total / days) : null, weeks: monthWeeks.filter(w => w.total > 0).length };
  }, [monthWeeks]);

  const isCurrentMonth = useMemo(() => {
    const n = new Date();
    return n.getFullYear() === year && n.getMonth() === month;
  }, [year, month]);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(month + 1);
  }
  function goToCurrentMonth() { const n = new Date(); setYear(n.getFullYear()); setMonth(n.getMonth()); }

  function exportMonthXLSX() {
    const header = ['Week', 'Range', 'Days Worked', 'Total Hours', 'Avg / Day'];
    const rows = monthWeeks.map(w => [
      `Wk ${w.week}`, `${fmtDate(w.mon)} – ${fmtDate(w.sat)}`, w.days,
      fmtMins(w.total), w.days > 0 ? fmtMins(Math.round(w.total / w.days)) : '—',
    ]);
    rows.push(['', 'TOTAL', monthTotals.days, fmtMins(monthTotals.total), monthTotals.avg ? fmtMins(monthTotals.avg) : '—']);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Monthly Hours');
    XLSX.writeFile(wb, `working-hours-${year}-${MONTHS_SHORT[month]}.xlsx`);
  }

  function exportMonthPDF() {
    const header = ['Week', 'Range', 'Days Worked', 'Total Hours', 'Avg / Day'];
    const rows = monthWeeks.map(w => [
      `Wk ${w.week}`, `${fmtDate(w.mon)} – ${fmtDate(w.sat)}`, String(w.days),
      fmtMins(w.total), w.days > 0 ? fmtMins(Math.round(w.total / w.days)) : '–',
    ]);
    rows.push(['', 'TOTAL', String(monthTotals.days), fmtMins(monthTotals.total), monthTotals.avg ? fmtMins(monthTotals.avg) : '–']);
    const headerRow = header.map(h => `<th style="padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${h}</th>`).join('');
    const bodyRows = rows.map((r, ri) => {
      const isTotal = ri === rows.length - 1;
      const bg = isTotal ? '#f9fafb' : ri % 2 === 0 ? '#ffffff' : '#f9fafb';
      return `<tr>${r.map((cell, ci) => `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};font-weight:${isTotal || ci === 3 ? '700' : '400'};color:${isTotal && ci === 3 ? '#059669' : '#111827'};">${escapeHtml(cell)}</td>`).join('')}</tr>`;
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Working Hours – ${MONTHS_SHORT[month]} ${year}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#111827;}h2{margin:0 0 4px;font-size:16px;}p{margin:0 0 14px;font-size:12px;color:#6b7280;}table{border-collapse:collapse;width:100%;}@media print{body{margin:12px;}}</style>
</head><body>
<h2>Working Hours &mdash; ${MONTHS_SHORT[month]} ${year}</h2>
<p>Month total ${fmtMins(monthTotals.total)} &middot; ${monthTotals.days} days worked${monthTotals.avg ? ` &middot; avg ${fmtMins(monthTotals.avg)}/day` : ''}</p>
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;
    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  const handleChange = useCallback((day, field, value) => {
    const currentValue = weekData[day]?.[field];
    if (currentValue && currentValue !== value) {
      setConfirmState({ isOpen: true, day, field, value, currentValue });
      return;
    }
    dispatch({ type: 'SET_WORKING_HOURS_ENTRY', payload: { weekKey, day, field, value } });
  }, [dispatch, weekKey, weekData]);

  const confirmChange = () => {
    const { day, field, value } = confirmState;
    if (day && field) {
      dispatch({ type: 'SET_WORKING_HOURS_ENTRY', payload: { weekKey, day, field, value } });
    }
  };

  const netMinsPerDay = DAYS.map(day => calcNetMins(weekData[day]));
  const totalMins     = netMinsPerDay.reduce((s, m) => s + (m || 0), 0);

  // Per-day view model, shared by the desktop table and the mobile card list.
  const dayRows = DAYS.map((day, i) => {
    const entry     = weekData[day] || {};
    const netMins   = netMinsPerDay[i];
    const date      = weekDates[i];
    const td        = new Date();
    const isToday   = date && date.getDate() === td.getDate() && date.getMonth() === td.getMonth() && date.getFullYear() === td.getFullYear();
    const isSat     = day === 'Sat';
    const pct       = netMins && netMins > 0 ? Math.min(100, Math.round((netMins / dailyTargetMins) * 100)) : 0;
    return {
      day, i, entry, netMins, date, isToday, isSat, pct,
      incomplete: isPastDate(date) && isIncompleteEntry(entry),
      overnight:  isOvernightEntry(entry),
    };
  });

  function exportXLSX() {
    const header = ['Day', 'Date', 'Time In', 'Break Start', 'Break Stop', 'Time Out', 'Net Hours'];
    const dataRows = DAYS.map((day, i) => {
      const e = weekData[day] || {};
      const fmt = t => use12h ? (to12h(t) || '') : (t || '');
      return [day, fmtDate(weekDates[i]), fmt(e.timeIn), fmt(e.breakStart), fmt(e.breakStop), fmt(e.timeOut), fmtMins(netMinsPerDay[i])];
    });
    dataRows.push(['', 'TOTAL', '', '', '', '', fmtMins(totalMins)]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Working Hours');
    XLSX.writeFile(wb, `working-hours-${weekKey}.xlsx`);
  }

  function exportPDF() {
    const header = ['Day', 'Date', 'Time In', 'Break Start', 'Break Stop', 'Time Out', 'Net Hours'];
    const rows = DAYS.map((day, i) => {
      const e = weekData[day] || {};
      const fmt = t => use12h ? (to12h(t) || '–') : (t || '–');
      return [day, fmtDate(weekDates[i]), fmt(e.timeIn), fmt(e.breakStart), fmt(e.breakStop), fmt(e.timeOut), fmtMins(netMinsPerDay[i])];
    });
    rows.push(['', 'TOTAL', '', '', '', '', fmtMins(totalMins)]);

    const colWidths = ['8%', '12%', '15%', '15%', '15%', '15%', '12%'];
    const headerRow = header.map((h, i) => `<th style="width:${colWidths[i]};padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${h}</th>`).join('');
    const bodyRows = rows.map((r, ri) => {
      const isTotal = ri === rows.length - 1;
      const bg = isTotal ? '#f9fafb' : ri % 2 === 0 ? '#ffffff' : '#f9fafb';
      const fw = isTotal ? '700' : '400';
      return `<tr>${r.map((cell, ci) => `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};font-weight:${ci === 6 || isTotal ? fw : '400'};color:${isTotal && ci === 6 ? '#059669' : '#111827'};">${escapeHtml(cell)}</td>`).join('')}</tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Working Hours – ${weekKey}</title>
<style>body{font-family:Arial,sans-serif;margin:24px;color:#111827;}h2{margin:0 0 4px;font-size:16px;}p{margin:0 0 14px;font-size:12px;color:#6b7280;}table{border-collapse:collapse;width:100%;}@media print{body{margin:12px;}}</style>
</head><body>
<h2>Working Hours &mdash; ${weekKey}</h2>
<p>${rangeLabel}</p>
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=650');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  const rangeLabel = weekDates.length === 6
    ? `${fmtDate(weekDates[0])} – ${fmtDate(weekDates[5])}`
    : '';

  return (
    <div className="space-y-5">

      {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Working Hours</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Personal time tracker &middot; {use12h ? '12-hour' : '24-hour'} format
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {/* Week / Month view toggle */}
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl mr-1">
            {['week', 'month'].map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={cn(
                  'px-3 py-1.5 text-sm font-semibold rounded-lg transition capitalize',
                  viewMode === v ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={viewMode === 'week' ? exportXLSX : exportMonthXLSX}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950
              transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="hidden sm:inline">Export </span>Excel
          </button>
          <button
            onClick={viewMode === 'week' ? exportPDF : exportMonthPDF}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-700 hover:bg-gray-800
              dark:bg-gray-700 dark:hover:bg-gray-600
              text-white font-semibold text-sm rounded-xl shadow-md
              focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950
              transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span className="hidden sm:inline">Export </span>PDF
          </button>
        </div>
      </div>

      {/* â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {viewMode === 'month' && (
        <MonthView
          year={year} month={month}
          weeks={monthWeeks} totals={monthTotals}
          isCurrentMonth={isCurrentMonth}
          onPrev={prevMonth} onNext={nextMonth} onToday={goToCurrentMonth}
        />
      )}

      {viewMode === 'week' && (<>
      <StatsCards weekData={weekData} use12h={use12h} />

      {/* Week at a glance — daily bar chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">This Week</h3>
          <span className="text-xs text-gray-400 dark:text-gray-500">Target {fmtMins(dailyTargetMins)}/day</span>
        </div>
        <MiniBars
          bars={DAYS.map((d, i) => ({ label: d, mins: netMinsPerDay[i] || 0 }))}
          refMins={dailyTargetMins}
          refLabel={fmtMins(dailyTargetMins)}
        />
      </div>

      {/* â”€â”€ Week Navigator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Prev */}
          <button
            onClick={prevWeek}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium
              bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
              hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Centre */}
          <div className="flex-1 flex flex-col items-center relative">
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <p className="font-bold text-gray-900 dark:text-white text-base">
                Week {week} &middot; {year}
              </p>
              {isCurrentWeek && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full
                  bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400
                  border border-blue-200 dark:border-blue-700/40">
                  Current
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rangeLabel}</p>

            <div className="flex items-center gap-2 mt-2">
              {!isCurrentWeek && (
                <button
                  onClick={goToCurrentWeek}
                  className="text-xs font-medium px-2.5 py-1 rounded-lg
                    text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-700/40
                    hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
                >
                  Go to Today
                </button>
              )}

              {/* Jump-to-week button */}
              <div className="relative">
                <button
                  onClick={() => setJumpOpen(o => !o)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg
                    bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400
                    hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Jump to week
                  <svg className={cn('w-3 h-3 transition-transform', jumpOpen && 'rotate-180')}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Next */}
          <button
            onClick={nextWeek}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium
              bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200
              hover:bg-gray-200 dark:hover:bg-gray-700 transition flex-shrink-0"
          >
            <span className="hidden sm:inline">Next</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">

        {/* ── Toolbar ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
          {/* Daily target control */}
          <div className="flex items-center gap-2">
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-0.5">Target</span>
            <button
              onClick={() => adjustTarget(-30)}
              disabled={dailyTargetMins <= 60}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-base leading-none transition"
              aria-label="Decrease target"
            >−</button>
            <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums min-w-[3rem] text-center">
              {fmtMins(dailyTargetMins)}
            </span>
            <button
              onClick={() => adjustTarget(30)}
              disabled={dailyTargetMins >= 720}
              className="w-6 h-6 flex items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-base leading-none transition"
              aria-label="Increase target"
            >+</button>
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-0.5">/ day</span>
          </div>

          {/* Timeline toggle */}
          <button
            onClick={() => setShowTimeline(t => !t)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition',
              showTimeline
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h10M4 14h7M4 18h4" />
            </svg>
            Timeline
          </button>
        </div>

        <div className="overflow-x-auto hidden lg:block">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[60px]">Day</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[76px]">Date</th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11 16l-4-4m0 0l4-4m-4 4h14" />
                    </svg>
                    Time In
                  </div>
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                    </svg>
                    Break Start
                  </div>
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M14 15l-4 4m0 0l-4-4m4 4V3" />
                    </svg>
                    Break Stop
                  </div>
                </th>
                <th className="px-3 py-3 text-xs font-semibold uppercase tracking-wider">
                  <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Time Out
                  </div>
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px]">
                  Net Hours
                </th>
              </tr>
            </thead>

            <tbody>
              {dayRows.map(({ day, entry, netMins, date, isToday, isSat, pct, incomplete, overnight }) => {
                const rowBg  = isToday ? 'bg-blue-50/50 dark:bg-blue-900/10'
                             : isSat   ? 'bg-gray-50/40 dark:bg-gray-800/10' : '';

                return (
                  <React.Fragment key={day}>
                    <tr className={cn('border-b border-gray-100 dark:border-gray-800 transition-colors', rowBg)}>
                      {/* Day label */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            'font-bold text-sm',
                            isToday ? 'text-blue-600 dark:text-blue-400' :
                            isSat   ? 'text-gray-500 dark:text-gray-500' :
                                      'text-gray-900 dark:text-white'
                          )}>
                            {day}
                          </span>
                          {isToday && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white leading-none">
                              NOW
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap tabular-nums">
                        {date ? fmtDate(date) : ''}
                      </td>

                      {/* Time In */}
                      <td className="px-3 py-2">
                        <TimeCell
                          value={entry.timeIn}
                          onChange={v => handleChange(day, 'timeIn', v)}
                          scheme="green"
                        />
                      </td>

                      {/* Break Start */}
                      <td className="px-3 py-2">
                        <TimeCell
                          value={entry.breakStart}
                          onChange={v => handleChange(day, 'breakStart', v)}
                          scheme="amber"
                        />
                      </td>

                      {/* Break Stop */}
                      <td className="px-3 py-2">
                        <TimeCell
                          value={entry.breakStop}
                          onChange={v => handleChange(day, 'breakStop', v)}
                          scheme="amber"
                        />
                      </td>

                      {/* Time Out */}
                      <td className="px-3 py-2">
                        <TimeCell
                          value={entry.timeOut}
                          onChange={v => handleChange(day, 'timeOut', v)}
                          scheme="red"
                        />
                      </td>

                      {/* Net Hours + progress bar */}
                      <td className="px-4 py-2.5 text-right min-w-[100px]">
                        <div className="flex items-center justify-end gap-1.5">
                          {incomplete && (
                            <span title="Incomplete — this past day is missing a Time In or Time Out" className="text-amber-500 dark:text-amber-400 flex-shrink-0">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </span>
                          )}
                          <span className={cn(
                            'font-bold text-sm tabular-nums',
                            netMins && netMins > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-gray-300 dark:text-gray-700'
                          )}>
                            {fmtMins(netMins)}
                          </span>
                        </div>
                        {overnight && (
                          <span title="Time Out is before Time In — counted as an overnight shift" className="block text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 mt-0.5">
                            overnight
                          </span>
                        )}
                        {isToday && isCurrentWeek && entry.timeIn && !entry.timeOut && (
                          <LiveNetTimer
                            timeIn={entry.timeIn}
                            breakStart={entry.breakStart}
                            breakStop={entry.breakStop}
                          />
                        )}
                        {pct > 0 && (
                          <div className="mt-1.5 w-full h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                pct >= 100 ? 'bg-emerald-500'
                                : pct >= 80 ? 'bg-amber-400'
                                : 'bg-rose-400'
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Timeline sub-row */}
                    {showTimeline && entry.timeIn && (
                      <tr className={cn('transition-colors', rowBg)} style={{ borderTop: 'none' }}>
                        <td colSpan={7} className="px-4 pb-2 pt-0">
                          <DayTimeline entry={entry} use12h={use12h} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <td colSpan={6} className="px-4 py-3 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Weekly Total
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={cn(
                    'font-bold text-base tabular-nums',
                    totalMins > 0
                      ? 'text-gray-900 dark:text-white'
                      : 'text-gray-400 dark:text-gray-600'
                  )}>
                    {fmtMins(totalMins)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile: one tappable card per day — no horizontal scrolling */}
        <div className="lg:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {dayRows.map(({ day, entry, netMins, date, isToday, isSat, pct, incomplete, overnight }) => {
            const rowBg = isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : '';
            return (
              <div key={day} className={cn('px-3 py-3', rowBg)}>
                {/* Header: day + date + net hours */}
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('font-bold text-sm', isToday ? 'text-blue-600 dark:text-blue-400' : isSat ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white')}>{day}</span>
                    {isToday && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-600 text-white leading-none">NOW</span>}
                    <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums">{date ? fmtDate(date) : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {incomplete && (
                      <span title="Incomplete — this past day is missing a Time In or Time Out" className="text-amber-500 dark:text-amber-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                      </span>
                    )}
                    <span className={cn('font-bold text-sm tabular-nums', netMins && netMins > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-700')}>{fmtMins(netMins)}</span>
                    {overnight && <span className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400">overnight</span>}
                  </div>
                </div>

                {/* 2×2 time fields */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Time In',     entry.timeIn,     'timeIn',     'green'],
                    ['Break Start', entry.breakStart, 'breakStart', 'amber'],
                    ['Break Stop',  entry.breakStop,  'breakStop',  'amber'],
                    ['Time Out',    entry.timeOut,    'timeOut',    'red'],
                  ].map(([label, val, field, scheme]) => (
                    <div key={field} className="space-y-1 min-w-0">
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</label>
                      <TimeCell value={val} onChange={v => handleChange(day, field, v)} scheme={scheme} fill />
                    </div>
                  ))}
                </div>

                {/* Live timer for today, then progress + timeline */}
                {isToday && isCurrentWeek && entry.timeIn && !entry.timeOut && (
                  <div className="mt-2 flex justify-end"><LiveNetTimer timeIn={entry.timeIn} breakStart={entry.breakStart} breakStop={entry.breakStop} /></div>
                )}
                {pct > 0 && (
                  <div className="mt-2 w-full h-1 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all duration-500', pct >= 100 ? 'bg-emerald-500' : pct >= 80 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${pct}%` }} />
                  </div>
                )}
                {showTimeline && entry.timeIn && (
                  <div className="mt-2"><DayTimeline entry={entry} use12h={use12h} /></div>
                )}
              </div>
            );
          })}
          {/* Weekly total */}
          <div className="flex items-center justify-between px-3 py-3 bg-gray-50 dark:bg-gray-800/60">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Weekly Total</span>
            <span className={cn('font-bold text-base tabular-nums', totalMins > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600')}>{fmtMins(totalMins)}</span>
          </div>
        </div>
      </div>
      </>)}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        onClose={() => setConfirmState(s => ({ ...s, isOpen: false }))}
        onConfirm={confirmChange}
        title="Confirm Time Change"
        message={confirmState.value ? 'Overwrite the existing time entry?' : 'Clear the saved time entry?'}
        comparison={{
          from: use12h ? to12h(confirmState.currentValue) : confirmState.currentValue,
          to:   confirmState.value ? (use12h ? to12h(confirmState.value) : confirmState.value) : null,
        }}
        confirmLabel="Confirm"
        danger={false}
      />
    </div>
  );
}


