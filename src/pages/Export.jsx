import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { TAX_TYPES, TAX_TYPE_KEYS, TAX_COLORS, monthToQuarter, cn } from '../utils/index.js';
import { TaxTypeBadge, StatusBadge } from '../components/UI.jsx';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ─── Cell renderers ───────────────────────────────────────────────────────────

function CellVal({ value }) {
  if (value === true)   return <span className="text-green-600 dark:text-green-400 font-bold text-base leading-none">✓</span>;
  if (value === 'nil')  return <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold tracking-widest">NIL</span>;
  return <span className="text-gray-300 dark:text-gray-700 select-none">–</span>;
}

function ClientCopyCell({ value }) {
  if (value === 'sent') return <span className="text-green-600 dark:text-green-400 font-bold text-base leading-none">✓</span>;
  if (value === 'nil')  return <span className="text-gray-400 dark:text-gray-500 text-[10px] font-bold tracking-widest">NIL</span>;
  return <span className="text-gray-300 dark:text-gray-700 select-none">–</span>;
}

// ─── Main Export Page ─────────────────────────────────────────────────────────

export default function ExportPage() {
  const { state } = useApp();
  const clients = state.clients;

  const now = new Date();
  const [year,  setYear]       = useState(now.getFullYear());
  const [month, setMonth]      = useState(now.getMonth()); // 0-indexed
  const [filterType, setFilterType] = useState('ALL');
  const [showHidden, setShowHidden] = useState(false);

  const hiddenCount = useMemo(() => clients.filter(c => c.hidden).length, [clients]);

  // Derived period strings
  const monthPeriod   = `${year}-${String(month).padStart(2, '0')}`;
  const quarter       = monthToQuarter(month); // 1–4
  const quarterPeriod = `${year}-Q${quarter}`;
  const quarterLabel  = `Q${quarter} ${year}`;

  // ── Build flat rows (one per client × taxType) ────────────────────────────
  const rows = useMemo(() => {
    const result = [];
    for (const client of clients) {
      if (!showHidden && client.hidden) continue;
      for (const taxType of TAX_TYPE_KEYS) {
        if (!client.taxTypes.includes(taxType)) continue;
        if (filterType !== 'ALL' && taxType !== filterType) continue;

        const isQuarterly   = taxType === 'PROVISIONAL' || taxType === 'CITY_LEVY';
        const period        = isQuarterly ? quarterPeriod : monthPeriod;
        const periodLabel   = isQuarterly ? quarterLabel  : `${MONTH_NAMES[month]} ${year}`;

        const rec = state.taxReturns.find(
          tr => tr.clientId === client.id && tr.taxType === taxType && tr.period === period
        );

        result.push({
          clientId:         client.id,
          clientName:       client.name,
          taxType,
          period,
          periodLabel,
          isQuarterly,
          status:           rec?.status           ?? 'pending',
          returnSubmitted:  rec?.returnSubmitted   ?? null,
          screenshotTaken:  rec?.screenshotTaken   ?? null,
          paymentConfirmed: rec?.paymentConfirmed  ?? null,
          returnDownloaded: rec?.returnDownloaded  ?? null,
          payslipStatus:    rec?.payslipStatus     ?? null,
          notes:            rec?.notes             || '',
        });
      }
    }
    return result;
  }, [clients, state.taxReturns, monthPeriod, quarterPeriod, filterType, month, quarter, year]);

  // ── Sort + add grouping metadata ──────────────────────────────────────────
  const displayRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const n = a.clientName.localeCompare(b.clientName);
      if (n !== 0) return n;
      return TAX_TYPE_KEYS.indexOf(a.taxType) - TAX_TYPE_KEYS.indexOf(b.taxType);
    });
    let groupIdx = -1;
    let prevId   = null;
    return sorted.map(r => {
      const isFirst = r.clientId !== prevId;
      if (isFirst) { groupIdx++; prevId = r.clientId; }
      return { ...r, groupIdx, isFirst };
    });
  }, [rows]);

  // ── Summary counts ────────────────────────────────────────────────────────
  const total      = rows.length;
  const completed  = rows.filter(r => r.status === 'completed').length;
  const inProgress = rows.filter(r => r.status === 'in_progress').length;
  const pending    = rows.filter(r => r.status === 'pending').length;
  const hasQuarterly = rows.some(r => r.isQuarterly);

  // ── Month navigation ──────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function exportCSV() {
    const fmt = v => v === true ? 'Done' : v === 'nil' ? 'NIL' : '';
    const headers = [
      'Client', 'Tax Type', 'Period', 'Status',
      'Return Filed', 'Screenshot', 'Payment', 'Downloaded', 'Client Copy', 'Notes',
    ];
    const csvContent = [
      headers.join(','),
      ...rows.map(r => [
        `"${r.clientName}"`,
        `"${TAX_TYPES[r.taxType] || r.taxType}"`,
        `"${r.periodLabel}"`,
        r.status,
        fmt(r.returnSubmitted),
        fmt(r.screenshotTaken),
        fmt(r.paymentConfirmed),
        fmt(r.returnDownloaded),
        r.payslipStatus === 'sent' ? 'Sent' : r.payslipStatus === 'nil' ? 'NIL' : '',
        `"${(r.notes || '').replace(/"/g, '""')}"`,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `submissions-${MONTH_NAMES[month].toLowerCase()}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Print (plain table PDF) ───────────────────────────────────────────────
  function exportPDF() {
    const colDefs = [
      { label: 'Client',       width: '18%' },
      { label: 'Tax Type',     width: '10%' },
      { label: 'Period',       width: '10%' },
      { label: 'Status',       width: '9%'  },
      { label: 'Return Filed', width: '8%'  },
      { label: 'Screenshot',   width: '8%'  },
      { label: 'Payment',      width: '8%'  },
      { label: 'Downloaded',   width: '8%'  },
      { label: 'Client Copy',  width: '8%'  },
      { label: 'Notes',        width: '13%' },
    ];
    const boolVal  = v => v === true ? '✓' : v === 'nil' ? 'NIL' : '–';
    const clientCopyVal = v => v === 'sent' ? '✓' : v === 'nil' ? 'NIL' : '–';

    const headerRow = colDefs.map(c =>
      `<th style="width:${c.width};padding:7px 8px;background:#f3f4f6;border:1px solid #d1d5db;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">${c.label}</th>`
    ).join('');

    const statusColors = { completed: '#059669', in_progress: '#2563eb', pending: '#9ca3af' };
    const statusLabels = { completed: 'Completed', in_progress: 'In Progress', pending: 'Pending' };

    const bodyRows = displayRows.map((r, ri) => {
      const bg = ri % 2 === 0 ? '#ffffff' : '#f9fafb';
      const statusColor = statusColors[r.status] || '#9ca3af';
      const cells = [
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};font-weight:${r.isFirst ? '600' : '400'};color:#111827;">${r.clientName}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};color:#374151;">${TAX_TYPES[r.taxType] || r.taxType}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};color:#374151;">${r.periodLabel}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};color:${statusColor};font-weight:600;">${statusLabels[r.status] || r.status}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};text-align:center;color:${r.returnSubmitted === true ? '#059669' : '#9ca3af'};">${boolVal(r.returnSubmitted)}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};text-align:center;color:${r.screenshotTaken === true ? '#059669' : '#9ca3af'};">${boolVal(r.screenshotTaken)}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};text-align:center;color:${r.paymentConfirmed === true ? '#059669' : '#9ca3af'};">${boolVal(r.paymentConfirmed)}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};text-align:center;color:${r.returnDownloaded === true ? '#059669' : '#9ca3af'};">${boolVal(r.returnDownloaded)}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};text-align:center;color:${r.payslipStatus === 'sent' ? '#059669' : '#9ca3af'};">${clientCopyVal(r.payslipStatus)}</td>`,
        `<td style="padding:6px 8px;border:1px solid #e5e7eb;font-size:11px;background:${bg};color:#6b7280;">${r.notes || ''}</td>`,
      ];
      return `<tr>${cells.join('')}</tr>`;
    }).join('') || `<tr><td colspan="10" style="padding:16px;text-align:center;color:#9ca3af;font-size:11px;border:1px solid #e5e7eb;">No data</td></tr>`;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Submission Report – ${MONTH_NAMES[month]} ${year}</title>
