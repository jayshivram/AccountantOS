import React, { useState, useMemo } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import { TAX_TYPES, TAX_TYPE_KEYS, formatDate, uuid, cn } from '../utils/index.js';
import { TaxTypeBadge, StatusBadge, EmptyState, Modal, ConfirmDialog } from '../components/UI.jsx';

// ── Checklist helpers (mirrored from Clients.jsx) ─────────────────────────────

function getChecklistForType(type, quarter) {
  switch (type) {
    case 'VAT':
      return [
        { key: 'excelDone',        label: 'Excel Done',       doneVal: true   },
        { key: 'returnSubmitted',  label: 'Submitted',         doneVal: true   },
        { key: 'payslipStatus',    label: 'Payslip Status',    doneVal: 'sent' },
        { key: 'returnDownloaded', label: 'R, A & A',          doneVal: true   },
        { key: 'screenshotTaken',  label: 'Screenshot',        doneVal: true   },
      ];
    case 'PAYE':
    case 'SDL':
      return [
        { key: 'returnSubmitted',  label: 'Submitted',         doneVal: true   },
        { key: 'payslipStatus',    label: 'Payslip Status',    doneVal: 'sent' },
        { key: 'returnDownloaded', label: 'R, A & A',          doneVal: true   },
        { key: 'screenshotTaken',  label: 'Screenshot',        doneVal: true   },
      ];
    case 'CITY_LEVY':
      return [
        { key: 'payslipMade',      label: 'Payslip Made',      doneVal: true   },
        { key: 'payslipStatus',    label: 'Sent to Client',    doneVal: 'sent' },
        { key: 'savedToServer',    label: 'Saved in Server',   doneVal: true   },
        { key: 'paymentConfirmed', label: 'Payment Status',    doneVal: true   },
      ];
    case 'PROVISIONAL':
      return [
        ...(quarter === 1 ? [{ key: 'returnSubmitted', label: 'Return Filled', doneVal: true }] : []),
        { key: 'payslipMade',      label: 'Payslip Made',      doneVal: true   },
        { key: 'payslipStatus',    label: 'Sent to Client',    doneVal: 'sent' },
        { key: 'paymentConfirmed', label: 'Payment Status',    doneVal: true   },
        { key: 'revised',          label: 'Revised',           doneVal: true   },
      ];
    case 'NSSF':
    case 'WCF':
      return [
        { key: 'payslipStatus',    label: 'Sent to Client',    doneVal: 'sent' },
        { key: 'savedToServer',    label: 'Saved to Server',   doneVal: true   },
      ];
    case 'WHT':
      return [
        { key: 'returnSubmitted',  label: 'Return Filled',     doneVal: true   },
      ];
    case 'ROI':
    default:
      return [
        { key: 'returnSubmitted',  label: 'Return Submitted',  doneVal: true   },
        { key: 'screenshotTaken',  label: 'Screenshot',        doneVal: true   },
        { key: 'paymentConfirmed', label: 'Payment Confirmed', doneVal: true   },
        { key: 'returnDownloaded', label: 'Return Downloaded', doneVal: true   },
        { key: 'payslipStatus',    label: 'Sent to Client',    doneVal: 'sent' },
      ];
  }
}

function isItemAddressed(item, val) {
  return val === item.doneVal || val === 'nil';
}

// ── Period helpers ─────────────────────────────────────────────────────────────

const MONTHLY_TYPES     = new Set(['VAT','PAYE','SDL','WHT','NSSF','WCF']);
const QUARTERLY_TYPES   = new Set(['PROVISIONAL','CITY_LEVY']);
const MONTH_ABBR        = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_FULL        = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function getPeriodsForType(type, year) {
  if (MONTHLY_TYPES.has(type)) {
    // periods are 0-indexed to match Clients.jsx (getMonth() is 0-indexed)
    return MONTH_ABBR.map((m, i) => ({
      label:  m,
      period: `${year}-${String(i).padStart(2, '0')}`,
    }));
  }
  if (QUARTERLY_TYPES.has(type)) {
    return [1,2,3,4].map(q => ({ label: `Q${q}`, period: `${year}-Q${q}` }));
  }
  return [{ label: 'Annual', period: `${year}-annual` }];
}

