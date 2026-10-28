// Pestana Ajustes (owner/admin): descripcion, descargas, marca de agua, NDA, caducidad del acceso,
// cierre de la sala y archivo final (ZIP con documentos, indice, Q&A y actividad).
import { useState } from 'react';
import { zipSync, strToU8 } from 'fflate';
import { supabase } from '../../lib/supabase';
import { api, dr, toCsv, fmtDate, fmtSize, KIND } from './api';
import { buildIndex, versionChain } from './DocsTab';
import { S, C } from './styles';

const DEFAULT_NDA = 'Al acceder a esta sala te comprometes a tratar toda la información como confidencial, a usarla solo para evaluar la operación y a no compartirla con terceros sin autorización. Todas las vistas y descargas quedan registradas.';
const LABEL = {
  document_view: 'Vio', document_download: 'Descargó', document_upload: 'Subió', document_version: 'Subió versión nueva', document_delete: 'Eliminó',
  chat_question: 'Preguntó al chat', qa_ask: 'Pregunta Q&A', qa_answer: 'Respuesta Q&A', qa_close: 'Cerró pregunta', qa_reopen: 'Reabrió pregunta',
  qa_visibility: 'Cambió visibilidad de pregunta', nda_accept: 'Aceptó el NDA', model_review: 'Revisión de modelo', room_export: 'Exportó el archivo',
};
const toInputDate = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'sin_nombre';

export default function SettingsTab({ room, onSaved, folders = [], docs = [], allDocs = docs, members = [] }) {
  const [f, setF] = useState({ name: room.name, description: room.description || '', allow_download: room.allow_download, watermark: room.watermark, nda_required: room.nda_required, nda_text: room.nda_text || DEFAULT_NDA });
  const [msg, setMsg] = useState('');
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save(e) {
    e.preventDefault(); setMsg('');
    const { error } = await dr().from('rooms').update(f).eq('id', room.id);
    if (error) setMsg(error.message); else { setMsg('Guardado.'); onSaved(); }
  }
  const Check = ({ k, label, hint }) => (
    <label style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 8, alignItems: 'start', padding: '10px 0', borderBottom: `1px solid ${C.line}` }}>
      <input type="checkbox" checked={!!f[k]} onChange={(e) => set(k, e.target.checked)} style={{ marginTop: 3 }} />
      <span><span style={{ fontSize: 14, fontWeight: 600 }}>{label}</span><div style={S.hint}>{hint}</div></span>
    </label>
  );
  return (
    <div style={{ display: 'grid', gap: 18, maxWidth: 760 }}>
      <form onSubmit={save} style={S.card}>
        <div style={S.cardHead}>Ajustes de la sala</div>
        <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
          <input style={S.input} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Nombre de la sala" required />
          <textarea style={{ ...S.input, minHeight: 60 }} value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Descripción (opcional): operación, calendario, contacto…" />
        </div>
        <Check k="allow_download" label="Permitir descargas" hint="Si lo desactivas, los miembros solo pueden ver los documentos en el visor. Owners y admins siempre pueden descargar." />
        <Check k="watermark" label="Marca de agua" hint="Los PDF se ven y se descargan con el email de quien los abre y la fecha en cada página." />
        <Check k="nda_required" label="Exigir NDA" hint="Antes de ver nada, cada miembro tiene que aceptar el acuerdo de confidencialidad. La aceptación queda registrada." />
        {f.nda_required && <textarea style={{ ...S.input, minHeight: 120, marginTop: 10, width: '100%' }} value={f.nda_text} onChange={(e) => set('nda_text', e.target.value)} />}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
          <button style={S.btn}>Guardar</button>
          {msg && <span style={{ fontSize: 13, color: msg === 'Guardado.' ? C.green : C.red }}>{msg}</span>}
        </div>
      </form>

      <Lifecycle room={room} onSaved={onSaved} />
      <Archive room={room} folders={folders} docs={docs} allDocs={allDocs} members={members} />
    </div>
  );
}