<style>body{font-family:Arial,sans-serif;margin:20px;color:#111827;}h2{margin:0 0 4px;font-size:15px;}p{margin:0 0 12px;font-size:11px;color:#6b7280;}table{border-collapse:collapse;width:100%;}@media print{body{margin:10px;}}</style>
</head><body>
<h2>Submission Report &mdash; ${MONTH_NAMES[month]} ${year}${hasQuarterly ? ` &middot; ${quarterLabel}` : ''}</h2>
<p>${total} filing${total !== 1 ? 's' : ''} &middot; ${completed} completed &middot; ${inProgress} in progress &middot; ${pending} pending</p>
<table><thead><tr>${headerRow}</tr></thead><tbody>${bodyRows}</tbody></table>
</body></html>`;

    const w = window.open('', '_blank', 'width=1100,height=700');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Submission Report</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Monthly filing status across all clients
            {hasQuarterly && <span className="ml-1 text-gray-400 dark:text-gray-500">· Quarterly: {quarterLabel}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={exportCSV}
            className="btn btn-primary flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button
            onClick={exportPDF}
            className="btn btn-secondary flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* Controls card: month picker + tax type filter */}
      <div className="card p-4 space-y-3" data-no-print>
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost p-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-bold text-gray-900 dark:text-white min-w-[160px] text-center select-none">
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} className="btn-ghost p-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Tax type filter chips */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setFilterType('ALL')}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-semibold border transition-all',
              filterType === 'ALL'
                ? 'bg-gray-800 dark:bg-gray-100 text-white dark:text-gray-900 border-transparent'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
            )}
          >
            All Types
          </button>
          {TAX_TYPE_KEYS.map(t => (
            <button
              key={t}
              onClick={() => setFilterType(filterType === t ? 'ALL' : t)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-semibold border transition-all',
                filterType === t
                  ? `${TAX_COLORS[t].bg} ${TAX_COLORS[t].text} ${TAX_COLORS[t].border}`
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500'
              )}
            >
              {TAX_TYPES[t]}
            </button>
          ))}
          {hiddenCount > 0 && (
            <button
              onClick={() => setShowHidden(v => !v)}
              className={cn(
                'text-xs px-3 py-1 rounded-full font-semibold border transition-all ml-auto flex items-center gap-1.5',
                showHidden
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-indigo-400 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400'
              )}
              title={showHidden ? 'Click to exclude hidden clients from report' : `Click to include ${hiddenCount} hidden client${hiddenCount !== 1 ? 's' : ''} in report`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showHidden
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                }
              </svg>
              {showHidden ? `Hide hidden (${hiddenCount})` : `Show hidden (${hiddenCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Filings', value: total,      cls: 'text-gray-900 dark:text-white' },
          { label: 'Completed',     value: completed,  cls: 'text-green-600 dark:text-green-400' },
          { label: 'In Progress',   value: inProgress, cls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Pending',       value: pending,    cls: 'text-gray-400 dark:text-gray-500' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={cn('text-2xl font-bold tabular-nums', s.cls)}>{s.value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-800">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Tax Type</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Filed</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Screenshot</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Paid</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Downloaded</th>
                <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Client Copy</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16">
                    <p className="text-gray-400 dark:text-gray-600 text-sm">No filings to display for this period.</p>
                    <p className="text-gray-400 dark:text-gray-600 text-xs mt-1">Try selecting a different month or tax type filter.</p>
                  </td>
                </tr>
              ) : (
                displayRows.map(r => (
                  <tr
                    key={`${r.clientId}-${r.taxType}`}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-800/60 transition-colors hover:bg-blue-50/40 dark:hover:bg-blue-900/10',
                      r.groupIdx % 2 === 0
                        ? 'bg-white dark:bg-transparent'
                        : 'bg-gray-50/60 dark:bg-gray-900/20',
                      r.isFirst && r.groupIdx > 0
                        ? 'border-t border-t-gray-200 dark:border-t-gray-700'
                        : ''
                    )}
                  >
                    <td className="px-4 py-2.5 font-semibold text-gray-900 dark:text-white whitespace-nowrap text-xs">
                      {r.clientName}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <TaxTypeBadge type={r.taxType} />
                    </td>
                    <td className="px-3 py-2.5 text-center"><CellVal value={r.returnSubmitted} /></td>
                    <td className="px-3 py-2.5 text-center"><CellVal value={r.screenshotTaken} /></td>
                    <td className="px-3 py-2.5 text-center"><CellVal value={r.paymentConfirmed} /></td>
                    <td className="px-3 py-2.5 text-center"><CellVal value={r.returnDownloaded} /></td>
                    <td className="px-3 py-2.5 text-center"><ClientCopyCell value={r.payslipStatus} /></td>
                    <td className="px-4 py-2.5"><StatusBadge status={r.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {displayRows.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20 flex items-center justify-between">
            <p className="text-xs text-gray-400 dark:text-gray-600">
              {displayRows.length} filing{displayRows.length !== 1 ? 's' : ''}
              {' · '}
              {MONTH_NAMES[month]} {year}
              {hasQuarterly && ` · Quarterly: ${quarterLabel}`}
            </p>
            <button
              onClick={exportCSV}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Download CSV
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
