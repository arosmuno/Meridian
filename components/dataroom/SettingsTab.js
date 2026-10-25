// Pestana Ajustes (owner/admin): descripcion, descargas, marca de agua y NDA de la sala.
import { useState } from 'react';
import { dr } from './api';
import { S, C } from './styles';

const DEFAULT_NDA = 'Al acceder a esta sala te comprometes a tratar toda la información como confidencial, a usarla solo para evaluar la operación y a no compartirla con terceros sin autorización. Todas las vistas y descargas quedan registradas.';

export default function SettingsTab({ room, onSaved }) {
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
    <form onSubmit={save} style={{ ...S.card, maxWidth: 720 }}>
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
  );
}
