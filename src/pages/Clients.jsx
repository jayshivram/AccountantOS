import React, { useState, useMemo } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import {
  TAX_TYPES, TAX_TYPE_KEYS, uuid, getActivePeriods, formatDate, cn, format, formatTIN, formatVRN
} from '../utils/index.js';
import {
  Modal, ConfirmDialog, TaxTypeBadge, EmptyState, ClickToCopy
} from '../components/UI.jsx';
// --- Client Form --------------------------------------------------------------

function ClientForm({ initial, isOpen, onClose, onSave }) {
  const [name, setName] = useState(initial?.name || '');
  const [tin, setTin] = useState(initial?.tin || '');
  const [vrn, setVrn] = useState(initial?.vrn || '');
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
    onSave({ ...initial, name: name.trim(), tin, vrn, taxTypes, tallyYears: years, notes });
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">TIN Number</label>
            <input
              className="input text-xs"
              value={tin}
              onChange={e => setTin(formatTIN(e.target.value))}
              placeholder="100-183-471"
            />
          </div>
          <div>
            <label className="label">VRN Number</label>
            <input
              className="input text-xs"
              value={vrn}
              onChange={e => setVrn(formatVRN(e.target.value))}
              placeholder="10-005396-Z"
            />
          </div>
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

// --- Client Row ---------------------------------------------------------------

function ClientRow({ client, onEdit, onDelete, onHide }) {
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm truncate">{client.name}</h3>
            {pendingTasks > 0 && (
              <span className="badge bg-amber-900/40 text-amber-300 border border-amber-700/40 text-[10px] flex-shrink-0">
                {pendingTasks} task{pendingTasks > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1 mb-3">
            {client.taxTypes.map(t => <TaxTypeBadge key={t} type={t} size="xs" />)}
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500 flex-wrap">
            <span className="whitespace-nowrap">✓ {completedReturns} submissions</span>
            {client.tallyYears.length > 0 && (
              <span className="whitespace-nowrap">📊 Tally: {client.tallyYears.join(', ')}</span>
            )}
            {(client.tin || client.vrn) && (
              <div className="flex gap-2 items-center">
                {client.tin && <ClickToCopy label="TIN" value={client.tin} />}
                {client.vrn && <ClickToCopy label="VRN" value={client.vrn} />}
              </div>
            )}
          </div>
        </div>

        {/* Actions: always visible on mobile, hover-reveal on desktop */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:transition-opacity">
          <div className="flex gap-1">
            <button
              onClick={() => onHide(client.id)}
              className="btn-ghost text-xs py-1 px-2"
              title="Hide client (manage in Settings)"
            >
              🙈
            </button>
            <button onClick={() => onEdit(client)} className="btn-ghost text-xs py-1 px-2" title="Edit">✏️</button>
            <button onClick={() => onDelete(client.id)} className="btn-ghost text-xs py-1 px-2 hover:text-red-400" title="Delete">🗑</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Clients Page -------------------------------------------------------------

export default function Clients() {
  const clients = useClients();
  const { dispatch } = useApp();

  const [search, setSearch]         = useState('');
  const [filterType, setFilterType]  = useState('ALL');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [deletingId, setDeletingId]  = useState(null);

  const hiddenCount = useMemo(() => clients.filter(c => c.hidden).length, [clients]);

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (c.hidden) return false;
      const matchSearch = c.name.toLowerCase().includes(search.toLowerCase());
      const matchType  = filterType === 'ALL' || c.taxTypes.includes(filterType);
      return matchSearch && matchType;
    });
  }, [clients, search, filterType]);

  // Stats by tax type (count only visible clients)
  const typeCounts = useMemo(() => {
    const counts = {};
    TAX_TYPE_KEYS.forEach(t => { counts[t] = clients.filter(c => !c.hidden && c.taxTypes.includes(t)).length; });
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

  function handleHide(id) {
    dispatch({ type: 'HIDE_CLIENTS', payload: [id] });
  }

  return (
    <div className="space-y-6 animate-fade-in min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Clients</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {clients.filter(c => !c.hidden).length} clients
            {hiddenCount > 0 && (
              <span className="text-gray-500 dark:text-gray-500"> · {hiddenCount} hidden — manage in Settings</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(true)} className="btn-primary">
            + Add Client
          </button>
        </div>
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
              onHide={handleHide}
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
    </div>
  );
}
