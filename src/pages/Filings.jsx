import React, { useState, useMemo } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import { TAX_TYPES, TAX_TYPE_KEYS, TAX_COLORS, format, cn } from '../utils/index.js';
import { TaxTypeBadge } from '../components/UI.jsx';

// ─── Checklist definitions per tax type ──────────────────────────────────────

function getChecklistForType(type, quarter) {
  switch (type) {
    case 'VAT':
      return [
        { key: 'excelDone',        label: 'Excel Done'                          },
        { key: 'returnSubmitted',  label: 'Submitted'                           },
        { key: 'payslipStatus',    label: 'Payslip Status', doneVal: 'sent'     },
        { key: 'returnDownloaded', label: 'R, A & A'                            },
        { key: 'screenshotTaken',  label: 'Screenshot'                          },
      ];
    case 'PAYE':
    case 'SDL':
      return [
        { key: 'returnSubmitted',  label: 'Submitted'                           },
        { key: 'payslipStatus',    label: 'Payslip Status', doneVal: 'sent'     },
        { key: 'returnDownloaded', label: 'R, A & A'                            },
        { key: 'screenshotTaken',  label: 'Screenshot'                          },
      ];
    case 'CITY_LEVY':
      return [
        { key: 'payslipMade',      label: 'Payslip Made'                        },
        { key: 'payslipStatus',    label: 'Sent to Client', doneVal: 'sent'     },
        { key: 'savedToServer',    label: 'Saved in Server'                     },
        { key: 'paymentConfirmed', label: 'Payment Status'                      },
      ];
    case 'PROVISIONAL':
      return [
        ...(quarter === 1 ? [{ key: 'returnSubmitted', label: 'Return Filled' }] : []),
        { key: 'payslipMade',      label: 'Payslip Made'                        },
        { key: 'payslipStatus',    label: 'Sent to Client', doneVal: 'sent'     },
        { key: 'paymentConfirmed', label: 'Payment Status'                      },
        { key: 'revised',          label: 'Revised'                             },
      ];
    case 'NSSF':
    case 'WCF':
      return [
        { key: 'payslipStatus',    label: 'Sent to Client', doneVal: 'sent'     },
        { key: 'savedToServer',    label: 'Saved to Server'                     },
      ];
    case 'WHT':
      return [
        { key: 'returnSubmitted',  label: 'Return Filled'                       },
      ];
    case 'ROI':
      return [
        { key: 'returnSubmitted',  label: 'Return Submitted'                    },
        { key: 'screenshotTaken',  label: 'Screenshot'                          },
        { key: 'paymentConfirmed', label: 'Payment Confirmed'                   },
        { key: 'returnDownloaded', label: 'Return Downloaded'                   },
        { key: 'payslipStatus',    label: 'Sent to Client', doneVal: 'sent'     },
      ];
    default:
      return [
        { key: 'returnSubmitted',  label: 'Return Submitted'                    },
        { key: 'screenshotTaken',  label: 'Screenshot'                          },
        { key: 'paymentConfirmed', label: 'Payment Confirmed'                   },
        { key: 'returnDownloaded', label: 'Return Downloaded'                   },
        { key: 'payslipStatus',    label: 'Sent to Client', doneVal: 'sent'     },
      ];
  }
}

function isItemAddressed(item, val) {
  const doneVal = item.doneVal ?? true;
  return val === doneVal || val === 'nil';
}

// ─── Filing Cell: Done | NIL ──────────────────────────────────────────────────

function FilingCell({ value, doneVal = true, onChange }) {
  const isDone = value === doneVal;
  const isNil  = value === 'nil';

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => onChange(isDone ? null : doneVal)}
        title={isDone ? 'Done — click to unset' : 'Mark as done'}
        className={cn(
          'w-8 h-7 rounded flex items-center justify-center text-xs font-bold transition-all border',
          isDone
            ? 'bg-green-500 border-green-500 text-white shadow-sm'
            : 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 hover:border-green-400 hover:text-green-500 dark:hover:border-green-500 dark:hover:text-green-500'
        )}
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => onChange(isNil ? null : 'nil')}
        title={isNil ? 'NIL — click to unset' : 'Mark as N/A'}
        className={cn(
          'w-[34px] h-7 rounded flex items-center justify-center text-[10px] font-bold transition-all border',
          isNil
            ? 'bg-gray-500 border-gray-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-600 hover:border-gray-500 hover:text-gray-500 dark:hover:border-gray-400 dark:hover:text-gray-400'
        )}
      >
        NIL
      </button>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const QUARTER_MONTHS = new Set([2, 5, 8, 11]); // March, June, Sep, Dec (0-indexed)

// ─── Filings Page ─────────────────────────────────────────────────────────────

