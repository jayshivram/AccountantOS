import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { TAX_TYPES, cn } from '../utils/index.js';

const LM_BASE = 'http://localhost:1234/v1';

// ─── Build system prompt from live app state ──────────────────────────────────
function buildSystemPrompt(state) {
  const clients = (state.clients || []).filter(c => !c.hidden);
  const returns = state.taxReturns || [];
  const tasks   = (state.tasks   || []).filter(t => t.status !== 'completed');
  const today   = new Date().toISOString().slice(0, 10);

  // Pending returns with due dates
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function dueDate(type, period) {
    if (!period.match(/^\d{4}-\d{2}$/)) return null;
    const [yr, mo] = period.split('-').map(Number);
    const nm = mo === 12 ? 1 : mo + 1;
    const ny = mo === 12 ? yr + 1 : yr;
    const day = type === 'VAT' ? 20 : (type === 'NSSF' || type === 'WCF') ? 30 : 7;
    return `${ny}-${String(nm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function fmtPeriod(p) {
    const [yr, mo] = p.split('-').map(Number);
    return (!yr || !mo || mo < 1 || mo > 12) ? p : `${MO[mo-1]} ${yr}`;
  }

  const cm = new Map(clients.map(c => [c.id, c]));

  const pending = returns.filter(r => {
    if (r.status === 'completed') return false;
    const c = cm.get(r.clientId);
    if (!c) return false;
    return !c.taxTypes || c.taxTypes.includes(r.taxType);
  });

  const pendingLines = pending.map(r => {
    const c = cm.get(r.clientId);
    const dd = dueDate(r.taxType, r.period);
    const diff = dd ? Math.round((new Date(dd) - new Date(today)) / 86400000) : null;
    const status = diff === null ? '' : diff < 0 ? ` (OVERDUE by ${Math.abs(diff)}d)` : diff === 0 ? ' (DUE TODAY)' : ` (due in ${diff}d)`;
    return `  - ${c?.name || r.clientId}: ${r.taxType} ${fmtPeriod(r.period)}${status}`;
  }).join('\n');

  const clientLines = clients.map(c =>
    `  - ${c.name} [${(c.taxTypes||[]).join(', ')}]`
  ).join('\n');

  const taskLines = tasks.map(t =>
    `  - [${t.priority}] ${t.title}${t.dueDate ? ` (due ${t.dueDate})` : ''}`
  ).join('\n');

  // Working hours — summarise all weeks and compute monthly totals
  const wh = state.workingHours || {};
  const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  function calcDay(d) {
    if (!d?.timeIn || !d?.timeOut) return 0;
    const toMins = t => { const [h,m] = t.split(':').map(Number); return h*60+m; };
    const worked = toMins(d.timeOut) - toMins(d.timeIn);
    const brk = (d.breakStart && d.breakStop) ? toMins(d.breakStop) - toMins(d.breakStart) : 0;
    return Math.max(0, (worked - Math.max(0, brk)) / 60);
  }
  // Group weeks by year-month
  const monthlyHours = {};
  const weekLines = [];
  for (const [wk, days] of Object.entries(wh).sort()) {
    let wkTotal = 0, wkDays = 0;
    const dayParts = [];
    for (const day of DAY_ORDER) {
      const e = days[day]; if (!e?.timeIn) continue;
      const h = calcDay(e); wkTotal += h; wkDays++;
      dayParts.push(`${day} ${h.toFixed(1)}h`);
    }
    if (wkDays === 0) continue;
    weekLines.push(`  ${wk}: ${wkTotal.toFixed(1)}h (${dayParts.join(', ')})`);
    // Parse week key to get approximate month
    const [yr, wNum] = wk.split('-W').map(Number);
    // simple week→month: use Jan 4 + (week-1)*7 days
    const jan4 = new Date(yr, 0, 4);
    const monday = new Date(jan4.getTime() + (wNum - 1) * 7 * 86400000);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const ym = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}`;
    monthlyHours[ym] = (monthlyHours[ym] || 0) + wkTotal;
  }
  const monthSummary = Object.entries(monthlyHours).sort()
    .map(([ym, h]) => {
      const [yr, mo] = ym.split('-').map(Number);
      return `  ${MO[mo-1]} ${yr}: ${h.toFixed(1)}h`;
    }).join('\n');

  // Notes summary
  const notes = state.notes || [];
  const noteLines = notes.slice(0, 10).map(n =>
    `  - ${n.title || '(untitled)'}: ${(n.content||'').slice(0, 80)}${(n.content||'').length > 80 ? '…' : ''}`
  ).join('\n');

  return `You are Jay's personal AI assistant. You're sharp, direct, and genuinely helpful — not a corporate chatbot. Talk like a real person. Be casual when the conversation is casual, focused when the work needs it.

You have full access to Jay's work data (below), but you're not limited to it. Jay can talk to you about anything — life, ideas, random questions, venting, whatever. Just be present and useful.

TODAY: ${today}

--- WORK CONTEXT ---

CLIENTS (${clients.length} active):
${clientLines || '  (none)'}

PENDING TAX RETURNS (${pending.length}):
${pendingLines || '  (all clear!)'}

PENDING TASKS (${tasks.length}):
${taskLines || '  (none)'}

WORKING HOURS BY WEEK:
${weekLines.join('\n') || '  (no hours logged)'}

WORKING HOURS BY MONTH:
${monthSummary || '  (no hours logged)'}

NOTES (${notes.length} total, showing first 10):
${noteLines || '  (none)'}

Tax due dates: VAT → 20th next month, PAYE/SDL/WHT → 7th, NSSF/WCF → 30th, PROVISIONAL/CITY_LEVY → quarterly, ROI → annual June.

You can read all this data and answer questions about it. To make changes, Jay uses the app or Telegram bot — but you don't need to remind him of that every time, only when directly relevant.`;
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={cn('flex gap-3 max-w-full', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-1',
        isUser
          ? 'bg-blue-600 text-white'
          : 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white'
      )}>
        {isUser ? 'J' : '✦'}
      </div>
      {/* Content */}
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
        isUser
          ? 'bg-blue-600 text-white rounded-tr-sm'
          : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
      )}>
        {msg.content.split('\n').map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < msg.content.split('\n').length - 1 && <br />}
          </React.Fragment>
        ))}
        {msg.streaming && (
          <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse rounded-sm align-middle" />
        )}
      </div>
    </div>
  );
}

