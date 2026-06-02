# TaxTool — Tax Calculators Implementation Prompt
> **Scope:** Rebuild all tax calculators from TaxTool PWA (Tanzania) into a new application.
> **Excluded:** VAT Workflow module (handled separately).
> **Jurisdiction:** Tanzania Revenue Authority (TRA) rates and rules.
> **Currency:** All monetary values in Tanzanian Shillings (TZS).

---

## Overview of Calculators to Build

| # | Calculator | Section | Key Rate/Rule |
|---|-----------|---------|--------------|
| 1 | VAT — Inclusive → Exclusive | VAT | 18% |
| 2 | VAT — Amount → Totals | VAT | 18% |
| 3 | VAT — Exclusive → Inclusive | VAT | 18% |
| 4 | Provisional Tax — Individual | Provisional Tax | Progressive bands |
| 5 | Provisional Tax — Individual Reverse | Provisional Tax | Inverse progressive |
| 6 | Provisional Tax — Corporate | Provisional Tax | Flat 30% |
| 7 | Provisional Tax — Corporate Reverse | Provisional Tax | Inverse 30% |
| 8 | Withholding Tax (WHT) | WHT | 2%–15% by type |
| 9 | PAYE Payslip Generator | Employment Tax | Progressive monthly bands |
| 10 | NSSF Employer Calculator | Employment Tax | 10% EE + 10% ER |
| 11 | SDL Calculator | Employment Tax | 3.5% (≥10 employees) |
| 12 | WCF Calculator | Employment Tax | 0.5% |
| 13 | City Service Levy | City Levy | 0.25% quarterly |

---

## Global Utilities (shared across all calculators)

### Number Formatting
```js
// Format as TZS currency (whole numbers)
fmt(n)     → "TZS 1,000,000"   // rounds to integer, returns "TZS —" if invalid
fmtN(n)    → "1,000,000"        // same but no currency prefix

// Format with decimals (for City Levy)
fmtDec(n)  → "TZS 2,500.00"    // drops .00 if zero cents
fmtNDec(n) → "2,500.00"        // same without prefix
```

### Input Reading
```js
readNum(id)       // strips all non-digits → integer (used for whole-TZS inputs)
readNumDec(id)    // strips commas → float (used for City Levy decimal inputs)
readSignedDec(id) // supports negative floats (for City Levy arrears)
```

### Input Auto-Formatting
- All monetary inputs should auto-format with comma separators as the user types (e.g., `1000000` → `1,000,000`).
- Cursor position must be preserved correctly after formatting.
- Decimal inputs (City Levy) allow up to 2 decimal places.
- Signed decimal inputs (City Levy arrears) allow a leading `-` sign.
- Pressing **Enter** in any input should blur the field (not submit form).

### Flash Animation
When results are displayed, each output box should play a brief highlight/flash animation to draw attention to the new value.

---

## 1. VAT Calculator

**Rate:** 18% (fixed, per TRA regulations)

### 1a. Inclusive → Exclusive (Extract VAT from gross total)
- **Input:** Total amount including VAT (`vatInclusive`)
- **Formula:**
  ```
  exclusive = inclusive / 1.18
  vatAmount = inclusive - exclusive
  ```
- **Outputs:**
  - Exclusive (Pre-VAT) amount
  - VAT Amount

### 1b. VAT Amount → Totals (Rebuild from VAT portion)
- **Input:** VAT amount only (`vatAmt`)
- **Formula:**
  ```
  exclusive = vatAmount / 0.18
  inclusive = exclusive + vatAmount
  ```
- **Outputs:**
  - Exclusive (Pre-VAT) amount
  - Inclusive (Gross) total

### 1c. Exclusive → Inclusive (Add VAT to net price)
- **Input:** Net amount before VAT (`vatExclusive`)
- **Formula:**
  ```
  vatAmount = exclusive × 0.18
  inclusive = exclusive + vatAmount
  ```
- **Outputs:**
  - VAT Amount (18%)
  - Inclusive Total

