import React, { useState, useMemo } from 'react';
import { useApp, useDocuments } from '../context/AppContext.jsx';
import { Modal, EmptyState, ConfirmDialog } from '../components/UI.jsx';
import { cn, formatDate, daysUntil } from '../utils/index.js';

// ─── Custody locations ─────────────────────────────────────────────────────────
// The set a document can be at. `with_me` is the "do I still have it?" state;
// `filed` is a terminal "done & stored safely" state; `other` carries a label
// for anywhere else an external accountant sends paperwork (NSSF, BRELA, bank,
// auditor, lawyer, courier…).

export const LOCATIONS = {
  with_me:       { label: 'With Me',       short: 'Me',        emoji: '📥', dot: 'bg-blue-500',
    badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700/50' },
  with_client:   { label: 'With Client',   short: 'Client',    emoji: '🧑‍💼', dot: 'bg-purple-500',
    badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700/50' },
  at_tra:        { label: 'At TRA',        short: 'TRA',       emoji: '🏛️', dot: 'bg-rose-500',
    badge: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700/50' },
  with_colleague:{ label: 'With Colleague',short: 'Colleague', emoji: '👥', dot: 'bg-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700/50' },
  filed:         { label: 'Filed / Archived', short: 'Filed', emoji: '🗄️', dot: 'bg-green-500',
    badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50' },
  other:         { label: 'Other',         short: 'Other',     emoji: '📦', dot: 'bg-gray-500',
    badge: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-700' },
};

const LOCATION_KEYS = Object.keys(LOCATIONS);

// Document categories — optional, purely to help organise the list.
const DOC_TYPES = [
  'Certificate', 'Bank Statement', 'Tax Return', 'TRA Letter',
  'Receipt / Payslip', 'Registration / ID', 'Contract / Agreement',
  'Invoice', 'Financial Statements', 'Other',
];

// A location resolves to a readable name, honouring the free-text "other" label.
function locName(doc) {
  const base = LOCATIONS[doc.location] || LOCATIONS.other;
  if (doc.location === 'other' && doc.otherLabel) return doc.otherLabel;
  return base.label;
}

// ─── Location badge ─────────────────────────────────────────────────────────────

function LocationBadge({ location, otherLabel }) {
  const loc = LOCATIONS[location] || LOCATIONS.other;
  const text = location === 'other' && otherLabel ? otherLabel : loc.label;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border', loc.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', loc.dot)} />
      {loc.emoji} {text}
    </span>
  );
}

// ─── Due-back state ──────────────────────────────────────────────────────────────
// A follow-up date flags a document that should have moved on by now. Filed docs
// are "done", so they never nag.

function dueState(doc) {
  if (!doc.dueBackDate || doc.location === 'filed') return null;
  const days = daysUntil(doc.dueBackDate);
  if (days < 0)  return { kind: 'overdue', days, label: `Overdue ${Math.abs(days)}d`, cls: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300 dark:border-red-700/60' };
  if (days === 0) return { kind: 'today', days, label: 'Due today', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800/50 animate-pulse' };
  if (days <= 3)  return { kind: 'soon', days, label: `${days}d left`, cls: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/50' };
  return { kind: 'ok', days, label: `${days}d left`, cls: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800/40' };
}

// ─── Add / Edit modal ────────────────────────────────────────────────────────────

function DocumentModal({ isOpen, onClose, clients, colleagues = [], editing, initialClientId = '', initialColleague = '' }) {
  const { dispatch } = useApp();
  const isEdit = !!editing;

  const [name,        setName]        = useState('');
  const [docType,     setDocType]     = useState('');
  const [fileMode,    setFileMode]    = useState('client'); // 'client' | 'colleague' | 'general'
  const [clientId,    setClientId]    = useState('');
  const [colleague,   setColleague]   = useState('');
  const [location,    setLocation]    = useState('with_me');
  const [otherLabel,  setOtherLabel]  = useState('');
  const [dueBackDate, setDueBackDate] = useState('');
  const [reference,   setReference]   = useState('');
  const [notes,       setNotes]       = useState('');

  const visibleClients = useMemo(
    () => [...clients].filter(c => !c.hidden).sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  // Load values when opening (edit) or reset (add)
  React.useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name || '');
      setDocType(editing.docType || '');
      setClientId(editing.clientId || '');
      setColleague(editing.colleague || '');
      setFileMode(editing.clientId ? 'client' : editing.colleague ? 'colleague' : 'general');
      setLocation(editing.location || 'with_me');
      setOtherLabel(editing.otherLabel || '');
      setDueBackDate(editing.dueBackDate || '');
      setReference(editing.reference || '');
      setNotes(editing.notes || '');
    } else {
      setName(''); setDocType('');
      setClientId(initialClientId); setColleague(initialColleague);
      setFileMode(initialColleague ? 'colleague' : 'client');
      setLocation('with_me');
      setOtherLabel(''); setDueBackDate(''); setReference(''); setNotes('');
    }
  }, [isOpen, editing, initialClientId, initialColleague]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const useClient    = fileMode === 'client';
    const useColleague = fileMode === 'colleague' && colleague.trim();
    const client = useClient ? clients.find(c => c.id === clientId) : null;
    const base = {
      name:       name.trim(),
      docType,
      clientId:   useClient ? clientId : '',
      clientName: client?.name || '',
      colleague:  useColleague ? colleague.trim() : '',
      otherLabel: location === 'other' ? otherLabel.trim() : '',
      reference:  reference.trim(),
      notes:      notes.trim(),
    };
    if (isEdit) {
      // Metadata edit — location changes go through "Move" instead, so keep location here.
      dispatch({ type: 'EDIT_DOCUMENT', payload: { ...editing, ...base } });
    } else {
      dispatch({ type: 'ADD_DOCUMENT', payload: { ...base, location, dueBackDate, note: 'Logged' } });
    }
    onClose();
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Document' : 'Log a Document'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label className={labelCls}>Document <span className="text-red-500">*</span></label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. VAT Certificate, Bank statements Jan–Mar, TIN letter"
            className={inputCls}
          />
        </div>

        {/* Type */}
        <div>
          <label className={labelCls}>Type <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
          <select value={docType} onChange={e => setDocType(e.target.value)} className={inputCls}>
            <option value="">Unspecified</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* File under — client / colleague / general */}
        <div>
          <label className={labelCls}>File under</label>
          <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
            {[['client', 'Client'], ['colleague', 'Colleague'], ['general', 'General']].map(([m, l]) => (
              <button
                key={m}
                type="button"
                onClick={() => setFileMode(m)}
                className={cn('flex-1 py-1.5 text-xs font-semibold rounded-md transition',
                  fileMode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200')}
              >
                {l}
              </button>
            ))}
          </div>
          {fileMode === 'client' && (
            <select value={clientId} onChange={e => setClientId(e.target.value)} className={inputCls}>
              <option value="">Select a client…</option>
              {visibleClients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {fileMode === 'colleague' && (
            <>
              <input
                list="doc-colleague-names"
                value={colleague}
                onChange={e => setColleague(e.target.value)}
                placeholder="Colleague's name (e.g. Amina)"
                className={inputCls}
              />
              <datalist id="doc-colleague-names">
                {colleagues.map(n => <option key={n} value={n} />)}
              </datalist>
            </>
          )}
          {fileMode === 'general' && (
            <p className="text-xs text-gray-400 dark:text-gray-500 px-1">Filed under <strong>General</strong> — for firm-wide or unassigned documents (e.g. a TRA notice).</p>
          )}
        </div>

        {/* Location (add only — edit uses Move) */}
        {!isEdit && (
          <div>
            <label className={labelCls}>Where is it now?</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LOCATION_KEYS.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setLocation(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition text-left',
                    location === key
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  )}
                >
                  <span>{LOCATIONS[key].emoji}</span>
                  <span className="truncate">{LOCATIONS[key].label}</span>
                </button>
              ))}
            </div>
            {location === 'other' && (
              <input
                value={otherLabel}
                onChange={e => setOtherLabel(e.target.value)}
                placeholder="Where exactly? e.g. NSSF office, BRELA, Client's bank, Auditor"
                className={cn(inputCls, 'mt-2')}
              />
            )}
          </div>
        )}

        {/* Reference + follow-up date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Reference <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="File no. / batch" className={inputCls} />
          </div>
          {!isEdit && (
            <div>
              <label className={labelCls}>Follow up by <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <input type="date" value={dueBackDate} onChange={e => setDueBackDate(e.target.value)} className={inputCls} />
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
          <textarea
            rows={2}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Anything worth remembering about this document…"
            className={cn(inputCls, 'resize-none')}
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isEdit ? 'Save Changes' : 'Log Document'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Move (hand-off) modal ───────────────────────────────────────────────────────

function MoveModal({ isOpen, onClose, doc }) {
  const { dispatch } = useApp();
  const [location,    setLocation]    = useState('with_me');
  const [otherLabel,  setOtherLabel]  = useState('');
  const [dueBackDate, setDueBackDate] = useState('');
  const [note,        setNote]        = useState('');

  React.useEffect(() => {
    if (isOpen && doc) {
      setLocation(doc.location || 'with_me');
      setOtherLabel(doc.otherLabel || '');
      setDueBackDate(doc.dueBackDate || '');
      setNote('');
    }
  }, [isOpen, doc]);

  if (!doc) return null;

  function handleSubmit(e) {
    e.preventDefault();
    dispatch({
      type: 'MOVE_DOCUMENT',
      payload: {
        id: doc.id,
        location,
        otherLabel: location === 'other' ? otherLabel.trim() : '',
        dueBackDate: location === 'filed' ? '' : dueBackDate,
        note: note.trim(),
      },
    });
    onClose();
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent';
  const labelCls = 'block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Move Document" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400">Moving:</span>
          <span className="font-semibold text-gray-900 dark:text-white">{doc.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Currently:</span>
          <LocationBadge location={doc.location} otherLabel={doc.otherLabel} />
        </div>

        <div>
          <label className={labelCls}>Move to</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {LOCATION_KEYS.map(key => (
              <button
                key={key}
                type="button"
                onClick={() => setLocation(key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-semibold transition text-left',
                  location === key
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <span>{LOCATIONS[key].emoji}</span>
                <span className="truncate">{LOCATIONS[key].label}</span>
              </button>
            ))}
          </div>
          {location === 'other' && (
            <input
              value={otherLabel}
              onChange={e => setOtherLabel(e.target.value)}
              placeholder="Where exactly? e.g. NSSF office, BRELA, Client's bank"
              className={cn(inputCls, 'mt-2')}
            />
          )}
        </div>

        {location !== 'filed' && (
          <div>
            <label className={labelCls}>Follow up by <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
            <input type="date" value={dueBackDate} onChange={e => setDueBackDate(e.target.value)} className={inputCls} />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Set a date to be reminded if it hasn't moved on by then.</p>
          </div>
        )}

        <div>
          <label className={labelCls}>Note <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Handed to Amina for signature" className={inputCls} />
        </div>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">Cancel</button>
          <button type="submit" className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition">
            Confirm Move
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Document card ───────────────────────────────────────────────────────────────

function DocumentCard({ doc, onMove, onEdit, onDelete, onQuickReceive }) {
  const [showHistory, setShowHistory] = useState(false);
  const due = dueState(doc);
  const withMe = doc.location === 'with_me';

  return (
    <div className={cn(
      'bg-white dark:bg-gray-900 border rounded-2xl p-4 sm:p-5 shadow-sm transition-all',
      due?.kind === 'overdue'
        ? 'border-red-300 dark:border-red-800/50'
        : doc.location === 'filed'
          ? 'border-gray-200 dark:border-gray-800 opacity-80'
          : 'border-gray-200 dark:border-gray-800'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight">{doc.name}</h3>
            {doc.docType && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                {doc.docType}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            {doc.clientName ? <span className="font-medium text-gray-700 dark:text-gray-300">{doc.clientName}</span> : 'General / no client'}
            {doc.reference && <span> · Ref {doc.reference}</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <LocationBadge location={doc.location} otherLabel={doc.otherLabel} />
          {due && (
            <span className={cn('inline-flex items-center rounded-full font-semibold text-[11px] px-2 py-0.5 border', due.cls)}>
              {due.label}
            </span>
          )}
        </div>
      </div>

      {/* Notes */}
      {doc.notes && (
        <div className="mb-3 p-2.5 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{doc.notes}</p>
        </div>
      )}

      {/* Meta line */}
      <div className="flex items-center gap-2 text-[11px] text-gray-400 dark:text-gray-500 mb-3 flex-wrap">
        <span>Updated {formatDate(doc.updatedAt, 'dd MMM yyyy')}</span>
        {doc.dueBackDate && doc.location !== 'filed' && (
          <><span>·</span><span>Follow up {formatDate(doc.dueBackDate, 'dd MMM yyyy')}</span></>
        )}
        {doc.history?.length > 1 && (
          <>
            <span>·</span>
            <button onClick={() => setShowHistory(v => !v)} className="text-blue-500 hover:underline">
              {showHistory ? 'Hide' : 'Show'} history ({doc.history.length})
            </button>
          </>
        )}
      </div>

      {/* History trail */}
      {showHistory && doc.history?.length > 0 && (
        <div className="mb-3 pl-3 border-l-2 border-gray-200 dark:border-gray-700 space-y-1.5">
          {[...doc.history].reverse().map((h, i) => (
            <div key={i} className="text-[11px] text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                {LOCATIONS[h.location]?.emoji} {h.location === 'other' && h.otherLabel ? h.otherLabel : (LOCATIONS[h.location]?.label || h.location)}
              </span>
              <span> · {formatDate(h.at, 'dd MMM yyyy, HH:mm')}</span>
              {h.note && <span className="italic"> — {h.note}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!withMe && doc.location !== 'filed' && (
          <button
            onClick={() => onQuickReceive(doc)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            📥 I have it back
          </button>
        )}
        <button
          onClick={() => onMove(doc)}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
          Move
        </button>
        <button
          onClick={() => onEdit(doc)}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        <button
          onClick={() => onDelete(doc)}
          className="ml-auto flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Folder (filing-cabinet drawer) ──────────────────────────────────────────────

const GENERAL_KEY = '__general__';

function FolderIcon({ kind }) {
  const tint = kind === 'colleague'
    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
    : kind === 'general'
      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
  return (
    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', tint)}>
      {kind === 'colleague' ? (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m0 0A4 4 0 108 8a4 4 0 00-1 7.87M15 8a4 4 0 11-2 7.87" />
        </svg>
      ) : (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
      )}
    </div>
  );
}

function FolderCard({ folder, onOpen }) {
  return (
    <button
      onClick={() => onOpen(folder)}
      className={cn(
        'group text-left bg-white dark:bg-gray-900 border rounded-2xl p-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5',
        folder.attention > 0
          ? 'border-red-300 dark:border-red-800/50'
          : 'border-gray-200 dark:border-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
      )}
    >
      <div className="flex items-start gap-3">
        <FolderIcon kind={folder.kind} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-sm leading-tight truncate">{folder.name}</h3>
            {folder.attention > 0 && (
              <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white">{folder.attention} ⚠</span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{folder.count} document{folder.count !== 1 ? 's' : ''}</p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2">
            {folder.withMe > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">📥 {folder.withMe} with me</span>}
            {folder.out > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 border border-purple-100 dark:border-purple-800/50">📤 {folder.out} out</span>}
            {folder.filed > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 border border-green-100 dark:border-green-800/50">🗄️ {folder.filed} filed</span>}
          </div>
        </div>
        <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-blue-500 flex-shrink-0 mt-1 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

// ─── Page (filing cabinet: folders → documents) ──────────────────────────────────

export default function Documents() {
  const { state, dispatch } = useApp();
  const documents           = useDocuments();

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [addTarget,   setAddTarget]   = useState({ clientId: '', colleague: '' });
  const [moveDoc,     setMoveDoc]     = useState(null);
  const [deleteDoc,   setDeleteDoc]   = useState(null);
  const [openKey,     setOpenKey]     = useState(null); // open folder: clientId or GENERAL_KEY
  const [filter,      setFilter]      = useState('all');
  const [search,      setSearch]      = useState('');

  // Live client lookup so folder names follow client renames
  const clientById = useMemo(() => {
    const m = new Map();
    (state.clients || []).forEach(c => m.set(c.id, c));
    return m;
  }, [state.clients]);

  // Group documents into folders: one per client, one per colleague, + a General drawer
  const folders = useMemo(() => {
    const map = new Map();
    documents.forEach(d => {
      let key, name, kind, clientId = '', colleague = '';
      if (d.clientId) {
        kind = 'client'; clientId = d.clientId; key = `c:${d.clientId}`;
        name = clientById.get(d.clientId)?.name || d.clientName || 'Unknown client';
      } else if (d.colleague) {
        kind = 'colleague'; colleague = d.colleague; key = `g:${d.colleague.toLowerCase()}`;
        name = d.colleague;
      } else {
        kind = 'general'; key = GENERAL_KEY; name = 'General / No client';
      }
      if (!map.has(key)) map.set(key, { key, kind, clientId, colleague, name, isGeneral: kind === 'general', docs: [] });
      map.get(key).docs.push(d);
    });
    const arr = [...map.values()].map(f => {
      const withMe = f.docs.filter(d => d.location === 'with_me').length;
      const filed  = f.docs.filter(d => d.location === 'filed').length;
      const attention = f.docs.filter(d => { const due = dueState(d); return due && (due.kind === 'overdue' || due.kind === 'today'); }).length;
      return { ...f, count: f.docs.length, withMe, filed, out: f.docs.length - withMe - filed, attention };
    });
    const rank = { client: 0, colleague: 1, general: 2 };
    arr.sort((a, b) => {
      if ((b.attention > 0) !== (a.attention > 0)) return a.attention > 0 ? -1 : 1; // needs-attention first
      if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];         // clients, colleagues, then General
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [documents, clientById]);

  // Distinct colleague names already used, for the log form's autocomplete
  const colleagueNames = useMemo(() => {
    const set = new Set();
    documents.forEach(d => { if (d.colleague) set.add(d.colleague); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [documents]);

  // Global stats for the cabinet header
  const totals = useMemo(() => {
    let withMe = 0, filed = 0, attention = 0;
    documents.forEach(d => {
      if (d.location === 'with_me') withMe++;
      else if (d.location === 'filed') filed++;
      const due = dueState(d);
      if (due && (due.kind === 'overdue' || due.kind === 'today')) attention++;
    });
    return { total: documents.length, withMe, filed, out: documents.length - withMe - filed, attention };
  }, [documents]);

  const openFolder = openKey ? folders.find(f => f.key === openKey) : null;

  function handleAdd(target = {}) { setEditing(null); setAddTarget({ clientId: target.clientId || '', colleague: target.colleague || '' }); setModalOpen(true); }
  function handleEdit(doc) { setEditing(doc); setModalOpen(true); }
  function handleQuickReceive(doc) {
    dispatch({ type: 'MOVE_DOCUMENT', payload: { id: doc.id, location: 'with_me', otherLabel: '', dueBackDate: '', note: 'Received back' } });
  }
  function openFolderView(f) { setOpenKey(f.key); setFilter('all'); setSearch(''); }
  function backToCabinet()   { setOpenKey(null); setFilter('all'); setSearch(''); }

  // Documents inside the open folder (chip filter + in-file search)
  const folderDocs = useMemo(() => {
    if (!openFolder) return [];
    const q = search.trim().toLowerCase();
    return openFolder.docs.filter(d => {
      if (filter === 'attention') {
        const due = dueState(d);
        if (!due || (due.kind !== 'overdue' && due.kind !== 'today')) return false;
      } else if (filter !== 'all' && d.location !== filter) return false;
      if (q) {
        const hay = `${d.name} ${d.docType} ${d.reference} ${d.notes} ${d.otherLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [openFolder, filter, search]);

  // Folders in the cabinet (search matches client name OR any contained document)
  const shownFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(f =>
      f.name.toLowerCase().includes(q) ||
      f.docs.some(d => `${d.name} ${d.docType} ${d.reference} ${d.notes}`.toLowerCase().includes(q))
    );
  }, [folders, search]);

  // Chips inside a folder
  const folderChips = openFolder ? (() => {
    const c = { all: openFolder.docs.length, attention: openFolder.attention };
    LOCATION_KEYS.forEach(k => { c[k] = openFolder.docs.filter(d => d.location === k).length; });
    return [
      { key: 'all', label: `All (${c.all})` },
      ...(c.attention > 0 ? [{ key: 'attention', label: `⚠ Needs attention (${c.attention})`, danger: true }] : []),
      ...LOCATION_KEYS.filter(k => c[k] > 0).map(k => ({ key: k, label: `${LOCATIONS[k].emoji} ${LOCATIONS[k].short} (${c[k]})` })),
    ];
  })() : [];

  const addBtn = (target, label = 'Log Document') => (
    <button
      onClick={() => handleAdd(target)}
      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-600/20 transition flex-shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </button>
  );

  const searchInput = (placeholder) => (
    <div className="relative">
      <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
      />
    </div>
  );

  const chipRow = (chips) => (
    <div className="flex gap-2 flex-wrap">
      {chips.map(chip => (
        <button
          key={chip.key}
          onClick={() => setFilter(chip.key)}
          className={cn(
            'px-3 py-1.5 text-xs font-semibold rounded-lg border transition',
            filter === chip.key
              ? chip.danger ? 'bg-red-600 text-white border-red-600' : 'bg-blue-600 text-white border-blue-600'
              : chip.danger
                ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800/50 hover:border-red-300'
                : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {openFolder ? (
        /* ══════════ FOLDER (drill-in) VIEW ══════════ */
        <>
          <button onClick={backToCabinet} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            All files
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <FolderIcon kind={openFolder.kind} />
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{openFolder.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {openFolder.count} document{openFolder.count !== 1 ? 's' : ''} · {openFolder.withMe} with me{openFolder.attention > 0 ? ` · ${openFolder.attention} need attention` : ''}
                </p>
              </div>
            </div>
            {addBtn({ clientId: openFolder.clientId, colleague: openFolder.colleague }, 'Log to this file')}
          </div>

          {openFolder.docs.length > 3 && searchInput('Search in this file…')}
          {chipRow(folderChips)}

          {folderDocs.length === 0 ? (
            <EmptyState icon="🔍" title="Nothing matches" message="Try a different filter or search term." />
          ) : (
            <div className="space-y-3">
              {folderDocs.map(doc => (
                <DocumentCard key={doc.id} doc={doc} onMove={setMoveDoc} onEdit={handleEdit} onDelete={setDeleteDoc} onQuickReceive={handleQuickReceive} />
              ))}
            </div>
          )}
        </>
      ) : (
        /* ══════════ CABINET VIEW ══════════ */
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Documents</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Your filing cabinet — organised by client. Open a file to see everything for that client.
              </p>
            </div>
            {addBtn({})}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Documents', value: totals.total, color: 'text-gray-900 dark:text-white' },
              { label: 'Files', value: folders.length, color: 'text-gray-900 dark:text-white' },
              { label: 'With me', value: totals.withMe, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Needs attention', value: totals.attention, color: totals.attention > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400 dark:text-gray-600' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 text-center shadow-sm">
                <p className={cn('text-2xl font-bold', color)}>{value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {folders.length > 0 && searchInput('Search files or documents…')}

          {folders.length === 0 ? (
            <EmptyState
              icon="🗄️"
              title="No documents filed yet"
              message="Log your first document and choose a client — a file will be created for them automatically."
              action={<button onClick={() => handleAdd({})} className="btn btn-primary">Log your first document</button>}
            />
          ) : shownFolders.length === 0 ? (
            <EmptyState icon="🔍" title="No files match" message="Try a different search." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {shownFolders.map(f => <FolderCard key={f.key} folder={f} onOpen={openFolderView} />)}
            </div>
          )}
        </>
      )}

      {/* Modals (shared) */}
      <DocumentModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        clients={state.clients || []}
        colleagues={colleagueNames}
        editing={editing}
        initialClientId={addTarget.clientId}
        initialColleague={addTarget.colleague}
      />
      <MoveModal isOpen={!!moveDoc} onClose={() => setMoveDoc(null)} doc={moveDoc} />
      <ConfirmDialog
        isOpen={!!deleteDoc}
        onClose={() => setDeleteDoc(null)}
        onConfirm={() => { if (deleteDoc) dispatch({ type: 'DELETE_DOCUMENT', payload: deleteDoc.id }); }}
        title="Delete document?"
        message={deleteDoc ? `Remove "${deleteDoc.name}" from tracking? This only deletes the tracking record, not any file.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}
