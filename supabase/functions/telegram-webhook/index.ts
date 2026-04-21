// AccountantOS Telegram Bot — Smart Personal Assistant v2
// Deploy with: --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BOT_TOKEN    = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT_ID      = Deno.env.get('TELEGRAM_CHAT_ID')!;
const USER_ID      = Deno.env.get('APP_USER_ID')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRV = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface TaxReturn  { id: string; clientId: string; taxType: string; period: string; status: string; completedAt?: string; notes?: string; }
interface Client     { id: string; name: string; taxTypes: string[]; hidden?: boolean; notes?: string; }
interface Task       { id: string; title: string; status: string; priority: string; dueDate?: string; description?: string; category?: string; clientId?: string; completedAt?: string; createdAt?: string; }
interface Note       { id: string; title?: string; content: string; color?: string; category?: string; pinned?: boolean; createdAt?: string; updatedAt?: string; }
interface DayEntry   { timeIn?: string; timeOut?: string; breakStart?: string; breakStop?: string; }
interface TallyProgress { id: string; year: number; clientId: string; tallyUpdated: boolean; bankReconciled: boolean; financialsPrep: boolean; accountsFinalized: boolean; adjustmentsPassed: boolean; }

// ─── Formatters ───────────────────────────────────────────────────────────────
const MO_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MO_L = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DY_L = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmtPeriod(period: string): string {
  const [yr, mo] = period.split('-').map(Number);
  // App stores months 0-based (Jan=0, Dec=11)
  return (!yr || mo === undefined || mo < 0 || mo > 11) ? period : `${MO_S[mo]} ${yr}`;
}
function fmtDate(iso: string): string {
  const [, mo, dy] = iso.split('-').map(Number);
  return `${MO_S[mo-1]} ${dy}`;
}

