import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn, format, escapeHtml } from '../utils/index.js';
import { WHT_SCHEDULE, WHT_CATEGORIES } from '../data/whtRates.js';
import {
  fmt, fmtN, fmtDec, fmtNDec,
  readNum, readNumDec, readSignedDec,
  calcVatInclusiveToExclusive, calcVatAmountToTotals, calcVatExclusiveToInclusive,
  calcBandTax, calcBandReverse,
  calcPaye, calcWHT, calcNSSF, calcSDL, calcWCF,
  getCityLevyRate, calcCityLevy,
  QUARTER_MONTHS, QUARTER_DUE_DATES,
} from '../utils/taxCalc.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseMoneyStr(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

function formatMoney(str) {
  if (str === '' || str == null) return '';
  const s = String(str).replace(/,/g, ''); // strip existing commas
  const negative = s.startsWith('-');
  const abs = negative ? s.slice(1) : s;
  const parts = abs.split('.');
  const intPart = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-US') : '';
  let result;
  if (parts.length > 1) {
    // preserve trailing dot + up to 2 decimal digits
    result = intPart + '.' + parts[1].slice(0, 2);
  } else if (s.endsWith('.')) {
    result = intPart + '.';
  } else {
    result = intPart;
  }
  return negative && result ? '-' + result : result;
}

function useMoneyInput(initial = '') {
  const [raw, setRaw] = useState(initial);
  function onChange(e) {
    setRaw(formatMoney(e.target.value));
  }
  return [raw, onChange, parseMoneyStr(raw), setRaw];
}

function useDecimalInput(initial = '') {
  const [raw, setRaw] = useState(initial);
  function onChange(e) {
    const val = e.target.value.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    const intPart = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-US') : '';
    setRaw(parts.length > 1 ? intPart + '.' + parts[1].slice(0, 2) : intPart);
  }
  return [raw, onChange, readNumDec(raw), setRaw];
}

function useSignedDecimalInput(initial = '') {
  const [raw, setRaw] = useState(initial);
  function onChange(e) {
    const v = e.target.value;
    const negative = v.startsWith('-');
    const cleaned = v.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const intPart = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-US') : '';
    const formatted = parts.length > 1 ? intPart + '.' + parts[1].slice(0, 2) : intPart;
    setRaw(negative && formatted ? '-' + formatted : formatted);
  }
  return [raw, onChange, readSignedDec(raw), setRaw];
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

function MoneyInput({ label, value, onChange, placeholder = '0', className = '' }) {
  return (
    <div className={cn('space-y-1', className)}>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>}
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
      />
    </div>
  );
}

function ResultRow({ label, value, color = 'default', flash }) {
  const colors = {
    default: 'text-gray-700 dark:text-gray-300',
    green:   'text-green-700 dark:text-green-400 font-semibold',
    red:     'text-red-600 dark:text-red-400 font-semibold',
    amber:   'text-amber-700 dark:text-amber-400 font-semibold',
    blue:    'text-blue-700 dark:text-blue-400 font-semibold',
    bold:    'text-gray-900 dark:text-white font-semibold',
  };
  return (
    <div className={cn('flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors duration-300', flash && 'bg-yellow-50 dark:bg-yellow-900/10')}>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cn('text-sm tabular-nums', colors[color])}>{value}</span>
    </div>
  );
}

function CalcCard({ title, children }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm space-y-4">
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      {children}
    </div>
  );
}

function CalcButton({ onClick, children, variant = 'primary' }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full py-2.5 text-sm font-semibold rounded-xl transition',
        variant === 'primary' && 'bg-blue-600 hover:bg-blue-700 text-white',
        variant === 'secondary' && 'border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
      )}
    >
      {children}
    </button>
  );
}

function RateBadge({ rate, label }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
      {label ?? `${(rate * 100).toFixed(2).replace(/\.?0+$/, '')}%`}
    </span>
  );
}

async function exportToPng(ref, filename) {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: null });
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function exportToPdf(htmlContent, title) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A5 portrait;margin:12mm;}body{font-family:Arial,sans-serif;margin:0;color:#111827;font-size:11px;}h2{margin:0 0 3px;font-size:13px;}p.sub{margin:0 0 10px;font-size:10px;color:#6b7280;}.section-title{font-size:9px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;margin:10px 0 4px;}.row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #e5e7eb;font-size:11px;}.row.bold{font-weight:700;border-bottom:2px solid #d1d5db;}.row.net{background:#f0fdf4;padding:6px 8px;border-radius:4px;border-bottom:none;margin:6px 0;font-weight:700;font-size:12px;color:#15803d;}</style></head><body>${htmlContent}</body></html>`;
  const w = window.open('', '_blank', 'width=500,height=600');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.focus(); w.print(); };
}

// ─── VAT Section ──────────────────────────────────────────────────────────────

