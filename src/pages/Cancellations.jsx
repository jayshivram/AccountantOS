import React, { useState } from 'react';
import { useApp, useCancellations } from '../context/AppContext.jsx';
import { Modal } from '../components/UI.jsx';
import { cn, formatDate } from '../utils/index.js';

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-700/40">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        Completed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700/40">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" />
      Pending
    </span>
  );
}

// ─── Avatar initials ─────────────────────────────────────────────────────────

function Avatar({ email, size = 'sm' }) {
  const initial = email ? email[0].toUpperCase() : '?';
  const colors = [
    'bg-blue-600', 'bg-purple-600', 'bg-green-600', 'bg-rose-600',
    'bg-teal-600', 'bg-orange-600', 'bg-indigo-600', 'bg-cyan-600',
  ];
  // Deterministic color from email characters
  const colorIndex = email
    ? [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0) % colors.length
    : 0;

  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs';
  return (
    <div
      title={email}
      className={cn('rounded-full flex items-center justify-center text-white font-bold flex-shrink-0', colors[colorIndex], sizeClass)}
    >
      {initial}
    </div>
  );
}

// ─── New Cancellation Modal ───────────────────────────────────────────────────

function NewCancellationModal({ isOpen, onClose, clients, currentUserEmail }) {
  const { dispatch } = useApp();
  const [clientId, setClientId]   = useState('');
  const [taxType, setTaxType]     = useState('');
  const [notes, setNotes]         = useState('');
  const [saving, setSaving]       = useState(false);

  const visibleClients = [...clients]
    .filter(c => !c.hidden)
    .sort((a, b) => a.name.localeCompare(b.name));

  function handleClose() {
    setClientId(''); setTaxType(''); setNotes(''); setSaving(false);
    onClose();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    const client = clients.find(c => c.id === clientId);
    dispatch({
      type: 'ADD_CANCELLATION',
      payload: {
        clientId,
        clientName:  client?.name || '',
        taxType:     taxType || null,
        notes:       notes.trim(),
        createdBy:   currentUserEmail,
        assignedTo:  'Tax Office Handler',
      },
    });
    handleClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New Cancellation Request" size="md">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Client selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Client <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={clientId}
            onChange={e => setClientId(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700
              text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">Select a client…</option>
            {visibleClients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Tax type (optional context) */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Tax Type <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={taxType}
            onChange={e => setTaxType(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700
              text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
          >
            <option value="">All / Unspecified</option>
            {clientId && clients.find(c => c.id === clientId)?.taxTypes.map(tt => (
              <option key={tt} value={tt}>{tt}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
            Instructions / Notes
          </label>
          <textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Describe what needs to be cancelled at the Tax Office, any reference numbers, or special instructions…"
            className="w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700
              text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent resize-none"
          />
        </div>

        {/* Assignment notice */}
        <div className="flex items-center gap-2.5 px-3.5 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>This request will be assigned to the <strong>Tax Office Handler</strong> and is visible to all team members.</span>
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={handleClose} className="btn-secondary flex-1 justify-center">
            Cancel
          </button>
          <button
            type="submit"
            disabled={!clientId || saving}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700
              text-white font-semibold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Submit Request
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Cancellation Card ───────────────────────────────────────────────────────

function CancellationCard({ item, currentUserEmail, onComplete, onReopen, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border rounded-2xl p-5 shadow-sm transition-all',
      item.status === 'completed'
        ? 'border-green-200 dark:border-green-800/40 opacity-75'
        : 'border-gray-200 dark:border-gray-800'
    )}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">
              {item.clientName}
            </h3>
            {item.taxType && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                {item.taxType}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Assigned to: <span className="font-medium text-gray-700 dark:text-gray-300">Tax Office Handler</span>
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>

      {/* Notes */}
      {item.notes && (
        <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{item.notes}</p>
        </div>
      )}

      {/* Audit trail */}
      <div className="space-y-1 mb-4">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
          <Avatar email={item.createdBy} />
          <span>Created by <span className="text-gray-700 dark:text-gray-300 font-medium">{item.createdBy}</span></span>
          <span>·</span>
          <span>{formatDate(item.createdAt, 'dd MMM yyyy, HH:mm')}</span>
        </div>
        {item.status === 'completed' && item.completedBy && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
            <Avatar email={item.completedBy} />
            <span>Completed by <span className="text-green-700 dark:text-green-400 font-medium">{item.completedBy}</span></span>
            {item.completedAt && (
              <>
                <span>·</span>
                <span>{formatDate(item.completedAt, 'dd MMM yyyy, HH:mm')}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.status === 'pending' ? (
          <button
            onClick={() => onComplete(item.id)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
              bg-green-600 hover:bg-green-700 text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Mark Completed
          </button>
        ) : (
          <button
            onClick={() => onReopen(item.id)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg
              bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600
              text-gray-700 dark:text-gray-200 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reopen
          </button>
        )}

        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="ml-auto flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg
              text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border border-transparent
              hover:border-red-200 dark:hover:border-red-800/40 transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Delete?</span>
            <button
              onClick={() => onDelete(item.id)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              No
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cancellations Page ───────────────────────────────────────────────────────

export default function Cancellations() {
  const { state, dispatch, userEmail } = useApp();
  const cancellations                  = useCancellations();
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [filter, setFilter]            = useState('all'); // 'all' | 'pending' | 'completed'

  const pending   = cancellations.filter(c => c.status === 'pending');
  const completed = cancellations.filter(c => c.status === 'completed');

  const displayed = filter === 'pending'
    ? pending
    : filter === 'completed'
      ? completed
      : cancellations;

  function handleComplete(id) {
    dispatch({ type: 'COMPLETE_CANCELLATION', payload: { id, completedBy: userEmail } });
  }
  function handleReopen(id) {
    dispatch({ type: 'REOPEN_CANCELLATION', payload: id });
  }
  function handleDelete(id) {
    dispatch({ type: 'DELETE_CANCELLATION', payload: id });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tax Office Cancellations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Team-shared log · visible to all members · real-time sync
          </p>
        </div>
        <button
          onClick={() => setNewModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
            text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-600/20
            focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-950
            transition flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Cancellation Request
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Total Requests', value: cancellations.length, color: 'text-gray-900 dark:text-white' },
          { label: 'Pending',        value: pending.length,       color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Completed',      value: completed.length,     color: 'text-green-600 dark:text-green-400'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
            <p className={cn('text-2xl font-bold', color)}>{value}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/60 p-1 rounded-xl w-fit">
        {(['all', 'pending', 'completed']).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition',
              filter === f
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {f === 'all' ? `All (${cancellations.length})` : f === 'pending' ? `Pending (${pending.length})` : `Done (${completed.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 14l2 2 4-4m-1-9H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V7l-4-4z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {filter === 'all' ? 'No cancellation requests yet' : `No ${filter} requests`}
          </p>
          {filter === 'all' && (
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 max-w-xs">
              Click "New Cancellation Request" to create one. It will sync to the whole team instantly.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(item => (
            <CancellationCard
              key={item.id}
              item={item}
              currentUserEmail={userEmail}
              onComplete={handleComplete}
              onReopen={handleReopen}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <NewCancellationModal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        clients={state.clients.filter(c => !c.hidden)}
        currentUserEmail={userEmail}
      />
    </div>
  );
}
