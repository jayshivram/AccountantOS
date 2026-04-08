import React, { useState, useMemo } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import {
  TAX_TYPES, TAX_TYPE_KEYS, uuid, getActivePeriods, formatDate, cn, format,
} from '../utils/index.js';
import {
  Modal, ConfirmDialog, TaxTypeBadge, StatusBadge, ProgressBar, EmptyState,
} from '../components/UI.jsx';

// ─── Tax Return Checklist Modal ───────────────────────────────────────────────

// All tax types share the same 4 base checklist items + payslip confirmation
const BASE_CHECKLIST = ['returnSubmitted', 'screenshotTaken', 'paymentConfirmed', 'returnDownloaded'];

const ITEM_LABELS = {
  returnSubmitted:  'Return Submitted',
  screenshotTaken:  'Screenshot Taken (Proof)',
  paymentConfirmed: 'Payment Confirmed',
  returnDownloaded: 'Return Downloaded',
};

const TOTAL_ITEMS = BASE_CHECKLIST.length + 1; // +1 for payslip/client notification

// value: true = done, 'nil' = not applicable, null/false = pending
function isAddressed(v) {
  return v === true || v === 'nil';
}

function countAddressed(rec) {
  const items = BASE_CHECKLIST.filter(k => isAddressed(rec?.[k])).length;
  const payslip = rec?.payslipStatus === 'sent' || rec?.payslipStatus === 'nil' ? 1 : 0;
  return items + payslip;
}

// ── 3-state checklist item: unchecked → done (✓) → NIL (─) ──
function ChecklistItem3({ label, value, onChange }) {
  const isDone = value === true;
  const isNil  = value === 'nil';
  return (
    <div className="flex items-center gap-2 text-sm py-0.5">
      <button
        type="button"
        onClick={() => onChange(isDone ? null : true)}
        className={cn(
          'flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
          isDone ? 'bg-green-500 border-green-500 text-white'
            : isNil ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
            : 'border-gray-400 dark:border-gray-600 hover:border-green-500'
        )}
      >
        {isDone && <span className="text-[10px] leading-none font-bold">✓</span>}
        {isNil  && <span className="text-[10px] leading-none font-bold">─</span>}
      </button>
      <span className={cn(
        'flex-1 leading-snug',
        isDone ? 'text-gray-400 dark:text-gray-500 line-through'
          : isNil ? 'text-gray-400 dark:text-gray-500'
          : 'text-gray-700 dark:text-gray-300'
      )}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(isNil ? null : 'nil')}
        className={cn(
          'text-[11px] px-1.5 py-0.5 rounded border font-semibold transition-all flex-shrink-0',
          isNil
            ? 'bg-gray-500 dark:bg-gray-600 border-gray-500 text-white'
            : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-gray-500 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
        )}
      >
        NIL
      </button>
    </div>
  );
}

