// Visor de documentos: PDF renderizado con pdf.js (sin el boton de descarga del visor nativo)
// y texto extraido para Word/Excel/texto. Marca de agua con el email del usuario encima.
import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { S, C, serif } from './styles';

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfjsPromise = null;
function loadPdfjs() {
  if (typeof window === 'undefined') return Promise.reject(new Error('sin navegador'));
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PDFJS;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; resolve(window.pdfjsLib); };
      s.onerror = () => reject(new Error('no se pudo cargar el visor de PDF'));
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

function Watermark({ text }) {
  if (!text) return null;
  const items = Array.from({ length: 12 });
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', alignContent: 'space-around' }}>
      {items.map((_, i) => (
        <div key={i} style={{ transform: 'rotate(-30deg)', color: 'rgba(120,110,95,.16)', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center', userSelect: 'none' }}>{text}</div>
      ))}
    </div>
  );
}

const PAGE_BATCH = 25;

export default function Viewer({ doc, startPage = 1, onClose, canDownload, onDownload }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [pdf, setPdf] = useState(null);
  const [limit, setLimit] = useState(PAGE_BATCH);
  const holder = useRef();

  useEffect(() => {
    let alive = true;
    api('/api/dataroom/view', { document_id: doc.id })
      .then(async (d) => {
        if (!alive) return;
        setData(d);
        if (d.mode === 'pdf') {
          const lib = await loadPdfjs();
          const task = lib.getDocument({ url: d.url });
          const p = await task.promise;
          if (alive) { setPdf(p); setLimit(Math.max(PAGE_BATCH, (startPage || 1) + 5)); }
        }
      })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [doc.id]); // eslint-disable-line

  useEffect(() => {
    if (!pdf || !holder.current) return;
    let cancelled = false;
    (async () => {
      const box = holder.current;
      box.innerHTML = '';
      const width = Math.min(860, box.clientWidth - 8);
      for (let n = 1; n <= Math.min(pdf.numPages, limit) && !cancelled; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = width / base.width;
        const vp = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
        const wrap = document.createElement('div');
        wrap.id = `pg-${n}`;
        wrap.style.cssText = `position:relative;margin:0 auto 14px;width:${width}px;box-shadow:0 1px 4px rgba(0,0,0,.12);background:#fff`;
        const canvas = document.createElement('canvas');
        canvas.width = vp.width; canvas.height = vp.height;
        canvas.style.cssText = `width:${width}px;height:${(vp.height / vp.width) * width}px;display:block`;
        wrap.appendChild(canvas);
        const tag = document.createElement('div');
        tag.textContent = `p. ${n}`;
        tag.style.cssText = 'position:absolute;top:6px;right:10px;font-size:11px;color:#a59d8f';
        wrap.appendChild(tag);
        box.appendChild(wrap);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        if (n === startPage) wrap.scrollIntoView({ block: 'start' });
      }
    })();
    return () => { cancelled = true; };
  }, [pdf, limit]); // eslint-disable-line

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,22,.55)', zIndex: 50, display: 'flex', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: C.paper, borderRadius: 12, width: '100%', maxWidth: 940, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${C.line}`, background: '#fffdf9' }}>
          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 16, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
          {pdf && <span style={{ fontSize: 12, color: C.mid }}>{pdf.numPages} págs.</span>}
          {canDownload && <button style={S.btnGhost} onClick={() => onDownload(doc)}>Descargar</button>}
          <button style={S.btnGhost} onClick={onClose}>Cerrar</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, position: 'relative' }}>
          {err && <div style={S.err}>{err}</div>}
          {!data && !err && <div style={S.empty}>Cargando…</div>}
          {data && data.mode === 'pdf' && (
            <div style={{ position: 'relative' }}>
              <div ref={holder} />
              <Watermark text={data.watermark} />
              {pdf && pdf.numPages > limit && <div style={{ textAlign: 'center' }}><button style={S.btnGhost} onClick={() => setLimit(limit + PAGE_BATCH)}>Cargar más páginas ({limit}/{pdf.numPages})</button></div>}
            </div>
          )}
          {data && data.mode === 'text' && (
            <div style={{ position: 'relative', background: '#fff', borderRadius: 8, padding: '18px 22px', border: `1px solid ${C.line}` }}>
              <Watermark text={data.watermark} />
              {data.pages.map((p, i) => (
                <div key={i} id={`pg-${p.page}`} style={{ marginBottom: 16 }}>
                  {p.page ? <div style={{ fontSize: 11, color: C.lo, marginBottom: 4 }}>{/\.xls[xm]$/i.test(doc.name) ? `Hoja ${p.page}` : `Página ${p.page}`}</div> : null}
                  <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{p.text}</pre>
                </div>
              ))}
              {!data.pages.length && <div style={S.empty}>Sin texto indexado para este documento.</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