### VAT UI Notes
- Show a prominent note: *"VAT rate fixed at 18% per TRA regulations"*
- All three modes should be visible on the same page/screen (not tabs)
- Default example values to show on load: `118,000` for inclusive, `18,000` for VAT amount, `100,000` for exclusive

---

## 2. Provisional Tax Calculator

### 2a. Individual Tax — Annual Profit → Tax
- **Input:** Annual profit (TZS)
- **Tax bands (progressive):**

| Annual Income (TZS) | Rate |
|---------------------|------|
| 0 – 3,240,000 | 0% |
| 3,240,001 – 6,240,000 | 8% on excess above 3,240,000 |
| 6,240,001 – 9,120,000 | TZS 240,000 + 20% on excess above 6,240,000 |
| 9,120,001 – 12,000,000 | TZS 816,000 + 25% on excess above 9,120,000 |
| Above 12,000,000 | TZS 1,536,000 + 30% on excess above 12,000,000 |

- **Formula (JavaScript):**
  ```js
  function indTax(p) {
    if (p <= 3240000)  return 0;
    if (p <= 6240000)  return (p - 3240000) * 0.08;
    if (p <= 9120000)  return 240000 + (p - 6240000) * 0.20;
    if (p <= 12000000) return 816000 + (p - 9120000) * 0.25;
    return 1536000 + (p - 12000000) * 0.30;
  }
  ```
- **Outputs:**
  - Annual Tax
  - Quarterly Instalment (Annual Tax ÷ 4)

### 2b. Individual Tax — Reverse (Target Tax → Required Profit)
- **Input:** Desired annual tax amount
- **Formula (inverse of progressive bands):**
  ```js
  function indReq(d) {
    if (d <= 0)       return 3240000;
    if (d <= 240000)  return d / 0.08 + 3240000;
    if (d <= 816000)  return (d - 240000) / 0.20 + 6240000;
    if (d <= 1536000) return (d - 816000) / 0.25 + 9120000;
    return (d - 1536000) / 0.30 + 12000000;
  }
  ```
- **Output:** Required Annual Profit to achieve that tax amount

### 2c. Corporate Tax — Annual Profit → Tax
- **Input:** Annual profit (TZS)
- **Formula:** `tax = profit × 0.30`
- **Outputs:**
  - Annual Tax (30%)
  - Quarterly Instalment (Annual Tax ÷ 4)

### 2d. Corporate Tax — Reverse (Target Tax → Required Profit)
- **Input:** Desired annual tax amount
- **Formula:** `requiredProfit = desiredTax / 0.30`
- **Output:** Required Annual Profit

### Provisional Tax UI Notes
- Show the Individual and Corporate calculators in the same view, separated by a divider
- Each has two sub-cards side by side: "Annual Profit → Tax" and "Target Tax → Required Profit"
- Show a reference table of the individual tax bands below the individual calculator
- Quarterly instalments are due on the last day of each quarter: **31 Mar, 30 Jun, 30 Sep, 31 Dec**
- Corporate rate note: *"Corporate rate fixed at 30% on all taxable profit"*

---

## 3. Withholding Tax (WHT) Calculator

### Inputs
- **Gross Payment (excl. VAT)** — monetary input (TZS)
- **Payment Type (GFS Code)** — dropdown selecting the rate

> ⚠️ **Important rule:** WHT is always calculated on the amount **exclusive of VAT**. The UI must display a prominent warning about this.

### Rate Table (dropdown options)

| Payment Type | Rate |
|-------------|------|
| Service Fees – Resident | 5% |
| Service Fees – Non-Resident | 15% |
| Interest | 10% |
| Royalty | 15% |
| Director Fees | 15% |
| Rent – Land & Buildings | 10% |
| Rent – Aircraft Lease | 10% |
| Rent – Machinery | 10% |
| Rent – Motor Vehicles | 10% |
| Natural Resource Payment | 15% |
| Insurance Premium (Non-Resident) | 10% |
| Digital Content Creator Payment | 5% |
| Digital Asset Transfer | 3% |
| Money Transfer Agent Commission | 10% |
| Commercial Bank / Digital Agent Fees | 10% |
| Gaming Advertisement Commission | 10% |
| Government Goods Payment | 2% |
| Precious Metal / Mineral Payments | 2% |
| Carbon Emission Reduction Payments | 10% |