function getPeriodLabel(period) {
  if (!period) return '';
  if (period.endsWith('-annual')) return `${period.slice(0,4)} Annual`;
  const qm = period.match(/(\d{4})-Q(\d)/);
  if (qm) return `Q${qm[2]} ${qm[1]}`;
  const mm = period.match(/(\d{4})-(\d{2})/);
  // month part is 0-indexed (Jan=00...Dec=11) to match Clients.jsx storage
  if (mm) return `${MONTH_FULL[parseInt(mm[2])]} ${mm[1]}`;
  return period;
}

function getPeriodQuarter(period) {
  const m = period?.match(/Q(\d)/);
  return m ? parseInt(m[1]) : null;
}

// ── ChecklistMini ──────────────────────────────────────────────────────────────

function ChecklistMini({ record, type }) {
  const quarter   = getPeriodQuarter(record?.period);
  const checklist = getChecklistForType(type, quarter ?? 1);
  const addressed = checklist.filter(item => isItemAddressed(item, record?.[item.key])).length;
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {checklist.map(item => {
          const v  = record?.[item.key];
          const ok = v === item.doneVal;
          const nil = v === 'nil';
          return (
            <span
              key={item.key}
              title={item.label}
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                ok  ? 'bg-green-500' :
                nil ? 'bg-gray-300 dark:bg-gray-600' :
                      'bg-gray-200 dark:bg-gray-700'
              )}
            />
          );
        })}
      </div>
      <span className="text-[10px] text-gray-400 tabular-nums font-medium">
        {addressed}/{checklist.length}
      </span>
    </div>
  );
}

// ── PeriodCell ─────────────────────────────────────────────────────────────────

function PeriodCell({ record, period, onClick }) {
  const status = record?.status;
  const cellCls = {
    completed:   'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700/40 hover:bg-green-200 dark:hover:bg-green-900/50',
    in_progress: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700/40 hover:bg-blue-200 dark:hover:bg-blue-900/50',
    pending:     'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-700/30 hover:bg-amber-100 dark:hover:bg-amber-900/40',
  };

  if (!record) {
    return (
      <button
        onClick={onClick}
        title={`Add — ${period}`}
        className="w-10 h-8 rounded-lg border border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-blue-400"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    );
  }

  const icon = status === 'completed'
    ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
    : status === 'in_progress'
    ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
    : <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /></svg>;

  return (
    <button
      onClick={onClick}
      title={`${period} — ${status}`}
      className={cn('w-10 h-8 rounded-lg border flex items-center justify-center transition-all', cellCls[status] || cellCls.pending)}
    >
      {icon}
    </button>
  );
}

// ── PeriodGrid ─────────────────────────────────────────────────────────────────

