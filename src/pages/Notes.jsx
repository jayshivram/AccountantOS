import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { cn } from '../utils/index.js';
import { Modal } from '../components/UI.jsx';

// --- Constants ----------------------------------------------------------------

const CATEGORIES = ['General', 'Double Entry', 'Client Files', 'Payments', 'Accounting', 'Reminders'];

const NOTE_COLORS = [
  { id:'yellow', label:'Yellow', dot:'bg-yellow-400', card:'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700/40', header:'bg-yellow-100/80 dark:bg-yellow-800/30', badge:'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700/50' },
  { id:'blue',   label:'Blue',   dot:'bg-blue-400',   card:'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700/40',     header:'bg-blue-100/80 dark:bg-blue-800/30',   badge:'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700/50' },
  { id:'green',  label:'Green',  dot:'bg-green-400',  card:'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700/40',  header:'bg-green-100/80 dark:bg-green-800/30', badge:'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700/50' },
  { id:'pink',   label:'Pink',   dot:'bg-pink-400',   card:'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-700/40',     header:'bg-pink-100/80 dark:bg-pink-800/30',   badge:'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-700/50' },
  { id:'purple', label:'Purple', dot:'bg-purple-400', card:'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/40', header:'bg-purple-100/80 dark:bg-purple-800/30', badge:'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700/50' },
  { id:'orange', label:'Orange', dot:'bg-orange-400', card:'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700/40', header:'bg-orange-100/80 dark:bg-orange-800/30', badge:'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700/50' },
];

const BLANK_NOTE = { title: '', content: '', color: 'yellow', category: 'General', pinned: false };

// --- Helpers ------------------------------------------------------------------

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  const wks  = Math.floor(days / 7);
  if (wks  < 5)   return `${wks}w ago`;
  const mos  = Math.floor(days / 30);
  return `${mos}mo ago`;
}

function getColor(id) {
  return NOTE_COLORS.find(c => c.id === id) || NOTE_COLORS[0];
}

function wordCount(text) {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

// --- Markdown utilities -------------------------------------------------------

function escapeHtml(str) {
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#039;');
}

function applyInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/__(.+?)__/g,     '<u>$1</u>')
    .replace(/~~(.+?)~~/g,     '<s>$1</s>');
}