### Formula
```
whtAmount = grossPayment × rate
netPayment = grossPayment - whtAmount
```

### Outputs
- Applicable Rate (displayed as a pill/badge)
- Gross Payment (excl. VAT) — echo input
- Withholding Tax Amount (highlighted in red/danger color)
- Net Payment After WHT (highlighted in green/success color)

### WHT UI Notes
- Changing the dropdown should **immediately recalculate** without pressing a button
- Show the rate as a percentage badge (e.g., "5%") next to the results
- Include a **Rate Reference Table** below the calculator showing all payment types and rates at a glance
- WHT returns are due by the **7th of the following month** — show this as a note

---

## 4. Employment Tax — Payslip / PAYE Calculator

### Inputs
- Basic Salary (TZS/month) — **required**
- Transport Allowance (TZS/month)
- Food Allowance (TZS/month)
- Housing Allowance (TZS/month)
- Other Allowances (TZS/month)
- Payslip Month (month picker, defaults to current month)

### PAYE Monthly Tax Bands (progressive)

| Monthly Income (TZS) | Rate |
|----------------------|------|
| 0 – 270,000 | 0% |
| 270,001 – 520,000 | 8% on excess above 270,000 |
| 520,001 – 760,000 | TZS 20,000 + 20% on excess above 520,000 |
| 760,001 – 1,000,000 | TZS 68,000 + 25% on excess above 760,000 |
| Above 1,000,000 | TZS 128,000 + 30% on excess above 1,000,000 |

```js
function payeMonthly(gross) {
  if (gross <= 270000)  return 0;
  if (gross <= 520000)  return (gross - 270000) * 0.08;
  if (gross <= 760000)  return 20000  + (gross - 520000) * 0.20;
  if (gross <= 1000000) return 68000  + (gross - 760000) * 0.25;
  return 128000 + (gross - 1000000) * 0.30;
}
```

### Calculation Steps
```
grossTotal = basic + transport + food + housing + other
nssfEmployee = grossTotal × 0.10      // 10% employee NSSF contribution
taxableIncome = grossTotal - nssfEmployee
paye = payeMonthly(taxableIncome)
netPay = grossTotal - nssfEmployee - paye
```

### Quick Summary Outputs (shown inline)
- Gross Pay
- NSSF (Employee, 10%)
- Taxable Income
- PAYE
- Net Pay

### Payslip Voucher (generated on calculate)
A formatted payslip document should be generated and scrolled into view containing:

**Header:** Employee Payslip · [Month Year]

**Earnings section:**
- Basic Salary
- Transport Allowance (only if > 0)
- Food Allowance (only if > 0)
- Housing Allowance (only if > 0)
- Other Allowances (only if > 0)
- **Total Gross Pay** (subtotal line)

**Deductions section:**
- NSSF (Employee 10%)
- PAYE

**Net Pay (final total)**

**Cost to Company (CTC) section:**
```
nssfEmployer = grossTotal × 0.10   // employer's matching 10%
sdl = grossTotal × 0.035           // Skills Development Levy
wcf = grossTotal × 0.005           // Workers' Compensation Fund
totalCTC = grossTotal + nssfEmployer + sdl + wcf
```

### Payslip Export
- **Export as PNG** — renders the voucher card to a PNG image (uses html2canvas or equivalent)
- **Export as PDF** — renders the voucher card to a PDF page sized to fit the card
- Filename format: `Payslip_[Month]_[Year]`
- Export should respect light/dark mode theme

### Payslip UI Notes
- Show a "Generate Payslip" primary button and a "Reset" secondary button
- The voucher should be hidden until calculated
- Validation: if basic salary is empty, show an error toast/notification
- Default example: Basic=500,000, Transport=100,000

