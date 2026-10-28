// Pestana Ajustes (owner/admin): descripcion, descargas, marca de agua, NDA, caducidad del acceso,
// cierre de la sala y archivo final (ZIP con documentos, indice, Q&A y actividad).
import { useState } from 'react';
import { dr, fmtDate } from './api';
import { buildArchive } from './archive';
import { S, C } from './styles';

const DEFAULT_NDA = 'Al acceder a esta sala te comprometes a tratar toda la información como confidencial, a usarla solo para evaluar la operación y a no compartirla con terceros sin autorización. Todas las vistas y descargas quedan registradas.';

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

// Fin de la operacion: la sala pasa a solo lectura y se borra sola al cabo de X dias, para no
// ocupar espacio indefinidamente. Todos ven la fecha de borrado y reciben un aviso 7 dias y 1 dia antes.
const RETENTION = [30, 60, 90];
function Lifecycle({ room, onSaved }) {
  const [days, setDays] = useState(room.retention_days || 30);
  const [msg, setMsg] = useState('');
  const closed = room.status === 'closed';
  const purgeDate = (d) => new Date(Date.now() + d * 86400e3).toLocaleDateString('es-ES');
  async function finish() {
    if (!window.confirm(`¿Dar por terminada la operación? La sala pasa a solo lectura para todos y se eliminará el ${purgeDate(days)}, con todos sus documentos. Antes de esa fecha podéis descargar lo que necesitéis.`)) return;
    const now = new Date();
    const { error } = await dr().from('rooms').update({ status: 'closed', closed_at: now.toISOString(), retention_days: days, purge_at: new Date(now.getTime() + days * 86400e3).toISOString(), purge_warned: 0 }).eq('id', room.id);
    if (error) setMsg(error.message); else onSaved();
  }
  async function extend() {
    const { error } = await dr().from('rooms').update({ retention_days: days, purge_at: new Date(Date.now() + days * 86400e3).toISOString(), purge_warned: 0 }).eq('id', room.id);
    if (error) setMsg(error.message); else { setMsg(`Se eliminará el ${purgeDate(days)}.`); onSaved(); }
  }
  async function reopen() {
    if (!window.confirm('¿Reabrir la operación? La sala vuelve a funcionar con normalidad y se cancela el borrado.')) return;
    const { error } = await dr().from('rooms').update({ status: 'active', closed_at: null, purge_at: null, purge_warned: 0 }).eq('id', room.id);
    if (error) setMsg(error.message); else onSaved();
  }
  const daysSelect = (
    <select style={S.input} value={days} onChange={(e) => setDays(Number(e.target.value))}>
      {RETENTION.map((d) => <option key={d} value={d}>{d} días</option>)}
    </select>
  );
  return (
    <section style={S.card}>
      <div style={S.cardHead}>Fin de la operación</div>
      {!closed ? (
        <>
          <p style={{ ...S.hint, marginTop: -6 }}>Cuando la operación termine, la sala pasa a solo lectura y se elimina sola pasado el plazo que elijas. Todos los equipos ven la fecha y reciben un aviso por email 7 días y 1 día antes, para que descarguen lo que quieran conservar.</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 14 }}>Mantener la sala</span>{daysSelect}<span style={{ fontSize: 14 }}>después de terminar</span>
            <button style={{ ...S.btnGhost, color: C.red, borderColor: C.red }} onClick={finish}>Dar por terminada la operación</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 14, lineHeight: 1.6 }}>
            Terminada el <b>{fmtDate(room.closed_at)}</b>. Solo lectura. Se eliminará el <b>{room.purge_at ? new Date(room.purge_at).toLocaleDateString('es-ES') : '—'}</b>.
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <span style={{ fontSize: 14 }}>Ampliar a</span>{daysSelect}<span style={{ fontSize: 14 }}>desde hoy</span>
            <button style={S.btnGhost} onClick={extend}>Ampliar plazo</button>
            <button style={S.btn} onClick={reopen}>Reabrir la operación</button>
          </div>
        </>
      )}
      {msg && <div style={{ ...S.hint, color: /eliminar/i.test(msg) ? C.green : C.red }}>{msg}</div>}
    </section>
  );
}

// Archivo final: se construye en el navegador (los documentos van directos de Storage al ZIP).
function Archive({ room, folders, docs, allDocs, members }) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [err, setErr] = useState('');
  const [withVersions, setWithVersions] = useState(true);
  async function build() {
    setBusy(true); setErr('');
    try {
      const n = await buildArchive({ room, folders, docs, allDocs, members, isAdmin: true, withVersions, onStage: setStage });
      setStage(`Listo: ${n} documentos.`);
    } catch (e) {
      setErr(e.message || String(e));
      setStage('');
    }
    setBusy(false);
  }

  return (
    <section style={S.card}>
      <div style={S.cardHead}>Archivo final de la sala</div>
      <p style={{ ...S.hint, marginTop: -6 }}>Un ZIP con todos los documentos (originales, sin marca de agua) ordenados y numerados como en el índice, más el índice, el Q&A completo, el registro de actividad y la actividad por equipo. Descárgalo antes de que la sala se elimine.</p>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, margin: '8px 0 12px' }}>
        <input type="checkbox" checked={withVersions} onChange={(e) => setWithVersions(e.target.checked)} /> Incluir versiones anteriores
      </label>
      <button style={S.btn} onClick={build} disabled={busy}>{busy ? 'Generando…' : 'Descargar archivo (ZIP)'}</button>
      {stage && <div style={{ ...S.hint, color: C.gold }}>{stage}</div>}
      {err && <div style={S.err}>{err}</div>}
    </section>
  );
}
