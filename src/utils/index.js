import {
  format, addMonths, subMonths, differenceInCalendarDays,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isSameDay, isSameMonth, parseISO, isToday, isBefore, isAfter,
  addDays, getYear, getMonth, getDate, setDate as setDateFn,
  addQuarters, startOfQuarter, endOfQuarter,
} from 'date-fns';

// ─── Tax Type Constants ────────────────────────────────────────────────────────

export const TAX_TYPES = {
  VAT:         'VAT',
  PAYE:        'PAYE',
  SDL:         'SDL',
  WHT:         'WHT',
  NSSF:        'NSSF',
  WCF:         'WCF',
  PROVISIONAL: 'Provisional Tax',
  CITY_LEVY:   'City Levy',
  ROI:         'ROI / Accounts',
};

export const TAX_TYPE_KEYS = Object.keys(TAX_TYPES);

export const TAX_COLORS = {
  VAT:         { bg: 'bg-blue-100 dark:bg-blue-900/30',    text: 'text-blue-700 dark:text-blue-400',    border: 'border-blue-400 dark:border-blue-700/50',    dot: 'bg-blue-500 dark:bg-blue-400',    ring: 'focus:ring-blue-500',    hex: '#60a5fa' },
  PAYE:        { bg: 'bg-purple-100 dark:bg-purple-900/30',text: 'text-purple-700 dark:text-purple-400',border: 'border-purple-400 dark:border-purple-700/50',dot: 'bg-purple-500 dark:bg-purple-400',ring: 'focus:ring-purple-500',  hex: '#c084fc' },
  SDL:         { bg: 'bg-cyan-100 dark:bg-cyan-900/30',    text: 'text-cyan-700 dark:text-cyan-400',    border: 'border-cyan-400 dark:border-cyan-700/50',    dot: 'bg-cyan-500 dark:bg-cyan-400',    ring: 'focus:ring-cyan-500',    hex: '#22d3ee' },
  WHT:         { bg: 'bg-rose-100 dark:bg-rose-900/30',    text: 'text-rose-700 dark:text-rose-400',    border: 'border-rose-400 dark:border-rose-700/50',    dot: 'bg-rose-500 dark:bg-rose-400',    ring: 'focus:ring-rose-500',    hex: '#fb7185' },
  NSSF:        { bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-400 dark:border-green-700/50',  dot: 'bg-green-500 dark:bg-green-400',  ring: 'focus:ring-green-500',   hex: '#4ade80' },
  WCF:         { bg: 'bg-teal-100 dark:bg-teal-900/30',    text: 'text-teal-700 dark:text-teal-400',    border: 'border-teal-400 dark:border-teal-700/50',    dot: 'bg-teal-500 dark:bg-teal-400',    ring: 'focus:ring-teal-500',    hex: '#2dd4bf' },
  PROVISIONAL: { bg: 'bg-orange-100 dark:bg-orange-900/30',text: 'text-orange-700 dark:text-orange-400',border: 'border-orange-400 dark:border-orange-700/50',dot: 'bg-orange-500 dark:bg-orange-400',ring: 'focus:ring-orange-500',  hex: '#fb923c' },
  CITY_LEVY:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30',text: 'text-yellow-700 dark:text-yellow-400',border: 'border-yellow-400 dark:border-yellow-700/50',dot: 'bg-yellow-500 dark:bg-yellow-400',ring: 'focus:ring-yellow-500',  hex: '#facc15' },
  ROI:         { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-400 dark:border-indigo-700/50', dot: 'bg-indigo-500 dark:bg-indigo-400', ring: 'focus:ring-indigo-500', hex: '#818cf8' },
};

export const TASK_STATUS = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
};

export const PRIORITY = {
  LOW:    'low',
  MEDIUM: 'medium',
  HIGH:   'high',
};

// ─── UUID ─────────────────────────────────────────────────────────────────────

export function uuid() {
  return crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────

export { format, parseISO, isSameDay, isToday, isBefore, isAfter, isSameMonth, differenceInCalendarDays, addDays };

export function today() {
  return new Date();
}

export function daysUntil(dateStr) {
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return differenceInCalendarDays(d, new Date());
}

export function countdownLabel(dateStr) {
  const days = daysUntil(dateStr);
  if (days === 0) return 'Due Today';
  if (days < 0)  return `Overdue by ${Math.abs(days)}d`;
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

export function countdownStatus(dateStr) {
  const days = daysUntil(dateStr);
  if (days < 0)  return 'overdue';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
}

export function formatDate(dateStr, fmt = 'dd MMM yyyy') {
  if (!dateStr) return '';
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  return format(d, fmt);
}

export function formatPeriod(type, month, year) {
  if (type === 'PROVISIONAL' || type === 'CITY_LEVY') {
    return `Q${Math.ceil((month + 1) / 3)} ${year}`;
  }
  return format(new Date(year, month, 1), 'MMMM yyyy');
}

// ─── Deadline Calculations ────────────────────────────────────────────────────

/**
 * Returns the VAT filing due date for a given return period.
 * Period: year/month (0-indexed month) the return covers.
 * Due: 20th of the FOLLOWING month.
 */
export function vatDueDate(periodYear, periodMonth) {
  // Due 20th of next month
  const d = new Date(periodYear, periodMonth + 1, 20);
  return d;
}

/**
 * PAYE/SDL/WHT: due 7th of the following month.
 */
export function payeDueDate(periodYear, periodMonth) {
  return new Date(periodYear, periodMonth + 1, 7);
}

/**
 * NSSF/WCF: due 30th of the following month.
 */
export function nssfDueDate(periodYear, periodMonth) {
  return new Date(periodYear, periodMonth + 1, 30);
}

/**
 * ROI / Accounts submission: due June 30 of the filing year.
 */
export function roiDueDate(filingYear) {
  return new Date(filingYear, 5, 30); // June 30
}

/**
 * City Levy & Provisional Tax: quarterly — end of the quarter.
 * Q1 (Jan-Mar) → 31 Mar, Q2 (Apr-Jun) → 30 Jun, Q3 (Jul-Sep) → 30 Sep, Q4 (Oct-Dec) → 31 Dec
 */
export function quarterlyDueDate(year, quarter) {
  const ends = [
    new Date(year, 2, 31),  // Q1 → 31 Mar
    new Date(year, 5, 30),  // Q2 → 30 Jun
    new Date(year, 8, 30),  // Q3 → 30 Sep
    new Date(year, 11, 31), // Q4 → 31 Dec
  ];
  return ends[quarter - 1];
}

/**
 * Returns the quarter number (1-4) for a given month (0-indexed).
 */
export function monthToQuarter(month) {
  return Math.floor(month / 3) + 1;
}

/**
 * Get the current/active period for a tax type based on today.
 * Returns { periodYear, periodMonth, quarter, dueDate }
 */
export function getActivePeriods(taxType, refDate = new Date()) {
  const y = getYear(refDate);
  const m = getMonth(refDate); // 0-indexed
  const periods = [];

  if (taxType === 'VAT') {
    // Show: last month (current filing period), and current month (next period)
    // Period M is due 20th of M+1
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    periods.push({ periodYear: prevY, periodMonth: prevM, dueDate: vatDueDate(prevY, prevM), period: `${prevY}-${String(prevM).padStart(2, '0')}` });
    periods.push({ periodYear: y, periodMonth: m, dueDate: vatDueDate(y, m), period: `${y}-${String(m).padStart(2, '0')}` });
  }

  if (taxType === 'PAYE' || taxType === 'SDL' || taxType === 'WHT') {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    periods.push({ periodYear: prevY, periodMonth: prevM, dueDate: payeDueDate(prevY, prevM), period: `${prevY}-${String(prevM).padStart(2, '0')}` });
    periods.push({ periodYear: y, periodMonth: m, dueDate: payeDueDate(y, m), period: `${y}-${String(m).padStart(2, '0')}` });
  }

  if (taxType === 'NSSF' || taxType === 'WCF') {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    periods.push({ periodYear: prevY, periodMonth: prevM, dueDate: nssfDueDate(prevY, prevM), period: `${prevY}-${String(prevM).padStart(2, '0')}` });
    periods.push({ periodYear: y, periodMonth: m, dueDate: nssfDueDate(y, m), period: `${y}-${String(m).padStart(2, '0')}` });
  }

  if (taxType === 'PROVISIONAL' || taxType === 'CITY_LEVY') {
    const currentQ = monthToQuarter(m);
    const prevQ = currentQ === 1 ? 4 : currentQ - 1;
    const prevQY = currentQ === 1 ? y - 1 : y;
    periods.push({ periodYear: prevQY, periodMonth: null, quarter: prevQ, dueDate: quarterlyDueDate(prevQY, prevQ), period: `${prevQY}-Q${prevQ}` });
    periods.push({ periodYear: y, periodMonth: null, quarter: currentQ, dueDate: quarterlyDueDate(y, currentQ), period: `${y}-Q${currentQ}` });
  }

  if (taxType === 'ROI') {
    // Annual: accounting year Y-1, filed by June 30 of current year Y
    const periodYear = y - 1;
    periods.push({
      periodYear,
      periodMonth: null,
      annual: true,
      dueDate: roiDueDate(y),
      period: `${periodYear}-annual`,
    });
  }

  return periods;
}

/**
 * Get ALL upcoming deadlines in the next `days` days.
 * Returns sorted array of deadline objects.
 */
export function getUpcomingDeadlines(days = 90, refDate = new Date()) {
  const y = getYear(refDate);
  const m = getMonth(refDate);
  const cutoff = addDays(refDate, days);
  const results = [];

  const monthlyTypes = ['VAT', 'PAYE', 'SDL', 'WHT', 'NSSF', 'WCF'];
  const quarterlyTypes = ['PROVISIONAL', 'CITY_LEVY'];

  // Monthly: look at prev month, current, next month
  for (const type of monthlyTypes) {
    for (let offset = -1; offset <= 2; offset++) {
      let pm = m + offset;
      let py = y;
      while (pm < 0)  { pm += 12; py--; }
      while (pm > 11) { pm -= 12; py++; }

      let due;
      if (type === 'VAT')  due = vatDueDate(py, pm);
      if (type === 'PAYE' || type === 'SDL' || type === 'WHT') due = payeDueDate(py, pm);
      if (type === 'NSSF' || type === 'WCF') due = nssfDueDate(py, pm);

      if (isAfter(due, addDays(refDate, -30)) && isBefore(due, cutoff)) {
        const days = differenceInCalendarDays(due, refDate);
        results.push({
          id: `${type}-${py}-${pm}`,
          type,
          period: `${py}-${String(pm).padStart(2, '0')}`,
          periodLabel: format(new Date(py, pm, 1), 'MMMM yyyy'),
          dueDate: due.toISOString(),
          dueDateFormatted: format(due, 'dd MMM yyyy'),
          daysRemaining: days,
          status: days < 0 ? 'overdue' : days <= 3 ? 'critical' : days <= 7 ? 'warning' : 'ok',
        });
      }
    }
  }

  // Quarterly: look across recent quarters
  for (const type of quarterlyTypes) {
    for (let qOffset = -1; qOffset <= 2; qOffset++) {
      const currentQ = monthToQuarter(m);
      let q = currentQ + qOffset;
      let qy = y;
      while (q < 1)  { q += 4; qy--; }
      while (q > 4)  { q -= 4; qy++; }

      const due = quarterlyDueDate(qy, q);
      if (isAfter(due, addDays(refDate, -30)) && isBefore(due, cutoff)) {
        const daysDiff = differenceInCalendarDays(due, refDate);
        results.push({
          id: `${type}-${qy}-Q${q}`,
          type,
          period: `${qy}-Q${q}`,
          periodLabel: `Q${q} ${qy}`,
          dueDate: due.toISOString(),
          dueDateFormatted: format(due, 'dd MMM yyyy'),
          daysRemaining: daysDiff,
          status: daysDiff < 0 ? 'overdue' : daysDiff <= 3 ? 'critical' : daysDiff <= 7 ? 'warning' : 'ok',
        });
      }
    }
  }

  // Annual: ROI/Accounts — June 30 each filing year
  for (let yOffset = 0; yOffset <= 1; yOffset++) {
    const filingYear = y + yOffset;
    const due = roiDueDate(filingYear);
    if (isAfter(due, addDays(refDate, -30)) && isBefore(due, cutoff)) {
      const daysDiff = differenceInCalendarDays(due, refDate);
      const periodYear = filingYear - 1;
      results.push({
        id: `ROI-${periodYear}-annual`,
        type: 'ROI',
        period: `${periodYear}-annual`,
        periodLabel: `Year ${periodYear}`,
        dueDate: due.toISOString(),
        dueDateFormatted: format(due, 'dd MMM yyyy'),
        daysRemaining: daysDiff,
        status: daysDiff < 0 ? 'overdue' : daysDiff <= 3 ? 'critical' : daysDiff <= 7 ? 'warning' : 'ok',
      });
    }
  }

  return results.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

/**
 * Get due dates for all active deadlines that should appear on a calendar day.
 */
export function getDeadlinesForDate(dateStr) {
  const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  const y = getYear(d);
  const m = getMonth(d);
  const day = getDate(d);
  const matches = [];

  // VAT on 20th
  if (day === 20) {
    // Which period? VAT for month m-1 is due on 20th of month m
    const periodM = m === 0 ? 11 : m - 1;
    const periodY = m === 0 ? y - 1 : y;
    matches.push({ type: 'VAT', period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `VAT ${format(new Date(periodY, periodM, 1), 'MMM yyyy')}` });
  }
  // PAYE / SDL / WHT on 7th
  if (day === 7) {
    const periodM = m === 0 ? 11 : m - 1;
    const periodY = m === 0 ? y - 1 : y;
    const pLabel = format(new Date(periodY, periodM, 1), 'MMM yyyy');
    matches.push({ type: 'PAYE', period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `PAYE ${pLabel}` });
    matches.push({ type: 'SDL',  period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `SDL ${pLabel}` });
    matches.push({ type: 'WHT',  period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `WHT ${pLabel}` });
  }
  // NSSF / WCF on 30th
  if (day === 30) {
    const periodM = m === 0 ? 11 : m - 1;
    const periodY = m === 0 ? y - 1 : y;
    const nLabel = format(new Date(periodY, periodM, 1), 'MMM yyyy');
    matches.push({ type: 'NSSF', period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `NSSF ${nLabel}` });
    matches.push({ type: 'WCF',  period: `${periodY}-${String(periodM).padStart(2, '0')}`, label: `WCF ${nLabel}` });
    // ROI/Accounts due June 30
    if (m === 5) {
      matches.push({ type: 'ROI', period: `${y - 1}-annual`, label: `ROI/Accounts ${y - 1}` });
    }
  }
  // Quarterly: Mar 31, Jun 30, Sep 30, Dec 31
  if ((m === 2 && day === 31) || (m === 5 && day === 30) || (m === 8 && day === 30) || (m === 11 && day === 31)) {
    const q = monthToQuarter(m);
    matches.push({ type: 'PROVISIONAL', period: `${y}-Q${q}`, label: `Provisional Q${q} ${y}` });
    matches.push({ type: 'CITY_LEVY',   period: `${y}-Q${q}`, label: `City Levy Q${q} ${y}` });
  }

  return matches;
}

// ─── Calendar Helpers ─────────────────────────────────────────────────────────

export function getCalendarDays(year, month) {
  const first = startOfMonth(new Date(year, month, 1));
  const last  = endOfMonth(new Date(year, month, 1));
  const days  = eachDayOfInterval({ start: first, end: last });
  const startPad = getDay(first); // 0=Sun
  return { days, startPad };
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'accountant-os-v1';
const SYNC_TS_KEY = 'accountant-os-sync-ts'; // separate key — only written after confirmed push/pull

export function saveState(state) {
  try {
    // Strip any legacy _syncedAt that leaked into state — sync tracking is now in SYNC_TS_KEY
    const { _syncedAt, ...clean } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('Failed to save state', e);
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { _syncedAt, ...clean } = JSON.parse(raw); // strip legacy field if present
    return clean;
  } catch (e) {
    return null;
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SYNC_TS_KEY);
  } catch (e) {
    console.warn('Failed to clear state', e);
  }
}

/** Returns the timestamp (ms) of the last confirmed sync with Supabase. 0 = never. */
export function getLastSyncTs() {
  try { return parseInt(localStorage.getItem(SYNC_TS_KEY) || '0', 10); } catch { return 0; }
}

/** Call after a successful push or pull to record the server timestamp. */
export function setLastSyncTs(tsMs) {
  try { localStorage.setItem(SYNC_TS_KEY, String(tsMs)); } catch { /* ignore */ }
}

export function exportData(state) {
  const blob = new Blob([JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accountant-os-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ─── Notification Helpers ─────────────────────────────────────────────────────

export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

export function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.svg' });
  }
}

// ─── Deadline Completion Helpers ──────────────────────────────────────────────

/** Non-hook: returns { total, completed } client counts for a deadline (safe inside useMemo). */
export function getClientCountForDeadline(state, type, period) {
  const total = state.clients.filter(c => c.taxTypes.includes(type)).length;
  const completed = state.taxReturns.filter(
    tr => tr.taxType === type && tr.period === period && tr.status === 'completed'
  ).length;
  return { total, completed };
}

// Track which deadlines have already fired a notification this browser session
const _notifiedThisSession = new Set();

/**
 * Send browser notifications for overdue/critical deadlines.
 * Only fires once per deadline per page session to avoid spamming.
 */
export function checkAndNotify(state, deadlines) {
  if (!state.notifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  deadlines.forEach(d => {
    if (d.daysRemaining > 2) return;
    if (_notifiedThisSession.has(d.id)) return;
    const { total, completed } = getClientCountForDeadline(state, d.type, d.period);
    if (total === 0 || completed >= total) return;
    _notifiedThisSession.add(d.id);
    const pending = total - completed;
    const urgency = d.daysRemaining < 0
      ? `Overdue by ${Math.abs(d.daysRemaining)}d`
      : d.daysRemaining === 0 ? 'Due today'
      : `Due in ${d.daysRemaining}d`;
    sendNotification(
      `${d.type} ${d.periodLabel} — ${urgency}`,
      `${pending} of ${total} client${pending !== 1 ? 's' : ''} still pending`
    );
  });
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function getPriorityColor(priority) {
  if (priority === 'high')   return 'text-red-400';
  if (priority === 'medium') return 'text-amber-400';
  return 'text-gray-400';
}

export function getStatusColor(status) {
  if (status === 'completed')  return 'text-green-400';
  if (status === 'in_progress') return 'text-blue-400';
  return 'text-gray-400';
}
