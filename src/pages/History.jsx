import React, { useState, useMemo } from 'react';
import { useApp, useClients } from '../context/AppContext.jsx';
import { TAX_TYPES, TAX_TYPE_KEYS, formatDate, cn } from '../utils/index.js';
import { TaxTypeBadge, StatusBadge, EmptyState } from '../components/UI.jsx';

export default function History() {
  const { state } = useApp();
  const clients = useClients();

  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType]     = useState('');
  const [filterYear, setFilterYear]     = useState('');
  const [filterStatus, setFilterStatus] = useState('completed');

  const years = useMemo(() => {
    const set = new Set();
    state.taxReturns.forEach(r => {
      const y = r.period?.slice(0, 4);
      if (y) set.add(y);
    });
    return [...set].sort().reverse();
  }, [state.taxReturns]);

  const filtered = useMemo(() => {
    return state.taxReturns.filter(r => {
      if (filterClient && r.clientId !== filterClient) return false;
      if (filterType && r.taxType !== filterType) return false;
      if (filterYear && !r.period?.startsWith(filterYear)) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => {
      // Sort by completedAt or period descending
      const aDate = a.completedAt || a.period || '';
      const bDate = b.completedAt || b.period || '';
      return bDate.localeCompare(aDate);
    });
  }, [state.taxReturns, filterClient, filterType, filterYear, filterStatus]);

  const stats = useMemo(() => {
    const completedTotal = state.taxReturns.filter(r => r.status === 'completed').length;
    const pendingTotal   = state.taxReturns.filter(r => r.status === 'pending').length;
    const inProgressTotal = state.taxReturns.filter(r => r.status === 'in_progress').length;
    return { completedTotal, pendingTotal, inProgressTotal };
  }, [state.taxReturns]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">Filing History & Records</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Track all submissions per client and tax type</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed',   value: stats.completedTotal,  color: 'text-green-600 dark:text-green-400' },
          { label: 'In Progress', value: stats.inProgressTotal, color: 'text-blue-600 dark:text-blue-400'   },
          { label: 'Pending',     value: stats.pendingTotal,    color: 'text-gray-600 dark:text-gray-400'   },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <p className={cn('text-3xl font-extrabold', s.color)}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <select className="input" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="input" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Tax Types</option>
          {TAX_TYPE_KEYS.map(t => <option key={t} value={t}>{TAX_TYPES[t]}</option>)}
        </select>
        <select className="input" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Records Table */}
      {filtered.length === 0 ? (
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tax Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Period</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Completed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filtered.map(r => {
                  const client = clients.find(c => c.id === r.clientId);
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors border-b border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{client?.name || '—'}</td>
                      <td className="px-4 py-3"><TaxTypeBadge type={r.taxType} /></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{r.period}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {r.completedAt ? formatDate(r.completedAt) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 text-xs text-gray-500">
                          {(r.payslipStatus === 'sent') && <span className="text-green-600 dark:text-green-400">✓ Payslip Sent</span>}
                          {(r.payslipStatus === 'nil')  && <span className="text-gray-400">NIL</span>}
                          {r.returnDownloaded   && <span className="text-blue-600 dark:text-blue-400">✓ Return</span>}
                          {r.returnSubmitted    && <span className="text-purple-600 dark:text-purple-400">✓ Submitted</span>}
                          {r.notes              && <span title={r.notes}>📝</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
            Showing {filtered.length} record{filtered.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