// ─── Offline state ────────────────────────────────────────────────────────────
function OfflinePanel({ onRetry, checking }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16 space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-3xl">
        🤖
      </div>
      <div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">LM Studio not detected</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed max-w-sm">
          Start LM Studio on this PC, load a model, start the server, and enable <strong>CORS</strong> in server settings.
        </p>
      </div>
      <div className="bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl px-5 py-4 text-left text-xs space-y-2 w-full max-w-sm">
        <p className="font-semibold text-gray-700 dark:text-gray-200">Quick setup:</p>
        <ol className="list-decimal pl-4 space-y-1.5 text-gray-500 dark:text-gray-400">
          <li>Open LM Studio → <strong>Local Server</strong> tab</li>
          <li>Load a model (Qwen3 30B A3B recommended)</li>
          <li>Enable <strong>CORS</strong> → click <strong>Start Server</strong></li>
          <li>Come back here and click Retry</li>
        </ol>
        <p className="text-gray-400 dark:text-gray-600 pt-1">Listening on: <code className="font-mono bg-gray-200 dark:bg-gray-700 px-1 rounded">localhost:1234</code></p>
      </div>
      <button
        onClick={onRetry}
        disabled={checking}
        className="btn-primary px-6 py-2 disabled:opacity-50"
      >
        {checking ? (
          <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Checking…</>
        ) : '🔄 Retry Connection'}
      </button>
    </div>
  );
}

// ─── Model selector ───────────────────────────────────────────────────────────
function ModelPill({ models, selected, onChange }) {
  if (!models.length) return null;
  return (
    <select
      value={selected}
      onChange={e => onChange(e.target.value)}
      className="text-xs bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px] truncate"
    >
      {models.map(m => (
        <option key={m} value={m}>{m.split('/').pop().split('-GGUF')[0]}</option>
      ))}
    </select>
  );
}

