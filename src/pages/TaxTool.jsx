import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn, format } from '../utils/index.js';
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
  } else if (str.endsWith('.')) {
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

async function exportToPdf(ref, filename) {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  const canvas = await html2canvas(ref.current, { scale: 2, useCORS: true, backgroundColor: null });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [canvas.width / 2, canvas.height / 2] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
  pdf.save(filename + '.pdf');
}

// ─── VAT Section ──────────────────────────────────────────────────────────────

function VATSection({ taxRates }) {
  const rate = taxRates.VAT;
  const [incl, onIncl, inclN, setIncl]   = useMoneyInput('118,000');
  const [vatA, onVatA, vatAN, setVatA]   = useMoneyInput('18,000');
  const [excl, onExcl, exclN, setExcl]   = useMoneyInput('100,000');
  const [res1, setRes1] = useState(null);
  const [res2, setRes2] = useState(null);
  const [res3, setRes3] = useState(null);
  const [flash1, setFlash1] = useState(false);
  const [flash2, setFlash2] = useState(false);
  const [flash3, setFlash3] = useState(false);

  function flash(setter) { setter(true); setTimeout(() => setter(false), 700); }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
        <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <p className="text-xs text-blue-700 dark:text-blue-300">VAT rate is <strong>{(rate * 100).toFixed(0)}%</strong> — configurable in Settings → Tax Rates</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 1a: Inclusive → Exclusive */}
        <CalcCard title="Inclusive → Exclusive">
          <MoneyInput label="Total incl. VAT (TZS)" value={incl} onChange={onIncl} />
          <CalcButton onClick={() => { const r = calcVatInclusiveToExclusive(inclN, rate); setRes1(r); flash(setFlash1); }}>Calculate</CalcButton>
          {res1 && (
            <div className="space-y-0.5">
              <ResultRow label="Pre-VAT (Exclusive)" value={fmt(res1.exclusive)} flash={flash1} />
              <ResultRow label="VAT Amount" value={fmt(res1.vatAmount)} color="red" flash={flash1} />
            </div>
          )}
        </CalcCard>

        {/* 1b: VAT Amount → Totals */}
        <CalcCard title="VAT Amount → Totals">
          <MoneyInput label="VAT Amount (TZS)" value={vatA} onChange={onVatA} />
          <CalcButton onClick={() => { const r = calcVatAmountToTotals(vatAN, rate); setRes2(r); flash(setFlash2); }}>Calculate</CalcButton>
          {res2 && (
            <div className="space-y-0.5">
              <ResultRow label="Pre-VAT (Exclusive)" value={fmt(res2.exclusive)} flash={flash2} />
              <ResultRow label="Inclusive Total" value={fmt(res2.inclusive)} color="green" flash={flash2} />
            </div>
          )}
        </CalcCard>

        {/* 1c: Exclusive → Inclusive */}
        <CalcCard title="Exclusive → Inclusive">
          <MoneyInput label="Net amount excl. VAT (TZS)" value={excl} onChange={onExcl} />
          <CalcButton onClick={() => { const r = calcVatExclusiveToInclusive(exclN, rate); setRes3(r); flash(setFlash3); }}>Calculate</CalcButton>
          {res3 && (
            <div className="space-y-0.5">
              <ResultRow label={`VAT (${(rate * 100).toFixed(0)}%)`} value={fmt(res3.vatAmount)} color="red" flash={flash3} />
              <ResultRow label="Inclusive Total" value={fmt(res3.inclusive)} color="green" flash={flash3} />
            </div>
          )}
        </CalcCard>
      </div>
    </div>
  );
}

// ─── Provisional Tax Section ──────────────────────────────────────────────────