function renderMarkdown(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(`<li>${applyInline(escapeHtml(lines[i].replace(/^[-*] /, '')))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${applyInline(escapeHtml(lines[i].replace(/^\d+\. /, '')))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }
    if (line.trim() === '') {
      out.push('<br/>');
      i++;
      continue;
    }
    out.push(`<span class="block">${applyInline(escapeHtml(line))}</span>`);
    i++;
  }
  return out.join('');
}

function stripMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g,     '$1')
    .replace(/__(.+?)__/g,     '$1')
    .replace(/~~(.+?)~~/g,     '$1')
    .replace(/^[-*] /gm,       '')
    .replace(/^\d+\. /gm,      '');
}

// --- Format helpers -----------------------------------------------------------

function applyFormat(textarea, setContent, type) {
  if (!textarea) return;
  const start    = textarea.selectionStart;
  const end      = textarea.selectionEnd;
  const value    = textarea.value;
  const selected = value.slice(start, end);
  let newText    = value;
  let newStart   = start;
  let newEnd     = end;

  if (type === 'bold') {
    newText  = value.slice(0, start) + `**${selected}**` + value.slice(end);
    newStart = selected ? start : start + 2;
    newEnd   = selected ? end + 4 : start + 2;
  } else if (type === 'italic') {
    newText  = value.slice(0, start) + `*${selected}*` + value.slice(end);
    newStart = selected ? start : start + 1;
    newEnd   = selected ? end + 2 : start + 1;
  } else if (type === 'underline') {
    newText  = value.slice(0, start) + `__${selected}__` + value.slice(end);
    newStart = selected ? start : start + 2;
    newEnd   = selected ? end + 4 : start + 2;
  } else if (type === 'strike') {
    newText  = value.slice(0, start) + `~~${selected}~~` + value.slice(end);
    newStart = selected ? start : start + 2;
    newEnd   = selected ? end + 4 : start + 2;
  } else if (type === 'bullet') {
    const lines    = selected ? selected.split('\n') : [''];
    const prefixed = lines.map(l => `- ${l}`).join('\n');
    newText  = value.slice(0, start) + prefixed + value.slice(end);
    newStart = start;
    newEnd   = start + prefixed.length;
  } else if (type === 'numbered') {
    const lines    = selected ? selected.split('\n') : [''];
    const prefixed = lines.map((l, idx) => `${idx + 1}. ${l}`).join('\n');
    newText  = value.slice(0, start) + prefixed + value.slice(end);
    newStart = start;
    newEnd   = start + prefixed.length;
  }

  setContent(newText);
  requestAnimationFrame(() => {
    if (textarea) {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }
  });
}

// --- NoteCard -----------------------------------------------------------------

function NoteCard({ note, onView, onEdit, onPin, onDelete }) {
  const color   = getColor(note.color);
  const preview = stripMarkdown(note.content);

  return (
    <div
      className={cn(
        'group relative rounded-2xl border flex flex-col cursor-pointer',
        'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5',
        color.card
      )}
      onClick={() => onView(note)}
    >
      {note.pinned && (
        <div className="absolute -top-2 -right-2 z-10 w-6 h-6 bg-amber-400 dark:bg-amber-500 rounded-full flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
          </svg>
        </div>
      )}

      <div className={cn('h-1.5 rounded-t-2xl w-full', color.dot)} />

      <div className="flex flex-col flex-1 p-4 gap-2">
        <div
          className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(note)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-white/70 dark:hover:bg-gray-900/60 transition"
            title="Edit note"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onPin(note.id)}
            className={cn(
              'p-1.5 rounded-lg transition',
              note.pinned
                ? 'text-amber-500 bg-white/70 dark:bg-gray-900/60 hover:bg-white dark:hover:bg-gray-900'
                : 'text-gray-400 hover:text-amber-500 hover:bg-white/70 dark:hover:bg-gray-900/60'
            )}
            title={note.pinned ? 'Unpin' : 'Pin to top'}
          >
            <svg className="w-3.5 h-3.5" fill={note.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/70 dark:hover:bg-gray-900/60 transition"
            title="Delete note"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {note.title && (
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug pr-14 line-clamp-2">
            {note.title}
          </h3>
        )}

        {preview && (
          <p className={cn(
            'text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-5',
            !note.title && 'pr-14'
          )}>
            {preview}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2">
          {note.category ? (
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
              color.badge
            )}>
              {note.category}
            </span>
          ) : <span />}
          <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
            {timeAgo(note.updatedAt || note.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- NoteViewModal ------------------------------------------------------------

function NoteViewModal({ note, isOpen, onClose, onEdit, onDuplicate }) {
  const [copied, setCopied] = useState(false);
  const color = note ? getColor(note.color) : NOTE_COLORS[0];

  function handleCopy() {
    if (!note) return;
    const plain = [note.title, note.content].filter(Boolean).join('\n\n');
    navigator.clipboard.writeText(plain)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
      .catch(() => {});
  }

  if (!note) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title=" " size="lg">
      <div className="space-y-4 -mt-2">

        <div className="flex items-start gap-3">
          <div className={cn('w-1 rounded-full flex-shrink-0 self-stretch min-h-[20px]', color.dot)} />
          <div className="flex-1 min-w-0">
            {note.title && (
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug break-words">
                {note.title}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {note.category && (
                <span className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border',
                  color.badge
                )}>
                  {note.category}
                </span>
              )}
              {note.pinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
                  </svg>
                  Pinned
                </span>
              )}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                Updated {timeAgo(note.updatedAt || note.createdAt)}
              </span>
              {note.content && (
                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                  {wordCount(note.content)} words
                </span>
              )}
            </div>
          </div>
        </div>

        <div className={cn(
          'rounded-xl border p-4 min-h-[80px] max-h-[55vh] overflow-y-auto',
          'bg-white/60 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700'
        )}>
          {note.content ? (
            <div
              className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:font-bold [&_em]:italic [&_u]:underline [&_s]:line-through"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
            />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">No content</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition',
                copied
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy
                </>
              )}
            </button>
            <button
              onClick={() => onDuplicate(note)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Duplicate
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Close</button>
            <button
              onClick={() => { onClose(); onEdit(note); }}
              className="btn btn-primary flex items-center gap-1.5 px-4 py-2 text-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}

// --- FormatButton (module-level to avoid remount on every render) -------------

function FormatButton({ label, formatType, title: btnTitle, onFormat }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onFormat(formatType); }}
      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition select-none"
      title={btnTitle}
    >
      {label}
    </button>
  );
}

// --- NoteModal ----------------------------------------------------------------

function NoteModal({ note, isOpen, onClose, onSave, onDelete }) {
  const isNew = !note?.id;
  const [form, setForm] = useState(note || BLANK_NOTE);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setForm(note || BLANK_NOTE);
    setConfirmDelete(false);
  }, [note, isOpen]);

  const canSave = form.title.trim() || form.content.trim();
  const wc = wordCount(form.content);
  const cc = (form.content || '').length;

  function handleSave() {
    if (!canSave) return;
    onSave(form);
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'b')     { e.preventDefault(); handleFormat('bold');      return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'i')     { e.preventDefault(); handleFormat('italic');    return; }
    if ((e.ctrlKey || e.metaKey) && e.key === 'u')     { e.preventDefault(); handleFormat('underline'); return; }
  }

  function handleFormat(type) {
    applyFormat(textareaRef.current, val => setForm(f => ({ ...f, content: val })), type);
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(note.id);
    onClose();
  }

  const selectedColor = getColor(form.color);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isNew ? 'New Note' : 'Edit Note'} size="lg">
      <div className="space-y-4" onKeyDown={handleKeyDown}>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Title</label>
          <input
            type="text"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Give your note a title..."
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Content</label>

          <div className="flex items-center gap-0.5 px-2 py-1 rounded-t-xl border border-b-0 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80 flex-wrap">
            <FormatButton label={<strong>B</strong>}                       formatType="bold"      title="Bold (Ctrl+B)"      onFormat={handleFormat} />
            <FormatButton label={<em>I</em>}                               formatType="italic"    title="Italic (Ctrl+I)"    onFormat={handleFormat} />
            <FormatButton label={<span className="underline">U</span>}     formatType="underline" title="Underline (Ctrl+U)"  onFormat={handleFormat} />
            <FormatButton label={<span className="line-through">S</span>}  formatType="strike"    title="Strikethrough"       onFormat={handleFormat} />
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0" />
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleFormat('bullet'); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition select-none"
              title="Bullet list"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              Bullets
            </button>
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleFormat('numbered'); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition select-none"
              title="Numbered list"
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Numbered
            </button>
            <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 tabular-nums pr-1 flex-shrink-0">
              {wc} words · {cc} chars
            </span>
          </div>

          <textarea
            ref={textareaRef}
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder={"Write anything here...\n\nFormatting: **bold**, *italic*, __underline__, ~~strikethrough~~\nLists: - item or 1. item"}
            rows={9}
            className="w-full px-3 py-2.5 rounded-b-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none leading-relaxed transition font-mono"
          />
          <p className="text-[10px] text-gray-400 mt-1">Ctrl+Enter save · Ctrl+B bold · Ctrl+I italic · Ctrl+U underline</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Color</label>
          <div className="flex items-center gap-2.5">
            {NOTE_COLORS.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c.id }))}
                className={cn(
                  'w-7 h-7 rounded-full transition-all duration-150',
                  c.dot,
                  form.color === c.id
                    ? 'ring-2 ring-offset-2 ring-gray-500 dark:ring-gray-400 dark:ring-offset-gray-900 scale-125 shadow-md'
                    : 'hover:scale-110 opacity-70 hover:opacity-100'
                )}
                title={c.label}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1">{selectedColor.label}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition cursor-pointer"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Pin to Top</label>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
              className={cn(
                'h-10 px-4 rounded-xl border text-sm font-semibold transition flex items-center gap-2 whitespace-nowrap',
                form.pinned
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/50'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-amber-300 dark:hover:border-amber-700'
              )}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill={form.pinned ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              {form.pinned ? 'Pinned' : 'Pin'}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition',
                confirmDelete
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'text-red-500 dark:text-red-400 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20'
              )}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              {confirmDelete ? 'Confirm Delete?' : 'Delete'}
            </button>
          ) : <div />}

          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="btn btn-primary px-5 py-2 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isNew ? 'Create Note' : 'Save Changes'}
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}

// --- Pastebin Section ---------------------------------------------------------

function PastebinSection({ pastebins, dispatch }) {
  const [open,        setOpen]        = useState(false);
  const [title,       setTitle]       = useState('');
  const [content,     setContent]     = useState('');
  const [editId,      setEditId]      = useState(null);
  const [editTitle,   setEditTitle]   = useState('');
  const [editContent, setEditContent] = useState('');
  const [editOpen,    setEditOpen]    = useState(false);
  const [copiedId,    setCopiedId]    = useState(null);
  const [deleteId,    setDeleteId]    = useState(null);

  function handleSave() {
    if (!content.trim()) return;
    const now = new Date();
    const autoTitle = title.trim() ||
      `Snippet - ${now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
    dispatch({ type: 'ADD_PASTEBIN', payload: { title: autoTitle, content: content.trim() } });
    setTitle('');
    setContent('');
  }

  function handleCopy(item) {
    navigator.clipboard.writeText(item.content)
      .then(() => { setCopiedId(item.id); setTimeout(() => setCopiedId(null), 1800); })
      .catch(() => {});
  }

  function handleEditOpen(item) {
    setEditId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditOpen(true);
  }

  function handleEditSave() {
    if (!editContent.trim()) return;
    dispatch({ type: 'EDIT_PASTEBIN', payload: { id: editId, title: editTitle, content: editContent } });
    setEditOpen(false);
  }

  function handleDelete(id) {
    if (deleteId === id) {
      dispatch({ type: 'DELETE_PASTEBIN', payload: id });
      setDeleteId(null);
    } else {
      setDeleteId(id);
      setTimeout(() => setDeleteId(d => d === id ? null : d), 3000);
    }
  }

  return (
    <section className="space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left"
      >
        <svg
          className={cn('w-3.5 h-3.5 text-gray-400 transition-transform duration-200', open && 'rotate-90')}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Pastebin</span>
          {pastebins.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({pastebins.length} snippet{pastebins.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 ml-1" />
      </button>

      {open && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Snippet title (optional - auto-named if empty)"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Paste anything here - code snippets, template text, frequently-used entries, text to copy later..."
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none leading-relaxed font-mono transition"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={!content.trim()}
                className="btn btn-primary flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Snippet
              </button>
            </div>
          </div>

          {pastebins.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No snippets saved yet.</p>
          ) : (
            <div className="space-y-2">
              {[...pastebins].reverse().map(item => (
                <div key={item.id} className="card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{timeAgo(item.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleCopy(item)}
                        className={cn(
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition',
                          copiedId === item.id
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700/50'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        {copiedId === item.id ? (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            Copy
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleEditOpen(item)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                        title="Edit snippet"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className={cn(
                          'p-1.5 rounded-lg transition',
                          deleteId === item.id
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800'
                        )}
                        title={deleteId === item.id ? 'Click again to confirm' : 'Delete snippet'}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-2.5 overflow-x-auto whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                    {item.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Snippet" size="md">
        <div className="space-y-3">
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            placeholder="Snippet title"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
          />
          <textarea
            value={editContent}
            onChange={e => setEditContent(e.target.value)}
            rows={7}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono leading-relaxed transition"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditOpen(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={handleEditSave}
              disabled={!editContent.trim()}
              className="btn btn-primary px-4 py-2 text-sm disabled:opacity-40"
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

// --- Main Notes Page ----------------------------------------------------------

export default function NotesPage() {
  const { state, dispatch } = useApp();
  const notes    = state.notes    || [];
  const pastebins = state.pastebins || [];

  const [search,    setSearch]    = useState('');
  const [filterCat, setFilterCat] = useState('All');
  const [sortBy,    setSortBy]    = useState('updated');

  const [viewNote, setViewNote] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);

  const [editNote, setEditNote] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  const [deleteId, setDeleteId] = useState(null);

  const filtered = useMemo(() => {
    let result = notes;
    if (filterCat !== 'All') result = result.filter(n => n.category === filterCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(n =>
        n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, filterCat, search]);

  const sorter = useMemo(() => {
    if (sortBy === 'title')   return (a, b) => (a.title || '').localeCompare(b.title || '');
    if (sortBy === 'created') return (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    return (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
  }, [sortBy]);

  const pinned   = useMemo(() => filtered.filter(n =>  n.pinned).sort(sorter), [filtered, sorter]);
  const unpinned = useMemo(() => filtered.filter(n => !n.pinned).sort(sorter), [filtered, sorter]);

  function openView(note)  { setViewNote(note); setViewOpen(true); }
  function closeView()     { setViewOpen(false); setViewNote(null); }
  function openNew()       { setEditNote(null); setEditOpen(true); }
  function openEdit(note)  { setEditNote(note); setEditOpen(true); }
  function closeEdit()     { setEditOpen(false); setEditNote(null); }

  function handleSave(form) {
    if (editNote?.id) {
      dispatch({ type: 'EDIT_NOTE', payload: { ...editNote, ...form, updatedAt: new Date().toISOString() } });
    } else {
      dispatch({ type: 'ADD_NOTE', payload: form });
    }
  }

  function handleDelete(id) {
    dispatch({ type: 'DELETE_NOTE', payload: id });
  }

  function handlePin(id) {
    dispatch({ type: 'PIN_NOTE', payload: id });
  }

  function handleDuplicate(note) {
    closeView();
    dispatch({
      type: 'ADD_NOTE',
      payload: {
        title:    `Copy of ${note.title || 'Untitled'}`,
        content:  note.content,
        color:    note.color,
        category: note.category,
        pinned:   false,
      },
    });
  }

  const catCounts = useMemo(() => {
    const counts = { All: notes.length };
    CATEGORIES.forEach(cat => {
      counts[cat] = notes.filter(n => n.category === cat).length;
    });
    return counts;
  }, [notes]);

  return (
    <div className="space-y-5">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {notes.length === 0
              ? 'Your personal notepad'
              : `${notes.length} note${notes.length !== 1 ? 's' : ''}${pinned.length > 0 ? ` · ${pinned.length} pinned` : ''}`
            }
          </p>
        </div>
        <button onClick={openNew} className="btn btn-primary flex items-center gap-2 text-sm flex-shrink-0">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Note
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notes by title or content..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition cursor-pointer flex-shrink-0"
          >
            <option value="updated">Last updated</option>
            <option value="created">Date created</option>
            <option value="title">Title A-Z</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['All', ...CATEGORIES].map(cat => {
            const count    = catCounts[cat] ?? 0;
            const isActive = filterCat === cat;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(cat)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                )}
              >
                {cat}
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    isActive ? 'text-blue-100' : 'text-gray-400 dark:text-gray-500'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {(search || filterCat !== 'All') && notes.length > 0 && (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            Showing {filtered.length} of {notes.length} note{notes.length !== 1 ? 's' : ''}
            {search && <> matching "<span className="text-gray-600 dark:text-gray-300">{search}</span>"</>}
          </p>
        )}
      </div>

      {notes.length === 0 && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-500 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 text-base mb-2">No notes yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-sm mx-auto mb-5 leading-relaxed">
            Jot down anything - double entry methods, file locations, payments received, who you gave files to. Supports bold, italic, lists and more.
          </p>
          <button onClick={openNew} className="btn btn-primary mx-auto">
            Create your first note
          </button>
        </div>
      )}

      {notes.length > 0 && filtered.length === 0 && (
        <div className="card p-10 text-center">
          <svg className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-gray-400 dark:text-gray-500">No notes match your search.</p>
          <button
            onClick={() => { setSearch(''); setFilterCat('All'); }}
            className="mt-3 text-xs text-blue-500 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {pinned.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-3.5 h-3.5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
            </svg>
            <h2 className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Pinned</h2>
            <span className="text-[10px] text-amber-500">({pinned.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pinned.map(note => (
              <NoteCard key={note.id} note={note} onView={openView} onEdit={openEdit} onPin={handlePin} onDelete={id => setDeleteId(id)} />
            ))}
          </div>
        </section>
      )}

      {unpinned.length > 0 && (
        <section>
          {pinned.length > 0 && (
            <h2 className="text-[11px] font-bold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3">Other Notes</h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unpinned.map(note => (
              <NoteCard key={note.id} note={note} onView={openView} onEdit={openEdit} onPin={handlePin} onDelete={id => setDeleteId(id)} />
            ))}
          </div>
        </section>
      )}

      <PastebinSection pastebins={pastebins} dispatch={dispatch} />

      <NoteViewModal
        isOpen={viewOpen}
        note={viewNote}
        onClose={closeView}
        onEdit={openEdit}
        onDuplicate={handleDuplicate}
      />

      <NoteModal
        isOpen={editOpen}
        note={editNote}
        onClose={closeEdit}
        onSave={handleSave}
        onDelete={handleDelete}
      />

      <Modal isOpen={deleteId !== null} onClose={() => setDeleteId(null)} title="Delete Note" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Are you sure you want to delete this note? This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
            <button
              onClick={() => { handleDelete(deleteId); setDeleteId(null); }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