// ─── Suggested prompts ────────────────────────────────────────────────────────
const SUGGESTIONS = [
  "What's overdue right now?",
  "How many hours did I work this month?",
  "Which clients haven't filed PAYE for April?",
  "I need to vent about work 😅",
  "Give me a quick summary of my week",
  "What should I focus on today?",
];

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AIAssistant() {
  const { state } = useApp();

  const [status,   setStatus]   = useState('checking'); // 'checking' | 'online' | 'offline'
  const [models,   setModels]   = useState([]);
  const [model,    setModel]    = useState('');
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const abortRef  = useRef(null);

  // ── Check LM Studio ──
  const checkConnection = useCallback(async () => {
    setStatus('checking');
    try {
      const res = await fetch(`${LM_BASE}/models`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const ids = (json.data || []).map(m => m.id);
      setModels(ids);
      setModel(prev => ids.includes(prev) ? prev : (ids[0] || ''));
      setStatus('online');
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => { checkConnection(); }, [checkConnection]);

  // ── Scroll to bottom ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──
  async function send(text) {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: userText };
    const systemPrompt = buildSystemPrompt(state);

    const history = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => !m.streaming).map(m => ({ role: m.role, content: m.content })),
      userMsg,
    ];

    setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', streaming: true }]);
    setLoading(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${LM_BASE}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          model,
          messages: history,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
          // Disable thinking for Qwen3 — must be top-level, not in extra_body
          enable_thinking: false,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';
      let inThink = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content || '';
            // Strip <think>...</think> blocks from Qwen3
            let filtered = '';
            for (let i = 0; i < delta.length; i++) {
              if (!inThink && delta.slice(i).startsWith('<think>')) { inThink = true; i += 6; continue; }
              if (inThink  && delta.slice(i).startsWith('</think>')) { inThink = false; i += 7; continue; }
              if (!inThink) filtered += delta[i];
            }
            if (filtered) {
              full += filtered;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: full, streaming: true };
                return updated;
              });
            }
          } catch { /* skip bad JSON chunks */ }
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: full, streaming: false };
        return updated;
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `⚠️ Error: ${err.message}. Make sure LM Studio server is running.`,
            streaming: false,
          };
          return updated;
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setLoading(false);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-h-[900px] animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <span className="text-2xl">✦</span> AI Assistant
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Powered by LM Studio · reads your live data
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status dot */}
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            status === 'online'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40 text-green-700 dark:text-green-400'
              : status === 'checking'
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40 text-blue-600 dark:text-blue-400'
              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
          )}>
            <span className={cn('w-1.5 h-1.5 rounded-full', status === 'online' ? 'bg-green-500' : status === 'checking' ? 'bg-blue-500 animate-pulse' : 'bg-gray-400')} />
            {status === 'online' ? 'Connected' : status === 'checking' ? 'Checking…' : 'Offline'}
          </div>
          {status === 'online' && <ModelPill models={models} selected={model} onChange={setModel} />}
          {messages.length > 0 && (
            <button onClick={clearChat} className="btn-secondary text-xs px-3 py-1.5 h-auto">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 card overflow-hidden flex flex-col min-h-0">
        {status !== 'online' ? (
          <OfflinePanel onRetry={checkConnection} checking={status === 'checking'} />
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {messages.length === 0 ? (
                /* Welcome state */
                <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-6">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-indigo-500/20">
                    ✦
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-800 dark:text-gray-100">Ask me anything about your work</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      I know your {(state.clients||[]).filter(c=>!c.hidden).length} clients, {(state.taxReturns||[]).filter(r=>r.status!=='completed').length} pending returns, and {(state.tasks||[]).filter(t=>t.status!=='completed').length} open tasks.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-left text-xs px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700/40 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, i) => <Bubble key={i} msg={msg} />)
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-3">
              <div className="flex gap-2 items-end">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Ask about clients, returns, deadlines…"
                  rows={1}
                  disabled={loading}
                  className="input flex-1 resize-none min-h-[40px] max-h-[120px] py-2.5 disabled:opacity-50"
                  style={{ height: 'auto', overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                />
                {loading ? (
                  <button
                    onClick={stop}
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-700/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition flex items-center justify-center"
                    title="Stop"
                  >
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>
                  </button>
                ) : (
                  <button
                    onClick={() => send()}
                    disabled={!input.trim()}
                    className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition flex items-center justify-center"
                    title="Send (Enter)"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5 px-1">
                Enter to send · Shift+Enter for new line · Context updates with every message
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
