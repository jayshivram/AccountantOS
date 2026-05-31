# AccountantOS

**AccountantOS** is a private, invite-only workspace built for accountants managing multiple clients in Tanzania. It keeps every deadline, filing, task, and tax calculation in one place — synced across devices in real time.

---

## What it does

### Dashboard
The home screen. Shows all upcoming and overdue tax deadlines with live countdowns, a client-by-client completion heatmap, and today's open tasks — all at a glance.

### Clients
A full client list with tax type tags (VAT, PAYE, NSSF, Provisional Tax, City Levy, and more). Each client has its own filing status tracker where you mark returns as Pending, In Progress, or Completed.

### Tax Calendar
A month-by-month calendar with Tanzania tax deadlines overlaid on each due date. Covers VAT (20th), PAYE/SDL/WHT (7th), NSSF/WCF (last day of month), Provisional Tax, and City Levy (quarterly).

### Monthly Work
Per-client monthly checklists — bank statements, tally updates, stock sheets, VAT computations, and custom tasks. Track which work is done for each client each month.

### Tax Tool
13 built-in Tanzania tax calculators across five tabs:
- **VAT** — output, input, net payable
- **Provisional Tax** — annual estimate and quarterly instalments
- **WHT** — 19 withholding tax types with correct resident/non-resident rates
- **Employment** — PAYE, NSSF (employee + employer), SDL, WCF, full payslip with PDF export
- **City Levy** — turnover-based levy with automatic rate switching (pre/post 2025 Q3)

### Tasks
A general task manager with client linking, priority levels, and due dates. Keyboard shortcut `D` marks the selected task done, `N` creates a new one.

### Tally Tracker
Quick data-entry counter for tracking figures during bookkeeping sessions.

### Filing History
A full audit trail of every filing action — filterable by client, tax type, and date.

### Notes
Freeform client notes with search.

### Focus Mode
Distraction-free view that hides the sidebar and surfaces only the most urgent items.

### AI Assistant
Built-in assistant for quick accounting queries.

### Export / Import
Full JSON backup and restore of all app data from Settings.

---

## Key details

- **Invite-only** — access is restricted to authorised users only
- **Cloud synced** — all data syncs automatically across devices via Supabase
- **Dark mode** — default dark theme, togglable in Settings
- **Tanzania-specific** — deadlines, rates, and calculators follow TRA rules
- **Configurable tax rates** — all rates (VAT, PAYE bands, WHT types, SDL, WCF, City Levy) are editable in Settings with lock/unlock protection against accidental changes
- **PWA** — installable on desktop and mobile as a standalone app