---

## 5. Employment Tax — NSSF Employer Calculator

### Input
- Total Monthly Payroll (TZS)

### Formula
```
employeeContribution = payroll × 0.10     // 10% deducted from employee
employerContribution = payroll × 0.10     // 10% matched by employer
totalNSSF = payroll × 0.20               // combined 20%
```

### Outputs
- Employee Contribution (10%)
- Employer Contribution (10%)
- Total NSSF (20%)

### NSSF UI Notes
- Note: *"NSSF contributions are remitted by the 7th of the following month"*
- This is a standalone calculator separate from the payslip

---

## 6. Employment Tax — SDL Calculator

### Inputs
- Total Monthly Payroll (TZS)
- Number of Employees (integer)

### Formula
```
if (employees < 10):
  rate = 0%
  sdlAmount = 0
  show exemption notice
else:
  rate = 3.5%
  sdlAmount = payroll × 0.035
```

### Outputs
- Rate (either "0% (exempt)" or "3.5%")
- SDL Amount

### SDL UI Notes
- If employees < 10, show an alert/banner: *"This employer is exempt from SDL (fewer than 10 employees)"*
- SDL is due by the **7th of the following month**

---

## 7. Employment Tax — WCF Calculator

### Input
- Total Monthly Payroll (TZS)

### Formula
```
wcfAmount = payroll × 0.005     // 0.5%
```

### Output
- WCF Amount

### WCF UI Notes
- Rate is always 0.5%, no conditions
- Note: *"WCF is paid by the employer and is not deducted from employee salary"*

---

## 8. City Service Levy Calculator

This is the most complex calculator. It operates on a **quarterly basis** and supports arrears from the previous quarter.

### Background
City Service Levy is a percentage of adjusted quarterly turnover, paid to the city council.
Due dates: **Q1** = 31 March, **Q2** = 30 June, **Q3** = 30 September, **Q4** = 31 December.

### ⚠️ Rate Change — June 2025
The City Service Levy rate changed effective **Q3 2025 (July 2025)**:

| Period | Rate |
|--------|------|
| Q1 2025 (Jan–Mar 2025) | **0.30%** |
| Q2 2025 (Apr–Jun 2025) | **0.30%** |
| Q3 2025 (Jul–Sep 2025) onwards | **0.25%** |
| All of 2026 and beyond | **0.25%** |

**Rate selection logic:**
```js
function getCityLevyRate(year, quarter) {
  if (year < 2025) return 0.0030;          // pre-2025: always 0.30%
  if (year === 2025 && (quarter === 'Q1' || quarter === 'Q2')) return 0.0030; // old rate
  return 0.0025;                           // Q3 2025 onwards: 0.25%
}
```

The rate used must be determined **before** applying it to the adjusted turnover. The UI should display the applicable rate clearly so the user can verify it.

### Quarter Structure
Each quarter covers 3 months:
- **Q1:** January, February, March
- **Q2:** April, May, June
- **Q3:** July, August, September
- **Q4:** October, November, December

### Inputs Per Quarter
1. **Month 1 Actual Turnover** (TZS) — actual revenue for first month of quarter
2. **Month 2 Actual Turnover** (TZS) — actual revenue for second month of quarter
3. **Month 3 Estimated Turnover** (TZS) — the third month is always **estimated** because the quarter isn't over yet when you file. Two methods:
   - **Manual:** User types their own estimate
   - **Auto:** System calculates `(Month1 + Month2) / 2` as the estimate
4. **Previous Quarter Arrears** — adjustment for underpayment/overpayment in last quarter. Two methods:
   - **Compute:** System calculates `actualMonth3PreviousQuarter - estimatedMonth3PreviousQuarter`
   - **Manual:** User types a signed amount (positive = underpaid, negative = overpaid)

### Calculation
```
rate = getCityLevyRate(selectedYear, selectedQuarter)  // 0.0030 or 0.0025
totalTurnover = month1 + month2 + month3estimated
adjustedTotal = totalTurnover + arrears
levy = adjustedTotal × rate
```