function ClientCopyToggle({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-sm font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">Client Copy:</span>
      <button
        type="button"
        onClick={() => onChange(value === 'nil' ? null : 'nil')}
        className={cn(
          'text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all',
          value === 'nil'
            ? 'bg-gray-500 dark:bg-gray-600 border-gray-500 text-white'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
        )}
      >
        NIL
      </button>
      <button
        type="button"
        onClick={() => onChange(value === 'sent' ? null : 'sent')}
        className={cn(
          'text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all',
          value === 'sent'
            ? 'bg-green-600 border-green-500 text-white'
            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
        )}
      >
        Sent to Client
      </button>
      {value && (
        <button type="button" onClick={() => onChange(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">✕</button>
      )}
    </div>
  );
}

function TaxReturnModal({ client, isOpen, onClose }) {
  const { state, dispatch } = useApp();

  const now = new Date();

  // Build a window of months: 3 months back → current → 2 months forward
  const months = [];
  for (let offset = -3; offset <= 2; offset++) {
    let month = now.getMonth() + offset;
    let year  = now.getFullYear();
    while (month < 0)  { month += 12; year--; }
    while (month > 11) { month -= 12; year++; }
    months.push({ month, year });
  }

  // Default to previous month (most commonly filing for last month)
  const defaultIdx = months.findIndex(m => {
    const prevM = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevY = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return m.month === prevM && m.year === prevY;
  });
  const [selectedIdx, setSelectedIdx] = useState(defaultIdx >= 0 ? defaultIdx : 2);

  const { month: selMonth, year: selYear } = months[selectedIdx];

  function getRecord(taxType, period) {
    return state.taxReturns.find(
      tr => tr.clientId === client.id && tr.taxType === taxType && tr.period === period
    ) || { status: 'pending', notes: '' };
  }

  function upsert(taxType, period, changes) {
    const current = getRecord(taxType, period);
    dispatch({
      type: 'UPSERT_TAX_RETURN',
      payload: { clientId: client.id, taxType, period, ...current, ...changes },
    });
  }

  // Determine which taxes apply to the selected month
  const isQuarterEnd = [2, 5, 8, 11].includes(selMonth); // Mar, Jun, Sep, Dec
  const quarter = Math.floor(selMonth / 3) + 1;
  const monthPeriod = `${selYear}-${String(selMonth).padStart(2, '0')}`;

  const applicableItems = [
    ...['VAT', 'PAYE', 'SDL', 'WHT', 'NSSF', 'WCF']
      .filter(t => client.taxTypes.includes(t))
      .map(type => ({ type, period: monthPeriod })),
    ...(isQuarterEnd && client.taxTypes.includes('PROVISIONAL')
      ? [{ type: 'PROVISIONAL', period: `${selYear}-Q${quarter}` }] : []),
    ...(isQuarterEnd && client.taxTypes.includes('CITY_LEVY')
      ? [{ type: 'CITY_LEVY', period: `${selYear}-Q${quarter}` }] : []),
    ...(selMonth === 5 && client.taxTypes.includes('ROI')
      ? [{ type: 'ROI', period: `${selYear - 1}-annual` }] : []),
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${client.name} — Filings`} size="xl">
      {/* Month Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-gray-200 dark:border-gray-700 scrollbar-hide">
        {months.map(({ month, year }, idx) => (
          <button
            key={idx}
            onClick={() => setSelectedIdx(idx)}
            className={cn(
              'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              selectedIdx === idx
                ? 'bg-blue-600 text-white shadow'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            {format(new Date(year, month, 1), 'MMM yyyy')}
          </button>
        ))}
      </div>

      {/* Month label & due-date hint */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
          {format(new Date(selYear, selMonth, 1), 'MMMM yyyy')} filings
        </h3>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
          {applicableItems.length} applicable tax type{applicableItems.length !== 1 ? 's' : ''}
          {isQuarterEnd ? ' · Quarter-end month' : ''}
          {selMonth === 5 ? ' · ROI/Accounts deadline month' : ''}
        </p>
      </div>

      {/* Tax items */}
      <div className="space-y-4 max-h-[58vh] overflow-y-auto pr-1">
        {applicableItems.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10 italic">No applicable filings for this month.</p>
        ) : (
          applicableItems.map(({ type, period }) => {
            const rec = getRecord(type, period);
            const done = countAddressed(rec);
            const allChecked = done >= TOTAL_ITEMS;

            return (
              <div key={`${type}-${period}`} className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <TaxTypeBadge type={type} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{TAX_TYPES[type]}</span>
                    {type === 'ROI' && (
                      <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 px-1.5 py-0.5 rounded font-medium">
                        Annual · Due 30 Jun {selYear}
                      </span>
                    )}
                    {type === 'PROVISIONAL' && (
                      <span className="text-[10px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 px-1.5 py-0.5 rounded font-medium">
                        Q{quarter} {selYear}
                      </span>
                    )}
                    {type === 'CITY_LEVY' && (
                      <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 px-1.5 py-0.5 rounded font-medium">
                        Q{quarter} {selYear}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{done}/{TOTAL_ITEMS} done</span>
                    <StatusBadge status={allChecked ? 'completed' : rec.status} />
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-3 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      allChecked ? 'bg-green-500' : done > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'
                    )}
                    style={{ width: `${(done / TOTAL_ITEMS) * 100}%` }}
                  />
                </div>

                {/* Status buttons */}
                <div className="flex gap-1.5 mb-3">
                  {['pending', 'in_progress', 'completed'].map(s => (
                    <button
                      key={s}
                      onClick={() => upsert(type, period, { status: s, ...(s === 'completed' ? { completedAt: new Date().toISOString() } : {}) })}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-lg border transition-all font-medium',
                        rec.status === s
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'
                      )}
                    >
                      {s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Checklist */}
                <div className="space-y-1 mb-3">
                  {BASE_CHECKLIST.map(key => (
                    <ChecklistItem3
                      key={key}
                      label={ITEM_LABELS[key]}
                      value={rec[key]}
                      onChange={v => upsert(type, period, { [key]: v })}
                    />
                  ))}
                </div>

                {/* Client Copy */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <ClientCopyToggle
                    value={rec.payslipStatus || null}
                    onChange={v => upsert(type, period, { payslipStatus: v })}
                  />
                </div>

                {/* Notes */}
                <textarea
                  className="input text-xs h-10 resize-none mt-3"
                  placeholder="Notes..."
                  value={rec.notes || ''}
                  onChange={e => upsert(type, period, { notes: e.target.value })}
                />
              </div>
            );
          })
        )}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button onClick={onClose} className="btn-secondary w-full">Close</button>
      </div>
    </Modal>
  );
}

// ─── Client Form ──────────────────────────────────────────────────────────────

function ClientForm({ initial, isOpen, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || '');
  const [taxTypes, setTaxTypes] = useState(initial?.taxTypes || []);
  const [tallyYears, setTallyYears] = useState((initial?.tallyYears || []).join(', '));
  const [notes, setNotes] = useState(initial?.notes || '');

  function toggleType(t) {
    setTaxTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function submit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const years = tallyYears.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y));
    onSave({ ...initial, name: name.trim(), taxTypes, tallyYears: years, notes });
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initial ? 'Edit Client' : 'Add New Client'}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Client Name *</label>
          <input
            className="input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. AL AHAD"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label">Tax Types</label>
          <div className="flex flex-wrap gap-2">
            {TAX_TYPE_KEYS.map(t => (
              <button
                type="button"
                key={t}
                onClick={() => toggleType(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  taxTypes.includes(t)
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-400'
                )}
              >
                {TAX_TYPES[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Tally Updated Years</label>
          <input
            className="input"
            value={tallyYears}
            onChange={e => setTallyYears(e.target.value)}
            placeholder="e.g. 2024, 2025"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated years</p>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input h-16 resize-none"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any notes about this client..."
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">
            {initial ? 'Save Changes' : 'Add Client'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Client Row ───────────────────────────────────────────────────────────────

function ClientRow({ client, onEdit, onDelete, onViewFilings }) {
  const { state } = useApp();

  // Count completed returns across all active periods/types
  const completedReturns = state.taxReturns.filter(
    tr => tr.clientId === client.id && tr.status === 'completed'
  ).length;

  const pendingTasks = state.tasks.filter(
    t => t.clientId === client.id && t.status !== 'completed'
  ).length;

  return (
    <div className="card p-4 hover:border-gray-700 transition-all group">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{client.name}</h3>
            {pendingTasks > 0 && (
              <span className="badge bg-amber-900/40 text-amber-300 border border-amber-700/40 text-[10px]">
                {pendingTasks} task{pendingTasks > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {client.taxTypes.map(t => <TaxTypeBadge key={t} type={t} size="xs" />)}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
            <span>✓ {completedReturns} submissions</span>
            {client.tallyYears.length > 0 && (
              <span>📊 Tally: {client.tallyYears.join(', ')}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onViewFilings(client)}
            className="btn-ghost text-xs py-1 px-2"
            title="View filings"
          >
            📋 Filings
          </button>
          <button onClick={() => onEdit(client)} className="btn-ghost text-xs py-1 px-2" title="Edit">✏️</button>
          <button onClick={() => onDelete(client.id)} className="btn-ghost text-xs py-1 px-2 hover:text-red-400" title="Delete">🗑</button>
        </div>
      </div>
    </div>
  );
}

// ─── Clients Page ─────────────────────────────────────────────────────────────

export default function Clients() {
  const clients = useClients();
  const { dispatch } = useApp();

  const [search, setSearch]       = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filingClient, setFilingClient] = useState(null);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchType  = filterType === 'ALL' || c.taxTypes.includes(filterType);
      return matchSearch && matchType;
    });
  }, [clients, search, filterType]);

  // Stats by tax type
  const typeCounts = useMemo(() => {
    const counts = {};
    TAX_TYPE_KEYS.forEach(t => { counts[t] = clients.filter(c => c.taxTypes.includes(t)).length; });
    return counts;
  }, [clients]);

  function handleAdd(data) {
    dispatch({ type: 'ADD_CLIENT', payload: data });
  }

  function handleEdit(data) {
    dispatch({ type: 'EDIT_CLIENT', payload: data });
  }

  function handleDelete(id) {
    dispatch({ type: 'DELETE_CLIENT', payload: id });
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{clients.length} clients total</p>
        </div>
        <button onClick={() => setShowAddForm(true)} className="btn-primary">
          + Add Client
        </button>
      </div>

      {/* Tax Type Summary Cards */}
      <div className="flex flex-wrap gap-2">
        {TAX_TYPE_KEYS.map(t => (
          <button
            key={t}
            onClick={() => setFilterType(filterType === t ? 'ALL' : t)}
            className={cn(
              'card p-3 text-left transition-all hover:scale-[1.02]',
              filterType === t ? 'border-blue-600/60 bg-blue-900/20' : ''
            )}
          >
            <p className="text-xl font-extrabold text-gray-800 dark:text-gray-100">{typeCounts[t]}</p>
            <TaxTypeBadge type={t} size="xs" />
          </button>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          className="input flex-1"
          placeholder="Search clients..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="input w-full sm:w-48"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">All Tax Types</option>
          {TAX_TYPE_KEYS.map(t => (
            <option key={t} value={t}>{TAX_TYPES[t]}</option>
          ))}
        </select>
      </div>

      {/* Client Grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No clients found"
          message="Try adjusting your search or tax type filter."
          action={
            <button onClick={() => setShowAddForm(true)} className="btn-primary">
              Add Client
            </button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <ClientRow
              key={c.id}
              client={c}
              onEdit={setEditingClient}
              onDelete={setDeletingId}
              onViewFilings={setFilingClient}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <ClientForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onSave={handleAdd}
      />
      {editingClient && (
        <ClientForm
          isOpen={!!editingClient}
          initial={editingClient}
          onClose={() => setEditingClient(null)}
          onSave={handleEdit}
        />
      )}
      {deletingId && (
        <ConfirmDialog
          isOpen={!!deletingId}
          onClose={() => setDeletingId(null)}
          onConfirm={() => handleDelete(deletingId)}
          title="Delete Client"
          message="This will also delete all filings and tasks for this client. This cannot be undone."
        />
      )}
      {filingClient && (
        <TaxReturnModal
          client={filingClient}
          isOpen={!!filingClient}
          onClose={() => setFilingClient(null)}
        />
      )}
    </div>
  );
}