function Lifecycle({ room, onSaved }) {
  const [expires, setExpires] = useState(toInputDate(room.access_expires_at));
  const [msg, setMsg] = useState('');
  const closed = room.status === 'closed';
  async function saveExpiry(v) {
    setExpires(v); setMsg('');
    const { error } = await dr().from('rooms').update({ access_expires_at: v ? new Date(v + 'T23:59:59').toISOString() : null }).eq('id', room.id);
    if (error) setMsg(error.message); else { setMsg(v ? 'Caducidad guardada.' : 'Sin caducidad.'); onSaved(); }
  }
  async function toggleClosed() {
    const txt = closed ? '¿Reabrir la sala? El equipo y los postores vuelven a tener acceso.' : '¿Cerrar la sala? A partir de ahora solo owners y admins pueden entrar. Puedes reabrirla cuando quieras.';
    if (!window.confirm(txt)) return;
    const { error } = await dr().from('rooms').update(closed ? { status: 'active', closed_at: null } : { status: 'closed', closed_at: new Date().toISOString() }).eq('id', room.id);
    if (error) setMsg(error.message); else onSaved();
  }
  return (
    <section style={S.card}>
      <div style={S.cardHead}>Acceso y cierre</div>
      <label style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 14 }}>
        Acceso para todos hasta
        <input type="date" style={S.input} value={expires} onChange={(e) => saveExpiry(e.target.value)} />
        {expires && <a style={{ fontSize: 13, color: C.mid, cursor: 'pointer' }} onClick={() => saveExpiry('')}>quitar</a>}
      </label>
      <p style={S.hint}>Pasada esa fecha solo entran owners y admins. Para dar un plazo distinto a un postor concreto, usa la caducidad de su grupo en la pestaña Postores.</p>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
        <button style={closed ? S.btn : { ...S.btnGhost, color: C.red, borderColor: C.red }} onClick={toggleClosed}>{closed ? 'Reabrir la sala' : 'Cerrar la sala'}</button>
        <span style={{ fontSize: 13, color: C.mid }}>{closed ? `Cerrada el ${fmtDate(room.closed_at)}. Solo owners y admins pueden entrar.` : 'Al cerrar la operación, descarga primero el archivo final y después cierra la sala.'}</span>
      </div>
      {msg && <div style={{ ...S.hint, color: /guardad|caducidad/i.test(msg) ? C.green : C.red }}>{msg}</div>}
    </section>
  );
}

