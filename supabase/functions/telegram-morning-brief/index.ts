import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Config ───────────────────────────────────────────────────────────────────
const BOT_TOKEN      = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT_ID        = Deno.env.get('TELEGRAM_CHAT_ID')!;
const USER_ID        = Deno.env.get('APP_USER_ID')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SRV   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ─── Types ────────────────────────────────────────────────────────────────────
interface TaxReturn {
  id: string; clientId: string; taxType: string; period: string;
  status: string; completedAt?: string; notes?: string;
}
interface Client {
  id: string; name: string; taxTypes: string[]; hidden?: boolean;
}
interface Task {
  id: string; title: string; status: string;
  priority: string; dueDate?: string; category?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD due date for a return, or null if non-monthly period. */
export function dueDate(taxType: string, period: string): string | null {
  if (!period.match(/^\d{4}-\d{2}$/)) return null; // skip non-monthly (annual, quarterly)
  const [yr, mo] = period.split('-').map(Number);
  // App stores months 0-based (Jan=0). Use JS Date to advance to next month.
  const next = new Date(yr, mo + 1, 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const t = taxType.toUpperCase();
  let day = 7;
  if (t === 'VAT')                          day = 20;
  else if (t === 'NSSF' || t === 'WCF')    day = 30;
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(day)}`;
}

export function daysDiff(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86_400_000);
}

/** A return is active if it is pending, the client is not hidden,
 *  and the client still has that tax type enabled. */
export function isActiveReturn(r: TaxReturn, clientMap: Map<string, Client>): boolean {
  if (r.status === 'completed') return false;
  const client = clientMap.get(r.clientId);
  if (!client || client.hidden) return false;
  return !client.taxTypes || client.taxTypes.includes(r.taxType);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  try {
    const supa = createClient(SUPABASE_URL, SUPABASE_SRV);
    const { data, error } = await supa
      .from('app_state').select('data').eq('id', USER_ID).single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: 'Failed to load state' }), { status: 500 });
    }

    const state      = data.data as Record<string, unknown>;

    // Respect mute flag — skip silently if user paused notifications
    if (state.botMuted === true) {
      return new Response(JSON.stringify({ ok: true, skipped: 'muted' }), { status: 200 });
    }

    const taxReturns = ((state.taxReturns as TaxReturn[]) || []);
    const tasks      = ((state.tasks      as Task[])      || []);
    const clients    = ((state.clients    as Client[])    || []);

    // Build client lookup map
    const clientMap = new Map<string, Client>(clients.map(c => [c.id, c]));

    // Categorise active pending returns — only explicitly filed entries
    const MO_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    function fmtPd(period: string): string {
      const [yr, mo] = period.split('-').map(Number);
      // App stores months 0-based (Jan=0, Dec=11)
      return (!yr || mo === undefined || mo < 0 || mo > 11) ? period : `${MO_S[mo]} ${yr}`;
    }
    function fmtDt(iso: string): string {
      const [, mo, dy] = iso.split('-').map(Number);
      return `${MO_S[mo-1]} ${dy}`;
    }

    const pendingReturns: Array<{name: string; taxType: string; period: string; dd: string; diff: number}> = [];
    for (const r of taxReturns) {
      if (!isActiveReturn(r, clientMap)) continue;
      const dd = dueDate(r.taxType, r.period);
      if (!dd) continue;
      const diff   = daysDiff(dd);
      const client = clientMap.get(r.clientId);
      if (!client) continue;
      pendingReturns.push({ name: client.name, taxType: r.taxType, period: r.period, dd, diff });
    }
    pendingReturns.sort((a, b) => a.diff - b.diff);
    const overdueList = pendingReturns.filter(r => r.diff < 0);
    const todayList   = pendingReturns.filter(r => r.diff === 0);
    const soonList    = pendingReturns.filter(r => r.diff > 0 && r.diff <= 3);
    const weekList    = pendingReturns.filter(r => r.diff > 3 && r.diff <= 7);

    // Tasks
    const pendingTasks = tasks.filter(t => t.status !== 'completed');
    const highTasks    = pendingTasks.filter(t => t.priority === 'high');

    // Format date
    const now    = new Date();
    const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dateStr = `${DAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

    const lines: string[] = [`☀️ *Good morning! ${dateStr}*`, ''];

    lines.push('📋 *Tax Returns:*');
    if (!pendingReturns.length) {
      lines.push('✅ All returns up to date — enjoy the day!');
    } else {
      if (overdueList.length) {
        lines.push(`🔴 *Overdue (${overdueList.length}) — file immediately:*`);
        overdueList.slice(0, 5).forEach(r => {
          lines.push(`  • *${r.name}* — ${r.taxType} ${fmtPd(r.period)}`);
          lines.push(`    _was due ${fmtDt(r.dd)}, ${Math.abs(r.diff)}d ago_`);
        });
        if (overdueList.length > 5) lines.push(`  _...+${overdueList.length - 5} more overdue_`);
      }
      if (todayList.length) {
        lines.push(`🟡 *Due Today (${todayList.length}):*`);
        todayList.forEach(r => lines.push(`  • *${r.name}* — ${r.taxType} ${fmtPd(r.period)}`));
      }
      if (soonList.length) {
        lines.push(`🟠 *Due in 1–3 Days (${soonList.length}):*`);
        soonList.slice(0, 4).forEach(r => lines.push(`  • *${r.name}* — ${r.taxType} ${fmtPd(r.period)} · _${fmtDt(r.dd)}_`));
        if (soonList.length > 4) lines.push(`  _...+${soonList.length - 4} more_`);
      }
      if (weekList.length && overdueList.length + todayList.length + soonList.length < 8) {
        lines.push(`🟢 *Later this week (${weekList.length}):*`);
        weekList.slice(0, 3).forEach(r => lines.push(`  • *${r.name}* — ${r.taxType} ${fmtPd(r.period)} · _${fmtDt(r.dd)}_`));
      }
    }

    lines.push('');

    if (highTasks.length) {
      lines.push(`⚡ *High Priority Tasks (${highTasks.length}):*`);
      highTasks.slice(0, 3).forEach(t => lines.push(`  • ${t.title}${t.dueDate ? ` · _${t.dueDate}_` : ''}`));
      if (pendingTasks.length > highTasks.length) lines.push(`  _+${pendingTasks.length - highTasks.length} more tasks pending_`);
    } else if (pendingTasks.length) {
      lines.push(`✅ *Tasks:* ${pendingTasks.length} pending · none high priority`);
    } else {
      lines.push('✅ *Tasks:* All clear!');
    }

    lines.push('');

    if (overdueList.length > 0) {
      lines.push(`⚠️ _${overdueList.length} overdue — late penalties may apply. File today!_`);
    } else if (todayList.length > 0) {
      lines.push(`📌 _${todayList.length} return${todayList.length > 1 ? 's' : ''} due today — don't miss the deadline!_`);
    } else if (!pendingReturns.length) {
      lines.push('_Have a great day! 😊_');
    } else {
      lines.push('_Have a productive day! Reply `focus` for your action list._');
    }

    lines.push('', '💬 `overdue` · `week` · `focus` · `tasks` · `client [name]` · `help`');
    const message = lines.join('\n');

    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });

    if (!tgRes.ok) {
      const body = await tgRes.text();
      return new Response(JSON.stringify({ error: 'Telegram error', detail: body }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