function taxDueDate(taxType: string, period: string): string | null {
  if (!period.match(/^\d{4}-\d{2}$/)) return null;
  const [yr, mo] = period.split('-').map(Number);
  // App stores months 0-based (Jan=0, Dec=11). Use JS Date to get next month in ISO.
  const next = new Date(yr, mo + 1, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const t = taxType.toUpperCase();
  let day = 7;
  if (t === 'VAT') day = 20;
  else if (t === 'NSSF' || t === 'WCF') day = 30;
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(day)}`;
}

function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
}

function isActive(r: TaxReturn, cm: Map<string, Client>): boolean {
  if (r.status === 'completed') return false;
  const c = cm.get(r.clientId);
  if (!c || c.hidden) return false;
  // A return is only active if the client still has that tax type enabled
  return !c.taxTypes || c.taxTypes.includes(r.taxType);
}

function urg(d: number) { return d < 0 ? '🔴' : d === 0 ? '🟡' : d <= 3 ? '🟠' : '🟢'; }

function fmtDiff(d: number): string {
  if (d < 0)   return `${Math.abs(d)}d overdue`;
  if (d === 0) return 'due TODAY';
  if (d === 1) return 'due tomorrow';
  return `due in ${d}d`;
}

// Full formatted line for a pending return: "🔴 *Acme Ltd* — VAT Apr 2026 · due Apr 7 · 14d overdue"
function retLine(r: TaxReturn, cm: Map<string, Client>): string {
  const name = cm.get(r.clientId)?.name || r.clientId;
  const dd   = taxDueDate(r.taxType, r.period);
  const d    = dd ? daysDiff(dd) : null;
  const ddPart  = dd ? ` · due ${fmtDate(dd)}` : '';
  const diffPart = d !== null ? ` · _${fmtDiff(d)}_` : '';
  return `${d !== null ? urg(d) : '⚪'} *${name}* — ${r.taxType} ${fmtPeriod(r.period)}${ddPart}${diffPart}`;
}

// ─── Working hours ────────────────────────────────────────────────────────────
function toMins(t?: string): number {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
function calcDay(d: DayEntry): number {
  if (!d.timeIn || !d.timeOut) return 0;
  const worked = toMins(d.timeOut) - toMins(d.timeIn);
  const brk    = (d.breakStart && d.breakStop) ? toMins(d.breakStop) - toMins(d.breakStart) : 0;
  return Math.max(0, (worked - Math.max(0, brk)) / 60);
}
function isoWeekKey(date = new Date()): string {
  const tmp = new Date(date); tmp.setHours(0,0,0,0);
  tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
  const w1 = new Date(tmp.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${tmp.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}
const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
function fmtWeek(key: string, week: Record<string, DayEntry>): string {
  const lines = [`⏱ *Working Hours — ${key}*`, ''];
  let total = 0, days = 0;
  for (const day of DAY_ORDER) {
    const e = week[day]; if (!e?.timeIn) continue;
    const h = calcDay(e); total += h; days++;
    const brk = (e.breakStart && e.breakStop) ? ` (break ${e.breakStart}–${e.breakStop})` : '';
    lines.push(`*${day}:* ${e.timeIn}–${e.timeOut}${brk} → _${h.toFixed(1)}h_`);
  }
  if (!days) { lines.push('No entries logged yet.'); return lines.join('\n'); }
  lines.push('', `⏱ *Total: ${total.toFixed(1)}h* · avg ${(total/days).toFixed(1)}h/day · ${days} day${days > 1 ? 's' : ''}`);
  return lines.join('\n');
}

// ─── NL Intent detection ──────────────────────────────────────────────────────
function detectIntent(raw: string): string {
  const t = raw.toLowerCase().trim();
  if (/^(hi|hello|hey|morning|good morning|good evening|good afternoon|yo|sup|hiya|howdy)/.test(t)) return 'greeting';
  if (/^(\?|help)$/.test(t) || /^help\s+(me|please|with)/.test(t)) return 'help';
  if (/^(\/start|start)$/.test(t)) return 'start';
  if (/\b(focus|what.*(should|do|must|need).*(i|me).*do|action.?item|priorit|what.*first|my.*priorit|what.*next|next.*step)\b/.test(t)) return 'focus';
  if (/\b(today.?plan|plan.*today)\b/.test(t)) return 'focus';
  if (/\b(brief|summary|overview|digest|status report|how.*going|how.*everything)\b/.test(t)) return 'brief';
  if (/\b(hour|worked|working.hours|timesheet|time.?log|how.*(long|many.*hour))\b/.test(t)) {
    if (/\blast\b/.test(t)) return 'hours_last';
    if (/(\d{4}-W\d{2})/i.test(raw)) return 'hours_week';
    return 'hours_this';
  }
  if (/^notes?\s*$/.test(t)) return 'notes_list';
  if (/^(find|search|look.*up)\s+\S/.test(t)) return 'search';
  if (/^notes?\s+\S/.test(t)) return 'note_create';
  if (/^note\s+\S/.test(t)) return 'note_create';
  if (/^(remember(\s+to)?|remind\s*me(\s+to)?|jot\s*(down)?|quick\s*note|save\s*this|memo)\s+\S/.test(t)) return 'note_create';
  if (/^tasks?\s*$/.test(t) || /^(todos?|to-do)$/.test(t)) return 'tasks';
  if (/^task\s+\S/.test(t) || /^(add|new|create)\s+task\s+\S/.test(t)) return 'task_create';
  if (/^done\s+task\s+\S/i.test(raw)) return 'task_done';
  if (/\b(high.?priority|urgent tasks?|critical tasks?)\b/.test(t)) return 'tasks_high';
  if (/\btask.*overdue|overdue.*task/.test(t)) return 'tasks_overdue';
  if (/^due\s*$/.test(t) || t === 'urgent') return 'due';
  if (/^today\s*$/.test(t) || /\bdue today\b/.test(t)) return 'today';
  if (/^week\s*$/.test(t) || /\b(this week|due.*week|week.*due)\b/.test(t)) return 'week';
  if (/^overdue\s*$/.test(t) || /\bwhat.*(overdue|late|missed)\b/.test(t)) return 'overdue';
  if (/^(month|this month)\s*$/.test(t) || /\bthis month'?s?\b/.test(t)) return 'month';
  if (/^pending(\s+\S+)?\s*$/.test(t)) return 'pending';
  if (/^clients?\s*$/.test(t) || t === 'all clients') return 'clients';
  if (/^client\s+\S/.test(t)) return 'client';
  if (/^done\s+(all\s+)?\S/i.test(raw)) return 'done_return';
  if (/\b(tally|annual|year.?end|yearend)\b/.test(t)) return 'tally';
  if (/\b(stats|statistics|how many|completion|progress report)\b/.test(t)) return 'stats';
  if (/\b(recent|what.*(completed|finished))\b/.test(t) && !/^done\s/.test(t)) return 'recent';
  // Personality / conversation
  if (/^(thank(s| you)|thx|cheers|appreciate[sd]?|great|awesome|perfect|nice one|good job|well done|brilliant|excellent|amazing|fantastic|superb|lovely)/.test(t)) return 'thanks';
  if (/\bhow are you|how.?s (it going|everything|life|work|things)|how.*you doing/.test(t)) return 'bot_status';
  if (/^(yes|no|ok|okay|sure|alright|got it|understood|noted|makes sense|sounds good|fair enough|yep|nope|yup|roger|copy that)$/.test(t)) return 'affirmation';
  if (/^(haha|lol|😂|😄|😅|ha+|hehe|lmao|😆)/.test(t)) return 'laugh';
  // Client management
  if (/^(hide|archive)\s+\S/.test(t)) return 'hide_client';
  if (/^(unhide|restore|unarchive)\s+(client\s+)?\S/.test(t)) return 'unhide_client';
  if (/^(add|new|create)\s+client\s+\S/.test(t)) return 'add_client';
  // Return management
  if (/^add\s+(vat|paye|sdl|nssf|wcf|wht|heslb|provisional|city|roi)\s+\S/i.test(raw)) return 'add_return';
  if (/^(add|new|create)\s+(return|filing|tax)\s+\S/.test(t)) return 'add_return';
  if (/^(delete|remove)\s+return\s+\S/.test(t)) return 'delete_return';
  // Task / note deletion
  if (/^(delete|remove)\s+task\s+\S/.test(t)) return 'delete_task';
  if (/^(delete|remove)\s+note\s+\S/.test(t)) return 'delete_note';
  // Hours logging
  if (/^log\s+(mon|tue|wed|thu|fri|sat|sun|hours?)\s+\S/i.test(raw)) return 'log_hours';
  if (/^(clear|reset)\s+hours?\s*/i.test(raw)) return 'clear_hours';
  // Export
  if (/\b(export|download|generate)\s*(excel|xlsx|pdf|report|csv)?\b/.test(t)) return 'export';
  // Filing gap / status detection
  if (/\b(who.*(hasn.?t|haven.?t|not\s+filed|missing|didn.?t|still\s+pending|remaining)|which.*(client|company).*(haven.?t|hasn.?t|not\s+filed|missing|still|pending)|(remaining|missing|unfiled|not.?filed)\s+.*(return|vat|paye|sdl|nssf|wcf|wht))\b/.test(t)) return 'who_missing';
  if (/\b(vat|paye|sdl|nssf|wcf|wht|heslb)\b.{0,40}\b(remaining|missing|unfiled|pending|status|who|which|filed|client)\b/.test(t)) return 'who_missing';
  if (/\b(status|progress|overview|report)\s+(of\s+|for\s+)?(vat|paye|sdl|nssf|wcf|wht)\b/.test(t)) return 'who_missing';
  // Tally step updates
  if (/\b(mark|update|tick|set|complete|done)\s+(tally|year.?end|bank\s+rec|bank\s+reconcil|financial|accounts?\s+final|adjustments?)\b/.test(t)) return 'update_tally';
  if (/\b(bank\s+reconcil|financials?\s+(prep|done|complete|prepar)|accounts?\s+(final|done|complet)|tally\s+(update|updat|done|upd)|adjustments?\s+(pass|done))\b/.test(t)) return 'update_tally';
  return 'unknown';
}

// ─── I/O + State ──────────────────────────────────────────────────────────────
async function send(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
  });
}
async function load(supa: ReturnType<typeof createClient>) {
  const { data, error } = await supa.from('app_state').select('data').eq('id', USER_ID).single();
  if (error || !data) return null;
  return data.data as Record<string, unknown>;
}
async function save(supa: ReturnType<typeof createClient>, state: Record<string, unknown>) {
  const { error } = await supa.from('app_state').upsert({ id: USER_ID, data: state, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Save failed: ${error.message}`);
}
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK', { status: 200 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return new Response('OK', { status: 200 }); }
  const rawText: string = ((body?.message as Record<string,unknown>)?.text as string || '').trim();
  if (!rawText) return new Response('OK', { status: 200 });

  try {
    const supa    = createClient(SUPABASE_URL, SUPABASE_SRV);
    const state   = await load(supa);
    if (!state) { await send('⚠️ Could not load data.'); return new Response('OK'); }

    const clients = (state.clients       as Client[])        || [];
    const returns = (state.taxReturns    as TaxReturn[])     || [];
    const tasks   = (state.tasks         as Task[])          || [];
    const notes   = (state.notes         as Note[])          || [];
    const wh      = (state.workingHours  as Record<string, Record<string, DayEntry>>) || {};
    const tally   = (state.tallyProgress as TallyProgress[]) || [];

    const cm   = new Map<string, Client>(clients.map(c => [c.id, c]));
    const it   = detectIntent(rawText);
    const lc   = rawText.toLowerCase().trim();

    // Pre-compute common filtered lists
    const pending = returns
      .filter(r => isActive(r, cm))
      .sort((a, b) => (taxDueDate(a.taxType, a.period) || '9999').localeCompare(taxDueDate(b.taxType, b.period) || '9999'));
    const overdue  = pending.filter(r => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) < 0; });
    const dueToday = pending.filter(r => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) === 0; });
    const dueSoon  = pending.filter(r => { const dd = taxDueDate(r.taxType, r.period); if (!dd) return false; const d = daysDiff(dd); return d > 0 && d <= 3; });

    // ── GREETING ──────────────────────────────────────────────────────────
    if (it === 'greeting') {
      const h = new Date().getHours();
      const g = h < 5 ? 'Up early' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      const wk = isoWeekKey(); const wd = wh[wk] || {};
      const wkh = Object.values(wd).reduce((s, d) => s + calcDay(d), 0);
      const hiTasks = tasks.filter(t => t.status !== 'completed' && t.priority === 'high');
      const lines: string[] = [`${g}! 👋`, ''];
      if (overdue.length) {
        lines.push(`🔴 *${overdue.length} OVERDUE RETURN${overdue.length > 1 ? 'S' : ''}:*`);
        overdue.slice(0, 3).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period)!;
          lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`);
          lines.push(`    _was due ${fmtDate(dd)}, ${Math.abs(daysDiff(dd))}d ago_`);
        });
        if (overdue.length > 3) lines.push(`  _...+${overdue.length - 3} more — run \`overdue\` to see all_`);
        lines.push('');
      }
      if (dueToday.length) {
        lines.push(`🟡 *DUE TODAY:*`);
        dueToday.forEach(r => lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`));
        lines.push('');
      }
      if (!overdue.length && !dueToday.length) {
        if (dueSoon.length) lines.push(`🟠 ${dueSoon.length} return${dueSoon.length > 1 ? 's' : ''} due in the next 3 days`);
        else lines.push('✅ No urgent returns — you\'re on top of things!');
      }
      if (hiTasks.length) lines.push(`⚡ ${hiTasks.length} high-priority task${hiTasks.length > 1 ? 's' : ''} pending`);
      if (wkh > 0) lines.push(`⏱ ${wkh.toFixed(1)}h logged this week`);
      const allClear = !overdue.length && !dueToday.length && !hiTasks.length;
      lines.push('', allClear ? '_Have a great day! 😊_' : '_Say `focus` for your action list._');
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── FOCUS / ACTION LIST ───────────────────────────────────────────────
    if (it === 'focus') {
      const lines: string[] = ['🎯 *Your Action List:*', ''];
      let count = 0;
      if (overdue.length) {
        lines.push('🔴 *FILE THESE NOW — Overdue:*');
        overdue.slice(0, 5).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period)!;
          lines.push(`  ${++count}. *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`);
          lines.push(`     _was due ${fmtDate(dd)}, ${Math.abs(daysDiff(dd))}d ago — late penalties may apply!_`);
        });
        if (overdue.length > 5) lines.push(`  _...+${overdue.length - 5} more overdue_`);
        lines.push('');
      }
      if (dueToday.length) {
        lines.push('🟡 *FILE TODAY:*');
        dueToday.forEach(r => {
          lines.push(`  ${++count}. *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`);
        });
        lines.push('');
      }
      if (dueSoon.length && count < 8) {
        lines.push('🟠 *FILE SOON (1–3 days):*');
        dueSoon.slice(0, 4).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period)!;
          lines.push(`  ${++count}. *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)} · _${fmtDate(dd)}_`);
        });
        lines.push('');
      }
      const hiTasks = tasks.filter(t => t.status !== 'completed' && t.priority === 'high').slice(0, 4);
      if (hiTasks.length) {
        lines.push('⚡ *HIGH PRIORITY TASKS:*');
        hiTasks.forEach(t => {
          lines.push(`  ${++count}. ${t.title}${t.dueDate ? ` · _due ${t.dueDate}_` : ''}`);
        });
        lines.push('');
      }
      if (!count) lines.push('✅ *Nothing urgent — you\'re all caught up!*', '', '_Check `week` for upcoming returns._');
      else lines.push(`_${count} item${count > 1 ? 's' : ''} · \`done [client] [type]\` to mark returns filed_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── START ─────────────────────────────────────────────────────────────
    if (it === 'start') {
      await send([
        '👋 *AccountantOS Bot — Your Smart Accounting Assistant*', '',
        'I understand natural language — just ask things like:',
        '_"what\'s overdue?"_, _"show my hours"_, _"find [client]"_', '',
        '📋 *TAX RETURNS*',
        '  `due` — expiring in the next 3 days',
        '  `overdue` — missed deadlines',
        '  `week` — everything due this week',
        '  `month` — this month\'s pending returns',
        '  `pending VAT` — filter by type',
        '  `done [Client] VAT` — mark as filed',
        '  `add VAT [client] 2026-04` — add a new filing', '',
        '⏱ *WORKING HOURS*',
        '  `hours` — this week\'s breakdown',
        '  `hours last` — last week',
        '  `log Mon 9:00 17:00` — log a day\'s hours', '',
        '✅ *TASKS*',
        '  `tasks` — all pending, sorted by priority',
        '  `task Buy stamps` — create task',
        '  `done task Invoice` — mark done',
        '  `delete task [title]` — remove task', '',
        '📝 *NOTES*',
        '  `notes` — recent list',
        '  `note Call client X` — save note',
        '  `remember to check VAT` — also saves a note', '',
        '🏢 *CLIENTS*',
        '  `clients` — all active with pending count',
        '  `client [name]` — full details, returns, tally, tasks',
        '  `hide [name]` / `unhide [name]` — visibility', '',
        '📊 *REPORTS*',
        '  `hi` — quick daily status',
        '  `focus` — prioritized action list',
        '  `brief` — full summary',
        '  `stats` — completion statistics',
        '  `tally` — year-end progress',
        '  `export excel` — export instructions', '',
        '_Type `help` for the full guide with descriptions._',
      ].join('\n'));
      return new Response('OK');
    }

    // ── HELP ──────────────────────────────────────────────────────────────
    if (it === 'help') {
      await send([
        '🤖 *Help — AccountantOS Bot*', '',
        '💡 _I understand natural language — just ask naturally!_',
        '_"what\'s overdue?"_, _"what should I work on?"_, _"show hours"_', '',
        '━━━━━━━━━━━━━━━',
        '📋 *TAX RETURNS*',
        '`due` — Returns due in the next 3 days',
        '`overdue` — Returns past deadline (file immediately!)',
        '`today` — Returns due today specifically',
        '`week` — This week, grouped by day',
        '`month` — This month\'s pending returns',
        '`pending` — All pending, grouped by tax type',
        '`pending VAT` — Pending for one type only',
        '`done [Client] VAT` — Mark a return as filed',
        '`done all [Client]` — Mark ALL pending returns for a client', '',
        '━━━━━━━━━━━━━━━',
        '⏱ *WORKING HOURS*',
        '`hours` — This week\'s daily breakdown + total',
        '`hours last` — Last week\'s hours',
        '`hours 2026-W15` — Specific week by ISO number',
        '`log Mon 9:00 17:00` — Log a day\'s hours',
        '`log Mon 9:00 17:00 break 13:00 14:00` — With break time',
        '`clear hours` — Clear this week\'s entries', '',
        '━━━━━━━━━━━━━━━',
        '✅ *TASKS*',
        '`tasks` — All pending, grouped by priority',
        '`urgent` — High priority tasks only',
        '`task [title]` — Create a task (high priority, due in 3 days)',
        '`done task [partial title]` — Mark task complete',
        '`delete task [partial title]` — Permanently remove a task', '',
        '━━━━━━━━━━━━━━━',
        '📝 *NOTES*',
        '`notes` — Recent notes (pinned first)',
        '`note [text]` — Save a quick note',
        '`remember to [text]` — Also saves a note',
        '`find [keyword]` — Search notes, tasks, AND clients',
        '`delete note [keyword]` — Remove a note', '',
        '━━━━━━━━━━━━━━━',
        '🏢 *CLIENTS & FILINGS*',
        '`clients` — All active, sorted by urgency',
        '`client [name]` — Returns + due dates + tally + tasks',
        '`add client [name]` — Create a new client',
        '`hide [name]` — Hide client from all reports',
        '`unhide [name]` — Restore a hidden client',
        '`add VAT [client] [period]` — Add a new filing',
        '`add PAYE [client] March 2026` — Month name works too',
        '`delete return [client] [type]` — Remove a pending return', '',
        '━━━━━━━━━━━━━━━',
        '📊 *SUMMARIES & EXPORT*',
        '`hi` — Quick daily status with overdue details',
        '`focus` — Prioritized action list right now',
        '`brief` — Full summary with all urgent items',
        '`stats` — Completion percentages + counts',
        '`recent` — Filed + completed this week',
        '`tally` — Year-end progress per client with next step',
        '`export excel` — How to export data from the app',
      ].join('\n'));
      return new Response('OK');
    }

    // ── BRIEF ─────────────────────────────────────────────────────────────
    if (it === 'brief') {
      const d   = new Date();
      const wk  = isoWeekKey(); const wd = wh[wk] || {};
      const wkh = Object.values(wd).reduce((s, e) => s + calcDay(e), 0);
      const pTasks = tasks.filter(t => t.status !== 'completed');
      const hi     = pTasks.filter(t => t.priority === 'high');
      const lines: string[] = [`📊 *Brief — ${DY_L[d.getDay()]}, ${d.getDate()} ${MO_S[d.getMonth()]}*`, ''];
      lines.push('📋 *Returns:*');
      if (overdue.length) {
        lines.push(`🔴 Overdue — ${overdue.length} return${overdue.length > 1 ? 's' : ''}:`);
        overdue.slice(0, 5).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period)!;
          lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`);
          lines.push(`    _was due ${fmtDate(dd)}, ${Math.abs(daysDiff(dd))}d ago_`);
        });
        if (overdue.length > 5) lines.push(`  _...+${overdue.length - 5} more_`);
      }
      if (dueToday.length) {
        lines.push(`🟡 Due Today — ${dueToday.length}:`);
        dueToday.forEach(r => lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`));
      }
      if (dueSoon.length) {
        lines.push(`🟠 Due in 1–3 Days — ${dueSoon.length}:`);
        dueSoon.slice(0, 4).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period)!;
          lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)} · _${fmtDate(dd)}_`);
        });
      }
      if (!overdue.length && !dueToday.length && !dueSoon.length) {
        const nxt = pending.find(r => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) > 3; });
        if (nxt) {
          const dd = taxDueDate(nxt.taxType, nxt.period)!;
          lines.push(`✅ Nothing urgent · Next: *${cm.get(nxt.clientId)?.name}* — ${nxt.taxType} ${fmtPeriod(nxt.period)} · _${fmtDate(dd)}_`);
        } else lines.push('✅ All returns up to date — great work!');
      }
      lines.push('');
      if (hi.length) {
        lines.push(`⚡ *High Priority Tasks (${hi.length}):*`);
        hi.slice(0, 3).forEach(t => lines.push(`  • ${t.title}${t.dueDate ? ` · _${t.dueDate}_` : ''}`));
        if (pTasks.length > hi.length) lines.push(`  _+${pTasks.length - hi.length} other pending tasks_`);
      } else {
        lines.push(`✅ *Tasks:* ${pTasks.length} pending${hi.length ? ` · ${hi.length} high priority ⚡` : ''}`);
      }
      lines.push(`⏱ *This week:* ${wkh > 0 ? wkh.toFixed(1) + 'h logged' : 'no hours logged yet'}`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── WORKING HOURS ─────────────────────────────────────────────────────
    if (it === 'hours_this' || it === 'hours_last' || it === 'hours_week') {
      let key = isoWeekKey();
      if (it === 'hours_last') key = isoWeekKey(new Date(Date.now() - 7 * 86400000));
      if (it === 'hours_week') { const m = rawText.match(/(\d{4}-W\d{2})/i); if (m) key = m[1].toUpperCase(); }
      const wd = wh[key];
      if (!wd || !Object.keys(wd).length) {
        const avail = Object.keys(wh).sort().reverse().slice(0, 6);
        await send(`⏱ No hours logged for *${key}*.\n\n${avail.length ? `Available weeks:\n${avail.map(k => `• ${k}`).join('\n')}` : 'No weeks logged yet.'}\n\n_Log hours in the AccountantOS app._`);
      } else {
        await send(fmtWeek(key, wd));
      }
      return new Response('OK');
    }

    // ── NOTES LIST ────────────────────────────────────────────────────────
    if (it === 'notes_list') {
      if (!notes.length) { await send('📝 No notes yet.\n\n*Create one:*\n`note Call back client X`\n`remember to check VAT exemption for Acme`'); return new Response('OK'); }
      const sorted = [...notes].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const pinned = sorted.filter(n => n.pinned);
      const rest   = sorted.filter(n => !n.pinned).slice(0, 8);
      const lines: string[] = [`📝 *Notes (${notes.length} total):*`, ''];
      if (pinned.length) {
        lines.push('📌 *Pinned:*');
        pinned.forEach(n => {
          lines.push(`  • *${n.title || n.content.slice(0, 50)}*${n.category ? ` _[${n.category}]_` : ''}`);
        });
        lines.push('');
      }
      lines.push('🕐 *Recent:*');
      rest.forEach((n, i) => {
        const title = n.title || n.content.slice(0, 50);
        const dt    = (n.createdAt || '').slice(0, 10);
        const cat   = n.category ? ` _[${n.category}]_` : '';
        lines.push(`  ${i + 1}. *${title}*${cat} · _${dt}_`);
      });
      lines.push('', '_`find [keyword]` to search · `note [text]` to add_');
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── SEARCH ────────────────────────────────────────────────────────────
    if (it === 'search') {
      const q  = rawText.replace(/^(find|search|look.*up)\s+/i, '').trim();
      const ql = q.toLowerCase();
      const mn = notes.filter(n => (n.title || '').toLowerCase().includes(ql) || n.content.toLowerCase().includes(ql)).slice(0, 5);
      const mt = tasks.filter(t => t.status !== 'completed' && (t.title.toLowerCase().includes(ql) || (t.description || '').toLowerCase().includes(ql))).slice(0, 5);
      const mc = clients.filter(c => c.name.toLowerCase().includes(ql)).slice(0, 4);
      if (!mn.length && !mt.length && !mc.length) {
        await send(`🔍 No results for _"${q}"_\n\nTips:\n• Try a client name\n• Try a note keyword\n• Try a task title`);
        return new Response('OK');
      }
      const lines: string[] = [`🔍 *Search: "${q}"*`, ''];
      if (mc.length) {
        lines.push('🏢 *Clients:*');
        mc.forEach(c => {
          const p = returns.filter(r => r.clientId === c.id && isActive(r, cm)).length;
          const o = returns.filter(r => r.clientId === c.id && isActive(r, cm) && (() => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) < 0; })()).length;
          lines.push(`  • *${c.name}*${o > 0 ? ` — 🔴 ${o} overdue` : p > 0 ? ` — ${p} pending` : ' ✅'}`);
        });
      }
      if (mn.length) {
        if (mc.length) lines.push('');
        lines.push('📝 *Notes:*');
        mn.forEach(n => {
          const title   = n.title || n.content.slice(0, 50);
          const preview = n.content.replace(/\n/g, ' ').slice(0, 90);
          lines.push(`  • *${title}*\n    _${preview}${n.content.length > 90 ? '…' : ''}_`);
        });
      }
      if (mt.length) {
        if (mc.length || mn.length) lines.push('');
        lines.push('✅ *Tasks:*');
        mt.forEach(t => {
          const p = t.priority === 'high' ? ' 🔴' : t.priority === 'medium' ? ' 🟡' : '';
          lines.push(`  • ${t.title}${t.dueDate ? ` · _${t.dueDate}_` : ''}${p}`);
        });
      }
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── NOTE CREATE ───────────────────────────────────────────────────────
    if (it === 'note_create') {
      let content = rawText
        .replace(/^notes?\s+/i, '')
        .replace(/^remember(\s+to)?\s+/i, '')
        .replace(/^remind\s*me(\s+to)?\s+/i, '')
        .replace(/^jot(\s+down)?\s+/i, '')
        .replace(/^quick\s*note\s+/i, '')
        .replace(/^save\s+this\s+/i, '')
        .replace(/^memo\s+/i, '')
        .replace(/^note\s+/i, '')
        .trim();
      if (!content) { await send('Usage: `note Your thought here`\nOr: `remember to check WHT for Acme`'); return new Response('OK'); }
      const title = content.split('\n')[0].slice(0, 65);
      const nn: Note = { id: uid(), title, content, color: 'yellow', category: 'General', pinned: false, createdAt: now(), updatedAt: now() };
      await save(supa, { ...state, notes: [nn, ...notes] });
      await send(`📝 *Note saved!*\n_"${title.slice(0, 100)}"_\n\nSee all notes: \`notes\``);
      return new Response('OK');
    }

    // ── TASKS ─────────────────────────────────────────────────────────────
    if (it === 'tasks') {
      const allPending = tasks
        .filter(t => t.status !== 'completed')
        .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] ?? 1) - ({ high: 0, medium: 1, low: 2 }[b.priority] ?? 1));
      if (!allPending.length) { await send('✅ *No pending tasks — all caught up!* 🎉\n\nAdd one: `task Buy stamps`'); return new Response('OK'); }
      const highT   = allPending.filter(t => t.priority === 'high');
      const mediumT = allPending.filter(t => t.priority === 'medium');
      const lowT    = allPending.filter(t => t.priority !== 'high' && t.priority !== 'medium');
      const lines: string[] = [`✅ *Tasks — ${allPending.length} pending:*`, ''];
      if (highT.length) {
        lines.push('🔴 *High Priority:*');
        highT.slice(0, 7).forEach((t, i) => {
          lines.push(`  ${i + 1}. *${t.title}*${t.dueDate ? ` · _${t.dueDate}_` : ''}${t.category ? ` [${t.category}]` : ''}`);
        });
      }
      if (mediumT.length) {
        if (highT.length) lines.push('');
        lines.push('🟡 *Medium Priority:*');
        mediumT.slice(0, 5).forEach((t, i) => lines.push(`  ${i + 1}. ${t.title}${t.dueDate ? ` · _${t.dueDate}_` : ''}`));
      }
      if (lowT.length && highT.length + mediumT.length < 10) {
        if (highT.length || mediumT.length) lines.push('');
        lines.push('⚪ *Low Priority:*');
        lowT.slice(0, 4).forEach((t, i) => lines.push(`  ${i + 1}. ${t.title}`));
      }
      lines.push('', `_\`done task [partial title]\` to complete · \`task [title]\` to add_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── HIGH PRIORITY ─────────────────────────────────────────────────────
    if (it === 'tasks_high' || lc === 'urgent') {
      const hi = tasks.filter(t => t.status !== 'completed' && t.priority === 'high');
      if (!hi.length) { await send('✅ No high-priority tasks right now!\n\nSee all tasks with `tasks`.'); return new Response('OK'); }
      const lines = [`⚡ *High Priority Tasks (${hi.length}):*`, ''];
      hi.slice(0, 10).forEach((t, i) => {
        const due  = t.dueDate ? ` · _due ${t.dueDate}_` : '';
        const desc = t.description ? `\n     _${t.description.slice(0, 80)}_` : '';
        lines.push(`${i + 1}. 🔴 *${t.title}*${due}${desc}`);
      });
      lines.push('', '_`done task [partial title]` to mark complete_');
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── OVERDUE TASKS ─────────────────────────────────────────────────────
    if (it === 'tasks_overdue') {
      const today_str = new Date().toISOString().slice(0, 10);
      const od = tasks
        .filter(t => t.status !== 'completed' && t.dueDate && t.dueDate < today_str)
        .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''));
      if (!od.length) { await send('✅ No overdue tasks!'); return new Response('OK'); }
      const lines = [`🚨 *Overdue Tasks (${od.length}):*`, ''];
      od.slice(0, 10).forEach((t, i) => {
        lines.push(`${i + 1}. 🔴 *${t.title}*`);
        lines.push(`   _Was due ${t.dueDate} · ${Math.abs(daysDiff(t.dueDate!))}d ago_`);
      });
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── TASK CREATE ───────────────────────────────────────────────────────
    if (it === 'task_create') {
      let tcText = rawText.replace(/^(add\s+|new\s+|create\s+)?task\s+/i, '').trim();
      // Parse priority from text
      let tcPriority: Task['priority'] = 'medium';
      if (/\b(urgent|asap|critical|immediately|high\s*priority|high-priority)\b/i.test(tcText)) tcPriority = 'high';
      else if (/\b(low\s*priority|low-priority|whenever|minor|not\s+urgent)\b/i.test(tcText)) tcPriority = 'low';
      tcText = tcText.replace(/\b(urgent|asap|critical|immediately|high\s*priority|high-priority|low\s*priority|low-priority|whenever|minor|not\s+urgent)\b/gi, '').trim();
      // Parse due date from text
      const tcBase = new Date(); tcBase.setHours(0,0,0,0);
      let tcDue = new Date(tcBase); tcDue.setDate(tcDue.getDate() + 3);
      const tcLow = tcText.toLowerCase();
      const tcIso = tcText.match(/\b(\d{4}-\d{2}-\d{2})\b/);
      const tcIn  = tcLow.match(/\bin\s+(\d+)\s+days?\b/);
      const TC_DAYS: Record<string,number> = { monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6,sunday:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,sun:0 };
      if (tcIso) {
        tcDue = new Date(tcIso[1] + 'T00:00:00'); tcText = tcText.replace(tcIso[0], '').trim();
      } else if (tcIn) {
        tcDue = new Date(tcBase); tcDue.setDate(tcDue.getDate() + parseInt(tcIn[1])); tcText = tcText.replace(tcIn[0], '').trim();
      } else if (/\btoday\b/i.test(tcLow)) {
        tcDue = new Date(tcBase); tcText = tcText.replace(/\btoday\b/gi, '').trim();
      } else if (/\btomorrow\b/i.test(tcLow)) {
        tcDue = new Date(tcBase); tcDue.setDate(tcDue.getDate() + 1); tcText = tcText.replace(/\btomorrow\b/gi, '').trim();
      } else if (/\bnext\s+week\b/i.test(tcLow)) {
        tcDue = new Date(tcBase); tcDue.setDate(tcDue.getDate() + 7); tcText = tcText.replace(/\bnext\s+week\b/gi, '').trim();
      } else if (/\bend\s+of\s+(the\s+)?week\b/i.test(tcLow)) {
        tcDue = new Date(tcBase); const dFri = (5 - tcBase.getDay() + 7) % 7 || 7; tcDue.setDate(tcDue.getDate() + dFri); tcText = tcText.replace(/\bend\s+of\s+(the\s+)?week\b/gi, '').trim();
      } else {
        const tcDayM = tcLow.match(/\b(?:(?:next|this)\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/);
        if (tcDayM) {
          const td = TC_DAYS[tcDayM[1]]; if (td !== undefined) { const diff = (td - tcBase.getDay() + 7) % 7 || 7; tcDue = new Date(tcBase); tcDue.setDate(tcDue.getDate() + diff); }
          tcText = tcText.replace(new RegExp('(?:(?:next|this)\\s+)?' + tcDayM[1], 'gi'), '').trim();
        }
      }
      tcText = tcText.replace(/\bby\s*$/i, '').replace(/\s{2,}/g, ' ').trim();
      const title = tcText.split('\n')[0].slice(0, 80).trim();
      if (!title) { await send('Usage: `task What needs to be done`\n\nExamples:\n`task Call TRA tomorrow urgent`\n`task Submit VAT by Friday`\n`task Review accounts in 5 days`'); return new Response('OK'); }
      const tcDueDateStr = tcDue.toISOString().slice(0, 10);
      const priEmoji = tcPriority === 'high' ? '🔴' : tcPriority === 'medium' ? '🟡' : '⚪';
      const newTask: Task = { id: uid(), title, status: 'pending', priority: tcPriority, dueDate: tcDueDateStr, description: '', category: 'Telegram', createdAt: now() };
      await save(supa, { ...state, tasks: [...tasks, newTask] });
      await send(`✅ *Task created!*\n"${title}"\n_${priEmoji} ${tcPriority[0].toUpperCase() + tcPriority.slice(1)} priority · Due: ${tcDueDateStr}_\n\nComplete: \`done task ${title.split(' ').slice(0, 3).join(' ')}\``);
      return new Response('OK');
    }

    // ── TASK DONE ─────────────────────────────────────────────────────────
    if (it === 'task_done') {
      const q = rawText.replace(/^done\s+task\s+/i, '').trim().toLowerCase();
      const matches = tasks.filter(t => t.status !== 'completed' && t.title.toLowerCase().includes(q));
      if (!matches.length) {
        const suggestions = tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => `• ${t.title}`).join('\n');
        await send(`❓ No task matching _"${q}"_\n\nYour pending tasks:\n${suggestions || 'none'}\n\nUse partial name, e.g. \`done task Invoice\``);
        return new Response('OK');
      }
      const f = matches[0];
      await save(supa, { ...state, tasks: tasks.map(t => t.id === f.id ? { ...t, status: 'completed', completedAt: now() } : t) });
      const extra = matches.length > 1 ? `\n_${matches.length - 1} other similar task${matches.length > 2 ? 's' : ''} still pending_` : '';
      await send(`✅ *Done: "${f.title}"* 🎉${extra}`);
      return new Response('OK');
    }

    // ── DUE SOON ──────────────────────────────────────────────────────────
    if (it === 'due') {
      const list = pending.filter(r => { const dd = taxDueDate(r.taxType, r.period); if (!dd) return false; const d = daysDiff(dd); return d >= 0 && d <= 3; });
      if (!list.length) {
        const nxt = pending.find(r => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) > 3; });
        if (nxt) {
          const dd = taxDueDate(nxt.taxType, nxt.period)!;
          await send(`✅ Nothing due in 3 days.\n\nNext: *${cm.get(nxt.clientId)?.name}* — ${nxt.taxType} ${fmtPeriod(nxt.period)} · _due ${fmtDate(dd)} (in ${daysDiff(dd)}d)_`);
        } else await send('✅ Nothing due soon — all clear!');
        return new Response('OK');
      }
      const lines = [`⚡ *Due in Next 3 Days (${list.length}):*`, '', ...list.map(r => retLine(r, cm))];
      lines.push('', `_\`done [client] [type]\` to mark as filed_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── TODAY ─────────────────────────────────────────────────────────────
    if (it === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (!dueToday.length) { await send(`✅ Nothing due today (${fmtDate(todayStr)})!\n\nUse \`week\` to see upcoming returns.`); return new Response('OK'); }
      const lines = [`📅 *Due Today — ${fmtDate(todayStr)} (${dueToday.length}):*`, ''];
      dueToday.forEach(r => lines.push(`🟡 *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`));
      lines.push('', '_File these today! · `done [client] [type]` to mark complete_');
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── WEEK ──────────────────────────────────────────────────────────────
    if (it === 'week') {
      const list = pending.filter(r => { const dd = taxDueDate(r.taxType, r.period); if (!dd) return false; const d = daysDiff(dd); return d >= 0 && d <= 7; });
      if (!list.length) { await send('✅ Nothing due this week!\n\nUse `month` to see this month\'s returns.'); return new Response('OK'); }
      const lines = [`📆 *Due This Week (${list.length}):*`, ''];
      // Group by day offset
      const byDay = new Map<number, TaxReturn[]>();
      list.forEach(r => { const d = daysDiff(taxDueDate(r.taxType, r.period)!); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(r); });
      [...byDay.keys()].sort((a, b) => a - b).forEach(d => {
        const label = d === 0 ? `🟡 *Today:*` : d === 1 ? `🟠 *Tomorrow:*` : `🟢 *In ${d} days (${fmtDate(taxDueDate(byDay.get(d)![0].taxType, byDay.get(d)![0].period)!)}):*`;
        lines.push(label);
        byDay.get(d)!.forEach(r => lines.push(`  • *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)}`));
      });
      if (overdue.length) lines.push('', `⚠️ _Also ${overdue.length} overdue — run \`overdue\` to see_`);
      lines.push(`\n_\`done [client] [type]\` to mark filed_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── OVERDUE ───────────────────────────────────────────────────────────
    if (it === 'overdue') {
      if (!overdue.length) { await send('✅ *No overdue returns — great work!* 🎉\n\nCheck `week` for upcoming deadlines.'); return new Response('OK'); }
      const lines = [`🚨 *Overdue Returns (${overdue.length}) — FILE IMMEDIATELY:*`, ''];
      overdue.forEach(r => {
        const dd   = taxDueDate(r.taxType, r.period)!;
        const d    = daysDiff(dd);
        const name = cm.get(r.clientId)?.name || r.clientId;
        lines.push(`🔴 *${name}*`);
        lines.push(`   ${r.taxType} ${fmtPeriod(r.period)} · was due *${fmtDate(dd)}* · _${Math.abs(d)} day${Math.abs(d) > 1 ? 's' : ''} ago_`);
        if (r.notes) lines.push(`   📌 _${r.notes}_`);
      });
      lines.push('', '⚠️ _Late filing attracts penalties. File these immediately._');
      const ex = overdue[0];
      lines.push(`\n_Mark done: \`done ${(cm.get(ex.clientId)?.name || '').split(' ')[0]} ${ex.taxType}\`_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── THIS MONTH ────────────────────────────────────────────────────────
    if (it === 'month') {
      const nd  = new Date();
      const per = `${nd.getFullYear()}-${String(nd.getMonth()).padStart(2, '0')}`;  // 0-based month
      const list = pending.filter(r => r.period === per);
      if (!list.length) { await send(`📅 No pending returns for *${MO_L[nd.getMonth()]} ${nd.getFullYear()}*.\n\nUse \`pending\` to see all pending returns.`); return new Response('OK'); }
      const lines = [`📅 *${MO_L[nd.getMonth()]} ${nd.getFullYear()} Returns (${list.length}):*`, '', ...list.map(r => retLine(r, cm))];
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── PENDING [TYPE] ────────────────────────────────────────────────────
    if (it === 'pending') {
      const hint = lc.replace(/^pending\s*/, '').trim().toUpperCase();
      const list = pending.filter(r => !hint || r.taxType.toUpperCase().includes(hint));
      if (!list.length) { await send(hint ? `✅ No pending ${hint} returns.` : '✅ No pending returns — all filed!'); return new Response('OK'); }
      const lines = [`📋 *${hint ? `Pending ${hint}` : 'All Pending Returns'} (${list.length}):*`, ''];
      if (!hint) {
        // Group by tax type
        const byType = new Map<string, TaxReturn[]>();
        list.forEach(r => { if (!byType.has(r.taxType)) byType.set(r.taxType, []); byType.get(r.taxType)!.push(r); });
        [...byType.entries()].forEach(([type, items]) => {
          lines.push(`*${type}* (${items.length}):`);
          items.slice(0, 5).forEach(r => {
            const dd = taxDueDate(r.taxType, r.period); const d = dd ? daysDiff(dd) : null;
            lines.push(`  ${d !== null ? urg(d) : '⚪'} *${cm.get(r.clientId)?.name}* — ${fmtPeriod(r.period)}${dd ? ` · ${fmtDate(dd)}` : ''}${d !== null ? ` · _${fmtDiff(d)}_` : ''}`);
          });
          if (items.length > 5) lines.push(`  _...+${items.length - 5} more_`);
        });
      } else {
        list.slice(0, 20).forEach(r => lines.push(retLine(r, cm)));
      }
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── CLIENTS LIST ──────────────────────────────────────────────────────
    if (it === 'clients') {
      const active = clients.filter(c => !c.hidden);
      if (!active.length) { await send('No active clients found.'); return new Response('OK'); }
      const withMeta = active.map(c => ({
        c,
        p:   returns.filter(r => r.clientId === c.id && isActive(r, cm)).length,
        ovd: returns.filter(r => r.clientId === c.id && isActive(r, cm) && (() => { const dd = taxDueDate(r.taxType, r.period); return dd && daysDiff(dd) < 0; })()).length,
      })).sort((a, b) => (b.ovd - a.ovd) || (b.p - a.p));
      const lines = [`🏢 *Active Clients (${active.length}):*`, ''];
      withMeta.forEach(({ c, p, ovd }) => {
        const flag = ovd > 0 ? ` 🔴 ${ovd} overdue` : p > 0 ? ` · ${p} pending` : ' ✅';
        lines.push(`• *${c.name}*${flag}`);
      });
      lines.push('', '_`client [name]` for full details_');
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── CLIENT DETAIL ─────────────────────────────────────────────────────
    if (it === 'client') {
      const q = rawText.replace(/^client\s+/i, '').trim().toLowerCase();
      const c = clients.find(x => x.name.toLowerCase().includes(q));
      if (!c) {
        const sug = clients.filter(x => !x.hidden).slice(0, 5).map(x => `• ${x.name}`).join('\n');
        await send(`❓ No client matching _"${q}"_\n\nActive clients:\n${sug}\n\nOr use \`clients\` for full list.`);
        return new Response('OK');
      }
      const cr    = returns.filter(r => r.clientId === c.id && isActive(r, cm)).sort((a, b) => (taxDueDate(a.taxType, a.period) || '9999').localeCompare(taxDueDate(b.taxType, b.period) || '9999'));
      const ct    = tasks.filter(t => t.status !== 'completed' && (t.clientId === c.id || t.title.toLowerCase().includes(q)));
      const tal   = tally.find(t => t.clientId === c.id);
      const cDone = returns.filter(r => r.clientId === c.id && r.status === 'completed').length;
      const lines = [`🏢 *${c.name}*`, `_Types: ${(c.taxTypes || []).join(', ')} · ${cDone} filed · ${cr.length} pending_`, ''];
      if (cr.length) {
        lines.push(`📋 *Pending Returns (${cr.length}):*`);
        cr.slice(0, 10).forEach(r => {
          const dd = taxDueDate(r.taxType, r.period); const d = dd ? daysDiff(dd) : null;
          lines.push(`  ${d !== null ? urg(d) : '⚪'} ${r.taxType} ${fmtPeriod(r.period)}${dd ? ` · due ${fmtDate(dd)}` : ''}${d !== null ? ` · _${fmtDiff(d)}_` : ''}`);
          if (r.notes) lines.push(`     📌 _${r.notes}_`);
        });
        if (cr.length > 10) lines.push(`  _...+${cr.length - 10} more_`);
      } else lines.push('📋 Returns: ✅ All up to date');
      if (tal) {
        lines.push('', `📊 *Year-End ${tal.year}:*`);
        const steps: [keyof TallyProgress, string][] = [
          ['tallyUpdated','Tally Updated'], ['bankReconciled','Bank Reconciled'],
          ['financialsPrep','Financials Prepared'], ['accountsFinalized','Accounts Finalized'],
          ['adjustmentsPassed','Adjustments Passed'],
        ];
        const done = steps.filter(([k]) => tal[k]).length;
        lines.push(`  Progress: [${'▓'.repeat(done)}${'░'.repeat(5 - done)}] ${done}/5`);
        steps.forEach(([k, l]) => lines.push(`  ${tal[k] ? '✅' : '⬜'} ${l}`));
      }
      if (ct.length) {
        lines.push('', `✅ *Related Tasks (${ct.length}):*`);
        ct.slice(0, 5).forEach(t => lines.push(`  • ${t.title}${t.priority === 'high' ? ' 🔴' : ''}${t.dueDate ? ` · _${t.dueDate}_` : ''}`));
      }
      if (c.notes) lines.push('', `📝 _${c.notes.slice(0, 150)}_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── MARK RETURN DONE ──────────────────────────────────────────────────
    if (it === 'done_return') {
      const rest  = rawText.slice(rawText.toLowerCase().indexOf('done ') + 5).trim();
      const parts = rest.split(/\s+/);
      const TAX   = ['vat','paye','sdl','nssf','wcf','wht','heslb','provisional','city','roi'];
      let hint = '', cq = rest.toLowerCase();
      const last = parts[parts.length - 1].toLowerCase();
      if (TAX.some(t => last.includes(t))) { hint = last; cq = parts.slice(0, -1).join(' ').toLowerCase(); }
      // "done all [client]" → mark all pending for client
      if (cq.startsWith('all ')) {
        cq = cq.slice(4).trim();
        const mc = clients.find(c => c.name.toLowerCase().includes(cq));
        if (!mc) { await send(`❓ No client matching _"${cq}"_. Try \`clients\`.`); return new Response('OK'); }
        const toMark = returns.filter(r => r.clientId === mc.id && r.status !== 'completed');
        if (!toMark.length) { await send(`✅ No pending returns for *${mc.name}*.`); return new Response('OK'); }
        const updated = returns.map(r => toMark.some(x => x.id === r.id) ? { ...r, status: 'completed', completedAt: now() } : r);
        await save(supa, { ...state, taxReturns: updated });
        await send(`✅ *Marked ${toMark.length} returns complete for ${mc.name}!* 🎉\n${toMark.map(r => `  • ${r.taxType} ${fmtPeriod(r.period)}`).join('\n')}`);
        return new Response('OK');
      }
      const mc = clients.find(c => c.name.toLowerCase().includes(cq));
      if (!mc) {
        const guesses = clients.filter(c => cq.split(' ').some(w => w.length > 2 && c.name.toLowerCase().includes(w))).slice(0, 3).map(c => `• ${c.name}`).join('\n');
        await send(`❓ No client matching _"${cq}"_${guesses ? `\n\nDid you mean:\n${guesses}` : ''}\n\nTry \`clients\` for full list.`);
        return new Response('OK');
      }
      const candidates = returns.filter(r => r.clientId === mc.id && r.status !== 'completed' && (!hint || r.taxType.toLowerCase().includes(hint)));
      if (!candidates.length) { await send(`✅ No pending${hint ? ' ' + hint.toUpperCase() : ''} returns for *${mc.name}*.`); return new Response('OK'); }
      const r = candidates[0];
      await save(supa, { ...state, taxReturns: returns.map(x => x.id === r.id ? { ...x, status: 'completed', completedAt: now() } : x) });
      const more = candidates.length - 1;
      await send(`✅ *Filed: ${mc.name} — ${r.taxType} ${fmtPeriod(r.period)}* 🎉${more > 0 ? `\n\n_${more} more pending return${more > 1 ? 's' : ''} for ${mc.name}._\n_Next: \`done ${mc.name.split(' ')[0]}${hint ? ' ' + hint : ''}\`_` : ''}`);
      return new Response('OK');
    }

    // ── TALLY ─────────────────────────────────────────────────────────────
    if (it === 'tally') {
      if (!tally.length) { await send('No tally entries found.'); return new Response('OK'); }
      const lines = ['📊 *Year-End Tally Progress:*', ''];
      tally.forEach(t => {
        const n    = cm.get(t.clientId)?.name || t.clientId;
        const vals = [t.tallyUpdated, t.bankReconciled, t.financialsPrep, t.accountsFinalized, t.adjustmentsPassed];
        const done = vals.filter(Boolean).length;
        lines.push(`*${n}* (${t.year}) [${'▓'.repeat(done)}${'░'.repeat(5 - done)}] ${done}/5`);
        if (done < 5) {
          const steps: [keyof TallyProgress, string][] = [
            ['tallyUpdated','Tally Updated'], ['bankReconciled','Bank Reconciled'],
            ['financialsPrep','Financials Prepared'], ['accountsFinalized','Accounts Finalized'],
            ['adjustmentsPassed','Adjustments Passed'],
          ];
          const nxt = steps.find(([k]) => !t[k]);
          if (nxt) lines.push(`  _Next step: ${nxt[1]}_`);
        }
      });
      const totalDone = tally.reduce((s, t) => s + [t.tallyUpdated,t.bankReconciled,t.financialsPrep,t.accountsFinalized,t.adjustmentsPassed].filter(Boolean).length, 0);
      const totalPoss = tally.length * 5;
      lines.push('', `_Overall: ${totalDone}/${totalPoss} steps (${Math.round(totalDone / totalPoss * 100)}%)_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── STATS ─────────────────────────────────────────────────────────────
    if (it === 'stats') {
      const ac   = clients.filter(c => !c.hidden).length;
      const tr   = returns.length;
      const cr   = returns.filter(r => r.status === 'completed').length;
      const pr   = pending.length;
      const or   = overdue.length;
      const tt   = tasks.length;
      const ct   = tasks.filter(t => t.status === 'completed').length;
      const pt   = tt - ct;
      const wk   = isoWeekKey(); const wd_s = wh[wk] || {};
      const wkh  = Object.values(wd_s).reduce((s, d) => s + calcDay(d), 0);
      const rPct = tr ? Math.round(cr / tr * 100) : 0;
      const tPct = tt ? Math.round(ct / tt * 100) : 0;
      const lines = [
        '📊 *AccountantOS Stats:*', '',
        `🏢 *Clients:* ${ac} active`, '',
        '📋 *Tax Returns:*',
        `  ✅ ${cr} / ${tr} filed (${rPct}%)`,
        `  ⏳ ${pr} pending`,
        `  🔴 ${or} overdue${or > 0 ? ' ⚠️' : ''}`, '',
        '✅ *Tasks:*',
        `  ✅ ${ct} / ${tt} done (${tPct}%)`,
        `  ⏳ ${pt} pending`,
        `  📝 ${notes.length} notes saved`, '',
        `⏱ *This week:* ${wkh > 0 ? wkh.toFixed(1) + 'h logged' : 'no hours logged yet'}`,
      ];
      if (or > 0) lines.push('', `⚠️ _${or} overdue return${or > 1 ? 's' : ''} — run \`overdue\` for details_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── RECENT COMPLETIONS ────────────────────────────────────────────────
    if (it === 'recent') {
      const cut = new Date(); cut.setDate(cut.getDate() - 7); cut.setHours(0, 0, 0, 0);
      const rr = returns.filter(r => r.status === 'completed' && r.completedAt && new Date(r.completedAt) >= cut)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 15);
      const rt = tasks.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt) >= cut)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')).slice(0, 8);
      if (!rr.length && !rt.length) { await send('Nothing completed in the last 7 days.\n\nUse `done [client] [type]` to mark returns filed.'); return new Response('OK'); }
      const lines: string[] = [`🏆 *Completed — Last 7 Days:*`, ''];
      if (rr.length) {
        lines.push(`📋 *${rr.length} Return${rr.length > 1 ? 's' : ''} Filed:*`);
        rr.forEach(r => lines.push(`  ✅ *${cm.get(r.clientId)?.name}* — ${r.taxType} ${fmtPeriod(r.period)} · _${(r.completedAt || '').slice(0, 10)}_`));
      }
      if (rt.length) {
        if (rr.length) lines.push('');
        lines.push(`✅ *${rt.length} Task${rt.length > 1 ? 's' : ''} Completed:*`);
        rt.forEach(t => lines.push(`  ✅ ${t.title} · _${(t.completedAt || '').slice(0, 10)}_`));
      }
      lines.push('', `_${rr.length + rt.length} completions this week — keep it up! 💪_`);
      await send(lines.join('\n'));
      return new Response('OK');
    }

    // ── PERSONALITY / CONVERSATION ────────────────────────────────────────
    if (it === 'thanks') {
      const replies = [
        "Happy to help! 😊 Anything else you need?",
        "Anytime! Let me know if there's anything else.",
        "Glad I could help! 😄 Type `focus` for your action list.",
        "You're welcome! Keep those filings on track 💪",
        "No problem at all! Anything else you'd like to check?",
      ];
      await send(replies[Math.floor(Math.random() * replies.length)]);
      return new Response('OK');
    }

    if (it === 'bot_status') {
      if (overdue.length > 3) {
        await send(`Running at full speed! 😅 Keeping an eye on ${overdue.length} overdue returns for you — it's a busy period.\n\nSay \`focus\` to see what needs your attention most.`);
      } else if (overdue.length > 0) {
        await send(`Doing well, thanks for asking! 😊 There ${overdue.length === 1 ? 'is' : 'are'} ${overdue.length} overdue return${overdue.length > 1 ? 's' : ''} that need attention.\n\nType \`overdue\` to see the details.`);
      } else if (!pending.length) {
        await send("All good over here! ✅ And things look great on your end too — no pending returns. Enjoy the calm! 😄");
      } else {
        await send(`Doing great, thanks! 😊 Tracking ${pending.length} pending return${pending.length > 1 ? 's' : ''}, all within deadline.\n\nAnything specific you need?`);
      }
      return new Response('OK');
    }

    if (it === 'affirmation') {
      const replies = [
        "Great! What would you like to do next?",
        "Perfect 👍 Anything else I can help with?",
        "Got it! Type `focus` for your action list or `help` for all commands.",
        "Understood! Let me know what's next.",
      ];
      await send(replies[Math.floor(Math.random() * replies.length)]);
      return new Response('OK');
    }

    if (it === 'laugh') {
      await send("😄 Glad to keep things light! Now — back to those returns? Type `focus` for your action list.");
      return new Response('OK');
    }

    // ── CLIENT MANAGEMENT ─────────────────────────────────────────────────
    if (it === 'hide_client') {
      const q_hc = rawText.replace(/^(hide|archive)\s+/i, '').trim().toLowerCase();
      const c_hc = clients.find(x => !x.hidden && x.name.toLowerCase().includes(q_hc));
      if (!c_hc) {
        const sug_hc = clients.filter(x => !x.hidden).slice(0, 5).map(x => `• ${x.name}`).join('\n');
        await send(`❓ No active client matching _"${q_hc}"_\n\nActive clients:\n${sug_hc || 'none'}`);
        return new Response('OK');
      }
      await save(supa, { ...state, clients: clients.map(x => x.id === c_hc.id ? { ...x, hidden: true } : x) });
      await send(`👁 *${c_hc.name}* is now hidden.\n\nThey won't appear in reports or overdue lists.\n_Restore with: \`unhide ${c_hc.name.split(' ')[0]}\`_`);
      return new Response('OK');
    }

    if (it === 'unhide_client') {
      const q_uc = rawText.replace(/^(unhide|restore|unarchive)\s+(client\s+)?/i, '').trim().toLowerCase();
      const c_uc = clients.find(x => x.hidden && x.name.toLowerCase().includes(q_uc));
      if (!c_uc) {
        const hidden_uc = clients.filter(x => x.hidden);
        if (!hidden_uc.length) await send('No hidden clients found.');
        else await send(`❓ No hidden client matching _"${q_uc}"_\n\nHidden clients:\n${hidden_uc.map(x => `• ${x.name}`).join('\n')}`);
        return new Response('OK');
      }
      await save(supa, { ...state, clients: clients.map(x => x.id === c_uc.id ? { ...x, hidden: false } : x) });
      await send(`✅ *${c_uc.name}* is visible again and will appear in all reports.`);
      return new Response('OK');
    }

    if (it === 'add_client') {
      const acName = rawText.replace(/^(add|new|create)\s+client\s+/i, '').trim();
      if (!acName) { await send('Usage: `add client [Name]`\nExample: `add client Kilimani Ltd`'); return new Response('OK'); }
      const acExists = clients.find(c => c.name.toLowerCase() === acName.toLowerCase());
      if (acExists) { await send(`⚠️ *${acExists.name}* already exists.\n\nView with: \`client ${acName.split(' ')[0]}\``); return new Response('OK'); }
      const acNew: Client = { id: uid(), name: acName, taxTypes: [], hidden: false };
      await save(supa, { ...state, clients: [...clients, acNew] });
      await send(`✅ *Client added: ${acName}*\n\n_Configure their tax types in the AccountantOS app, then add filings here._\n_View with: \`client ${acName.split(' ')[0]}\`_`);
      return new Response('OK');
    }

    // ── RETURN MANAGEMENT ─────────────────────────────────────────────────
    if (it === 'add_return') {
      let arRest = rawText.replace(/^(add|new|create)\s+(return|filing|tax)?\s*/i, '').trim();
      const AR_TYPES = ['VAT','PAYE','SDL','NSSF','WCF','WHT','HESLB','PROVISIONAL','CITY','ROI'];
      const arWords = arRest.split(/\s+/);
      let arType = '';
      if (AR_TYPES.some(t => t === arWords[0].toUpperCase())) { arType = arWords[0].toUpperCase(); arRest = arWords.slice(1).join(' '); }
      const AR_MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      let arPeriod = '';
      const arPeriodMatch = arRest.match(/(\d{4}-\d{2})/);
      const arMonthMatch  = arRest.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i);
      let arClientQ = '';
      if (arPeriodMatch) {
        arPeriod  = arPeriodMatch[1];
        arClientQ = arRest.replace(arPeriodMatch[0], '').replace(new RegExp(arType, 'i'), '').trim().toLowerCase();
      } else if (arMonthMatch) {
        const arMKey = arMonthMatch[1].slice(0, 3).toLowerCase();
        const arMIdx = AR_MONTHS.indexOf(arMKey);
        const arYr   = arMonthMatch[2] ? parseInt(arMonthMatch[2]) : new Date().getFullYear();
        arPeriod  = `${arYr}-${String(arMIdx).padStart(2, '0')}`;  // 0-based month
        arClientQ = arRest.replace(arMonthMatch[0], '').replace(new RegExp(arType, 'i'), '').trim().toLowerCase();
      } else {
        arClientQ = arRest.replace(new RegExp(arType, 'i'), '').trim().toLowerCase();
      }
      if (!arType || !arClientQ) {
        await send(['Usage: `add [TYPE] [client] [period]`', '', 'Examples:', '`add VAT Kilimani 2026-04`', '`add PAYE Nyota March 2026`', '`add NSSF Baraka Apr`', '', 'Types: VAT · PAYE · SDL · NSSF · WCF · WHT · HESLB'].join('\n'));
        return new Response('OK');
      }
      const arClient = clients.find(x => x.name.toLowerCase().includes(arClientQ));
      if (!arClient) {
        const arSug = clients.filter(x => !x.hidden).slice(0, 5).map(x => `• ${x.name}`).join('\n');
        await send(`❓ No client matching _"${arClientQ}"_\n\nActive clients:\n${arSug}`);
        return new Response('OK');
      }
      if (!arPeriod) { const nd = new Date(); arPeriod = `${nd.getFullYear()}-${String(nd.getMonth()).padStart(2, '0')}`; }  // 0-based month
      const arDup = returns.find(r => r.clientId === arClient.id && r.taxType === arType && r.period === arPeriod && r.status !== 'completed');
      if (arDup) { await send(`⚠️ *${arClient.name}* already has a pending ${arType} for ${fmtPeriod(arPeriod)}.\n\nMark it done: \`done ${arClient.name.split(' ')[0]} ${arType}\``); return new Response('OK'); }
      const arNew: TaxReturn = { id: uid(), clientId: arClient.id, taxType: arType, period: arPeriod, status: 'pending' };
      await save(supa, { ...state, taxReturns: [...returns, arNew] });
      const arDd = taxDueDate(arType, arPeriod);
      await send(`✅ *Filing added: ${arClient.name} — ${arType} ${fmtPeriod(arPeriod)}*${arDd ? `\n_Due: ${fmtDate(arDd)} (${fmtDiff(daysDiff(arDd))})_` : ''}`);
      return new Response('OK');
    }

    if (it === 'delete_return') {
      const drRest  = rawText.replace(/^(delete|remove)\s+return\s+/i, '').trim();
      const drWords = drRest.split(/\s+/);
      const DR_TYPES = ['vat','paye','sdl','nssf','wcf','wht','heslb','provisional','city','roi'];
      let drHint = '', drCq = drRest.toLowerCase();
      const drTax = drWords.find(w => DR_TYPES.includes(w.toLowerCase()));
      if (drTax) { drHint = drTax.toUpperCase(); drCq = drRest.toLowerCase().replace(new RegExp(drTax, 'i'), '').trim(); }
      const drClient = clients.find(x => x.name.toLowerCase().includes(drCq));
      if (!drClient) { await send(`❓ No client matching _"${drCq}"_. Try \`clients\`.`); return new Response('OK'); }
      const drMatch = returns.find(r => r.clientId === drClient.id && r.status !== 'completed' && (!drHint || r.taxType === drHint));
      if (!drMatch) { await send(`No pending${drHint ? ' ' + drHint : ''} returns found for *${drClient.name}*.`); return new Response('OK'); }
      await save(supa, { ...state, taxReturns: returns.filter(r => r.id !== drMatch.id) });
      await send(`🗑 *Deleted: ${drClient.name} — ${drMatch.taxType} ${fmtPeriod(drMatch.period)}*\n\n_Add it back: \`add ${drMatch.taxType} ${drClient.name.split(' ')[0]} ${drMatch.period}\`_`);
      return new Response('OK');
    }

    if (it === 'delete_task') {
      const dtQ = rawText.replace(/^(delete|remove)\s+task\s+/i, '').trim().toLowerCase();
      const dtMatch = tasks.find(t => t.title.toLowerCase().includes(dtQ));
      if (!dtMatch) {
        const dtPending = tasks.filter(t => t.status !== 'completed').slice(0, 5).map(t => `• ${t.title}`).join('\n');
        await send(`❓ No task matching _"${dtQ}"_\n\nPending tasks:\n${dtPending || 'none'}`);
        return new Response('OK');
      }
      await save(supa, { ...state, tasks: tasks.filter(t => t.id !== dtMatch.id) });
      await send(`🗑 *Deleted task: "${dtMatch.title}"*`);
      return new Response('OK');
    }

    if (it === 'delete_note') {
      const dnQ = rawText.replace(/^(delete|remove)\s+note\s+/i, '').trim().toLowerCase();
      const dnMatch = notes.find(n => (n.title || '').toLowerCase().includes(dnQ) || n.content.toLowerCase().includes(dnQ));
      if (!dnMatch) { await send(`❓ No note matching _"${dnQ}"_. See your notes: \`notes\``); return new Response('OK'); }
      await save(supa, { ...state, notes: notes.filter(n => n.id !== dnMatch.id) });
      await send(`🗑 *Deleted note: "${dnMatch.title || dnMatch.content.slice(0, 60)}"*`);
      return new Response('OK');
    }

    // ── HOURS LOGGING ─────────────────────────────────────────────────────
    if (it === 'log_hours') {
      const lhRaw = rawText.replace(/^log\s+(hours?\s+)?/i, '').trim();
      const LH_DAYS: Record<string, string> = {
        mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun',
        monday:'Mon', tuesday:'Tue', wednesday:'Wed', thursday:'Thu', friday:'Fri', saturday:'Sat', sunday:'Sun',
      };
      const lhParts = lhRaw.split(/\s+/);
      const lhDay = LH_DAYS[lhParts[0].toLowerCase()];
      if (!lhDay) { await send('Usage: `log Mon 9:00 17:00`\nOr: `log Tuesday 8:30 17:30 break 13:00 14:00`'); return new Response('OK'); }
      const parseT = (s: string): string | null => {
        s = s.trim().toLowerCase();
        const pm = s.match(/^(\d+)(?::(\d+))?pm$/);
        const am = s.match(/^(\d+)(?::(\d+))?am$/);
        const pl = s.match(/^(\d+)(?::(\d+))?$/);
        if (pm) { let h = parseInt(pm[1]); if (h !== 12) h += 12; return `${String(h).padStart(2,'0')}:${String(parseInt(pm[2]||'0')).padStart(2,'0')}`; }
        if (am) { let h = parseInt(am[1]); if (h === 12) h = 0; return `${String(h).padStart(2,'0')}:${String(parseInt(am[2]||'0')).padStart(2,'0')}`; }
        if (pl) return `${String(parseInt(pl[1])).padStart(2,'0')}:${String(parseInt(pl[2]||'0')).padStart(2,'0')}`;
        return null;
      };
      const lhIn  = parseT(lhParts[1] || '');
      const lhOut = parseT(lhParts[2] || '');
      if (!lhIn || !lhOut) { await send('Could not parse times.\nUsage: `log Mon 9:00 17:00`\nOr: `log Mon 9am 5pm`'); return new Response('OK'); }
      let lhBrkStart: string | undefined, lhBrkStop: string | undefined;
      const lhBrkIdx = lhParts.findIndex(p => p.toLowerCase() === 'break');
      if (lhBrkIdx !== -1 && lhParts[lhBrkIdx+1] && lhParts[lhBrkIdx+2]) {
        lhBrkStart = parseT(lhParts[lhBrkIdx+1]) || undefined;
        lhBrkStop  = parseT(lhParts[lhBrkIdx+2]) || undefined;
      }
      const lhWkKey = isoWeekKey();
      const lhEntry: DayEntry = { timeIn: lhIn, timeOut: lhOut, ...(lhBrkStart ? { breakStart: lhBrkStart, breakStop: lhBrkStop } : {}) };
      const lhUpdWH = { ...wh, [lhWkKey]: { ...(wh[lhWkKey] || {}), [lhDay]: lhEntry } };
      await save(supa, { ...state, workingHours: lhUpdWH });
      const lhHours = calcDay(lhEntry);
      const lhBrkPart = lhBrkStart ? ` (break ${lhBrkStart}–${lhBrkStop})` : '';
      await send(`⏱ *Logged: ${lhDay} ${lhIn}–${lhOut}${lhBrkPart} = ${lhHours.toFixed(1)}h* ✅\n\nType \`hours\` to see your full week.`);
      return new Response('OK');
    }

    if (it === 'clear_hours') {
      const chQ = rawText.replace(/^(clear|reset)\s+hours?\s*/i, '').trim();
      let chKey = isoWeekKey();
      if (chQ.match(/\d{4}-W\d{2}/i)) chKey = chQ.toUpperCase();
      else if (chQ.toLowerCase() === 'last') chKey = isoWeekKey(new Date(Date.now() - 7 * 86400000));
      if (!wh[chKey]) { await send(`No hours logged for *${chKey}*.`); return new Response('OK'); }
      const chUpdWH = { ...wh }; delete chUpdWH[chKey];
      await save(supa, { ...state, workingHours: chUpdWH });
      await send(`🗑 *Hours cleared for ${chKey}.*\n_Log them again: \`log Mon 9:00 17:00\`_`);
      return new Response('OK');
    }

    // ── EXPORT ────────────────────────────────────────────────────────────
    if (it === 'export') {
      if (lc.includes('excel') || lc.includes('xlsx') || lc.includes('csv')) {
        await send(["📊 *Export to Excel*", "", "I can't generate files in Telegram — but it's easy in the app:", "", "1. Open *AccountantOS* in your browser", "2. Go to the *Export* page", "3. Choose your date range → click *Download Excel*", "", "_Includes all returns, clients, tasks, and hours._"].join('\n'));
      } else if (lc.includes('pdf')) {
        await send(["📄 *Export to PDF*", "", "1. Open *AccountantOS* in your browser", "2. Go to the *Export* page", "3. Use browser Print → Save as PDF", "", "_Or get a text summary here — try `brief` or `stats`_"].join('\n'));
      } else {
        const expD = new Date();
        await send([`📊 *Quick Summary — ${expD.getDate()} ${MO_S[expD.getMonth()]} ${expD.getFullYear()}*`, '', `🏢 ${clients.filter(c => !c.hidden).length} active clients`, `📋 ${returns.filter(r => r.status === 'completed').length} filed · ${pending.length} pending · ${overdue.length} overdue`, `✅ ${tasks.filter(t => t.status !== 'completed').length} tasks pending`, '', '_For Excel/PDF: Open AccountantOS → Export page_'].join('\n'));
      }
      return new Response('OK');
    }

    // ── UNKNOWN — smart fallbacks ──────────────────────────────────────────

    // ── WHO MISSING / FILING STATUS ──────────────────────────────────────────
    if (it === 'who_missing') {
      const wmTxM = rawText.match(/\b(VAT|PAYE|SDL|NSSF|WCF|WHT|HESLB|PROVISIONAL|ROI|CITY)\b/i);
      const wmType = wmTxM ? wmTxM[1].toUpperCase() : null;
      const MN_SHORT_WM = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      let wmPeriod = '';
      const wmPM  = rawText.match(/(\d{4}-\d{2})/);
      const wmMM  = rawText.match(/\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(\d{4})?/i);
      if (wmPM) { wmPeriod = wmPM[1]; }
      else if (wmMM) { const mi = MN_SHORT_WM.indexOf(wmMM[1].slice(0,3).toLowerCase()); const yr = wmMM[2] ? parseInt(wmMM[2]) : new Date().getFullYear(); wmPeriod = `${yr}-${String(mi).padStart(2,'0')}`; }  // 0-based
      else { const d = new Date(); d.setMonth(d.getMonth()-1); wmPeriod = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`; }  // 0-based
      if (!wmType) {
        await send(`📋 Include a tax type to check filing status.\n\nExamples:\n\`who hasn't filed NSSF March?\`\n\`PAYE April status\`\n\`WCF March missing clients\``);
        return new Response('OK');
      }
      const wmClients = clients.filter(c => !c.hidden && (c.taxTypes||[]).includes(wmType));
      if (!wmClients.length) { await send(`No active clients track ${wmType}.`); return new Response('OK'); }
      const wmFiled   = wmClients.filter(c => returns.some(r => r.clientId===c.id && r.taxType===wmType && r.period===wmPeriod && r.status==='completed'));
      const wmPending = wmClients.filter(c => returns.some(r => r.clientId===c.id && r.taxType===wmType && r.period===wmPeriod && r.status!=='completed'));
      const wmMissing = wmClients.filter(c => !returns.some(r => r.clientId===c.id && r.taxType===wmType && r.period===wmPeriod));
      const wmDd = taxDueDate(wmType, wmPeriod);
      const wmDdStr = wmDd ? ` \u00b7 due ${fmtDate(wmDd)} (${fmtDiff(daysDiff(wmDd))})` : '';
      const wmLines: string[] = [`\ud83d\udccb *${wmType} ${fmtPeriod(wmPeriod)} \u2014 Status${wmDdStr}*`, `_${wmClients.length} client${wmClients.length!==1?'s':''} track ${wmType}_`, ''];
      if (wmMissing.length) { wmLines.push(`\u274c *No record yet (${wmMissing.length}):*`); wmMissing.forEach(c => wmLines.push(`  \u2022 ${c.name}`)); wmLines.push(''); }
      if (wmPending.length) { wmLines.push(`\u23f3 *Pending \u2014 not yet filed (${wmPending.length}):*`); wmPending.forEach(c => wmLines.push(`  \u2022 ${c.name}`)); wmLines.push(''); }
      if (wmFiled.length)   { wmLines.push(`\u2705 *Filed (${wmFiled.length}):*`); wmFiled.forEach(c => wmLines.push(`  \u2022 ${c.name}`)); }
      if (!wmMissing.length && !wmPending.length) wmLines.push('\u2705 *All clients have filed \u2014 great work!*');
      else wmLines.push('', `_Add filing: \`add ${wmType} [client] ${wmPeriod}\` \u00b7 Mark done: \`done [client] ${wmType}\`_`);
      await send(wmLines.join('\n'));
      return new Response('OK');
    }

    // ── UPDATE TALLY ──────────────────────────────────────────────────────────
    if (it === 'update_tally') {
      type TallyKey = 'tallyUpdated'|'bankReconciled'|'financialsPrep'|'accountsFinalized'|'adjustmentsPassed';
      const TALLY_STEPS: Array<[TallyKey, string, string[]]> = [
        ['tallyUpdated',      'Tally Updated',      ['tally updat','tally done','tally update','step 1','step1']],
        ['bankReconciled',    'Bank Reconciled',     ['bank rec','bank reconcil','step 2','step2']],
        ['financialsPrep',    'Financials Prepared', ['financial','step 3','step3']],
        ['accountsFinalized', 'Accounts Finalized',  ['accounts final','accounts done','finalized','accounts complet','step 4','step4']],
        ['adjustmentsPassed', 'Adjustments Passed',  ['adjustment','step 5','step5']],
      ];
      const utLc = rawText.toLowerCase();
      let utStep: TallyKey|null = null; let utLabel = '';
      for (const [key, label, kws] of TALLY_STEPS) {
        if (kws.some(k => utLc.includes(k))) { utStep = key; utLabel = label; break; }
      }
      const utClient = clients.find(c => !c.hidden && utLc.includes(c.name.toLowerCase().split(' ')[0]));
      if (!utStep || !utClient) {
        const stepList = TALLY_STEPS.map(([,l]) => `  \u2022 ${l}`).join('\n');
        const hint = utStep ? `_Step detected: ${utLabel} \u2713 \u2014 add client name_` : utClient ? `_Client detected: ${utClient.name} \u2713 \u2014 add step_` : '_Specify both client and step_';
        await send([`\ud83d\udcca *Tally Update \u2014 Usage:*`,'',`Examples:`,`\`mark tally updated for Alfa\``,`\`Alfa Hardware bank reconciled\``,`\`mark financials done for Zeetech\``,'',`Steps:`,stepList,'',hint].join('\n'));
        return new Response('OK');
      }
      const utExisting = tally.find(t => t.clientId === utClient.id);
      const utYr = new Date().getFullYear();
      const utBase: TallyProgress = utExisting || { id: uid(), year: utYr, clientId: utClient.id, tallyUpdated: false, bankReconciled: false, financialsPrep: false, accountsFinalized: false, adjustmentsPassed: false };
      const utUpdated = { ...utBase, [utStep]: true };
      const newTally = utExisting ? tally.map(t => t.clientId === utClient.id ? utUpdated : t) : [...tally, utUpdated];
      await save(supa, { ...state, tallyProgress: newTally });
      const utVals = [utUpdated.tallyUpdated, utUpdated.bankReconciled, utUpdated.financialsPrep, utUpdated.accountsFinalized, utUpdated.adjustmentsPassed];
      const utDone = utVals.filter(Boolean).length;
      const utLines = [
        `\u2705 *${utClient.name} \u2014 ${utLabel} done!*`,
        utDone === 5 ? '\ud83c\udfc6 *Year-end COMPLETE!* \ud83c\udf89' : `Progress: [${'\u2593'.repeat(utDone)}${'\u2591'.repeat(5-utDone)}] ${utDone}/5`,
        '',
        ...TALLY_STEPS.map(([k,l]) => `  ${utUpdated[k] ? '\u2705' : '\u2b1c'} ${l}`),
      ];
      await send(utLines.join('\n'));
      return new Response('OK');
    }

    // Hours keyword fallback
    if (lc.includes('hour') || lc.includes('worked') || lc.includes('timesheet')) {
      const wd_u = wh[isoWeekKey()] || {};
      if (!Object.keys(wd_u).length) await send('⏱ No hours logged this week yet.\n\nLog them in the app, or check a past week: `hours 2026-W15`');
      else await send(fmtWeek(isoWeekKey(), wd_u));
      return new Response('OK');
    }

    // Tax type + month name — show who-filed status
    const TAX_LIST_FB = ['VAT','PAYE','SDL','NSSF','WCF','WHT','HESLB'];
    const fbTaxType = TAX_LIST_FB.find(t => lc.includes(t.toLowerCase()));
    const fbMoIdx   = MO_L.findIndex(m => lc.includes(m.toLowerCase()));
    if (fbTaxType && fbMoIdx !== -1) {
      const fbYr     = new Date().getFullYear();
      const fbPeriod = `${fbYr}-${String(fbMoIdx).padStart(2,'0')}`;  // 0-based month
      const fbClients = clients.filter(c => !c.hidden && (c.taxTypes||[]).includes(fbTaxType));
      const fbFiled   = fbClients.filter(c => returns.some(r => r.clientId===c.id && r.taxType===fbTaxType && r.period===fbPeriod && r.status==='completed'));
      const fbPend    = fbClients.filter(c => returns.some(r => r.clientId===c.id && r.taxType===fbTaxType && r.period===fbPeriod && r.status!=='completed'));
      const fbMiss    = fbClients.filter(c => !returns.some(r => r.clientId===c.id && r.taxType===fbTaxType && r.period===fbPeriod));
      const fbDd = taxDueDate(fbTaxType, fbPeriod);
      const fbDdStr = fbDd ? ` · due ${fmtDate(fbDd)} (${fmtDiff(daysDiff(fbDd))})` : '';
      const fbLines: string[] = [`📋 *${fbTaxType} ${fmtPeriod(fbPeriod)}${fbDdStr}*`, `_${fbClients.length} client${fbClients.length!==1?'s':''} track ${fbTaxType}_`, ''];
      if (fbMiss.length)  { fbLines.push(`❌ *No record (${fbMiss.length}):*`);  fbMiss.forEach(c => fbLines.push(`  • ${c.name}`));  fbLines.push(''); }
      if (fbPend.length)  { fbLines.push(`⏳ *Pending (${fbPend.length}):*`);   fbPend.forEach(c => fbLines.push(`  • ${c.name}`));   fbLines.push(''); }
      if (fbFiled.length) { fbLines.push(`✅ *Filed (${fbFiled.length}):*`);    fbFiled.forEach(c => fbLines.push(`  • ${c.name}`)); }
      if (!fbMiss.length && !fbPend.length) fbLines.push('✅ *All clients filed!*');
      else fbLines.push('', `_Add: \`add ${fbTaxType} [client] ${fbPeriod}\` · Done: \`done [client] ${fbTaxType}\`_`);
      await send(fbLines.join('\n'));
      return new Response('OK');
    }
    // Tax type only — show all pending for that type
    if (fbTaxType) {
      const fbPendList = pending.filter(r => r.taxType === fbTaxType);
      if (fbPendList.length) { await send([`📋 *Pending ${fbTaxType} (${fbPendList.length}):*`, '', ...fbPendList.map(r => retLine(r, cm)), '', `_\`done [client] ${fbTaxType}\` to mark filed_`].join('\n')); return new Response('OK'); }
    }

    // Month name in message (e.g. "april returns", "march")
    const mIdx = MO_L.findIndex(m => lc.includes(m.toLowerCase()));
    if (mIdx !== -1) {
      const yr     = new Date().getFullYear();
      const period = `${yr}-${String(mIdx).padStart(2, '0')}`;  // 0-based month
      const list   = pending.filter(r => r.period === period);
      if (list.length) await send([`📅 *${MO_L[mIdx]} ${yr} Returns (${list.length}):*`, '', ...list.map(r => retLine(r, cm))].join('\n'));
      else await send(`✅ No pending returns for ${MO_L[mIdx]} ${yr}.`);
      return new Response('OK');
    }

    // Client name anywhere in message
    const fc = clients.find(c => lc.includes(c.name.toLowerCase()));
    if (fc) {
      const cr = returns.filter(r => r.clientId === fc.id && isActive(r, cm)).sort((a, b) => (taxDueDate(a.taxType, a.period) || '9999').localeCompare(taxDueDate(b.taxType, b.period) || '9999'));
      if (cr.length) {
        const lines = [`🏢 *${fc.name}* — ${cr.length} pending:`, '', ...cr.slice(0, 8).map(r => retLine(r, cm))];
        lines.push('', `_\`client ${fc.name.split(' ')[0]}\` for full details_`);
        await send(lines.join('\n'));
      } else {
        await send(`🏢 *${fc.name}* — ✅ All returns up to date!\n\n_Use \`client ${fc.name.split(' ')[0]}\` for full details including tasks and tally._`);
      }
      return new Response('OK');
    }

    const noIdea = ["🤔 I didn't quite catch that.", "Hmm, not sure what you mean 🤔", "I didn't follow that one 🤔"][new Date().getSeconds() % 3];
    const urgHint = overdue.length > 0 ? `\n\n⚠️ _By the way \u2014 you have ${overdue.length} overdue return${overdue.length > 1 ? 's' : ''} waiting. Type \`overdue\` to see them._` : '';
    await send([
      noIdea, '',
      'Try asking naturally, like:',
      '_"what\'s overdue?"_, _"show my hours"_, _"find [client name]"_', '',
      'Or use a quick command:',
      '`focus` \u2014 what to work on right now',
      '`overdue` \u2014 missed deadlines',
      '`week` \u2014 due this week',
      '`brief` \u2014 full summary',
      '`hi` \u2014 quick daily status',
      '',
      '_Type `help` for the full guide._',
    ].join('\n') + urgHint);
    return new Response('OK');

  } catch (err) {
    console.error(err);
    await send('⚠️ Something went wrong. Please try again.').catch(() => {});
    return new Response('OK', { status: 200 });
  }
});