export default function Filings() {
  const { state, dispatch } = useApp();
  const clients = useClients();

  const now = new Date();
  const initMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const initYear  = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [selMonth,   setSelMonth]   = useState(initMonth);
  const [selYear,    setSelYear]    = useState(initYear);
  const [activeTab,  setActiveTab]  = useState('PAYE');

  const isQuarterEnd   = QUARTER_MONTHS.has(selMonth);
  const quarter        = Math.floor(selMonth / 3) + 1;
  const monthPeriod    = `${selYear}-${String(selMonth).padStart(2, '0')}`;
  const quarterPeriod  = `${selYear}-Q${quarter}`;
  const annualPeriod   = `${selYear - 1}-annual`;

  const isQuarterOnly = activeTab === 'PROVISIONAL' || activeTab === 'CITY_LEVY';
  const isAnnual      = activeTab === 'ROI';

  function getPeriodForTab(tab) {
    if (tab === 'PROVISIONAL' || tab === 'CITY_LEVY') return quarterPeriod;
    if (tab === 'ROI') return annualPeriod;
    return monthPeriod;
  }

  const period    = getPeriodForTab(activeTab);
  const checklist = useMemo(
    () => getChecklistForType(activeTab, quarter),
    [activeTab, quarter]
  );

  const tabClients = useMemo(
    () => clients.filter(c => !c.hidden && c.taxTypes.includes(activeTab)),
    [clients, activeTab]
  );

  // Per-tab client counts for tab bar badges
  const tabCounts = useMemo(() => {
    const counts = {};
    TAX_TYPE_KEYS.forEach(t => {
      counts[t] = clients.filter(c => !c.hidden && c.taxTypes.includes(t)).length;
    });
    return counts;
  }, [clients]);

  function getRecord(clientId, taxType, p) {
    return state.taxReturns.find(
      tr => tr.clientId === clientId && tr.taxType === taxType && tr.period === p
    ) || {};
  }

  function upsert(clientId, taxType, p, changes) {
    const current = state.taxReturns.find(
      tr => tr.clientId === clientId && tr.taxType === taxType && tr.period === p
    ) || { clientId, taxType, period: p };

    const merged   = { ...current, clientId, taxType, period: p, ...changes };
    const cl       = getChecklistForType(taxType, quarter);
    const allDone  = cl.every(item => isItemAddressed(item, merged[item.key]));

    if (allDone && merged.status !== 'completed') {
      merged.status      = 'completed';
      merged.completedAt = new Date().toISOString();
    } else if (!allDone && merged.status === 'completed') {
      merged.status = 'in_progress';
      delete merged.completedAt;
    }
    if (!merged.status) merged.status = 'pending';

    dispatch({ type: 'UPSERT_TAX_RETURN', payload: merged });
  }

  function handleCellChange(clientId, key, val) {
    upsert(clientId, activeTab, period, { [key]: val });
  }

  function handleAllNil(clientId) {
    const nilPayload = {};
    checklist.forEach(item => { nilPayload[item.key] = 'nil'; });
    upsert(clientId, activeTab, period, nilPayload);
  }

  function handleAddWHT(clientId) {
    upsert(clientId, 'WHT', monthPeriod, { status: 'pending' });
  }

  const colors = TAX_COLORS[activeTab] || TAX_COLORS.VAT;

  // ── Completion summary ──────────────────────────────────────────────────────
  const completedCount = useMemo(() => {
    if (!tabClients.length || checklist.length === 0) return 0;
    return tabClients.filter(c => {
      const rec = getRecord(c.id, activeTab, period);
      return checklist.every(item => isItemAddressed(item, rec[item.key]));
    }).length;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.taxReturns, tabClients, checklist, activeTab, period]);

  return (
    <div className="space-y-5 animate-fade-in min-w-0">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Filings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track tax submissions across all clients
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isAnnual && (
            <select
              className="input w-36 text-sm"
              value={selMonth}
              onChange={e => setSelMonth(Number(e.target.value))}
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>
          )}
          <select
            className="input w-24 text-sm"
            value={selYear}
            onChange={e => setSelYear(Number(e.target.value))}
          >
            {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Tax type tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TAX_TYPE_KEYS.map(tab => {
          const tc = TAX_COLORS[tab];
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                isActive
                  ? `${tc.bg} ${tc.text} ${tc.border} shadow-sm`
                  : 'bg-gray-100 dark:bg-gray-800 border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', tc.dot)} />
              {TAX_TYPES[tab]}
              <span className={cn(
                'text-[10px] font-bold px-1 py-0.5 rounded-full min-w-[16px] text-center',
                isActive ? 'bg-white/30' : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
              )}>
                {tabCounts[tab]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Quarter-only warning ─────────────────────────────────────────────── */}
      {isQuarterOnly && !isQuarterEnd && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/40">
          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
              {TAX_TYPES[activeTab]} is filed quarterly
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
              This filing is only due in quarter-end months: <strong>March, June, September, December</strong>.
              Switch to one of those months to view the table.
            </p>
          </div>
        </div>
      )}

      {/* ── ROI annual notice ────────────────────────────────────────────────── */}
      {isAnnual && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40 text-xs text-indigo-700 dark:text-indigo-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Showing ROI / Accounts filings for financial year{' '}
          <strong className="mx-1">{selYear - 1}</strong>
          (due 30 June {selYear})
        </div>
      )}

      {/* ── No clients assigned ─────────────────────────────────────────────── */}
      {tabClients.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-600">
          <svg className="w-14 h-14 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" />
          </svg>
          <p className="text-sm font-semibold">No clients assigned to {TAX_TYPES[activeTab]}</p>
          <p className="text-xs mt-1 text-center max-w-xs">
            Go to Clients, edit a client, and add <strong>{TAX_TYPES[activeTab]}</strong> as one of their tax types.
          </p>
        </div>
      )}

      {/* ── Filings table ────────────────────────────────────────────────────── */}
      {tabClients.length > 0 && (!isQuarterOnly || isQuarterEnd) && (
        <>
          {/* Summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TaxTypeBadge type={activeTab} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-bold text-green-600 dark:text-green-400">{completedCount}</span>
                <span className="text-gray-400 dark:text-gray-600"> / {tabClients.length}</span>
                <span className="ml-1">clients fully addressed</span>
              </span>
              {isQuarterOnly && (
                <span className="text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-2 py-0.5 rounded font-medium">
                  Q{quarter} {selYear}
                </span>
              )}
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-600 font-mono">{period}</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <table className="w-full min-w-max border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
                  {/* Client column (sticky) */}
                  <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800 text-left px-4 py-3 font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap min-w-[180px] border-r border-gray-200 dark:border-gray-700">
                    Client
                  </th>
                  {/* Task columns */}
                  {checklist.map(item => (
                    <th
                      key={item.key}
                      className="px-4 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap"
                    >
                      {item.label}
                    </th>
                  ))}
                  {/* Progress */}
                  <th className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap">
                    Done
                  </th>
                  {/* All NIL */}
                  <th className="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide whitespace-nowrap">
                    All NIL
                  </th>
                </tr>
              </thead>
              <tbody>
                {tabClients.map((client, rowIdx) => {
                  const isWHTNoRecord =
                    activeTab === 'WHT' &&
                    !state.taxReturns.some(
                      tr => tr.clientId === client.id && tr.taxType === 'WHT' && tr.period === monthPeriod
                    );

                  const rec            = getRecord(client.id, activeTab, period);
                  const addressedCount = checklist.filter(item => isItemAddressed(item, rec[item.key])).length;
                  const allAddressed   = addressedCount === checklist.length && checklist.length > 0;

                  const rowBase = rowIdx % 2 === 0
                    ? 'bg-white dark:bg-gray-900'
                    : 'bg-gray-50 dark:bg-gray-800/40';

                  const rowCls = cn(
                    'border-b border-gray-100 dark:border-gray-800 transition-colors',
                    allAddressed ? 'bg-green-50/70 dark:bg-green-900/10' : rowBase
                  );

                  const stickyBg = allAddressed
                    ? 'bg-green-50/70 dark:bg-green-900/10'
                    : rowIdx % 2 === 0
                      ? 'bg-white dark:bg-gray-900'
                      : 'bg-gray-50 dark:bg-gray-800/40';

                  return (
                    <tr key={client.id} className={rowCls}>
                      {/* Client name (sticky) */}
                      <td className={cn(
                        'sticky left-0 z-10 px-4 py-2.5 border-r border-gray-200 dark:border-gray-700 whitespace-nowrap',
                        stickyBg
                      )}>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-semibold text-sm',
                            allAddressed
                              ? 'text-green-700 dark:text-green-400'
                              : 'text-gray-800 dark:text-gray-100'
                          )}>
                            {client.name}
                          </span>
                          {allAddressed && (
                            <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                              ✓
                            </span>
                          )}
                        </div>
                      </td>

                      {/* WHT with no record: show "Add WHT" spanning all task + progress + allNil columns */}
                      {isWHTNoRecord ? (
                        <td colSpan={checklist.length + 2} className="px-4 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleAddWHT(client.id)}
                            className="text-xs px-3 py-1.5 rounded-lg border-2 border-dashed border-rose-300 dark:border-rose-700/50 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/10 font-semibold transition-all"
                          >
                            + Add WHT filing for {MONTH_NAMES[selMonth]} {selYear}
                          </button>
                        </td>
                      ) : (
                        <>
                          {/* Task cells */}
                          {checklist.map(item => {
                            const dv = item.doneVal ?? true;
                            return (
                              <td key={item.key} className="px-2 py-2.5 text-center">
                                <FilingCell
                                  value={rec[item.key] ?? null}
                                  doneVal={dv}
                                  onChange={val => handleCellChange(client.id, item.key, val)}
                                />
                              </td>
                            );
                          })}

                          {/* Progress badge */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className={cn(
                              'text-xs font-bold px-2 py-1 rounded-full tabular-nums',
                              allAddressed
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : addressedCount > 0
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                            )}>
                              {addressedCount}/{checklist.length}
                            </span>
                          </td>

                          {/* All NIL button */}
                          <td className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleAllNil(client.id)}
                              className="text-[11px] px-2 py-1 rounded border font-semibold transition-all whitespace-nowrap text-gray-400 dark:text-gray-500 border-gray-300 dark:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-500 dark:hover:border-gray-400"
                            >
                              All NIL
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