function PeriodGrid({ client, records, year, onEditRecord, onDeleteRecord }) {
  const registeredTypes = client.taxTypes || [];
  const orphaned = records.filter(r => !registeredTypes.includes(r.taxType));
  return (
    <div className="px-4 pb-4 pt-3 space-y-3">
      {registeredTypes.map(type => {
        const periods = getPeriodsForType(type, year);
        return (
          <div key={type} className="flex items-start gap-3 flex-wrap">
            <div className="w-28 flex-shrink-0 pt-1">
              <TaxTypeBadge type={type} />
            </div>
            <div className="flex items-end gap-1 flex-wrap">
              {periods.map(({ label, period }) => {
                const rec = records.find(r => r.taxType === type && r.period === period);
                return (
                  <div key={period} className="flex flex-col items-center gap-0.5">
                    <PeriodCell
                      record={rec}
                      period={period}
                      onClick={() => onEditRecord(
                        rec ?? { clientId: client.id, taxType: type, period, status: 'pending' }
                      )}
                    />
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium leading-none select-none">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {orphaned.length > 0 && (
        <div className="mt-2 pt-2 border-t border-dashed border-red-200 dark:border-red-800/40 space-y-1.5">
          <p className="text-[10px] font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">Orphaned records (tax type no longer registered)</p>
          {orphaned.map(r => (
            <div key={r.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/30">
              <TaxTypeBadge type={r.taxType} size="xs" />
              <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{getPeriodLabel(r.period)}</span>
              <StatusBadge status={r.status} />
              <button
                onClick={() => onDeleteRecord(r.id)}
                title="Delete orphaned record"
                className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
              >Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── HistoryEditModal ───────────────────────────────────────────────────────────

function HistoryEditModal({ record, clients, onClose }) {
  const { dispatch } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [form, setForm] = useState({ ...record });
  const client    = clients.find(c => c.id === form.clientId);
  const quarter   = getPeriodQuarter(form.period);
  const checklist = getChecklistForType(form.taxType, quarter ?? 1);
  const isNew     = !record.id;

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function cycleField(item) {
    const cur  = form[item.key];
    const next = cur == null ? item.doneVal : cur === item.doneVal ? 'nil' : null;
    set(item.key, next);
  }

  function save() {
    const payload = isNew ? { ...form, id: uuid() } : form;
    dispatch({ type: 'UPSERT_TAX_RETURN', payload });
    onClose();
  }

  function deleteRecord() {
    dispatch({ type: 'DELETE_TAX_RETURN', payload: record.id });
    onClose();
  }

  return (
    <>
      <Modal isOpen title={isNew ? 'Add Filing Record' : 'Edit Filing Record'} onClose={onClose}>
        <div className="space-y-4">
          {/* Info header */}
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-gray-800">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{client?.name || '—'}</p>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">{getPeriodLabel(form.period)}</p>
            </div>
            <TaxTypeBadge type={form.taxType} />
          </div>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <div className="flex gap-2">
              {[
                { v: 'pending',     label: 'Pending',     on: 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' },
                { v: 'in_progress', label: 'In Progress', on: 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' },
                { v: 'completed',   label: 'Completed',   on: 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' },
              ].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => set('status', opt.v)}
                  className={cn(
                    'flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all',
                    form.status === opt.v
                      ? opt.on
                      : 'border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >{opt.label}</button>
              ))}
            </div>
          </div>

          {/* Per-type checklist */}
          <div>
            <label className="label">Checklist</label>
            <div className="space-y-2">
              {checklist.map(item => {
                const v    = form[item.key];
                const done = v === item.doneVal;
                const nil  = v === 'nil';
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <button
                      onClick={() => cycleField(item)}
                      className={cn(
                        'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                        done
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 dark:border-gray-600 hover:border-green-400'
                      )}
                    >
                      {done && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={cn(
                      'text-sm flex-1',
                      done ? 'text-gray-800 dark:text-gray-200' :
                      nil  ? 'text-gray-400 dark:text-gray-600 line-through' :
                             'text-gray-500 dark:text-gray-400'
                    )}>
                      {item.label}
                    </span>
                    <button
                      onClick={() => set(item.key, nil ? null : 'nil')}
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded border transition-all',
                        nil
                          ? 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500 text-gray-600 dark:text-gray-300'
                          : 'border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 hover:border-gray-400 hover:text-gray-500'
                      )}
                    >NIL</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input h-16 resize-none"
              value={form.notes || ''}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {!isNew && (
              <button
                onClick={() => setConfirming(true)}
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-red-200 dark:border-red-800 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
              >
                Delete
              </button>
            )}
            <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button onClick={save}    className="btn-primary flex-1">Save</button>
          </div>
        </div>
      </Modal>
      {confirming && (
        <ConfirmDialog
          isOpen
          title="Delete Record"
          message={`Delete the ${form.taxType} record for ${getPeriodLabel(form.period)}? This cannot be undone.`}
          onClose={() => setConfirming(false)}
          onConfirm={deleteRecord}
        />
      )}
    </>
  );
}

// ── SortIcon (module-level to avoid remount on each History render) ─────────────

function SortIcon({ col, sortBy, sortDir }) {
  return (
    <svg
      className={cn('inline w-3 h-3 ml-0.5 transition-transform', sortBy === col && sortDir === 'asc' && 'rotate-180', sortBy !== col && 'opacity-30')}
      fill="none" stroke="currentColor" viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Main History page ──────────────────────────────────────────────────────────

export default function History() {
  const { state, dispatch } = useApp();
  const clients   = useClients();

  const curYear   = String(new Date().getFullYear());

  const [viewMode,        setViewMode]        = useState('client');
  const [sortBy,          setSortBy]          = useState('period');
  const [sortDir,         setSortDir]         = useState('desc');
  const [filterClient,    setFilterClient]    = useState('');
  const [filterType,      setFilterType]      = useState('');
  const [filterYear,      setFilterYear]      = useState(curYear);
  const [filterStatus,    setFilterStatus]    = useState('');
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [editingRecord,   setEditingRecord]   = useState(null);

  const years = useMemo(() => {
    const set = new Set([curYear]);
    state.taxReturns.forEach(r => {
      const y = r.period?.slice(0, 4);
      if (y) set.add(y);
    });
    return [...set].sort().reverse();
  }, [state.taxReturns, curYear]);

  const filtered = useMemo(() => {
    const base = state.taxReturns.filter(r => {
      if (filterClient && r.clientId !== filterClient) return false;
      if (filterType   && r.taxType   !== filterType)  return false;
      if (filterYear   && !r.period?.startsWith(filterYear)) return false;
      if (filterStatus && r.status    !== filterStatus) return false;
      return true;
    });
    return base.sort((a, b) => {
      let va, vb;
      if (sortBy === 'completedAt') {
        va = a.completedAt || ''; vb = b.completedAt || '';
      } else if (sortBy === 'client') {
        va = clients.find(c => c.id === a.clientId)?.name || '';
        vb = clients.find(c => c.id === b.clientId)?.name || '';
      } else {
        va = a.period || ''; vb = b.period || '';
      }
      const cmp = va.localeCompare(vb);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [state.taxReturns, filterClient, filterType, filterYear, filterStatus, sortBy, sortDir, clients]);

  const clientGroups = useMemo(() => {
    if (viewMode !== 'client') return [];
    const map = new Map();
    filtered.forEach(r => {
      if (!map.has(r.clientId)) map.set(r.clientId, []);
      map.get(r.clientId).push(r);
    });
    return [...map.entries()]
      .map(([clientId, records]) => ({ client: clients.find(c => c.id === clientId), records }))
      .filter(g => g.client)
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [filtered, clients, viewMode]);

  const stats = useMemo(() => ({
    completed:  state.taxReturns.filter(r => r.status === 'completed').length,
    inProgress: state.taxReturns.filter(r => r.status === 'in_progress').length,
    pending:    state.taxReturns.filter(r => r.status === 'pending').length,
  }), [state.taxReturns]);

  const hasActiveFilter = filterClient || filterType || filterYear !== curYear || filterStatus;

  // When no year is selected the period grid cannot determine which columns to show
  const clientViewNeedsYear = viewMode === 'client' && !filterYear;

  function toggleClient(id) {
    setExpandedClients(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  }

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Filing History & Records</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Track all submissions per client and tax type</p>
        </div>
        {/* View mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
          <button
            onClick={() => setViewMode('client')}
            title="By Client"
            className={cn('p-2 rounded-lg transition-all', viewMode === 'client' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            title="Flat List"
            className={cn('p-2 rounded-lg transition-all', viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed',   value: stats.completed,  color: 'text-green-600 dark:text-green-400' },
          { label: 'In Progress', value: stats.inProgress, color: 'text-blue-600 dark:text-blue-400'   },
          { label: 'Pending',     value: stats.pending,    color: 'text-gray-600 dark:text-gray-400'   },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={cn('text-3xl font-extrabold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select className="input w-full sm:w-44" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input w-full sm:w-40" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Tax Types</option>
          {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
        </select>
        <select className="input w-36" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
          <option value="">All Years</option>
        </select>
        <select className="input w-36" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="pending">Pending</option>
        </select>
        {hasActiveFilter && (
          <button
            onClick={() => { setFilterClient(''); setFilterType(''); setFilterYear(curYear); setFilterStatus(''); }}
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 transition"
          >
            × Clear filters
          </button>
        )}
      </div>

      {/* ── By-Client Accordion ── */}
      {viewMode === 'client' && clientViewNeedsYear && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-xl text-sm">
          <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-700 dark:text-blue-300">
            Select a specific year above to view the period grid, or switch to <button onClick={() => setViewMode('list')} className="underline font-semibold hover:text-blue-900 dark:hover:text-blue-100">Flat List</button> to browse all years.
          </span>
        </div>
      )}
      {viewMode === 'client' && !clientViewNeedsYear && (
        clientGroups.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No records found"
            message="Open the Clients page, click a client's Filings button, and mark submissions as completed."
          />
        ) : (
          <div className="space-y-2">
            {clientGroups.map(({ client, records }) => {
              const isOpen  = expandedClients.has(client.id);
              const regRecords = records.filter(r => (client.taxTypes || []).includes(r.taxType));
              const done    = regRecords.filter(r => r.status === 'completed').length;
              const pending = regRecords.filter(r => r.status === 'pending').length;
              const taxTypes = client.taxTypes || [];
              return (
                <div key={client.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleClient(client.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors text-left"
                  >
                    <svg
                      className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200', isOpen && 'rotate-90')}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="font-semibold text-sm text-gray-900 dark:text-white flex-1 min-w-0 truncate">
                      {client.name}
                    </span>
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {taxTypes.map(t => <TaxTypeBadge key={t} type={t} size="xs" />)}
                    </div>
                    <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                      {done > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                          {done}✓
                        </span>
                      )}
                      {pending > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                          {pending}⚠
                        </span>
                      )}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-100 dark:border-gray-800">
                      <PeriodGrid
                        client={client}
                        records={records}
                        year={filterYear || curYear}
                        onEditRecord={setEditingRecord}                        onDeleteRecord={id => dispatch({ type: 'DELETE_TAX_RETURN', payload: id })}                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── Flat List ── */}
      {/* (also shown when clientViewNeedsYear but user hasn't switched view) */}
      {viewMode === 'list' && (
        filtered.length === 0 ? (
          <EmptyState
            icon="📁"
            title="No records found"
            message="Open the Clients page, click a client's Filings button, and mark submissions as completed."
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => toggleSort('client')} className="hover:text-gray-700 dark:hover:text-gray-200 transition">
                        Client <SortIcon col="client" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tax Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => toggleSort('period')} className="hover:text-gray-700 dark:hover:text-gray-200 transition">
                        Period <SortIcon col="period" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      <button onClick={() => toggleSort('completedAt')} className="hover:text-gray-700 dark:hover:text-gray-200 transition">
                        Completed <SortIcon col="completedAt" sortBy={sortBy} sortDir={sortDir} />
                      </button>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Checklist</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const client = clients.find(c => c.id === r.clientId);
                    return (
                      <tr key={r.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800">
                        <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200 text-xs">{client?.name || '—'}</td>
                        <td className="px-4 py-3"><TaxTypeBadge type={r.taxType} /></td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs tabular-nums">{getPeriodLabel(r.period)}</td>
                        <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                          {r.completedAt ? formatDate(r.completedAt) : '—'}
                        </td>
                        <td className="px-4 py-3"><ChecklistMini record={r} type={r.taxType} /></td>
                        <td className="px-3 py-3 w-10">
                          <button
                            onClick={() => setEditingRecord(r)}
                            title="Edit record"
                            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-300 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-200 transition opacity-0 group-hover:opacity-100"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )
      )}

      {/* Edit / New record modal */}
      {editingRecord && (
        <HistoryEditModal
          record={editingRecord}
          clients={clients}
          onClose={() => setEditingRecord(null)}
        />
      )}
    </div>
  );
}