function ProvisionalSection({ taxRates }) {
  const provBands = taxRates.PROV_BANDS;
  const corpRate  = taxRates.CORPORATE;

  const [iProfit, onIProfit, iProfitN] = useMoneyInput('');
  const [iRes, setIRes] = useState(null);
  const [iFlash, setIFlash] = useState(false);

  const [iTarget, onITarget, iTargetN] = useMoneyInput('');
  const [iRevRes, setIRevRes] = useState(null);
  const [iRevFlash, setIRevFlash] = useState(false);

  const [cProfit, onCProfit, cProfitN] = useMoneyInput('');
  const [cRes, setCRes] = useState(null);
  const [cFlash, setCFlash] = useState(false);

  const [cTarget, onCTarget, cTargetN] = useMoneyInput('');
  const [cRevRes, setCRevRes] = useState(null);
  const [cRevFlash, setCRevFlash] = useState(false);

  function flash(setter) { setter(true); setTimeout(() => setter(false), 700); }

  return (
    <div className="space-y-6">
      {/* Individual */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">Individual (Progressive Bands)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CalcCard title="Annual Profit → Tax">
            <MoneyInput label="Annual Profit (TZS)" value={iProfit} onChange={onIProfit} />
            <CalcButton onClick={() => { const tax = calcBandTax(iProfitN, provBands); setIRes({ tax, quarterly: tax / 4 }); flash(setIFlash); }}>Calculate</CalcButton>
            {iRes && (
              <div className="space-y-0.5">
                <ResultRow label="Annual Tax" value={fmt(iRes.tax)} color="red" flash={iFlash} />
                <ResultRow label="Quarterly Instalment" value={fmt(iRes.quarterly)} color="bold" flash={iFlash} />
              </div>
            )}
          </CalcCard>
          <CalcCard title="Target Tax → Required Profit">
            <MoneyInput label="Desired Annual Tax (TZS)" value={iTarget} onChange={onITarget} />
            <CalcButton onClick={() => { const profit = calcBandReverse(iTargetN, provBands); setIRevRes({ profit }); flash(setIRevFlash); }}>Calculate</CalcButton>
            {iRevRes && (
              <div className="space-y-0.5">
                <ResultRow label="Required Annual Profit" value={fmt(iRevRes.profit)} color="blue" flash={iRevFlash} />
              </div>
            )}
          </CalcCard>
        </div>

        {/* Band reference table */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/60">
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Annual Income (TZS)</th>
                <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {provBands.map((b, i) => (
                <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 tabular-nums">
                    {fmtN(b.min)}{b.max ? ` – ${fmtN(b.max)}` : ' and above'}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                    {(b.rate * 100).toFixed(0)}%{b.base > 0 && ` (+${fmtN(b.base)})`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4" />

      {/* Corporate */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-1 uppercase tracking-wide">Corporate (Flat Rate)</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Corporate rate: <strong>{(corpRate * 100).toFixed(0)}%</strong> on all taxable profit — configurable in Settings</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CalcCard title="Annual Profit → Tax">
            <MoneyInput label="Annual Profit (TZS)" value={cProfit} onChange={onCProfit} />
            <CalcButton onClick={() => { const tax = cProfitN * corpRate; setCRes({ tax, quarterly: tax / 4 }); flash(setCFlash); }}>Calculate</CalcButton>
            {cRes && (
              <div className="space-y-0.5">
                <ResultRow label={`Corporate Tax (${(corpRate * 100).toFixed(0)}%)`} value={fmt(cRes.tax)} color="red" flash={cFlash} />
                <ResultRow label="Quarterly Instalment" value={fmt(cRes.quarterly)} color="bold" flash={cFlash} />
              </div>
            )}
          </CalcCard>
          <CalcCard title="Target Tax → Required Profit">
            <MoneyInput label="Desired Annual Tax (TZS)" value={cTarget} onChange={onCTarget} />
            <CalcButton onClick={() => { const profit = cTargetN / corpRate; setCRevRes({ profit }); flash(setCRevFlash); }}>Calculate</CalcButton>
            {cRevRes && (
              <div className="space-y-0.5">
                <ResultRow label="Required Annual Profit" value={fmt(cRevRes.profit)} color="blue" flash={cRevFlash} />
              </div>
            )}
          </CalcCard>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Quarterly instalments due: <strong>31 Mar · 30 Jun · 30 Sep · 31 Dec</strong></p>
      </div>
    </div>
  );
}

// ─── WHT Section ─────────────────────────────────────────────────────────────

function WHTSection({ taxRates }) {
  const whtRates = taxRates.WHT;
  const types = Object.keys(whtRates);
  const [grossStr, onGross, grossN] = useMoneyInput('');
  const [selectedType, setSelectedType] = useState(types[0]);
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);

  function calculate(type, gross) {
    const rate = whtRates[type];
    if (!rate || !gross) return;
    const r = calcWHT(gross, rate);
    setRes({ ...r, rate, type });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
  }

  function onTypeChange(e) {
    setSelectedType(e.target.value);
    if (grossN > 0) calculate(e.target.value, grossN);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40">
        <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        <p className="text-xs text-amber-700 dark:text-amber-300"><strong>Important:</strong> WHT is calculated on gross payment amount <strong>exclusive of VAT</strong>.</p>
      </div>

      <CalcCard title="Withholding Tax Calculator">
        <div className="space-y-3">
          <MoneyInput label="Gross Payment excl. VAT (TZS)" value={grossStr} onChange={onGross} />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Payment Type</label>
            <select
              value={selectedType}
              onChange={onTypeChange}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            >
              {types.map(t => (
                <option key={t} value={t}>{t} — {(whtRates[t] * 100).toFixed(0)}%</option>
              ))}
            </select>
          </div>
          <CalcButton onClick={() => calculate(selectedType, grossN)}>Calculate WHT</CalcButton>
        </div>

        {res && (
          <div className={cn('space-y-0.5 rounded-xl p-3 border transition-colors duration-300', flash ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700/40' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800')}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">Rate Applied</span>
              <RateBadge rate={res.rate} />
            </div>
            <ResultRow label="Gross Payment (excl. VAT)" value={fmt(grossN)} />
            <ResultRow label="Withholding Tax" value={fmt(res.whtAmount)} color="red" />
            <ResultRow label="Net Payment to Vendor" value={fmt(res.netPayment)} color="green" />
          </div>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">WHT returns are due by the <strong>7th of the following month</strong>.</p>
      </CalcCard>

      {/* Rate reference table */}
      <div>
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-2">Rate Reference</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr>
                <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Payment Type</th>
                <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Rate</th>
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t} className={cn('border-t border-gray-100 dark:border-gray-800', selectedType === t && 'bg-blue-50 dark:bg-blue-900/20')}>
                  <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300">{t}</td>
                  <td className="px-3 py-1.5 text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums">{(whtRates[t] * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Employment Section ───────────────────────────────────────────────────────

const EMP_TABS = ['PAYE', 'NSSF', 'SDL', 'WCF'];

function PayslipSection({ taxRates }) {
  const [basic, onBasic, basicN] = useMoneyInput('500,000');
  const [transport, onTransport, transportN] = useMoneyInput('100,000');
  const [food, onFood, foodN] = useMoneyInput('');
  const [housing, onHousing, housingN] = useMoneyInput('');
  const [other, onOther, otherN] = useMoneyInput('');
  const [month, setMonth] = useState(format(new Date(), 'MMMM yyyy'));
  const [res, setRes] = useState(null);
  const [flash, setFlash] = useState(false);
  const [exporting, setExporting] = useState(false);
  const voucherRef = useRef(null);

  function handleCalculate() {
    if (!basicN) { alert('Please enter Basic Salary.'); return; }
    const gross = basicN + transportN + foodN + housingN + otherN;
    const { nssfEmployee, taxableIncome, paye, netPay } = calcPaye(gross, taxRates.PAYE_BANDS, taxRates.NSSF_EMPLOYEE);
    const nssfEmployer = gross * taxRates.NSSF_EMPLOYER;
    const sdl = gross * taxRates.SDL;
    const wcf = gross * taxRates.WCF;
    const totalCTC = gross + nssfEmployer + sdl + wcf;
    setRes({ gross, nssfEmployee, taxableIncome, paye, netPay, nssfEmployer, sdl, wcf, totalCTC, month, basicN, transportN, foodN, housingN, otherN });
    setFlash(true);
    setTimeout(() => setFlash(false), 700);
    setTimeout(() => voucherRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }

  async function handleExport(type) {
    setExporting(true);
    try {
      const fname = `Payslip_${res.month.replace(' ', '_')}`;
      if (type === 'png') await exportToPng(voucherRef, fname);
      else await exportToPdf(voucherRef, fname);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <CalcCard title="PAYE Payslip Generator">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <MoneyInput label="Basic Salary (TZS) *" value={basic} onChange={onBasic} />
          <MoneyInput label="Transport Allowance" value={transport} onChange={onTransport} />
          <MoneyInput label="Food Allowance" value={food} onChange={onFood} />
          <MoneyInput label="Housing Allowance" value={housing} onChange={onHousing} />
          <MoneyInput label="Other Allowances" value={other} onChange={onOther} />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">Payslip Month</label>
            <input
              type="month"
              defaultValue={format(new Date(), 'yyyy-MM')}
              onChange={e => {
                if (!e.target.value) return;
                const d = new Date(e.target.value + '-01');
                setMonth(format(d, 'MMMM yyyy'));
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <CalcButton onClick={handleCalculate}>Generate Payslip</CalcButton>
          <CalcButton onClick={() => { setRes(null); }} variant="secondary">Reset</CalcButton>
        </div>

        {res && (
          <div className={cn('space-y-0.5 rounded-xl p-3 border transition-colors duration-300', flash ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700/40' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800')}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Summary</h4>
            <ResultRow label="Gross Pay" value={fmt(res.gross)} color="bold" flash={flash} />
            <ResultRow label={`NSSF Employee (${(taxRates.NSSF_EMPLOYEE * 100).toFixed(0)}%)`} value={`− ${fmt(res.nssfEmployee)}`} color="red" flash={flash} />
            <ResultRow label="Taxable Income" value={fmt(res.taxableIncome)} flash={flash} />
            <ResultRow label="PAYE" value={`− ${fmt(res.paye)}`} color="red" flash={flash} />
            <ResultRow label="Net Pay" value={fmt(res.netPay)} color="green" flash={flash} />
          </div>
        )}
      </CalcCard>

      {/* Payslip Voucher */}
      {res && (
        <div>
          <div ref={voucherRef} className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">Employee Payslip</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{res.month}</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Earnings</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Basic Salary</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.basicN)}</span></div>
                {res.transportN > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Transport Allowance</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.transportN)}</span></div>}
                {res.foodN > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Food Allowance</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.foodN)}</span></div>}
                {res.housingN > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Housing Allowance</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.housingN)}</span></div>}
                {res.otherN > 0 && <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Other Allowances</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.otherN)}</span></div>}
                <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                  <span className="text-gray-800 dark:text-gray-200">Total Gross Pay</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.gross)}</span>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Deductions</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">NSSF (Employee 10%)</span><span className="tabular-nums text-red-600 dark:text-red-400">{fmt(res.nssfEmployee)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">PAYE</span><span className="tabular-nums text-red-600 dark:text-red-400">{fmt(res.paye)}</span></div>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-bold text-green-800 dark:text-green-300">Net Pay</span>
              <span className="text-lg font-bold tabular-nums text-green-700 dark:text-green-400">{fmt(res.netPay)}</span>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Cost to Company</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Gross Pay</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.gross)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">NSSF (Employer 10%)</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.nssfEmployer)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">SDL (3.5%)</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.sdl)}</span></div>
                <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">WCF (0.5%)</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.wcf)}</span></div>
                <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                  <span className="text-gray-800 dark:text-gray-200">Total CTC</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.totalCTC)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => handleExport('png')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export PNG
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Export PDF
            </button>
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
    const r = calcCityLevy(m1, m2, m3, arrears, rate);
    setRes({ ...r, rate, quarter, year, months, dueDate, m1, m2, m3, arrears });
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
      else await exportToPdf(voucherRef, fname);
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
            <button
              key={q}
              onClick={() => switchQuarter(q)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold rounded-lg transition',
                quarter === q ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <RateBadge rate={rate} />
          <span className="text-xs text-gray-500 dark:text-gray-400">Due: {dueDate} {year}</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Period: <strong>{months.join(' – ')} {year}</strong>
      </p>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{months[0]} Turnover (TZS)</label>
          <input type="text" inputMode="numeric" value={month1Str}
            onChange={e => setMonth1Str(formatMoney(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">{months[1]} Turnover (TZS)</label>
          <input type="text" inputMode="numeric" value={month2Str}
            onChange={e => setMonth2Str(formatMoney(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>
      </div>

      {/* Month 3 */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">{months[2]} Estimate (TZS)</label>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setMonth3Mode('manual')} className={cn('px-2.5 py-1 rounded-lg transition', month3Mode === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500')}>Manual</button>
            <button onClick={() => setMonth3Mode('auto')} className={cn('px-2.5 py-1 rounded-lg transition', month3Mode === 'auto' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500')}>Auto (avg)</button>
          </div>
        </div>
        {month3Mode === 'auto' ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Auto = (M1 + M2) / 2 =</span>
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">{fmt(m3)}</span>
          </div>
        ) : (
          <input type="text" inputMode="numeric" value={month3Str}
            onChange={e => setMonth3Str(formatMoney(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
            placeholder="0"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        )}
      </div>

      {/* Arrears */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 space-y-2 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Previous Quarter ({prevQ} {prevYear}) Arrears</label>
          <div className="flex gap-1 text-xs">
            <button onClick={() => setArrearsMode('manual')} className={cn('px-2.5 py-1 rounded-lg transition', arrearsMode === 'manual' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500')}>Manual</button>
            <button onClick={() => setArrearsMode('compute')} className={cn('px-2.5 py-1 rounded-lg transition', arrearsMode === 'compute' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm font-medium' : 'text-gray-500')}>Compute</button>
          </div>
        </div>
        {arrearsMode === 'compute' ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Prev {QUARTER_MONTHS[prevQ]?.[2]} Actual</label>
                <input type="text" inputMode="numeric" value={prevActualStr}
                  onChange={e => setPrevActualStr(formatMoney(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Prev {QUARTER_MONTHS[prevQ]?.[2]} Estimated</label>
                <input type="text" inputMode="numeric" value={prevEstStr}
                  onChange={e => setPrevEstStr(formatMoney(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Computed Arrears =</span>
              <span className={cn('text-sm font-semibold tabular-nums', computedArrears > 0 ? 'text-amber-600 dark:text-amber-400' : computedArrears < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>{computedArrears >= 0 ? '' : '−'}{fmt(Math.abs(computedArrears))}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">Enter signed amount (positive = underpaid, negative = overpaid)</p>
            <input type="text" value={arrearsStr}
              onChange={e => setArrearsStr(formatMoney(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder="0 (or -100,000)"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
            />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <CalcButton onClick={handleCalculate}>Calculate City Levy</CalcButton>
        <CalcButton onClick={handleReset} variant="secondary">Reset</CalcButton>
      </div>

      {/* Results */}
      {res && (
        <div>
          <div ref={voucherRef} className="bg-white dark:bg-gray-950 border-2 border-gray-200 dark:border-gray-700 rounded-2xl p-5 space-y-4">
            <div className="text-center border-b border-gray-200 dark:border-gray-700 pb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-widest">City Service Levy</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{res.quarter} {res.year}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{res.months.join(' – ')}</p>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{res.months[0]}</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.m1)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{res.months[1]}</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.m2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{res.months[2]} <span className="text-xs text-gray-400">(Est.)</span></span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.m3)}</span></div>
              <div className="flex justify-between font-semibold border-t border-gray-200 dark:border-gray-700 pt-1 mt-1"><span className="text-gray-700 dark:text-gray-300">Total Turnover</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.totalTurnover)}</span></div>
              {res.arrears !== 0 && (
                <div className={cn('flex justify-between', res.arrears > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
                  <span>Arrears ({res.arrears > 0 ? '+' : ''})</span>
                  <span className="tabular-nums">{res.arrears >= 0 ? '' : '−'}{fmt(Math.abs(res.arrears))}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold"><span className="text-gray-700 dark:text-gray-300">Adjusted Turnover</span><span className="tabular-nums text-gray-900 dark:text-white">{fmt(res.adjustedTotal)}</span></div>
              <div className="flex justify-between text-xs text-gray-500"><span>Rate Applied</span><span><RateBadge rate={res.rate} /></span></div>
            </div>

            <div className={cn('rounded-xl px-4 py-3 flex justify-between items-center transition-colors duration-300', flash ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-blue-50 dark:bg-blue-900/20')}>
              <span className="text-sm font-bold text-blue-800 dark:text-blue-300">City Levy</span>
              <span className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">{fmtDec(res.levy)}</span>
            </div>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">Due: {res.dueDate} {res.year}</p>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={() => handleExport('png')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export PNG
            </button>
            <button onClick={() => handleExport('pdf')} disabled={exporting} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main TaxTool Page ────────────────────────────────────────────────────────

const TABS = [
  { key: 'vat',         label: 'VAT' },
  { key: 'provisional', label: 'Provisional' },
  { key: 'wht',         label: 'WHT' },
  { key: 'employment',  label: 'Employment' },
  { key: 'cityLevy',    label: 'City Levy' },
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
      {activeTab === 'wht'         && <WHTSection         taxRates={taxRates} />}
      {activeTab === 'employment'  && <EmploymentSection  taxRates={taxRates} />}
      {activeTab === 'cityLevy'    && <CityLevySection    taxRates={taxRates} />}
    </div>
  );
}
