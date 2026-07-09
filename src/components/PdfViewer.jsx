import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { cn } from '../utils/index.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

// Renders one page onto a canvas (with a transparent, selectable text layer on
// top), only once it scrolls near the viewport — keeps a 50-page document from
// rasterizing everything upfront.
function PdfPage({ pdf, pageNumber, scale }) {
  const wrapRef      = useRef(null);
  const canvasRef    = useRef(null);
  const textRef      = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setVisible(true); }),
      { rootMargin: '800px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !pdf) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const wrap   = wrapRef.current;
      const textLayerDiv = textRef.current;
      if (!canvas || !wrap) return;

      // Size the wrapper in CSS pixels; render the canvas at device-pixel
      // resolution for crispness, then downscale via CSS.
      const outputScale = window.devicePixelRatio || 1;
      wrap.style.width  = `${Math.floor(viewport.width)}px`;
      wrap.style.height = `${Math.floor(viewport.height)}px`;
      canvas.width  = Math.floor(viewport.width  * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width  = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      renderTaskRef.current?.cancel();
      const task = page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTaskRef.current = task;
      try { await task.promise; } catch { return; /* superseded by a newer render */ }
      if (cancelled) return;

      // Selectable/copyable text overlay, aligned to the canvas.
      if (textLayerDiv) {
        textLayerDiv.replaceChildren();
        textLayerDiv.style.setProperty('--total-scale-factor', String(scale));
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: page.streamTextContent(),
          container: textLayerDiv,
          viewport,
        });
        try { await textLayer.render(); } catch { /* ignore */ }
      }
    })();
    return () => { cancelled = true; };
  }, [visible, pdf, pageNumber, scale]);

  return (
    <div ref={containerRef} className="flex justify-center mb-4">
      {visible ? (
        <div ref={wrapRef} className="pdf-page-wrap shadow-md bg-white max-w-full">
          <canvas ref={canvasRef} className="block" />
          <div ref={textRef} className="textLayer" />
        </div>
      ) : (
        <div className="w-full max-w-2xl aspect-[1/1.41] bg-white/60 dark:bg-gray-800/40 rounded shadow-sm" />
      )}
    </div>
  );
}

/** Self-contained PDF viewer (pdf.js + canvas) — avoids native browser PDF
 *  plugins entirely, since they render unreliably (blank/black) embedded
 *  inside a themed, dark-mode single-page app. */
export default function PdfViewer({ src, title }) {
  const [pdf, setPdf]         = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale]     = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setPdf(null); setNumPages(0);
    const loadingTask = pdfjsLib.getDocument({ url: src });
    loadingTask.promise.then(doc => {
      if (cancelled) return;
      setPdf(doc);
      setNumPages(doc.numPages);
      setLoading(false);
    }).catch(err => {
      if (cancelled) return;
      setError(err?.message || 'Failed to load this PDF.');
      setLoading(false);
    });
    return () => { cancelled = true; loadingTask.destroy?.(); };
  }, [src]);

  const zoomOut = () => setScale(s => Math.max(0.5, +(s - 0.15).toFixed(2)));
  const zoomIn  = () => setScale(s => Math.min(3,   +(s + 0.15).toFixed(2)));

  return (
    <div className="h-full flex flex-col bg-gray-100 dark:bg-gray-950">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0">
        <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
          {loading ? 'Loading…' : numPages ? `${numPages} page${numPages !== 1 ? 's' : ''}` : ''}
        </span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">−</button>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition">+</button>
          <a
            href={src}
            download
            className="ml-1.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      </div>

      {/* Pages */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {loading && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500">Loading {title || 'document'}…</div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-4">
            <p className="text-sm text-red-500 dark:text-red-400">Couldn't load this PDF.</p>
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Open the file directly →</a>
          </div>
        )}
        {!loading && !error && pdf && (
          <div className={cn('mx-auto', 'max-w-3xl')}>
            {Array.from({ length: numPages }, (_, i) => (
              <PdfPage key={i + 1} pdf={pdf} pageNumber={i + 1} scale={scale} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
