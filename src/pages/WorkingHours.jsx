import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';

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
  if (inM === null || outM === null || outM <= inM) return null;
  let net = outM - inM;
  const bsM = toMins(entry.breakStart);
  const beM = toMins(entry.breakStop);
  if (bsM !== null && beM !== null && beM > bsM) net -= beM - bsM;
  return net > 0 ? net : null;
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

  return (
    <div className="flex flex-col items-end gap-0.5 mt-0.5">
      <div className={cn(
        'flex items-center gap-1 text-xs font-semibold tabular-nums',
        onBreak ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
      )}>
        <span className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          onBreak
            ? 'bg-amber-400'
            : 'bg-emerald-500 animate-pulse'
        )} />
        {fmtMins(netMins)}
      </div>
      {onBreak && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 dark:text-amber-500 leading-none">
          On Break
        </span>
      )}
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

function TimeCell({ value, onChange, scheme = 'green' }) {
  const s = SCHEME[scheme];

  return (
    <div className="flex items-center gap-1 min-w-[155px]">
      {/* Native time input with styled border */}
      <div className={cn(
        'rounded-lg border flex-1 transition-colors bg-white dark:bg-gray-900 focus-within:ring-2 focus-within:ring-blue-400/40 focus-within:ring-offset-1',
        s.border
      )}>
        <input
          type="time"
          value={value || ''}
          onChange={e => onChange(e.target.value || null)}
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
        title="Set to current time"
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

// â”€â”€â”€ Working Hours Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function WorkingHours() {
  const { state, dispatch } = useApp();
  const use12h = (state.hourFormat || '24') === '12';

  const { week: initWeek, year: initYear } = useMemo(() => currentISOWeek(), []);
  const [week, setWeek] = useState(initWeek);
  const [year, setYear] = useState(initYear);
  const [jumpOpen, setJumpOpen] = useState(false);

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

  const handleChange = useCallback((day, field, value) => {
    dispatch({ type: 'SET_WORKING_HOURS_ENTRY', payload: { weekKey, day, field, value } });
  }, [dispatch, weekKey]);

  const netMinsPerDay = DAYS.map(day => calcNetMins(weekData[day]));
  const totalMins     = netMinsPerDay.reduce((s, m) => s + (m || 0), 0);

  function exportXLSX() {
    const header = ['Day', 'Date', 'Time In', 'Break Start', 'Break Stop', 'Time Out', 'Net Hours'];
    const dataRows = DAYS.map((day, i) => {
      const e = weekData[day] || {};
      return [day, fmtDate(weekDates[i]), e.timeIn || '', e.breakStart || '', e.breakStop || '', e.timeOut || '', fmtMins(netMinsPerDay[i])];
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
      return [day, fmtDate(weekDates[i]), e.timeIn || '–', e.breakStart || '–', e.breakStop || '–', e.timeOut || '–', fmtMins(netMinsPerDay[i])];
    });
    rows.push(['', 'TOTAL', '', '', '', '', fmtMins(totalMins)]);

    const colWidths = ['8%', '12%', '15%', '15%', '15%', '15%', '12%'];
    const headerRow = header.map((h, i) => `<th style="width:${colWidths[i]};padding:8px 10px;background:#f3f4f6;border:1px solid #d1d5db;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${h}</th>`).join('');
    const bodyRows = rows.map((r, ri) => {
      const isTotal = ri === rows.length - 1;
      const bg = isTotal ? '#f9fafb' : ri % 2 === 0 ? '#ffffff' : '#f9fafb';
      const fw = isTotal ? '700' : '400';
      return `<tr>${r.map((cell, ci) => `<td style="padding:7px 10px;border:1px solid #e5e7eb;font-size:12px;background:${bg};font-weight:${ci === 6 || isTotal ? fw : '400'};color:${isTotal && ci === 6 ? '#059669' : '#111827'};">${cell}</td>`).join('')}</tr>`;
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
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exportXLSX}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700
              text-white font-semibold text-sm rounded-xl shadow-md shadow-emerald-600/20
              focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-950
              transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
          <button
            onClick={exportPDF}
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
            Export PDF
          </button>
        </div>
      </div>

      {/* â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <StatsCards weekData={weekData} use12h={use12h} />

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
        <div className="overflow-x-auto">
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

            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {DAYS.map((day, i) => {
                const entry     = weekData[day] || {};
                const netMins   = netMinsPerDay[i];
                const date      = weekDates[i];
                const todayDate = new Date();
                const isToday   = date &&
                  date.getDate() === todayDate.getDate() &&
                  date.getMonth() === todayDate.getMonth() &&
                  date.getFullYear() === todayDate.getFullYear();
                const isSat = day === 'Sat';

                return (
                  <tr
                    key={day}
                    className={cn(
                      'transition-colors',
                      isToday ? 'bg-blue-50/50 dark:bg-blue-900/10' :
                      isSat   ? 'bg-gray-50/40 dark:bg-gray-800/10' : ''
                    )}
                  >
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

                    {/* Net Hours */}
                    <td className="px-4 py-2.5 text-right">
                      <span className={cn(
                        'font-bold text-sm tabular-nums',
                        netMins && netMins > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-300 dark:text-gray-700'
                      )}>
                        {fmtMins(netMins)}
                      </span>
                      {isToday && isCurrentWeek && entry.timeIn && !entry.timeOut && (
                        <LiveNetTimer
                          timeIn={entry.timeIn}
                          breakStart={entry.breakStart}
                          breakStop={entry.breakStop}
                        />
                      )}
                    </td>
                  </tr>
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
      </div>

      <p className="text-xs text-center text-gray-400 dark:text-gray-600 lg:hidden">
        Scroll horizontally to see all columns
      </p>
    </div>
  );
}