// Archivo final: se construye en el navegador (los documentos van directos de Storage al ZIP).
function Archive({ room, folders, docs, allDocs, members }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [err, setErr] = useState('');
  const [withVersions, setWithVersions] = useState(true);
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '';

  async function build() {
    setBusy(true); setErr('');
    try {
      const idx = buildIndex(folders, docs);
      const folderPath = (fid) => {
        const parts = [];
        for (let fo = folders.find((x) => x.id === fid); fo; fo = folders.find((x) => x.id === fo.parent_id)) parts.unshift(safe(`${idx.num.get(fo.id)} ${fo.name}`));
        return parts.join('/');
      };
      const items = [];
      for (const d of docs) {
        const base = folderPath(d.folder_id);
        items.push({ d, path: `Documentos/${base ? base + '/' : ''}${safe(`${idx.num.get(d.id)} ${d.name}`)}` });
        if (withVersions) {
          for (const old of versionChain(d, allDocs).slice(1)) {
            items.push({ d: old, path: `Documentos/${base ? base + '/' : ''}_versiones anteriores/${safe(`${idx.num.get(d.id)} v${old.version || 1} ${old.name}`)}` });
          }
        }
      }
      const files = {};
      let i = 0;
      for (const it of items) {
        i++;
        setStage(`Descargando documentos ${i}/${items.length}…`);
        const { url } = await api('/api/dataroom/download', { document_id: it.d.id, original: true });
        const r = await fetch(url);
        if (!r.ok) throw new Error(`No se pudo descargar «${it.d.name}»`);
        files[it.path] = [new Uint8Array(await r.arrayBuffer()), { level: 0 }];
      }
      setStage('Preparando índice, Q&A y actividad…');
      const indexRows = [['Nº', 'Tipo', 'Nombre', 'Carpeta', 'Versión', 'Tamaño', 'Páginas / hojas', 'Subido', 'Subido por']];
      const walk = (fid) => {
        for (const fo of idx.childrenOf(fid)) { indexRows.push([idx.num.get(fo.id), 'Carpeta', fo.name, folderPath(fo.parent_id), '', '', '', '', '']); walk(fo.id); }
        for (const d of idx.docsOf(fid)) indexRows.push([idx.num.get(d.id), KIND(d.name), d.name, folderPath(d.folder_id), d.version || 1, fmtSize(d.size_bytes), d.pages || '', fmtDate(d.created_at), email(d.created_by)]);
      };
      walk(null);
      const [{ data: qs }, { data: logs }, { data: groups }, { data: rep }] = await Promise.all([
        dr().from('questions').select('*').eq('room_id', room.id).order('created_at'),
        dr().from('audit_log').select('*').eq('room_id', room.id).order('created_at').limit(20000),
        dr().from('room_groups').select('id, name').eq('room_id', room.id),
        supabase.rpc('dataroom_bidder_report', { p_room: room.id }),
      ]);
      const gname = (id) => ((groups || []).find((g) => g.id === id) || {}).name || '';
      const qaRows = [['Fecha', 'Postor', 'Preguntado por', 'Pregunta', 'Estado', 'Respuesta', 'Respondido por', 'Fecha respuesta', 'Visible para']];
      (qs || []).forEach((q) => qaRows.push([fmtDate(q.created_at), gname(q.group_id) || 'Equipo vendedor', email(q.asked_by), q.question, q.status, q.answer || '', email(q.answered_by), q.answered_at ? fmtDate(q.answered_at) : '', q.visibility === 'all' ? 'Todos' : 'Su grupo']));
      const logRows = [['Fecha', 'Persona', 'Acción', 'Detalle']];
      (logs || []).forEach((l) => logRows.push([fmtDate(l.created_at), email(l.actor), LABEL[l.action] || l.action, (l.meta && (l.meta.name || l.meta.question || l.meta.email)) || '']));
      const repRows = [['Postor', 'Personas', 'Documentos vistos', 'Tiempo de lectura (min)', 'Aperturas', 'Descargas', 'Preguntas Q&A', 'Preguntas chat', 'Última actividad']];
      (rep || []).forEach((r) => repRows.push([r.group_name, r.members, r.docs_viewed, Math.round(r.total_seconds / 60), r.views, r.downloads, r.qa_questions, r.chat_questions, r.last_activity ? fmtDate(r.last_activity) : '']));
      files['Indice.csv'] = strToU8(toCsv(indexRows));
      files['Q&A.csv'] = strToU8(toCsv(qaRows));
      files['Actividad.csv'] = strToU8(toCsv(logRows));
      if ((rep || []).length) files['Postores.csv'] = strToU8(toCsv(repRows));
      files['LEEME.txt'] = strToU8(`Archivo de la sala "${room.name}" generado el ${new Date().toLocaleString('es-ES')}.\r\n\r\nDocumentos: versión vigente de cada documento, numerados como en el índice${withVersions ? ', con las versiones anteriores en "_versiones anteriores"' : ''}. Son los originales, sin marca de agua.\r\nIndice.csv: índice completo. Q&A.csv: preguntas y respuestas. Actividad.csv: registro de accesos, descargas y acciones. Postores.csv: actividad por postor.\r\n`);
      setStage('Comprimiendo…');
      const zipped = zipSync(files);
      const blob = new Blob([zipped], { type: 'application/zip' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${safe(room.name)} - archivo ${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      setStage(`Listo: ${items.length} documentos.`);
    } catch (e) {
      setErr(e.message || String(e));
      setStage('');
    }
    setBusy(false);
  }

  return (
    <section style={S.card}>
      <div style={S.cardHead}>Archivo final de la sala</div>
      <p style={{ ...S.hint, marginTop: -6 }}>Un ZIP con todos los documentos (originales, sin marca de agua) ordenados y numerados como en el índice, más el índice, el Q&A completo, el registro de actividad y el informe por postor. Es lo que se guarda al cierre de la operación.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0 12px' }}>
        <input type="checkbox" checked={withVersions} onChange={(e) => setWithVersions(e.target.checked)} /> Incluir versiones anteriores
      </label>
      <button style={S.btn} onClick={build} disabled={busy}>{busy ? 'Generando…' : 'Descargar archivo (ZIP)'}</button>
      {stage && <div style={{ ...S.hint, color: C.gold }}>{stage}</div>}
      {err && <div style={S.err}>{err}</div>}
    </section>
  );
}
