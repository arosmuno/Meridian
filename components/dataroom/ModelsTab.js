// Pestana Modelos (Meridian Modelling): revision automatica de cada Excel de la sala.
// Resumen ejecutivo + hallazgos con hoja y celda, filtrables y exportables.
import { useEffect, useState } from 'react';
import { api, dr, isXlsx, fmtDate, downloadCsv, uploadFile } from './api';
import { S, C, sevColor, sevLabel } from './styles';

const TYPE = {
  error_value: 'Error de cálculo', hardcode_in_row: 'Valor a mano', check_failed: 'Check que no cuadra',
  external_link: 'Enlace externo', inconsistent_formula: 'Fórmula inconsistente', hardcode_in_formula: 'Constante en fórmula',
  volatile: 'Función volátil', nested_if: 'IF anidados', long_formula: 'Fórmula larga', hidden_sheet: 'Hoja oculta',
};

export default function ModelsTab({ room, canWrite, docs, selected, setSelected, reload }) {
  const models = docs.filter((d) => isXlsx(d.name));
  const [reviews, setReviews] = useState({});
  const [sev, setSev] = useState('all');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const doc = models.find((d) => d.id === selected) || models[0] || null;
  const rev = doc ? reviews[doc.id] : null;

  async function loadReviews() {
    if (!models.length) return;
    const { data } = await dr().from('model_reviews').select('*').in('document_id', models.map((d) => d.id)).order('created_at', { ascending: false });
    const latest = {};
    for (const r of data || []) if (!latest[r.document_id]) latest[r.document_id] = r;
    setReviews(latest);
  }
  useEffect(() => { loadReviews(); }, [docs.length]); // eslint-disable-line

  async function rerun() {
    if (!doc) return;
    setBusy('Revisando el modelo…'); setMsg('');
    try { await api('/api/dataroom/review', { document_id: doc.id }); await loadReviews(); }
    catch (e) { setMsg(e.message); }
    setBusy('');
  }
  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setMsg('');
    try {
      const d = await uploadFile({ roomId: room.id, folderId: null, file, onStage: setBusy });
      await reload(); setSelected(d.id); await loadReviews();
    } catch (err) { setMsg(err.message); }
    setBusy(''); e.target.value = '';
  }
  const findings = rev && Array.isArray(rev.findings) ? rev.findings : [];
  const shown = findings.filter((f) => sev === 'all' || f.severity === sev);
  const st = (rev && rev.stats) || {};
  const exportCsv = () => downloadCsv(`Revision-${doc.name}.csv`, [['Gravedad', 'Tipo', 'Hoja', 'Celda', 'Hallazgo', 'Detalle', 'Fórmula'],
    ...findings.map((f) => [sevLabel[f.severity], TYPE[f.type] || f.type, f.sheet, f.cell || '', f.title, f.detail, f.formula ? '=' + f.formula : ''])]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 18, alignItems: 'start' }}>
      <aside style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.cardHead, fontSize: 15, marginBottom: 8 }}>Modelos de la sala</div>
        {models.map((d) => (
          <button key={d.id} onClick={() => setSelected(d.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', border: 0, borderRadius: 7, cursor: 'pointer', fontSize: 13, background: doc && doc.id === d.id ? C.soft : 'transparent', fontWeight: doc && doc.id === d.id ? 700 : 400 }}>
            {d.name}
            <div style={{ fontSize: 11, color: C.lo, fontWeight: 400 }}>{reviews[d.id] ? (reviews[d.id].status === 'done' ? `${(reviews[d.id].findings || []).length} hallazgos` : reviews[d.id].status === 'error' ? 'Error en la revisión' : 'Revisando…') : 'Sin revisar'}</div>
          </button>
        ))}
        {!models.length && <div style={S.empty}>Aún no hay archivos Excel en la sala.</div>}
        {canWrite && <label style={{ ...S.btnGhost, display: 'block', textAlign: 'center', marginTop: 10, cursor: 'pointer' }}>+ Subir modelo (.xlsx)<input type="file" accept=".xlsx,.xlsm" style={{ display: 'none' }} onChange={onFile} /></label>}
        <p style={S.hint}>Cada Excel que se sube a la sala se revisa automáticamente: errores, valores a mano, fórmulas inconsistentes, enlaces externos y checks que no cuadran.</p>
      </aside>

      <section style={S.card}>
        {!doc ? <div style={S.empty}>Sube un modelo para revisarlo.</div> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ ...S.cardHead, margin: 0, flex: 1 }}>{doc.name}</div>
              {rev && rev.status === 'done' && <button style={S.btnGhost} onClick={exportCsv}>Exportar hallazgos (CSV)</button>}
              <button style={S.btnGhost} onClick={rerun} disabled={!!busy}>{rev ? 'Repetir revisión' : 'Revisar ahora'}</button>
            </div>
            {busy && <div style={{ ...S.hint, color: C.gold }}>{busy}</div>}
            {msg && <div style={S.err}>{msg}</div>}
            {!rev && !busy && <div style={S.empty}>Este modelo aún no tiene revisión.</div>}
            {rev && rev.status === 'error' && <div style={S.err}>La revisión falló: {rev.error}</div>}
            {rev && rev.status === 'running' && <div style={S.empty}>Revisión en curso…</div>}
            {rev && rev.status === 'done' && (
              <>
                <div style={{ fontSize: 12, color: C.mid, margin: '6px 0 14px' }}>Revisado el {fmtDate(rev.created_at)} · {st.sheets} hojas · {st.formulas} fórmulas · {st.numbers} valores fijos{st.hidden_sheets ? ` · ${st.hidden_sheets} hoja(s) oculta(s)` : ''}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  {['high', 'medium', 'low', 'info'].map((k) => (
                    <button key={k} onClick={() => setSev(sev === k ? 'all' : k)} style={{ border: `1px solid ${sev === k ? sevColor[k] : C.line}`, borderRadius: 10, padding: '10px 12px', background: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: sevColor[k] }}>{(st.by_severity || {})[k] || 0}</div>
                      <div style={{ fontSize: 12, color: C.mid }}>{sevLabel[k]}</div>
                    </button>
                  ))}
                </div>
                <div style={{ background: C.soft, borderRadius: 10, padding: '12px 14px', fontSize: 14, lineHeight: 1.65, marginBottom: 16, whiteSpace: 'pre-wrap' }}>{rev.summary}</div>
                <div style={{ display: 'grid', gap: 6 }}>
                  {shown.map((f, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 150px 1fr', gap: 10, padding: '9px 12px', border: `1px solid ${C.line}`, borderRadius: 8, background: '#fff', fontSize: 13 }}>
                      <span style={{ color: sevColor[f.severity], fontWeight: 700 }}>{sevLabel[f.severity]}</span>
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }}>{f.sheet}{f.cell ? `!${f.cell}` : ''}</span>
                      <span><b>{f.title}.</b> {f.detail}{f.formula && <div style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: C.mid, marginTop: 3, wordBreak: 'break-all' }}>={f.formula}</div>}</span>
                    </div>
                  ))}
                  {!shown.length && <div style={S.empty}>{findings.length ? 'Ningún hallazgo con esa gravedad.' : 'No se ha encontrado ningún problema.'}</div>}
                  {(st.truncated || []).length > 0 && <div style={S.hint}>Se muestran los 12 primeros hallazgos de cada tipo por hoja: {(st.truncated || []).map((t) => `${TYPE[t.type] || t.type} en ${t.sheet} (${t.total})`).join(', ')}.</div>}
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
