// ─── TaxCalc Utilities ────────────────────────────────────────────────────────
// Pure calculation functions for the TaxTool page.
// All functions accept rates/bands from AppContext so they stay in sync with
// the user's configured Tax Rates settings.

// ─── Formatting ───────────────────────────────────────────────────────────────

/** Format as TZS amount, up to 2 decimal places (drops trailing zeros): "TZS 1,500,000.50" */
export function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Format number only, no prefix, up to 2 decimal places: "1,500,000.50" */
export function fmtN(n) {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Format with 2 decimal places: "2,500.00" (drops ".00" if zero cents) */
export function fmtDec(n) {
  if (n == null || isNaN(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  const str = rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return str;
}

/** Format decimal without prefix: "2,500.00" */
export function fmtNDec(n) {
  if (n == null || isNaN(n)) return '—';
  const rounded = Math.round(n * 100) / 100;
  return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Input Parsing ────────────────────────────────────────────────────────────

/** Strip commas → integer */
export function readNum(str) {
  return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
}

/** Strip commas → float */
export function readNumDec(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

/** Strip commas, support leading minus → float */
export function readSignedDec(str) {
  return parseFloat(String(str).replace(/,/g, '')) || 0;
}

// ─── Auto-format input value (with comma separators) ─────────────────────────

/**
 * Format a raw string as a comma-separated integer.
 * Returns { formatted, cursorOffset } — cursorOffset is the delta to apply
 * to the caret position after formatting.
 */
export function formatMoneyInput(raw, prevRaw) {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return { formatted: '', cursorOffset: 0 };
  const formatted = parseInt(digits, 10).toLocaleString('en-US');
  return { formatted };
}

/**
 * Format a raw string as a comma-separated decimal (up to 2dp).
 */
export function formatDecimalInput(raw) {
  // allow digits, one dot, up to 2 decimal places
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  const intPart = parts[0] ? parseInt(parts[0], 10).toLocaleString('en-US') : '';
  if (parts.length > 1) {
    return intPart + '.' + parts[1].slice(0, 2);
  }
  return intPart;
}

/**
 * Format raw as signed decimal (supports leading minus).
 */
export function formatSignedDecimalInput(raw) {
  const negative = raw.startsWith('-');
  const abs = raw.replace(/[^0-9.]/g, '');
  const formatted = formatDecimalInput(abs);
  return negative && formatted ? '-' + formatted : formatted;
}

// ─── VAT ──────────────────────────────────────────────────────────────────────

export function calcVatInclusiveToExclusive(inclusive, vatRate) {
  const divisor = 1 + vatRate;
  const exclusive = inclusive / divisor;
  const vatAmount = inclusive - exclusive;
  return { exclusive, vatAmount };
}

export function calcVatAmountToTotals(vatAmount, vatRate) {
  const exclusive = vatAmount / vatRate;
  const inclusive = exclusive + vatAmount;
  return { exclusive, inclusive };
}

export function calcVatExclusiveToInclusive(exclusive, vatRate) {
  const vatAmount = exclusive * vatRate;
  const inclusive = exclusive + vatAmount;
  return { vatAmount, inclusive };
}

// ─── Progressive Tax Band Calculation ────────────────────────────────────────

/**
 * Calculate tax from progressive bands.
 * bands: [{ min, max, base, rate }] — sorted ascending by min.
 */
export function calcBandTax(income, bands) {
  if (!bands || bands.length === 0) return 0;
  let tax = 0;
  for (const band of bands) {
    if (income <= band.min - 1) break; // below this band
    const excess = income - (band.min - 1);
    const bandWidth = band.max != null ? band.max - (band.min - 1) : Infinity;
    const taxable = Math.min(excess, bandWidth);
    const base = band.fixed ?? band.base ?? 0;
    tax = base + taxable * band.rate;
    if (band.max == null || income <= band.max) break;
  }
  return Math.max(0, tax);
}

/**
 * Reverse-calculate income needed to produce a target tax amount from progressive bands.
 */
export function calcBandReverse(targetTax, bands) {
  if (!bands || bands.length === 0) return 0;
  if (targetTax <= 0) return bands[0].min - 1;

  for (let i = 0; i < bands.length; i++) {
    const band = bands[i];
    if (band.rate === 0) continue;
    const base = band.fixed ?? band.base ?? 0;
    const maxTaxInBand = band.max != null ? base + (band.max - (band.min - 1)) * band.rate : Infinity;
    if (targetTax <= maxTaxInBand || i === bands.length - 1) {
      return (band.min - 1) + (targetTax - base) / band.rate;
    }
  }
  return 0;
}

// ─── PAYE ─────────────────────────────────────────────────────────────────────

export function calcPaye(grossMonthly, payeBands, nssfEmployeeRate) {
  const nssfEmployee = Math.round(grossMonthly * nssfEmployeeRate);
  const taxableIncome = grossMonthly - nssfEmployee;
  const paye = Math.round(calcBandTax(taxableIncome, payeBands));
  const netPay = grossMonthly - nssfEmployee - paye;
  return { nssfEmployee, taxableIncome, paye, netPay };
}

// ─── WHT ──────────────────────────────────────────────────────────────────────

export function calcWHT(grossPayment, rate) {
  const whtAmount = grossPayment * rate;
  const netPayment = grossPayment - whtAmount;
  return { whtAmount, netPayment };
}

// ─── Employment Levies ────────────────────────────────────────────────────────

export function calcNSSF(payroll, employeeRate, employerRate) {
  const employeeContribution = payroll * employeeRate;
  const employerContribution = payroll * employerRate;
  const totalNSSF = employeeContribution + employerContribution;
  return { employeeContribution, employerContribution, totalNSSF };
}

export function calcSDL(payroll, employeeCount, sdlRate, minEmployees) {
  if (employeeCount < minEmployees) {
    return { rate: 0, sdlAmount: 0, exempt: true };
  }
  const sdlAmount = payroll * sdlRate;
  return { rate: sdlRate, sdlAmount, exempt: false };
}

export function calcWCF(payroll, wcfRate) {
  return { wcfAmount: payroll * wcfRate };
}

// ─── City Levy ────────────────────────────────────────────────────────────────

export function getCityLevyRate(year, quarter, taxRates) {
  const changeYear = taxRates?.CITY_LEVY_CHANGE_YEAR ?? 2025;
  const changeQ    = taxRates?.CITY_LEVY_CHANGE_QUARTER ?? 3;
  const oldRate    = taxRates?.CITY_LEVY_OLD ?? 0.0030;
  const newRate    = taxRates?.CITY_LEVY_NEW ?? 0.0025;

  if (year < changeYear) return oldRate;
  if (year === changeYear && quarter < changeQ) return oldRate;
  return newRate;
}

export function calcCityLevy(month1, month2, month3Est, arrears, rate) {
  const totalTurnover = month1 + month2 + month3Est;
  const adjustedTotal = totalTurnover + arrears;
  const levy = adjustedTotal * rate;
  return { totalTurnover, adjustedTotal, levy };
}

// ─── Quarter helpers ──────────────────────────────────────────────────────────

export const QUARTER_MONTHS = {
  Q1: ['January', 'February', 'March'],
  Q2: ['April', 'May', 'June'],
  Q3: ['July', 'August', 'September'],
  Q4: ['October', 'November', 'December'],
};

export const QUARTER_DUE_DATES = {
  Q1: '31 March',
  Q2: '30 June',
  Q3: '30 September',
  Q4: '31 December',
};

export function prevQuarter(quarter) {
  const map = { Q1: 'Q4', Q2: 'Q1', Q3: 'Q2', Q4: 'Q3' };
  return map[quarter];
}

export function prevQuarterYear(quarter, year) {
  return quarter === 'Q1' ? year - 1 : year;
}