> If arrears are **positive** (you underestimated last quarter) → you owe more this quarter.
> If arrears are **negative** (you overestimated last quarter) → you get a deduction this quarter.

### Outputs
- Total Quarterly Turnover
- Arrears Adjustment (colour-coded: amber=positive, red=negative, neutral=zero)
- Adjusted Turnover (after arrears)
- **Applicable Rate** (0.30% or 0.25% — shown clearly so the user can verify)
- **City Levy Amount** (formatted to 2 decimal places)
- Due Date (e.g., "31 March 2026")

### Data Persistence
- All entered data (monthly turnovers, estimation method, arrears) must be **saved to localStorage** per quarter+year key
- Switching quarters should auto-save current data and load the new quarter's data
- The previous quarter's estimated Month 3 value must carry forward to the next quarter's arrears computation

### Voucher / Receipt
When calculated, generate a summary voucher showing:
- Quarter + Year + Period (e.g., "Q1 2026 · January – March")
- Month 1 amount
- Month 2 amount
- Month 3 amount (labelled "Est.")
- Total Turnover
- Previous Quarter Arrears (with sign)
- Adjusted Turnover
- **City Levy Amount**
- Due Date

### City Levy Export
- **Export as PNG** — renders the voucher card to PNG
- **Export as PDF** — renders the voucher card to a PDF
- Filename format: `CityLevy_[Quarter]_[Year]`
- Export respects light/dark mode

### City Levy UI Notes
- Quarter selector tabs: Q1, Q2, Q3, Q4 (only one active at a time)
- Year selector (number input, defaults to current year)
- Changing year or quarter auto-saves current inputs and loads stored data for the new selection
- Month labels update dynamically when quarter changes (e.g., switching to Q3 shows "July", "August", "September")
- The "Previous Quarter" label should show the correct prev quarter (e.g., when on Q2, it shows Q1 data)
- Show the previous quarter's estimated Month 3 and actual Month 3 for reference
- A "Reset" button clears the current quarter's data from localStorage
- Validate: Month 1 and Month 2 must be entered before calculating

---

## Summary of All Tax Rates (Quick Reference)

| Tax | Rate | Base |
|-----|------|------|
| VAT | 18% | Transaction value |
| Individual Income Tax | 0–30% | Annual profit (progressive) |
| Corporate Income Tax | 30% | Annual profit (flat) |
| WHT — Service (Resident) | 5% | Gross payment excl. VAT |
| WHT — Service (Non-Resident) | 15% | Gross payment excl. VAT |
| WHT — Interest | 10% | Gross payment excl. VAT |
| WHT — Royalty | 15% | Gross payment excl. VAT |
| WHT — Director Fees | 15% | Gross payment excl. VAT |
| WHT — Rent | 10% | Gross payment excl. VAT |
| WHT — Natural Resources | 15% | Gross payment excl. VAT |
| WHT — Insurance (Non-Resident) | 10% | Gross payment excl. VAT |
| WHT — Digital Content | 5% | Gross payment excl. VAT |
| WHT — Digital Asset | 3% | Gross payment excl. VAT |
| WHT — Agent Commissions | 10% | Gross payment excl. VAT |
| WHT — Government Goods | 2% | Gross payment excl. VAT |
| WHT — Minerals | 2% | Gross payment excl. VAT |
| WHT — Carbon Credits | 10% | Gross payment excl. VAT |
| PAYE | 0–30% | Monthly gross minus employee NSSF (progressive) |
| NSSF Employee | 10% | Gross monthly salary |
| NSSF Employer | 10% | Gross monthly salary |
| SDL | 3.5% | Monthly payroll (≥10 employees only) |
| WCF | 0.5% | Monthly payroll |
| City Service Levy (Q3 2025 onwards) | 0.25% | Adjusted quarterly turnover |
| City Service Levy (Q1–Q2 2025 and earlier) | 0.30% | Adjusted quarterly turnover |
