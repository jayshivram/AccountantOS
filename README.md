# AccountantOS

A personal accounting task & deadline manager built with React + TailwindCSS.
Designed for accountants managing multiple clients, tax deadlines, and ADHD-friendly workflows.

## Features

- **Tax Calendar Dashboard** — Live countdowns for VAT, PAYE/SDL/WHT, NSSF/WCF, Provisional Tax, City Levy
- **Client Management** — 22 pre-loaded clients with tax type tagging
- **Filing Tracker** — Mark each client's returns as Pending / In Progress / Completed
- **Progress Heatmap** — See which clients are done vs pending per deadline
- **Full Calendar View** — Month-by-month view with deadline overlays per day
- **Task Manager** — General tasks linked to clients with priority + due dates
- **Filing History** — Full audit trail of all submissions
- **Export / Import** — JSON backup of all your data
- **Keyboard Shortcuts** — `D` = mark task done, `N` = new task
- **Dark Mode** — Default dark theme, togglable in Settings
- **Team Collaboration** — User authentication and real-time syncing across devices via Supabase. Data is pushed to your personal cloud row automatically.

## Tax Deadline Rules

| Tax Type         | Period | Due Date             |
|-----------------|--------|----------------------|
| VAT              | Month  | 20th of next month   |
| PAYE/SDL/WHT     | Month  | 7th of next month    |
| NSSF/WCF         | Month  | 30th of next month   |
| Provisional Tax  | Quarterly | 31 Mar / 30 Jun / 30 Sep / 31 Dec |
| City Levy        | Quarterly | 31 Mar / 30 Jun / 30 Sep / 31 Dec |

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

Then open **http://localhost:5173** in your browser.

## Usage

1. **Dashboard** — Your main landing page. Shows all upcoming/overdue deadlines, progress bars, and today's tasks.
2. **Clients** — View/add/edit clients. Click **Filings** on any client to mark returns as done.
3. **Calendar** — Monthly calendar. Click any day to see deadlines and tasks.
4. **Tasks** — Create and manage general tasks. Use `D` to mark a selected task done.
5. **History** — Filter and review all past filings.
6. **Settings** (gear icon) — Export/import data, toggle dark mode, enable notifications.

## Data Backup

Use **Settings → Export JSON Backup** regularly to save your data.
To restore, use **Settings → Import JSON Backup**.

## Supabase Setup (Manual Steps)

You need to do this in your Supabase dashboard before going live or inviting your team:

1. **Authentication → Providers**: Enable the Email provider.
2. **Authentication → Users**: Click "Invite User" (or "Add User") for each team member. This keeps the app closed and invite-only.
3. **Table Editor → app_state → RLS**: Enable Row Level Security (RLS) on the `app_state` table. Add these two policies:
   - **SELECT**: `auth.role() = 'authenticated'`
   - **INSERT/UPDATE (upsert)**: `auth.role() = 'authenticated'`
   
   This locks the database so only your logged-in team can read or write any data.

> **Data migration note**: The first time each user logs in, their existing `localStorage` data will automatically push up to their new personal row in Supabase — no manual migration needed.