function VATSection({ taxRates }) {
  const [vatTab, setVatTab] = useState('summary'); // 'summary' | 'converter'

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {[['summary', 'VAT Summary'], ['converter', 'Converter']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setVatTab(key)}
            className={cn(
              'flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition whitespace-nowrap px-3',
              vatTab === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {vatTab === 'summary'   && <VATSummarySection taxRates={taxRates} />}
      {vatTab === 'converter' && <VATConverter      taxRates={taxRates} />}
    </div>
  );
}

// ─── VAT Converter (inclusive ↔ exclusive quick calculators) ──────────────────

const VAT_CONVERTERS = [
  {
    key: 'inclToExcl', title: 'Inclusive → Exclusive', hint: 'Strip VAT out of a gross total',
    inputLabel: 'Total incl. VAT (TZS)', initial: '118,000',
    accent: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30',
    icon: 'M20 12H4',
    calc: (n, rate) => { const r = calcVatInclusiveToExclusive(n, rate); return [
      { label: 'Pre-VAT (Exclusive)', value: fmt(r.exclusive), color: 'bold' },
      { label: 'VAT Amount', value: fmt(r.vatAmount), color: 'red' },
    ]; },
  },
  {
    key: 'amtToTotals', title: 'VAT Amount → Totals', hint: 'Rebuild totals from the VAT figure',
    inputLabel: 'VAT Amount (TZS)', initial: '18,000',
    accent: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30',
    icon: 'M12 4v16m8-8H4',
    calc: (n, rate) => { const r = calcVatAmountToTotals(n, rate); return [
      { label: 'Pre-VAT (Exclusive)', value: fmt(r.exclusive), color: 'bold' },
      { label: 'Inclusive Total', value: fmt(r.inclusive), color: 'green' },
    ]; },
  },
  {
    key: 'exclToIncl', title: 'Exclusive → Inclusive', hint: 'Add VAT on top of a net amount',
    inputLabel: 'Net amount excl. VAT (TZS)', initial: '100,000',
    accent: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30',
    icon: 'M12 6v12m6-6H6',
    calc: (n, rate) => { const r = calcVatExclusiveToInclusive(n, rate); return [
      { label: `VAT (${(rate * 100).toFixed(0)}%)`, value: fmt(r.vatAmount), color: 'red' },
      { label: 'Inclusive Total', value: fmt(r.inclusive), color: 'green' },
    ]; },
  },
];

function VATConverterCard({ config, rate }) {
  const [raw, onChange, num] = useMoneyInput(config.initial);
  const [rows, setRows] = useState(null);
  const [flash, setFlash] = useState(false);

  function run() {
    setRows(config.calc(num, rate));
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm space-y-3.5">
      <div className="flex items-center gap-2.5">
        <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', config.accent)}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={config.icon} /></svg>
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 leading-tight">{config.title}</h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-tight mt-0.5">{config.hint}</p>
        </div>
      </div>
      <MoneyInput label={config.inputLabel} value={raw} onChange={onChange} />
      <CalcButton onClick={run}>Calculate</CalcButton>
      {rows && (
        <div className="space-y-0.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2 border border-gray-100 dark:border-gray-800">
          {rows.map(r => <ResultRow key={r.label} label={r.label} value={r.value} color={r.color} flash={flash} />)}
        </div>
      )}
    </div>
  );
}

function VATConverter({ taxRates }) {
  const rate = taxRates.VAT;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-blue-700 dark:text-blue-300">VAT rate is <strong>{(rate * 100).toFixed(0)}%</strong> — configurable in Settings → Tax Rates</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {VAT_CONVERTERS.map(c => <VATConverterCard key={c.key} config={c} rate={rate} />)}
      </div>
    </div>
  );
}

// ─── VAT Summary (monthly VAT computation template) ───────────────────────────

const VAT_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function loadVatSummary(period) {
  try { const s = localStorage.getItem(`vatSummary_${period}`); return s ? JSON.parse(s) : null; } catch { return null; }
}
function saveVatSummary(period, data) {
  try { localStorage.setItem(`vatSummary_${period}`, JSON.stringify(data)); } catch {}
}

function VATSummarySection({ taxRates }) {
  const rate = taxRates.VAT;
  const now = new Date();
  const [period, setPeriod] = useState(format(now, 'yyyy-MM'));
  const [company, setCompany] = useState('');
  // standard-rated lines — enter ANY of INC / EXCL / VAT; the other two derive.
  // Each line is { v: rawString, b: 'inc' | 'excl' | 'vat' } (b = which column was entered).
  const [sales, setSales]       = useState({ v: '', b: 'inc' });
  const [purchases, setPurch]   = useState({ v: '', b: 'inc' });
  const [imports, setImports]   = useState({ v: '', b: 'inc' });
  const [indirect, setIndirect] = useState({ v: '', b: 'inc' });
  // exempt / non-creditable lines — no VAT, exclusive amount only
  const [nonCredSales, setNonCredSales] = useState('');
  const [exemptSales, setExemptSales] = useState('');
  const [nonCred, setNonCred]         = useState('');
  const [exemptPurch, setExemptPurch] = useState('');
  // direct VAT-amount lines
  const [vatWithheld, setVatWithheld] = useState('');
  const [balanceCf, setBalanceCf]     = useState(''); // signed: negative = credit b/f
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const voucherRef = useRef(null);

  const fields = { company, sales, purchases, imports, indirect, nonCredSales, exemptSales, nonCred, exemptPurch, vatWithheld, balanceCf };

  // Normalise a stored line to { v, b } — tolerates the old string-only format.
  function normLine(x) {
    if (x == null) return { v: '', b: 'inc' };
    if (typeof x === 'string') return { v: x, b: 'inc' };
    return { v: x.v || '', b: x.b || 'inc' };
  }

  function applyData(d) {
    setCompany(d?.company || '');
    setSales(normLine(d?.sales)); setPurch(normLine(d?.purchases)); setImports(normLine(d?.imports)); setIndirect(normLine(d?.indirect));
    setNonCredSales(d?.nonCredSales || ''); setExemptSales(d?.exemptSales || ''); setNonCred(d?.nonCred || ''); setExemptPurch(d?.exemptPurch || '');
    setVatWithheld(d?.vatWithheld || ''); setBalanceCf(d?.balanceCf || '');
    setRes(null);
  }

  useEffect(() => { applyData(loadVatSummary(period)); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function switchPeriod(newPeriod) {
    saveVatSummary(period, fields);
    setPeriod(newPeriod);
    applyData(loadVatSummary(newPeriod));
  }

  // ── Live computation ──
  // Derive INC / EXCL / VAT from whichever column the user typed into.
  function computeLine(line) {
    const n = readSignedDec(line.v);
    if (line.b === 'excl') { const excl = n; const vat = excl * rate;           return { inc: excl + vat, excl, vat, n }; }
    if (line.b === 'vat')  { const vat = n;  const excl = rate ? vat / rate : 0; return { inc: excl + vat, excl, vat, n }; }
    const inc = n; const excl = inc / (1 + rate);                                return { inc, excl, vat: inc - excl, n };
  }
  const S  = computeLine(sales);
  const P  = computeLine(purchases);
  const I  = computeLine(imports);
  const IE = computeLine(indirect);
  const nonCredSalesN = readNumDec(nonCredSales);
  const exemptSalesN  = readNumDec(exemptSales);
  const nonCredN      = readNumDec(nonCred);
  const exemptPurchN  = readNumDec(exemptPurch);
  const vatWithheldN  = readNumDec(vatWithheld);
  const balanceCfN    = readSignedDec(balanceCf);

  const outputVat = S.vat;
  const inputVat  = P.vat + I.vat + IE.vat;
  const totalSalesExcl = S.excl + nonCredSalesN + exemptSalesN;
  const net = outputVat - inputVat - vatWithheldN + balanceCfN; // >0 payable, <0 refundable

  function handleCalculate() {
    if (!S.inc && !P.inc && !IE.inc) { alert('Enter at least Sales or Purchases figures.'); return; }
    setRes({
      period, company, rate,
      sales: S, purchases: P, imports: I, indirect: IE,
      nonCredSalesN, exemptSalesN, nonCredN, exemptPurchN, vatWithheldN, balanceCfN,
      outputVat, inputVat, totalSalesExcl, net,
    });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    saveVatSummary(period, fields);
    setTimeout(() => voucherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }

  function handleReset() {
    if (!confirm('Clear this period\'s VAT summary?')) return;
    localStorage.removeItem(`vatSummary_${period}`);
    applyData(null);
  }

  const periodLabel = (() => {
    const [y, m] = period.split('-').map(Number);
    return `${VAT_MONTHS[(m || 1) - 1]} ${y}`.toUpperCase();
  })();

  async function handleExport(type) {
    if (!res) return;
    setExporting(true);
    try {
      const rLabel = (() => { const [y, m] = res.period.split('-').map(Number); return `${VAT_MONTHS[(m || 1) - 1]} ${y}`.toUpperCase(); })();
      const fname = `VAT_Summary_${res.period}`;
      if (type === 'png') { await exportToPng(voucherRef, fname); return; }
      const netAbs = fmtNDec(Math.abs(res.net));
      const netLabel = res.net < 0 ? `(${netAbs})` : netAbs;
      const netTag = res.net < 0 ? 'Tax Receivable' : 'Tax Payable';
      const line = (name, inc, excl, vat, cls = '') =>
        `<tr class="${cls}"><td>${name}</td><td class="num">${inc}</td><td class="num">${excl}</td><td class="num">${vat}</td></tr>`;
      const dash = '-';
      const html = `
        ${res.company ? `<p style="text-align:center;font-weight:700;font-size:13px;margin:0 0 2px;">${escapeHtml(res.company)}</p>` : ''}
        <h2 style="text-align:center;">VAT SUMMARY ${escapeHtml(rLabel)}</h2>
        <table>
          <thead><tr><th>SUMMARY</th><th class="num">INC</th><th class="num">EXCL</th><th class="num">VAT</th></tr></thead>
          <tbody>
            ${line('SALES', fmtNDec(res.sales.inc), fmtNDec(res.sales.excl), fmtNDec(res.sales.vat))}
            ${line('NON CREDITABLE SALES', '', res.nonCredSalesN ? fmtNDec(res.nonCredSalesN) : dash, '')}
            ${line('EXEMPT SALES', '', res.exemptSalesN ? fmtNDec(res.exemptSalesN) : dash, '')}
            ${line('TOTAL SALES', '', fmtNDec(res.totalSalesExcl), '', 'subtotal')}
            ${line('PURCHASES', fmtNDec(res.purchases.inc), fmtNDec(res.purchases.excl), fmtNDec(res.purchases.vat))}
            ${line('PURCHASES (IMPORT)', res.imports.inc ? fmtNDec(res.imports.inc) : dash, res.imports.inc ? fmtNDec(res.imports.excl) : dash, res.imports.inc ? fmtNDec(res.imports.vat) : dash)}
            ${line('INDIRECT EXPENSES', fmtNDec(res.indirect.inc), fmtNDec(res.indirect.excl), fmtNDec(res.indirect.vat))}
            ${line('NON CRED', '', res.nonCredN ? fmtNDec(res.nonCredN) : dash, '')}
            ${line('EXEMPT', '', res.exemptPurchN ? fmtNDec(res.exemptPurchN) : dash, '')}
            ${line('VAT WITHHELD', '', '', res.vatWithheldN ? fmtNDec(res.vatWithheldN) : dash)}
            ${line('BALANCE C/F', '', '', fmtNDec(res.balanceCfN))}
            <tr class="net"><td>PAYABLE/REFUNDABLE</td><td class="num"></td><td class="num"></td><td class="num">${netLabel}</td></tr>
          </tbody>
        </table>
        <p style="text-align:right;font-style:italic;font-size:11px;margin:6px 2px 0;color:#6b7280;">${netTag}</p>
      `;
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(fname)}</title><style>@page{size:A4 portrait;margin:14mm;}body{font-family:Arial,sans-serif;margin:0;color:#111827;font-size:11px;}h2{margin:0 0 10px;font-size:14px;}table{border-collapse:collapse;width:100%;}th,td{padding:5px 8px;border:1px solid #d1d5db;font-size:11px;}th{background:#f3f4f6;font-weight:700;text-align:left;}th.num,td.num{text-align:right;font-family:monospace;}tr.subtotal td{background:#f9fafb;font-weight:600;}tr.net td{background:#fef08a;font-weight:700;font-size:12px;}</style></head><body>${html}</body></html>`;
      const w = window.open('', '_blank', 'width=720,height=800');
      if (!w) return;
      w.document.write(fullHtml);
      w.document.close();
      w.onload = () => { w.focus(); w.print(); };
    } finally {
      setExporting(false);
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

  // Standard-rated line: all three columns editable. Type in any one (INC/EXCL/VAT)
  // and the other two derive. The entered column is highlighted; derived ones are muted.
  function StandardLine({ label, line, onChange }) {
    const c = computeLine(line);
    const hasVal = line.v !== '' && c.n !== 0;
    const cellBase = 'w-full px-2.5 py-1.5 text-right rounded-lg border text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition';
    function cell(col) {
      const isSource = line.b === col;
      const display = isSource ? line.v : (hasVal ? fmtNDec(col === 'inc' ? c.inc : col === 'excl' ? c.excl : c.vat) : '');
      return (
        <input
          type="text" inputMode="decimal" value={display}
          onChange={e => onChange({ v: formatMoney(e.target.value), b: col })}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
          placeholder="0"
          className={cn(cellBase, isSource
            ? 'border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-medium'
            : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-gray-500 dark:text-gray-400')}
        />
      );
    }
    return (
      <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="sm:hidden text-sm text-gray-700 dark:text-gray-300 mb-1.5">{label}</div>
        <div className="grid grid-cols-3 sm:grid-cols-[1fr_11rem_9rem_9rem] gap-2 sm:gap-3 items-center">
          <span className="hidden sm:block text-sm text-gray-700 dark:text-gray-300">{label}</span>
          {[['inc', 'INC'], ['excl', 'EXCL'], ['vat', 'VAT']].map(([col, cap]) => (
            <div key={col}>
              <div className="sm:hidden text-[10px] text-gray-400 mb-0.5 text-right pr-1">{cap}</div>
              {cell(col)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // A row in the editable form. `driver` = which column is editable ('inc' | 'excl' | 'vat').
  function FormRow({ label, value, onChange, split, driver = 'inc', signed = false, bold = false }) {
    return (
      <div className={cn('grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_11rem_9rem_9rem] items-center gap-x-3 gap-y-1 px-4 py-2 border-b border-gray-100 dark:border-gray-800', bold && 'bg-gray-50 dark:bg-gray-800/40')}>
        <span className={cn('text-sm', bold ? 'font-semibold text-gray-800 dark:text-gray-200' : 'text-gray-700 dark:text-gray-300')}>{label}</span>
        {/* INC */}
        <div className="justify-self-end sm:justify-self-stretch">
          {driver === 'inc' ? (
            <input type="text" inputMode="decimal" value={value}
              onChange={e => onChange(signed ? formatMoney(e.target.value) : formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} placeholder="0" className={inputCls} />
          ) : <span className="hidden sm:block text-right text-xs text-gray-300 dark:text-gray-600 pr-2">—</span>}
        </div>
        {/* EXCL */}
        <div className="hidden sm:block justify-self-stretch">
          {driver === 'excl' ? (
            <input type="text" inputMode="decimal" value={value}
              onChange={e => onChange(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} placeholder="0" className={inputCls} />
          ) : driver === 'inc' ? (
            <span className="block text-right text-sm tabular-nums text-gray-500 dark:text-gray-400 pr-2">{split && split.inc ? fmtNDec(split.excl) : '—'}</span>
          ) : <span className="block text-right text-xs text-gray-300 dark:text-gray-600 pr-2">—</span>}
        </div>
        {/* VAT */}
        <div className="hidden sm:block justify-self-stretch">
          {driver === 'vat' ? (
            <input type="text" inputMode="decimal" value={value}
              onChange={e => onChange(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }} placeholder="0" className={inputCls} />
          ) : driver === 'inc' ? (
            <span className="block text-right text-sm tabular-nums font-medium text-blue-600 dark:text-blue-400 pr-2">{split && split.inc ? fmtNDec(split.vat) : '—'}</span>
          ) : <span className="block text-right text-xs text-gray-300 dark:text-gray-600 pr-2">—</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period + company */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Period</label>
          <input type="month" value={period} onChange={e => e.target.value && switchPeriod(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>
        <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Client / company name (optional)"
          className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <RateBadge rate={rate} />
        </div>
      </div>

      {/* Editable summary table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1fr_11rem_9rem_9rem] gap-x-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>Summary</span>
          <span className="text-right pr-2">Inc</span>
          <span className="text-right pr-2">Excl</span>
          <span className="text-right pr-2">VAT</span>
        </div>

        <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Output — Sales</p>
        </div>
        <StandardLine label="Sales" line={sales} onChange={setSales} />
        <FormRow label="Non Creditable Sales" value={nonCredSales} onChange={setNonCredSales} driver="excl" />
        <FormRow label="Exempt Sales" value={exemptSales} onChange={setExemptSales} driver="excl" />
        {/* Total Sales — read-only computed (EXCL column only) */}
        <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_11rem_9rem_9rem] items-center gap-x-3 px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Total Sales (excl.)</span>
          <span className="hidden sm:block" />
          <span className="justify-self-end sm:justify-self-stretch text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-white pr-2">{fmtNDec(totalSalesExcl)}</span>
          <span className="hidden sm:block text-right text-xs text-gray-300 dark:text-gray-600 pr-2">—</span>
        </div>

        <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 border-y border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Input — Purchases &amp; Expenses</p>
        </div>
        <StandardLine label="Purchases" line={purchases} onChange={setPurch} />
        <StandardLine label="Purchases (Import)" line={imports} onChange={setImports} />
        <StandardLine label="Indirect Expenses" line={indirect} onChange={setIndirect} />
        <FormRow label="Non Cred" value={nonCred} onChange={setNonCred} driver="excl" />
        <FormRow label="Exempt" value={exemptPurch} onChange={setExemptPurch} driver="excl" />

        <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-800/40 border-y border-gray-100 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Adjustments</p>
        </div>
        <FormRow label="VAT Withheld" value={vatWithheld} onChange={setVatWithheld} driver="vat" />
        <FormRow label="Balance C/F (− = credit)" value={balanceCf} onChange={setBalanceCf} driver="vat" signed />

        {/* Net position */}
        <div className={cn('flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-300', flash ? 'bg-yellow-200/70 dark:bg-yellow-900/30' : 'bg-yellow-100 dark:bg-yellow-900/20')}>
          <span className="text-sm font-bold text-gray-900 dark:text-white">Payable / Refundable</span>
          <div className="flex items-center gap-2">
            <span className={cn('text-base font-bold tabular-nums', net < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white')}>
              {net < 0 ? `(${fmtNDec(Math.abs(net))})` : fmtNDec(net)}
            </span>
            <span className="text-[11px] italic text-gray-500 dark:text-gray-400 whitespace-nowrap">{net < 0 ? 'Tax Receivable' : 'Tax Payable'}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <CalcButton onClick={handleCalculate}>Calculate &amp; Preview</CalcButton>
        <CalcButton onClick={handleReset} variant="secondary">Reset</CalcButton>
        {res && (
          <>
            <button onClick={() => handleExport('png')} disabled={exporting} className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">PNG</button>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">PDF</button>
          </>
        )}
      </div>

      {/* Exportable preview (white, matches the shared template) */}
      {res && (
        <div ref={voucherRef} className="bg-white border border-gray-200 rounded-xl p-5 text-sm text-gray-900">
          {res.company && <p className="text-center font-bold text-base mb-0.5">{res.company}</p>}
          <p className="text-center font-bold text-base mb-3">VAT SUMMARY {periodLabel}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                {['SUMMARY', 'INC', 'EXCL', 'VAT'].map((h, i) => (
                  <th key={h} style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: i === 0 ? 'left' : 'right', fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: 'SALES', inc: fmtNDec(res.sales.inc), excl: fmtNDec(res.sales.excl), vat: fmtNDec(res.sales.vat) },
                { name: 'NON CREDITABLE SALES', inc: '', excl: res.nonCredSalesN ? fmtNDec(res.nonCredSalesN) : '-', vat: '' },
                { name: 'EXEMPT SALES', inc: '', excl: res.exemptSalesN ? fmtNDec(res.exemptSalesN) : '-', vat: '' },
                { name: 'TOTAL SALES', inc: '', excl: fmtNDec(res.totalSalesExcl), vat: '', bg: '#f9fafb', bold: true },
                { name: 'PURCHASES', inc: fmtNDec(res.purchases.inc), excl: fmtNDec(res.purchases.excl), vat: fmtNDec(res.purchases.vat) },
                { name: 'PURCHASES (IMPORT)', inc: res.imports.inc ? fmtNDec(res.imports.inc) : '-', excl: res.imports.inc ? fmtNDec(res.imports.excl) : '-', vat: res.imports.inc ? fmtNDec(res.imports.vat) : '-' },
                { name: 'INDIRECT EXPENSES', inc: fmtNDec(res.indirect.inc), excl: fmtNDec(res.indirect.excl), vat: fmtNDec(res.indirect.vat) },
                { name: 'NON CRED', inc: '', excl: res.nonCredN ? fmtNDec(res.nonCredN) : '-', vat: '' },
                { name: 'EXEMPT', inc: '', excl: res.exemptPurchN ? fmtNDec(res.exemptPurchN) : '-', vat: '' },
                { name: 'VAT WITHHELD', inc: '', excl: '', vat: res.vatWithheldN ? fmtNDec(res.vatWithheldN) : '-' },
                { name: 'BALANCE C/F', inc: '', excl: '', vat: fmtNDec(res.balanceCfN) },
              ].map(row => (
                <tr key={row.name} style={{ background: row.bg || 'transparent' }}>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', fontWeight: row.bold ? 600 : 400 }}>{row.name}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontFamily: 'monospace' }}>{row.inc}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontFamily: 'monospace', fontWeight: row.bold ? 600 : 400 }}>{row.excl}</td>
                  <td style={{ padding: '5px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontFamily: 'monospace' }}>{row.vat}</td>
                </tr>
              ))}
              <tr style={{ background: '#fef08a' }}>
                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>PAYABLE/REFUNDABLE</td>
                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}></td>
                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db' }}></td>
                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                  {res.net < 0 ? `(${fmtNDec(Math.abs(res.net))})` : fmtNDec(res.net)}
                </td>
              </tr>
            </tbody>
          </table>
          <p style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '11px', marginTop: '6px', color: '#6b7280' }}>{res.net < 0 ? 'Tax Receivable' : 'Tax Payable'}</p>
        </div>
      )}
    </div>
  );
}

// ─── Provisional Tax Section ──────────────────────────────────────────────────

const PROV_QUARTERS = [['Q1', '31 Mar'], ['Q2', '30 Jun'], ['Q3', '30 Sep'], ['Q4', '31 Dec']];

function ProvisionalSection({ taxRates }) {
  const provBands = taxRates.PROV_BANDS;
  const corpRate  = taxRates.CORPORATE;

  const [payer, setPayer] = useState('individual'); // 'individual' | 'corporate'
  const [mode,  setMode]  = useState('forward');    // 'forward' (profit→tax) | 'reverse' (tax→profit)
  const [profit, onProfit] = useMoneyInput('');
  const [target, onTarget] = useMoneyInput('');
  const profitN = parseMoneyStr(profit);
  const targetN = parseMoneyStr(target);
  const [res, setRes]     = useState(null);
  const [flash, setFlash] = useState(false);

  const isCorp = payer === 'corporate';

  function handleCalc() {
    if (mode === 'forward') {
      if (!profitN || profitN <= 0) { alert('Enter the annual profit.'); return; }
      const tax = isCorp ? profitN * corpRate : calcBandTax(profitN, provBands);
      setRes({ kind: 'forward', profit: profitN, tax, quarterly: tax / 4, eff: profitN ? tax / profitN : 0 });
    } else {
      if (!targetN || targetN <= 0) { alert('Enter the target tax amount.'); return; }
      const p = isCorp ? targetN / corpRate : calcBandReverse(targetN, provBands);
      setRes({ kind: 'reverse', target: targetN, profit: p, quarterly: targetN / 4 });
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }

  // Which band the calculated profit falls in (individual + forward only)
  const activeBand = (!isCorp && res?.kind === 'forward')
    ? provBands.findIndex(b => res.profit >= b.min && (b.max == null || b.max === Infinity || res.profit <= b.max))
    : -1;

  const segBtn = (active) => cn(
    'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition text-center leading-tight',
    active
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/50'
  );
  const modeBtn = (active) => cn(
    'flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition',
    active
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/60 dark:hover:bg-gray-700/50'
  );

  return (
    <div className="space-y-4">
      {/* Taxpayer type */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
        <button onClick={() => { setPayer('individual'); setRes(null); }} className={segBtn(!isCorp)}>
          Individual<span className="block text-[10px] font-normal opacity-70">Progressive bands</span>
        </button>
        <button onClick={() => { setPayer('corporate'); setRes(null); }} className={segBtn(isCorp)}>
          Corporate<span className="block text-[10px] font-normal opacity-70">Flat {(corpRate * 100).toFixed(0)}%</span>
        </button>
      </div>

      {/* Calculator */}
      <CalcCard title={`Provisional Tax — ${isCorp ? 'Corporate' : 'Individual'}`}>
        {/* Direction toggle */}
        <div className="flex gap-1 p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button onClick={() => { setMode('forward'); setRes(null); }} className={modeBtn(mode === 'forward')}>Profit → Tax</button>
          <button onClick={() => { setMode('reverse'); setRes(null); }} className={modeBtn(mode === 'reverse')}>Target Tax → Profit</button>
        </div>

        {mode === 'forward'
          ? <MoneyInput label="Annual Profit (TZS)" value={profit} onChange={onProfit} />
          : <MoneyInput label="Desired Annual Tax (TZS)" value={target} onChange={onTarget} />}

        <CalcButton onClick={handleCalc}>Calculate</CalcButton>

        {/* Forward result */}
        {res?.kind === 'forward' && (
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
            <div className={cn('grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 transition-colors duration-500', flash && 'bg-yellow-50 dark:bg-yellow-900/10')}>
              {[
                { label: 'Annual Tax', value: fmtN(Math.round(res.tax)), color: 'text-red-600 dark:text-red-400' },
                { label: 'Per Quarter', value: fmtN(Math.round(res.quarterly)), color: 'text-blue-600 dark:text-blue-400' },
                { label: 'Effective Rate', value: `${(res.eff * 100).toFixed(1)}%`, color: 'text-green-600 dark:text-green-400' },
              ].map(t => (
                <div key={t.label} className="px-2 py-3.5 text-center">
                  <p className={cn('text-base sm:text-lg font-bold tabular-nums leading-tight break-words', t.color)}>{t.value}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{t.label}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quarterly Instalments</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROV_QUARTERS.map(([q, d]) => (
                  <div key={q} className="rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 px-2 py-2 text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">{q} · {d}</p>
                    <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white mt-0.5">{fmtN(Math.round(res.quarterly))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reverse result */}
        {res?.kind === 'reverse' && (
          <div className={cn('rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden grid grid-cols-2 divide-x divide-gray-100 dark:divide-gray-800 transition-colors duration-500', flash && 'bg-yellow-50 dark:bg-yellow-900/10')}>
            <div className="px-3 py-4 text-center">
              <p className="text-base sm:text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400 leading-tight break-words">{fmtN(Math.round(res.profit))}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">Required Annual Profit</p>
            </div>
            <div className="px-3 py-4 text-center">
              <p className="text-base sm:text-lg font-bold tabular-nums text-gray-900 dark:text-white leading-tight break-words">{fmtN(Math.round(res.quarterly))}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">Per Quarter</p>
            </div>
          </div>
        )}
      </CalcCard>

      {/* Reference — bands (individual) or flat-rate note (corporate) */}
      {isCorp ? (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Flat {(corpRate * 100).toFixed(0)}% on all taxable profit</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">No bands for companies — configurable in Settings → Tax Rates.</p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Individual Tax Bands · Annual</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="text-left px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">Annual Income (TZS)</th>
                  <th className="text-right px-4 py-2 text-gray-500 font-semibold whitespace-nowrap">Rate</th>
                </tr>
              </thead>
              <tbody>
                {provBands.map((b, i) => (
                  <tr key={i} className={cn('border-t border-gray-100 dark:border-gray-800 transition-colors', i === activeBand && 'bg-blue-50 dark:bg-blue-900/20')}>
                    <td className="px-4 py-2 text-gray-700 dark:text-gray-300 tabular-nums whitespace-nowrap">
                      {fmtN(b.min)}{b.max != null && b.max !== Infinity ? ` – ${fmtN(b.max)}` : ' and above'}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <span className={cn('font-semibold tabular-nums', b.rate === 0 ? 'text-gray-400 dark:text-gray-500' : 'text-blue-700 dark:text-blue-400')}>{(b.rate * 100).toFixed(0)}%</span>
                      {i === activeBand && <span className="ml-2 text-[10px] font-bold text-blue-600 dark:text-blue-300">◄ your band</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Due dates */}
      <p className="text-xs text-gray-500 dark:text-gray-400 px-1">
        Quarterly instalments due: <strong className="text-gray-700 dark:text-gray-300">31 Mar · 30 Jun · 30 Sep · 31 Dec</strong>. Rates configurable in Settings → Tax Rates.
      </p>
    </div>
  );
}

// ─── WHT Section ─────────────────────────────────────────────────────────────

const WHT_CAT_LABEL = Object.fromEntries(WHT_CATEGORIES.map(c => [c.key, c.label]));

// Rate → chip colour, so the reference scans quickly by band.
function whtRateChip(rate) {
  if (rate >= 15) return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300';
  if (rate >= 10) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300';
  if (rate >= 5)  return 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300';
  return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300';
}

function WHTSection() {
  const [category, setCategory]     = useState('ind_res');
  const [selectedCode, setSelected] = useState(() => WHT_SCHEDULE.find(e => e.category === 'ind_res')?.code);
  const [search, setSearch]         = useState('');
  const [grossStr, onGross, grossN] = useMoneyInput('');
  const [refSearch, setRefSearch]   = useState('');
  const [showRef, setShowRef]       = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);

  // Close the payment-type dropdown when clicking outside it.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = e => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [pickerOpen]);

  const catItems = useMemo(() => WHT_SCHEDULE.filter(e => e.category === category), [category]);
  const listItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? catItems.filter(e => e.name.toLowerCase().includes(q) || e.code.includes(q)) : catItems;
  }, [catItems, search]);

  const selected    = WHT_SCHEDULE.find(e => e.code === selectedCode) || catItems[0];
  const rateFrac    = selected ? selected.rate / 100 : 0;
  const whtAmount   = grossN * rateFrac;
  const netPayment  = grossN - whtAmount;
  const hasGross    = grossN > 0;

  function pickCategory(key) {
    setCategory(key);
    setSearch('');
    setSelected(WHT_SCHEDULE.find(e => e.category === key)?.code);
  }

  const refFiltered = useMemo(() => {
    const q = refSearch.trim().toLowerCase();
    if (!q) return WHT_SCHEDULE;
    return WHT_SCHEDULE.filter(e =>
      e.name.toLowerCase().includes(q) || e.code.includes(q) || WHT_CAT_LABEL[e.category].toLowerCase().includes(q)
    );
  }, [refSearch]);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">WHT is charged on the gross payment <strong>exclusive of VAT</strong>. Rates follow the TRA GFS schedule — pick the payer category and payment type below.</p>
      </div>

      <CalcCard title="Withholding Tax Calculator">
        {/* Payer category */}
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payer Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {WHT_CATEGORIES.map(c => (
              <button
                key={c.key}
                onClick={() => pickCategory(c.key)}
                className={cn(
                  'py-2 px-2 rounded-xl text-xs font-semibold transition text-center leading-tight border',
                  category === c.key
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                {c.short}
              </button>
            ))}
          </div>
        </div>

        {/* Payment type — searchable dropdown */}
        <div className="space-y-1.5" ref={pickerRef}>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
            Payment Type <span className="text-gray-400 dark:text-gray-500 font-normal">· {catItems.length} in {WHT_CAT_LABEL[category]}</span>
          </label>
          <div className="relative">
            {/* Trigger */}
            <button
              type="button"
              onClick={() => { setPickerOpen(o => !o); setSearch(''); }}
              className={cn('w-full flex items-center justify-between gap-3 pl-3.5 pr-3 py-2.5 rounded-xl border bg-white dark:bg-gray-900 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500',
                pickerOpen ? 'border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/30' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-900 dark:text-white truncate">{selected ? selected.name : 'Select payment type'}</span>
                {selected && <span className="block text-[10px] text-gray-400 dark:text-gray-500 font-mono">GFS {selected.code}</span>}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {selected && <span className={cn('text-xs font-bold px-2 py-0.5 rounded-full tabular-nums', whtRateChip(selected.rate))}>{selected.rate}%</span>}
                <svg className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', pickerOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </span>
            </button>

            {/* Dropdown panel */}
            {pickerOpen && (
              <div className="absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg dark:shadow-black/40 overflow-hidden">
                <div className="relative p-2 border-b border-gray-100 dark:border-gray-800">
                  <svg className="w-4 h-4 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Escape') setPickerOpen(false); }}
                    placeholder="Search e.g. royalties, rent, 11121119…"
                    className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                  {listItems.length === 0 && (
                    <p className="px-3 py-4 text-xs text-gray-400 text-center">No payment types match “{search}”.</p>
                  )}
                  {listItems.map(e => {
                    const active = e.code === selectedCode;
                    return (
                      <button
                        key={e.code}
                        onClick={() => { setSelected(e.code); setPickerOpen(false); setSearch(''); }}
                        className={cn('w-full flex items-center justify-between gap-3 px-3 py-2 text-left transition',
                          active ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50')}
                      >
                        <span className="min-w-0">
                          <span className={cn('block text-sm leading-snug', active ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300')}>{e.name}</span>
                          <span className="block text-[10px] text-gray-400 dark:text-gray-500 font-mono mt-0.5">GFS {e.code}</span>
                        </span>
                        <span className={cn('flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full tabular-nums', whtRateChip(e.rate))}>{e.rate}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <MoneyInput label="Gross Payment excl. VAT (TZS)" value={grossStr} onChange={onGross} />

        {/* Result */}
        {selected && (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{selected.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">GFS {selected.code} · {WHT_CAT_LABEL[selected.category]}</p>
              </div>
              <span className={cn('flex-shrink-0 text-sm font-bold px-2.5 py-1 rounded-full tabular-nums', whtRateChip(selected.rate))}>{selected.rate}%</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800">
              {[
                { label: 'Withholding Tax', value: hasGross ? fmt(whtAmount) : '—', color: 'text-red-600 dark:text-red-400' },
                { label: 'Net to Vendor',   value: hasGross ? fmt(netPayment) : '—', color: 'text-green-600 dark:text-green-400' },
                { label: 'Gross (excl VAT)', value: hasGross ? fmt(grossN) : '—', color: 'text-gray-900 dark:text-white' },
              ].map(t => (
                <div key={t.label} className="px-2 py-3.5 text-center">
                  <p className={cn('text-sm sm:text-base font-bold tabular-nums leading-tight break-words', t.color)}>{t.value}</p>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">WHT returns and payment are due by the <strong>7th of the following month</strong>.</p>
      </CalcCard>

      {/* Full GFS rate reference — collapsible, searchable */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <button
          onClick={() => setShowRef(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">Full WHT Rate Reference</span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">· TRA GFS · {WHT_SCHEDULE.length} codes</span>
          </span>
          <svg className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200', showRef && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>

        {showRef && (
          <div className="px-4 pb-4 pt-1 space-y-3">
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={refSearch}
                onChange={e => setRefSearch(e.target.value)}
                placeholder="Search all 114 codes — name, GFS code or category…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              />
            </div>

            {WHT_CATEGORIES.map(cat => {
              const items = refFiltered.filter(e => e.category === cat.key);
              if (items.length === 0) return null;
              return (
                <div key={cat.key}>
                  <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 mt-1">{cat.label} <span className="text-gray-300 dark:text-gray-600 font-medium">· {items.length}</span></h4>
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-xs">
                      <tbody>
                        {items.map(e => (
                          <tr key={e.code} className={cn('border-t first:border-t-0 border-gray-100 dark:border-gray-800',
                            e.code === selectedCode && e.category === category && 'bg-blue-50 dark:bg-blue-900/20')}>
                            <td className="px-3 py-1.5 font-mono text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap align-top w-20">{e.code}</td>
                            <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300">{e.name}</td>
                            <td className="px-3 py-1.5 text-right whitespace-nowrap w-14">
                              <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded tabular-nums', whtRateChip(e.rate))}>{e.rate}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {refFiltered.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">No codes match “{refSearch}”.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Employment Section ───────────────────────────────────────────────────────

const EMP_TABS = ['PAYE', 'NSSF', 'SDL', 'WCF'];

function PayslipSection({ taxRates }) {
  const [company, setCompany] = useState('');
  const [empName, setEmpName] = useState('');
  const [basic, onBasic, basicN] = useMoneyInput('');
  const [transport, onTransport, transportN] = useMoneyInput('');
  const [food, onFood, foodN] = useMoneyInput('');
  const [housing, onHousing, housingN] = useMoneyInput('');
  const [cashInLieu, onCashInLieu, cashInLieuN] = useMoneyInput('');
  const [overtime, onOvertime, overtimeN] = useMoneyInput('');
  const [salaryAdvance, onSalaryAdvance, salaryAdvanceN] = useMoneyInput('');
  const [loan, onLoan, loanN] = useMoneyInput('');
  const [month, setMonth] = useState(format(new Date(), 'MMMM yyyy'));
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const voucherRef = useRef(null);

  function handleCalculate() {
    if (!basicN) { alert('Please enter Basic Salary.'); return; }
    const gross = basicN + transportN + foodN + housingN + cashInLieuN + overtimeN;
    const { nssfEmployee, taxableIncome, paye, netPay: baseNet } = calcPaye(gross, taxRates.PAYE_BANDS, taxRates.NSSF_EMPLOYEE);
    const totalDeductions = nssfEmployee + paye + salaryAdvanceN + loanN;
    const netPay = gross - totalDeductions;
    const nssfEmployer = gross * taxRates.NSSF_EMPLOYER;
    const sdl = gross * taxRates.SDL;
    const wcf = gross * taxRates.WCF;
    const totalCTC = gross + nssfEmployer + wcf;
    setRes({ gross, nssfEmployee, taxableIncome, paye, netPay, totalDeductions, nssfEmployer, sdl, wcf, totalCTC, month, company, empName, basicN, transportN, foodN, housingN, cashInLieuN, overtimeN, salaryAdvanceN, loanN });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    setTimeout(() => voucherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }

  const dash = v => v > 0 ? fmtN(v) : '-';

  async function handleExport(type) {
    setExporting(true);
    try {
      const fname = `Payslip_${res.month.replace(' ', '_')}`;
      if (type === 'png') await exportToPng(voucherRef, fname);
      else {
        const html = `
          ${res.company ? `<p style="text-align:center;font-weight:700;font-size:13px;margin-bottom:4px;">${escapeHtml(res.company)}</p>` : ''}
          <h2 style="text-align:center;">SALARY VOUCHER</h2>
          <p style="text-align:center;margin-bottom:12px;">MONTH OF ${escapeHtml(res.month.toUpperCase())}</p>
          ${res.empName ? `<p style="margin-bottom:8px;"><strong>NAME:</strong> ${escapeHtml(res.empName)}</p>` : ''}
          <table>
            <tbody>
              <tr><td>BASIC SALARY</td><td class="num">${fmtN(res.basicN)}</td></tr>
              <tr><td>TRANSPORT ALLOWANCE</td><td class="num">${dash(res.transportN)}</td></tr>
              <tr><td>FOOD ALLOWANCE</td><td class="num">${dash(res.foodN)}</td></tr>
              <tr><td>HOUSING ALLOWANCE</td><td class="num">${dash(res.housingN)}</td></tr>
              <tr><td>CASH IN LIEU OF LEAVE</td><td class="num">${dash(res.cashInLieuN)}</td></tr>
              <tr><td>OVERTIME</td><td class="num">${dash(res.overtimeN)}</td></tr>
              <tr class="total"><td>TOTAL EARNINGS</td><td class="num">${fmtN(res.gross)}</td></tr>
              <tr class="spacer"><td colspan="2"></td></tr>
              <tr><td>TAXABLE PAY</td><td class="num">${fmtN(res.taxableIncome)}</td></tr>
              <tr class="spacer"><td colspan="2"></td></tr>
              <tr class="section-hdr"><td colspan="2">DEDUCTION</td></tr>
              <tr><td>P.A.Y.E</td><td class="num">${fmtN(res.paye)}</td></tr>
              <tr><td>Less Relief</td><td class="num">-</td></tr>
              <tr><td>N.S.S.F</td><td class="num">${fmtN(res.nssfEmployee)}</td></tr>
              <tr><td>Salary Advance</td><td class="num">${dash(res.salaryAdvanceN)}</td></tr>
              <tr><td>Loan</td><td class="num">${dash(res.loanN)}</td></tr>
              <tr class="total"><td>TOTAL DEDUCTIONS</td><td class="num">${fmtN(res.totalDeductions)}</td></tr>
              <tr class="net"><td>NET PAY</td><td class="num">${fmtN(res.netPay)}</td></tr>
              <tr class="spacer"><td colspan="2"></td></tr>
              <tr class="section-hdr"><td colspan="2">COST TO COMPANY</td></tr>
              <tr><td>Gross Pay</td><td class="num">${fmtN(res.gross)}</td></tr>
              <tr><td>NSSF Employer (${(taxRates.NSSF_EMPLOYER*100).toFixed(0)}%)</td><td class="num">${fmtN(res.nssfEmployer)}</td></tr>
              <tr><td>WCF (${(taxRates.WCF*100).toFixed(1)}%)</td><td class="num">${fmtN(res.wcf)}</td></tr>
              <tr class="ctc"><td>TOTAL CTC</td><td class="num">${fmtN(res.totalCTC)}</td></tr>
            </tbody>
          </table>`;
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(fname)}</title><style>@page{size:A5 portrait;margin:15mm;}body{font-family:Arial,sans-serif;color:#111;font-size:11px;margin:0;}h2{margin:0 0 2px;font-size:13px;text-align:center;}p{margin:0 0 4px;}table{border-collapse:collapse;width:100%;}td{padding:3px 6px;border:1px solid #aaa;font-size:11px;}td.num{text-align:right;font-family:monospace;}tr.total td{font-weight:700;background:#f3f4f6;border-top:2px solid #000;}tr.net td{font-weight:700;font-size:13px;background:#d1fae5;border-top:2px solid #000;}tr.ctc td{font-weight:700;background:#dbeafe;border-top:2px solid #1d4ed8;}tr.spacer td{border:none;height:6px;}tr.section-hdr td{font-weight:700;background:#e5e7eb;}</style></head><body>${html}</body></html>`;
        const w = window.open('', '_blank', 'width=480,height=700');
        if (!w) return;
        w.document.write(fullHtml);
        w.document.close();
        w.onload = () => { w.focus(); w.print(); };
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CalcCard title="PAYE Payslip Generator">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Company Name</label>
            <input value={company} onChange={e => setCompany(e.target.value)} placeholder="(optional)" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Employee Name</label>
            <input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="(optional)" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Payslip Month</label>
            <input type="month" defaultValue={format(new Date(), 'yyyy-MM')} onChange={e => { if (!e.target.value) return; const d = new Date(e.target.value + '-01'); setMonth(format(d, 'MMMM yyyy')); }} className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
          <MoneyInput label="Basic Salary (TZS) *" value={basic} onChange={onBasic} />
          <MoneyInput label="Transport Allowance" value={transport} onChange={onTransport} />
          <MoneyInput label="Food Allowance" value={food} onChange={onFood} />
          <MoneyInput label="Housing Allowance" value={housing} onChange={onHousing} />
          <MoneyInput label="Cash in Lieu of Leave" value={cashInLieu} onChange={onCashInLieu} />
          <MoneyInput label="Overtime" value={overtime} onChange={onOvertime} />
          <MoneyInput label="Salary Advance" value={salaryAdvance} onChange={onSalaryAdvance} />
          <MoneyInput label="Loan" value={loan} onChange={onLoan} />
        </div>
        <div className="flex gap-2">
          <CalcButton onClick={handleCalculate}>Generate Payslip</CalcButton>
          <CalcButton onClick={() => { setRes(null); }} variant="secondary">Reset</CalcButton>
        </div>

        {res && (
          <div className={cn('space-y-0.5 rounded-xl p-3 border transition-colors duration-300', flash ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700/40' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800')}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Summary</h4>
            <ResultRow label="Total Earnings" value={fmtN(res.gross)} color="bold" flash={flash} />
            <ResultRow label={`NSSF (${(taxRates.NSSF_EMPLOYEE*100).toFixed(0)}%)`} value={`− ${fmtN(res.nssfEmployee)}`} color="red" flash={flash} />
            <ResultRow label="Taxable Pay" value={fmtN(res.taxableIncome)} flash={flash} />
            <ResultRow label="PAYE" value={`− ${fmtN(res.paye)}`} color="red" flash={flash} />
            <ResultRow label="Total Deductions" value={fmtN(res.totalDeductions)} color="red" flash={flash} />
            <ResultRow label="Net Pay" value={fmtN(res.netPay)} color="green" flash={flash} />
          </div>
        )}
      </CalcCard>

      {/* Salary Voucher */}
      {res && (
        <div>
          <div ref={voucherRef} className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="text-center py-4 px-5 border-b border-gray-200 dark:border-gray-700">
              {res.company && <p className="text-sm font-bold text-gray-900 dark:text-white uppercase">{res.company}</p>}
              <p className="text-base font-bold text-gray-900 dark:text-white tracking-wide">SALARY VOUCHER</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">MONTH OF {res.month.toUpperCase()}</p>
            </div>
            {res.empName && <div className="px-5 py-2 border-b border-gray-100 dark:border-gray-800 text-sm"><span className="font-semibold text-gray-700 dark:text-gray-300">NAME: </span><span className="text-gray-900 dark:text-white">{res.empName}</span></div>}

            {/* Voucher table */}
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['BASIC SALARY', res.basicN],
                  ['TRANSPORT ALLOWANCE', res.transportN],
                  ['FOOD ALLOWANCE', res.foodN],
                  ['HOUSING ALLOWANCE', res.housingN],
                  ['CASH IN LIEU OF LEAVE', res.cashInLieuN],
                  ['OVERTIME', res.overtimeN],
                ].map(([label, val]) => (
                  <tr key={label} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-1.5 text-gray-700 dark:text-gray-300">{label}</td>
                    <td className="px-5 py-1.5 text-right tabular-nums text-gray-900 dark:text-white w-32">{val > 0 ? fmtN(val) : <span className="text-gray-400">-</span>}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <td className="px-5 py-2 font-bold text-gray-900 dark:text-white">TOTAL EARNINGS</td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtN(res.gross)}</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="px-5 py-1.5 text-gray-600 dark:text-gray-400">TAXABLE PAY</td>
                  <td className="px-5 py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{fmtN(res.taxableIncome)}</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/40">
                  <td colSpan={2} className="px-5 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">DEDUCTION</td>
                </tr>
                {[
                  ['P.A.Y.E', res.paye],
                  ['Less Relief', 0],
                  ['N.S.S.F', res.nssfEmployee],
                  ['Salary Advance', res.salaryAdvanceN],
                  ['Loan', res.loanN],
                ].map(([label, val]) => (
                  <tr key={label} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-1.5 text-gray-700 dark:text-gray-300">{label}</td>
                    <td className="px-5 py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{val > 0 ? fmtN(val) : <span className="text-gray-400">-</span>}</td>
                  </tr>
                ))}
                <tr className="border-b-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50">
                  <td className="px-5 py-2 font-bold text-gray-900 dark:text-white">TOTAL DEDUCTIONS</td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums text-gray-900 dark:text-white">{fmtN(res.totalDeductions)}</td>
                </tr>
                <tr className="bg-green-50 dark:bg-green-900/20">
                  <td className="px-5 py-3 font-bold text-green-800 dark:text-green-300 text-base">NET PAY</td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums text-green-700 dark:text-green-400 text-base">{fmtN(res.netPay)}</td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-800/40">
                  <td colSpan={2} className="px-5 py-1.5 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">COST TO COMPANY</td>
                </tr>
                {[
                  ['Gross Pay', res.gross],
                  [`NSSF Employer (${(taxRates.NSSF_EMPLOYER*100).toFixed(0)}%)`, res.nssfEmployer],
                  [`WCF (${(taxRates.WCF*100).toFixed(1)}%)`, res.wcf],
                ].map(([label, val]) => (
                  <tr key={label} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-5 py-1.5 text-gray-700 dark:text-gray-300">{label}</td>
                    <td className="px-5 py-1.5 text-right tabular-nums text-gray-900 dark:text-white">{fmtN(val)}</td>
                  </tr>
                ))}
                <tr className="bg-blue-50 dark:bg-blue-900/20">
                  <td className="px-5 py-2 font-bold text-blue-800 dark:text-blue-300">TOTAL CTC</td>
                  <td className="px-5 py-2 text-right font-bold tabular-nums text-blue-700 dark:text-blue-400">{fmtN(res.totalCTC)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => handleExport('png')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">PNG</button>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">PDF</button>
          </div>
        </div>
      )}

      {/* PAYE band reference */}
      <div>
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">PAYE Monthly Bands</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Monthly Income (TZS)</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {taxRates.PAYE_BANDS.map((b, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmtN(b.min)}{b.max ? ` – ${fmtN(b.max)}` : ' and above'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums">
                    {(b.rate * 100).toFixed(0)}%{b.base > 0 && ` (+${fmtN(b.base)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function NSSFSection({ taxRates }) {
  const [payroll, onPayroll, payrollN] = useMoneyInput('');
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  return (
    <div className="space-y-4">
      <CalcCard title="NSSF Employer Calculator">
        <MoneyInput label="Total Monthly Payroll (TZS)" value={payroll} onChange={onPayroll} />
        <CalcButton onClick={() => {
          const r = calcNSSF(payrollN, taxRates.NSSF_EMPLOYEE, taxRates.NSSF_EMPLOYER);
          setRes(r); setFlash(true); setTimeout(() => setFlash(false), 700);
        }}>Calculate</CalcButton>
        {res && (
          <div className="space-y-0.5">
            <ResultRow label={`Employee Contribution (${(taxRates.NSSF_EMPLOYEE*100).toFixed(0)}%)`} value={fmt(res.employeeContribution)} color="red" flash={flash} />
            <ResultRow label={`Employer Contribution (${(taxRates.NSSF_EMPLOYER*100).toFixed(0)}%)`} value={fmt(res.employerContribution)} color="red" flash={flash} />
            <ResultRow label="Total NSSF (20%)" value={fmt(res.totalNSSF)} color="bold" flash={flash} />
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">NSSF contributions are remitted by the <strong>7th of the following month</strong>.</p>
      </CalcCard>
    </div>
  );
}

function SDLSection({ taxRates }) {
  const [payroll, onPayroll, payrollN] = useMoneyInput('');
  const [empCount, setEmpCount] = useState('');
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  return (
    <div className="space-y-4">
      <CalcCard title="SDL Calculator">
        <MoneyInput label="Total Monthly Payroll (TZS)" value={payroll} onChange={onPayroll} />
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Number of Employees</label>
          <input
            type="number" min="0"
            value={empCount}
            onChange={e => setEmpCount(e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <CalcButton onClick={() => {
          const r = calcSDL(payrollN, parseInt(empCount) || 0, taxRates.SDL, taxRates.SDL_MIN_EMPLOYEES);
          setRes(r); setFlash(true); setTimeout(() => setFlash(false), 700);
        }}>Calculate</CalcButton>
        {res && (
          res.exempt ? (
            <div className="flex gap-2 px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
              <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-xs text-amber-700 dark:text-amber-300">This employer is <strong>exempt from SDL</strong> (fewer than {taxRates.SDL_MIN_EMPLOYEES} employees).</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <ResultRow label={`SDL Rate (${(taxRates.SDL*100).toFixed(1)}%)`} value="" flash={flash} />
              <ResultRow label="SDL Amount" value={fmt(res.sdlAmount)} color="red" flash={flash} />
            </div>
          )
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">SDL is due by the <strong>7th of the following month</strong>.</p>
      </CalcCard>
    </div>
  );
}

function WCFSection({ taxRates }) {
  const [payroll, onPayroll, payrollN] = useMoneyInput('');
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  return (
    <div className="space-y-4">
      <CalcCard title="WCF Calculator">
        <MoneyInput label="Total Monthly Payroll (TZS)" value={payroll} onChange={onPayroll} />
        <CalcButton onClick={() => {
          const r = calcWCF(payrollN, taxRates.WCF);
          setRes(r); setFlash(true); setTimeout(() => setFlash(false), 700);
        }}>Calculate</CalcButton>
        {res && (
          <div className="space-y-0.5">
            <ResultRow label={`WCF (${(taxRates.WCF*100).toFixed(1)}%)`} value={fmt(res.wcfAmount)} color="red" flash={flash} />
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">WCF is paid by the employer and is <strong>not deducted</strong> from employee salary.</p>
      </CalcCard>
    </div>
  );
}

function EmploymentSection({ taxRates }) {
  const [empTab, setEmpTab] = useState('PAYE');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl overflow-x-auto">
        {EMP_TABS.map(t => (
          <button
            key={t}
            onClick={() => setEmpTab(t)}
            className={cn(
              'flex-1 py-2 text-xs font-semibold rounded-lg transition whitespace-nowrap px-3',
              empTab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {empTab === 'PAYE' && <PayslipSection taxRates={taxRates} />}
      {empTab === 'NSSF' && <NSSFSection taxRates={taxRates} />}
      {empTab === 'SDL'  && <SDLSection  taxRates={taxRates} />}
      {empTab === 'WCF'  && <WCFSection  taxRates={taxRates} />}
    </div>
  );
}

// ─── City Levy Section ────────────────────────────────────────────────────────

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];

function loadCityLevyData(year, quarter) {
  try {
    const stored = localStorage.getItem(`cityLevy_${year}_${quarter}`);
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

function saveCityLevyData(year, quarter, data) {
  try {
    localStorage.setItem(`cityLevy_${year}_${quarter}`, JSON.stringify(data));
  } catch {}
}

function CityLevySection({ taxRates }) {
  const [year, setYear]       = useState(new Date().getFullYear());
  const [quarter, setQuarter] = useState('Q1');
  const [month1Str, setMonth1Str] = useState('');
  const [month2Str, setMonth2Str] = useState('');
  const [month3Str, setMonth3Str] = useState('');
  const [month3Mode, setMonth3Mode] = useState('manual'); // 'manual' | 'auto'
  const [arrearsStr, setArrearsStr] = useState('');
  const [arrearsMode, setArrearsMode] = useState('manual'); // 'manual' | 'compute'
  const [prevActualStr, setPrevActualStr] = useState('');
  const [prevEstStr, setPrevEstStr] = useState('');
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const voucherRef = useRef(null);

  const months = QUARTER_MONTHS[quarter];
  const rate = getCityLevyRate(year, QUARTERS.indexOf(quarter) + 1, taxRates);
  const dueDate = QUARTER_DUE_DATES[quarter];
  const prevQ = QUARTERS[(QUARTERS.indexOf(quarter) + 3) % 4];
  const prevYear = quarter === 'Q1' ? year - 1 : year;

  function getCurrentData() {
    return { month1: month1Str, month2: month2Str, month3: month3Str, month3Mode, arrears: arrearsStr, arrearsMode, prevActual: prevActualStr, prevEst: prevEstStr };
  }

  function applyData(data) {
    setMonth1Str(data?.month1 || '');
    setMonth2Str(data?.month2 || '');
    setMonth3Str(data?.month3 || '');
    setMonth3Mode(data?.month3Mode || 'manual');
    setArrearsStr(data?.arrears || '');
    setArrearsMode(data?.arrearsMode || 'manual');
    setPrevActualStr(data?.prevActual || '');
    setPrevEstStr(data?.prevEst || '');
    setRes(null);
  }

  function switchQuarter(newQ) {
    saveCityLevyData(year, quarter, getCurrentData());
    setQuarter(newQ);
    applyData(loadCityLevyData(year, newQ));
  }

  function switchYear(newYear) {
    saveCityLevyData(year, quarter, getCurrentData());
    setYear(newYear);
    applyData(loadCityLevyData(newYear, quarter));
  }

  useEffect(() => {
    applyData(loadCityLevyData(year, quarter));
  }, []);

  const m1 = parseMoneyStr(month1Str);
  const m2 = parseMoneyStr(month2Str);
  const m3 = month3Mode === 'auto' ? Math.round((m1 + m2) / 2) : parseMoneyStr(month3Str);
  const m3Display = formatMoney(m3);

  const prevActual = parseMoneyStr(prevActualStr);
  const prevEst    = parseMoneyStr(prevEstStr);
  const computedArrears = prevActual - prevEst;
  const arrears = arrearsMode === 'compute' ? computedArrears : readSignedDec(arrearsStr);

  function handleCalculate() {
    if (!m1 || !m2) { alert('Please enter Month 1 and Month 2 turnovers.'); return; }
    const r = calcCityLevy(m1, m2, m3, computedArrears, rate);
    setRes({ ...r, rate, quarter, year, months, dueDate, m1, m2, m3, arrears: computedArrears });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    // persist
    saveCityLevyData(year, quarter, getCurrentData());
    setTimeout(() => voucherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }

  function handleReset() {
    if (!confirm('Clear this quarter\'s data?')) return;
    localStorage.removeItem(`cityLevy_${year}_${quarter}`);
    applyData(null);
  }

  async function handleExport(type) {
    setExporting(true);
    try {
      const fname = `CityLevy_${quarter}_${year}`;
      if (type === 'png') await exportToPng(voucherRef, fname);
      else {
        const prevLastMonth = QUARTER_MONTHS[prevQ]?.[2];
        const html = `
          <h2>City Service Levy</h2>
          <p class="sub">Period: ${months.join(' to ')} ${year}</p>
          <table>
            <thead><tr><th></th><th>Turnover</th><th>Code</th></tr></thead>
            <tbody>
              <tr><td colspan="3" class="section">Previous Quarter Summary</td></tr>
              <tr><td>${prevLastMonth} Actual Turnover</td><td class="num">${fmtN(prevActual)}</td><td></td></tr>
              <tr><td>${prevLastMonth} Estimated Turnover</td><td class="num">${fmtN(prevEst)}</td><td></td></tr>
              <tr class="subtotal"><td>Arrears ${prevLastMonth} ${prevYear}</td><td class="num">${fmtN(computedArrears)}</td><td class="code">A</td></tr>
              <tr><td colspan="3" class="section">Current Quarter Summary</td></tr>
              <tr><td>${months[0]} Turnover</td><td class="num">${fmtN(res.m1)}</td><td class="code">B</td></tr>
              <tr><td>${months[1]} Turnover</td><td class="num">${fmtN(res.m2)}</td><td class="code">C</td></tr>
              <tr><td>${months[2]} Turnover</td><td class="num">${fmtN(res.m3)}</td><td class="code">D</td></tr>
              <tr class="total"><td>Total Turnover</td><td class="num">${fmtN(res.adjustedTotal)}</td><td class="code">A+B+C+D</td></tr>
              <tr><td colspan="3"></td></tr>
              <tr class="levy"><td>City Service levy for the Quarter</td><td class="num levy-num">${fmtNDec(res.levy)}</td><td class="num">${(res.rate * 100).toFixed(2).replace(/\.?0+$/, '')}%</td></tr>
            </tbody>
          </table>
          <p class="sub" style="margin-top:10px;">Due: ${res.dueDate} ${res.year}</p>
        `;
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(fname)}</title><style>@page{size:A5 portrait;margin:10mm;}body{font-family:Arial,sans-serif;margin:0;color:#111827;font-size:11px;}h2{margin:0 0 2px;font-size:13px;}p.sub{margin:0 0 8px;font-size:10px;color:#6b7280;}table{border-collapse:collapse;width:100%;}th,td{padding:4px 8px;border:1px solid #d1d5db;font-size:11px;}th{background:#f3f4f6;font-weight:600;text-align:left;}td.num{text-align:right;font-family:monospace;}td.code{text-align:center;font-weight:700;background:#f9fafb;}td.section{background:#e5e7eb;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.04em;}tr.subtotal td{background:#fef3c7;}tr.total td{background:#dbeafe;font-weight:700;}tr.levy td{background:#d1fae5;font-weight:700;}td.levy-num{font-size:13px;font-weight:700;}</style></head><body>${html}</body></html>`;
        const w = window.open('', '_blank', 'width=600,height=500');
        if (!w) return;
        w.document.write(fullHtml);
        w.document.close();
        w.onload = () => { w.focus(); w.print(); };
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Year + Quarter selectors */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">Year</label>
          <input
            type="number"
            value={year}
            onChange={e => switchYear(parseInt(e.target.value) || year)}
            className="w-24 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
          {QUARTERS.map(q => (
            <button key={q} onClick={() => switchQuarter(q)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg transition', quarter === q ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300')}
            >{q}</button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <RateBadge rate={rate} />
          <span className="text-xs text-gray-500 dark:text-gray-400">Due: {dueDate} {year}</span>
        </div>
      </div>

      {/* Table-style input form */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700 px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>Period: {months.join(' – ')} {year}</span>
          <span className="w-40 text-right pr-2">Turnover</span>
          <span className="w-12 text-center">Code</span>
        </div>

        {/* Previous Quarter Summary */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Previous Quarter Summary</p>
        </div>
        {[
          { label: `${QUARTER_MONTHS[prevQ]?.[2]} Actual Turnover`, val: prevActualStr, set: setPrevActualStr },
          { label: `${QUARTER_MONTHS[prevQ]?.[2]} Estimated Turnover`, val: prevEstStr, set: setPrevEstStr },
        ].map(({ label, val, set }) => (
          <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            <input type="text" inputMode="numeric" value={val}
              onChange={e => set(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder="0"
              className="w-40 px-2 py-1.5 text-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <span className="w-12 text-center text-xs text-gray-400">—</span>
          </div>
        ))}
        {/* Arrears row */}
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/10">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Arrears {QUARTER_MONTHS[prevQ]?.[2]} {prevYear}</span>
          <span className={cn('w-40 text-right pr-2 text-sm font-semibold tabular-nums', computedArrears > 0 ? 'text-amber-700 dark:text-amber-400' : computedArrears < 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-500')}>{fmtN(computedArrears)}</span>
          <span className="w-12 text-center text-xs font-bold text-gray-700 dark:text-gray-300">A</span>
        </div>

        {/* Current Quarter Summary */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/40 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Current Quarter Summary</p>
        </div>
        {[
          { label: `${months[0]} Turnover`, val: month1Str, set: setMonth1Str, code: 'B' },
          { label: `${months[1]} Turnover`, val: month2Str, set: setMonth2Str, code: 'C' },
        ].map(({ label, val, set, code }) => (
          <div key={label} className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800">
            <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
            <input type="text" inputMode="numeric" value={val}
              onChange={e => set(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder="0"
              className="w-40 px-2 py-1.5 text-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
            <span className="w-12 text-center text-xs font-bold text-gray-700 dark:text-gray-300">{code}</span>
          </div>
        ))}
        {/* Month 3 with toggle */}
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">{months[2]} Turnover</span>
            <div className="flex gap-0.5 text-[10px]">
              <button onClick={() => setMonth3Mode('manual')} className={cn('px-2 py-0.5 rounded transition', month3Mode === 'manual' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-400 hover:text-gray-600')}>Manual</button>
              <button onClick={() => setMonth3Mode('auto')} className={cn('px-2 py-0.5 rounded transition', month3Mode === 'auto' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold' : 'text-gray-400 hover:text-gray-600')}>Est.</button>
            </div>
          </div>
          {month3Mode === 'auto' ? (
            <span className="w-40 text-right pr-2 text-sm tabular-nums text-blue-600 dark:text-blue-400 font-semibold">{fmtN(m3)}</span>
          ) : (
            <input type="text" inputMode="numeric" value={month3Str}
              onChange={e => setMonth3Str(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder="0"
              className="w-40 px-2 py-1.5 text-right rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          )}
          <span className="w-12 text-center text-xs font-bold text-gray-700 dark:text-gray-300">D</span>
        </div>
        {/* Total Turnover */}
        <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
          <span className="text-sm font-bold text-gray-900 dark:text-white">Total Turnover</span>
          <span className="w-40 text-right pr-2 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{fmtN(m1 + m2 + m3 + computedArrears)}</span>
          <span className="w-12 text-center text-[10px] font-bold text-gray-700 dark:text-gray-300">A+B+C+D</span>
        </div>

        {/* City Levy result row (shown after calculate) */}
        {res && (
          <div className={cn('grid grid-cols-[1fr_auto_auto] items-center px-4 py-3 transition-colors duration-300', flash ? 'bg-yellow-100 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/10')}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-white">City Service Levy for the Quarter</span>
              <RateBadge rate={res.rate} />
            </div>
            <span className="w-40 text-right pr-2 text-base font-bold tabular-nums text-green-700 dark:text-green-400">{fmtNDec(res.levy)}</span>
            <span className="w-12 text-center text-xs text-gray-400">—</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <CalcButton onClick={handleCalculate}>Calculate City Levy</CalcButton>
        <CalcButton onClick={handleReset} variant="secondary">Reset</CalcButton>
        {res && (
          <>
            <button onClick={() => handleExport('png')} disabled={exporting} className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">
              PNG
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              PDF
            </button>
          </>
        )}
      </div>

      {/* Hidden voucher ref for PNG export */}
      {res && (
        <div ref={voucherRef} className="bg-white border border-gray-200 rounded-xl p-4 text-sm" style={{ position: 'absolute', left: '-9999px', top: 0, width: '500px' }}>
          <p className="font-bold text-base mb-1">City Service Levy – {res.quarter} {res.year}</p>
          <p className="text-xs text-gray-500 mb-3">{res.months.join(' – ')}</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead><tr style={{ background: '#f3f4f6' }}><th style={{ textAlign: 'left', padding: '4px 8px', border: '1px solid #d1d5db' }}>Description</th><th style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>Turnover</th><th style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db' }}>Code</th></tr></thead>
            <tbody>
              <tr style={{ background: '#e5e7eb' }}><td colSpan={3} style={{ padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>Previous Quarter Summary</td></tr>
              <tr><td style={{ padding: '4px 8px', border: '1px solid #d1d5db' }}>{QUARTER_MONTHS[prevQ]?.[2]} Actual Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>{fmtN(prevActual)}</td><td style={{ textAlign: 'center', border: '1px solid #d1d5db' }}>—</td></tr>
              <tr><td style={{ padding: '4px 8px', border: '1px solid #d1d5db' }}>{QUARTER_MONTHS[prevQ]?.[2]} Estimated Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>{fmtN(prevEst)}</td><td style={{ textAlign: 'center', border: '1px solid #d1d5db' }}>—</td></tr>
              <tr style={{ background: '#fef3c7' }}><td style={{ padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 600 }}>Arrears {QUARTER_MONTHS[prevQ]?.[2]} {prevYear}</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 600 }}>{fmtN(computedArrears)}</td><td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>A</td></tr>
              <tr style={{ background: '#e5e7eb' }}><td colSpan={3} style={{ padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>Current Quarter Summary</td></tr>
              <tr><td style={{ padding: '4px 8px', border: '1px solid #d1d5db' }}>{res.months[0]} Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>{fmtN(res.m1)}</td><td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>B</td></tr>
              <tr><td style={{ padding: '4px 8px', border: '1px solid #d1d5db' }}>{res.months[1]} Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>{fmtN(res.m2)}</td><td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>C</td></tr>
              <tr><td style={{ padding: '4px 8px', border: '1px solid #d1d5db' }}>{res.months[2]} Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db' }}>{fmtN(res.m3)}</td><td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>D</td></tr>
              <tr style={{ background: '#dbeafe' }}><td style={{ padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>Total Turnover</td><td style={{ textAlign: 'right', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>{fmtN(res.adjustedTotal)}</td><td style={{ textAlign: 'center', padding: '4px 8px', border: '1px solid #d1d5db', fontWeight: 700, fontSize: '10px' }}>A+B+C+D</td></tr>
              <tr style={{ background: '#d1fae5' }}><td style={{ padding: '6px 8px', border: '1px solid #d1d5db', fontWeight: 700 }}>City Service Levy for the Quarter ({(res.rate * 100).toFixed(2).replace(/\.?0+$/, '')}%)</td><td style={{ textAlign: 'right', padding: '6px 8px', border: '1px solid #d1d5db', fontWeight: 700, fontSize: '13px' }}>{fmtNDec(res.levy)}</td><td style={{ textAlign: 'center', border: '1px solid #d1d5db' }}>—</td></tr>
            </tbody>
          </table>
          <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '8px' }}>Due: {res.dueDate} {res.year}</p>
        </div>
      )}
    </div>
  );
}

// ─── Depreciation Section ────────────────────────────────────────────────────
const DEPR_CLASSES = [
  { cls: '1', method: 'Diminishing', rate: 0.375, assets: 'Computers, IT equipment, cars, minibuses (<30 seats), light goods vehicles (<7t), construction equipment' },
  { cls: '2', method: 'Diminishing', rate: 0.25,  assets: 'Heavy trucks, buses (30+ seats), aircraft, ships, manufacturing/agricultural machinery' },
  { cls: '3', method: 'Diminishing', rate: 0.125, assets: 'Office furniture, fixtures, office equipment, assets not in other classes' },
  { cls: '5', method: 'Straight-line', rate: 0.20, assets: 'Agricultural buildings and structures' },
  { cls: '6', method: 'Straight-line', rate: 0.05, assets: 'Commercial and residential buildings (other than Class 5)' },
  { cls: '7', method: 'Straight-line', rate: null, assets: 'Intangible assets (patents, licenses, software rights)' },
  { cls: '8', method: 'Full write-off', rate: 1.00, assets: 'Qualifying plant & machinery (some agricultural and mineral exploration assets)' },
];

const DEPR_EXAMPLES = [
  ['Laptop / Desktop / Computer', '1', 0.375],
  ['Motor car', '1', 0.375],
  ['Toyota Hiace / minibus (<30 seats)', '1', 0.375],
  ['Heavy truck (10+ tonnes)', '2', 0.25],
  ['Manufacturing machine', '2', 0.25],
  ['Office desk / chair / furniture', '3', 0.125],
  ['Office printer / copier', '3', 0.125],
  ['Agricultural building', '5', 0.20],
  ['Commercial / office building', '6', 0.05],
];

// Human-readable rate for a class row: "37.5%", "100%", or "1 ÷ life"
function deprRateText(c) {
  if (c.rate === null) return '1 ÷ life';
  if (c.rate === 1)    return '100%';
  return `${parseFloat((c.rate * 100).toFixed(2))}%`;
}

function DepreciationSection() {
  const [cost, onCost, costN] = useMoneyInput('');
  const [cls, setCls]         = useState('1');
  const [years, setYears]     = useState(5);
  const [usefulLife, setUsefulLife] = useState(5);
  const [table, setTable]     = useState(null);
  const [flash, setFlash]     = useState(false);
  const [showRef, setShowRef] = useState(false);
  const resultRef = useRef(null);

  const selected = DEPR_CLASSES.find(c => c.cls === cls);
  const rate     = selected?.rate;
  const method   = selected?.method;

  function handleCalculate() {
    if (!costN || costN <= 0) { alert('Enter a valid asset cost.'); return; }
    const r = cls === '7' ? 1 / usefulLife : rate;
    const rows = [];
    let nbv = costN;
    const n = cls === '8' ? 1 : years;
    for (let y = 1; y <= n; y++) {
      const depr = method === 'Straight-line' || cls === '8'
        ? Math.min(costN * r, nbv)
        : nbv * r;
      const rounded = Math.round(depr);
      const closingNbv = Math.max(0, Math.round(nbv - depr));
      rows.push({ year: y, openingNbv: Math.round(nbv), depr: rounded, closingNbv });
      nbv = closingNbv;
      if (nbv === 0) break;
    }
    setTable({ rows, cost0: costN, cls, method, r });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }

  const totalDepr = table ? table.rows.reduce((s, r) => s + r.depr, 0) : 0;
  const finalNbv  = table ? table.rows[table.rows.length - 1].closingNbv : 0;
  const pctOff    = table && table.cost0 ? Math.round((totalDepr / table.cost0) * 100) : 0;

  const fieldCls = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition';

  return (
    <div className="space-y-5">
      {/* ── Calculator ─────────────────────────────────────────────────── */}
      <CalcCard title="Depreciation Schedule Calculator">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="col-span-2">
            <MoneyInput label="Asset Cost (TZS)" value={cost} onChange={onCost} />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Class</label>
            <select value={cls} onChange={e => setCls(e.target.value)} className={fieldCls}>
              {DEPR_CLASSES.map(c => <option key={c.cls} value={c.cls}>Class {c.cls} — {deprRateText(c)}</option>)}
            </select>
          </div>
          {cls === '7' ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Useful Life (yrs)</label>
              <input type="number" min={1} value={usefulLife} onChange={e => setUsefulLife(parseInt(e.target.value) || 1)} className={fieldCls} />
            </div>
          ) : cls !== '8' ? (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Years to project</label>
              <input type="number" min={1} max={50} value={years} onChange={e => setYears(parseInt(e.target.value) || 1)} className={fieldCls} />
            </div>
          ) : (
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Period</label>
              <div className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-sm text-gray-500 dark:text-gray-400 border border-transparent">Immediate</div>
            </div>
          )}
        </div>

        {/* Selected-class summary */}
        {selected && (
          <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-3.5 py-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">Class {cls}</span>
              <RateBadge
                rate={cls === '7' ? 1 / usefulLife : (rate ?? 0)}
                label={cls === '7' ? `${(100 / usefulLife).toFixed(2).replace(/\.?0+$/, '')}%` : rate === 1 ? '100%' : undefined}
              />
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{method}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{selected.assets}</p>
          </div>
        )}

        <CalcButton onClick={handleCalculate}>Generate Schedule</CalcButton>
      </CalcCard>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {table && (
        <div ref={resultRef} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {/* Highlight strip */}
          <div className={cn('grid grid-cols-3 divide-x divide-gray-100 dark:divide-gray-800 transition-colors duration-500', flash && 'bg-yellow-50 dark:bg-yellow-900/10')}>
            {[
              { label: 'Total Depreciation', value: fmtN(totalDepr), color: 'text-red-600 dark:text-red-400' },
              { label: 'Remaining Book Value', value: fmtN(finalNbv), color: 'text-gray-900 dark:text-white' },
              { label: '% Written Off', value: `${pctOff}%`, color: 'text-green-600 dark:text-green-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="px-3 py-4 text-center">
                <p className={cn('text-base sm:text-xl font-bold tabular-nums leading-tight break-words', color)}>{value}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
              </div>
            ))}
          </div>

          {/* Year-by-year schedule */}
          <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60">
                <tr>
                  <th className="text-left  px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Year</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Opening NBV</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Depreciation</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 whitespace-nowrap">Closing NBV</th>
                </tr>
              </thead>
              <tbody>
                {table.rows.map(r => (
                  <tr key={r.year} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium whitespace-nowrap">Year {r.year}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{fmtN(r.openingNbv)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-red-600 dark:text-red-400 font-semibold">{fmtN(r.depr)}</td>
                    <td className={cn('px-4 py-2.5 text-right tabular-nums font-semibold', r.closingNbv === 0 ? 'text-gray-400 dark:text-gray-600' : 'text-gray-900 dark:text-white')}>{fmtN(r.closingNbv)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-bold text-gray-900 dark:text-white">Total</td>
                  <td className="px-4 py-2.5" />
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-red-700 dark:text-red-400">{fmtN(totalDepr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-500 dark:text-gray-400">{fmtN(finalNbv)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
            {table.method === 'Diminishing' ? 'Diminishing-balance basis — rate applied to the reducing net book value each year.' : table.cls === '8' ? 'Class 8 — full write-off in the year of purchase.' : 'Straight-line basis — equal charge on cost each year.'} All amounts in TZS.
          </p>
        </div>
      )}

      {/* ── Reference (collapsible) ────────────────────────────────────── */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <button
          onClick={() => setShowRef(v => !v)}
          className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        >
          <span className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">Capital Allowance Reference</span>
            <span className="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">· ITA Cap.332</span>
          </span>
          <svg className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200', showRef && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showRef && (
          <div className="px-4 pb-4 pt-1 space-y-5">
            {/* Classes */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Classes &amp; Rates</h4>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold whitespace-nowrap">Class</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold whitespace-nowrap">Method</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold whitespace-nowrap">Rate</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold">Asset Types</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPR_CLASSES.map(c => (
                      <tr key={c.cls} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">Class {c.cls}</span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{c.method}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-white whitespace-nowrap">{deprRateText(c)}</td>
                        <td className="px-3 py-2 text-gray-500 dark:text-gray-400 min-w-[220px]">{c.assets}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Common assets */}
            <div>
              <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Common Assets — Quick Lookup</h4>
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800/60">
                    <tr>
                      <th className="text-left  px-3 py-2 text-gray-500 font-semibold">Asset</th>
                      <th className="text-center px-3 py-2 text-gray-500 font-semibold whitespace-nowrap">Class</th>
                      <th className="text-right px-3 py-2 text-gray-500 font-semibold whitespace-nowrap">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPR_EXAMPLES.map(([asset, c, r]) => (
                      <tr key={asset} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{asset}</td>
                        <td className="px-3 py-2 text-center whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{c}</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-white whitespace-nowrap">{parseFloat((r * 100).toFixed(2))}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main TaxTool Page ────────────────────────────────────────────────────────

const TABS = [
  { key: 'vat',         label: 'VAT' },
  { key: 'provisional', label: 'Provisional' },
  { key: 'wht',         label: 'WHT' },
  { key: 'employment',  label: 'Employment' },
  { key: 'cityLevy',      label: 'City Levy' },
  { key: 'depreciation',  label: 'Depreciation' },
];

export default function TaxTool() {
  const { state } = useApp();
  const taxRates = state.taxRates;
  const [activeTab, setActiveTab] = useState('vat');

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Tax Tool</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Tanzania tax calculators · Rates from Settings → Tax Rates</p>
      </div>

      {/* Tab navigation — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-2xl min-w-max sm:min-w-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex-1 py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold rounded-xl transition whitespace-nowrap',
                activeTab === t.key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'vat'         && <VATSection         taxRates={taxRates} />}
      {activeTab === 'provisional' && <ProvisionalSection taxRates={taxRates} />}
      {activeTab === 'wht'         && <WHTSection />}
      {activeTab === 'employment'  && <EmploymentSection  taxRates={taxRates} />}
      {activeTab === 'cityLevy'    && <CityLevySection    taxRates={taxRates} />}
      {activeTab === 'depreciation' && <DepreciationSection />}
    </div>
  );
}
