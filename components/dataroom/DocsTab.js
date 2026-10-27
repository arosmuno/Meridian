// Pestana Documentos: arbol de carpetas con indice numerado (1, 1.1, 1.1.2...), subida
// multiple con progreso, mover/reordenar, carpetas restringidas y acceso por persona.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, dr, uploadFile, finishIndexing, KIND, isXlsx, fmtSize } from './api';
import { S, C } from './styles';

// Indice: dentro de cada carpeta van primero las subcarpetas y luego los documentos.
export function buildIndex(folders, docs) {
  const byParent = new Map();
  for (const f of folders) {
    const k = f.parent_id || 'root';
    if (!byParent.has(k)) byParent.set(k, []);
    byParent.get(k).push(f);
  }
  const docsBy = new Map();
  for (const d of docs) {
    const k = d.folder_id || 'root';
    if (!docsBy.has(k)) docsBy.set(k, []);
    docsBy.get(k).push(d);
  }
  const sort = (a, b) => (a.position - b.position) || String(a.name).localeCompare(String(b.name));
  const num = new Map();
  const flat = [];
  const walk = (key, prefix, depth) => {
    const subs = (byParent.get(key) || []).sort(sort);
    const ds = (docsBy.get(key) || []).sort(sort);
    let i = 0;
    for (const f of subs) {
      i++;
      const n = prefix ? `${prefix}.${i}` : `${i}`;
      num.set(f.id, n);
      flat.push({ ...f, num: n, depth });
      walk(f.id, n, depth + 1);
    }
    for (const d of ds) { i++; num.set(d.id, prefix ? `${prefix}.${i}` : `${i}`); }
  };
  walk('root', '', 0);
  return { num, flat, childrenOf: (k) => (byParent.get(k || 'root') || []).sort(sort), docsOf: (k) => (docsBy.get(k || 'root') || []).sort(sort) };
}

const statusTxt = (d) => d.status === 'ready' ? 'Indexado' : d.status === 'error' ? 'Error' : d.status === 'indexing' ? `Indexando ${d.chunk_count ? Math.round((100 * d.embedded_count) / d.chunk_count) : 0}%` : d.status === 'uploading' ? 'Subiendo' : 'Procesando';
const statusCol = (s) => s === 'ready' ? C.green : s === 'error' ? C.red : C.gold;

export default function DocsTab({ room, canWrite, isAdmin, canDownload, members, folders, docs, reload, openViewer, onDownload, goReview }) {
  const [current, setCurrent] = useState(null);
  const [progress, setProgress] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [accessFor, setAccessFor] = useState(null);
  const fileRef = useRef();
  const idx = useMemo(() => buildIndex(folders, docs), [folders, docs]);
  const cur = folders.find((f) => f.id === current) || null;
  const path = [];
  for (let f = cur; f; f = folders.find((x) => x.id === f.parent_id)) path.unshift(f);

  const visibleDocs = q.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
    : idx.docsOf(current);
  const subfolders = q.trim() ? [] : idx.childrenOf(current);

  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true); setMsg('');
    const errors = [];
    for (const file of files) {
      const key = file.name + file.size;
      try {
        await uploadFile({ roomId: room.id, folderId: current, file, onStage: (s) => setProgress((p) => ({ ...p, [key]: `${file.name}: ${s}` })) });
        setProgress((p) => { const n = { ...p }; delete n[key]; return n; });
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
        setProgress((p) => { const n = { ...p }; delete n[key]; return n; });
      }
      await reload();
    }
    if (fileRef.current) fileRef.current.value = '';
    setBusy(false);
    if (errors.length) setMsg(errors.join(' · '));
  }

  async function addFolder(e) {
    e.preventDefault();
    if (!newFolder.trim()) return;
    const siblings = idx.childrenOf(current);
    const { error } = await dr().from('folders').insert({ room_id: room.id, org_id: room.org_id, parent_id: current, name: newFolder.trim(), position: siblings.length });
    if (error) return setMsg(error.message);
    setNewFolder(''); reload();
  }
  async function renameFolder(f) {
    const name = window.prompt('Nuevo nombre de la carpeta', f.name);
    if (!name || !name.trim()) return;
    const { error } = await dr().from('folders').update({ name: name.trim() }).eq('id', f.id);
    if (error) setMsg(error.message); else reload();
  }
  async function removeFolder(f) {
    if (!window.confirm(`¿Eliminar la carpeta «${f.name}»? Tiene que estar vacía.`)) return;
    const { error } = await dr().from('folders').delete().eq('id', f.id);
    if (error) setMsg(error.message); else { if (current === f.id) setCurrent(f.parent_id); reload(); }
  }
  async function move(item, table, dir) {
    const list = table === 'folders' ? idx.childrenOf(item.parent_id) : idx.docsOf(item.folder_id);
    const i = list.findIndex((x) => x.id === item.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[i], b = list[j];
    await Promise.all(list.map((x, k) => {
      const pos = x.id === a.id ? j : x.id === b.id ? i : k;
      return x.position === pos ? null : dr().from(table).update({ position: pos }).eq('id', x.id);
    }));
    reload();
  }
  async function moveDoc(d, folderId) {
    const { error } = await dr().from('documents').update({ folder_id: folderId || null, position: idx.docsOf(folderId).length }).eq('id', d.id);
    if (error) setMsg(error.message); else reload();
  }
  async function removeDoc(d) {
    if (!window.confirm(`¿Eliminar «${d.name}»? No se puede deshacer.`)) return;
    try { await api('/api/dataroom/delete', { document_id: d.id }); } catch (e) { setMsg(e.message); }
    reload();
  }
  async function reindex(d) {
    setProgress((p) => ({ ...p, [d.id]: `${d.name}: Indexando…` }));
    try {
      const stage = (s) => setProgress((p) => ({ ...p, [d.id]: `${d.name}: ${s}` }));
      // Si el texto ya esta troceado, solo falta embeber: no hace falta reprocesar el archivo.
      if (d.chunk_count > 0 && d.embedded_count < d.chunk_count) await finishIndexing(d.id, stage);
      else await finishIndexing(d.id, stage, await api('/api/dataroom/ingest', { document_id: d.id }));
    } catch (e) { setMsg(`${d.name}: ${e.message}`); }
    setProgress((p) => { const n = { ...p }; delete n[d.id]; return n; });
    reload();
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'start' }}>
      <aside style={{ ...S.card, padding: 12 }}>
        <div style={{ ...S.cardHead, fontSize: 15, marginBottom: 8 }}>Índice</div>
        <button style={{ ...(current === null ? folderOn : folderBtn) }} onClick={() => { setCurrent(null); setQ(''); }}>Todos (raíz)</button>
        {idx.flat.map((f) => (
          <button key={f.id} style={{ ...(current === f.id ? folderOn : folderBtn), paddingLeft: 10 + f.depth * 14 }} onClick={() => { setCurrent(f.id); setQ(''); }}>
            <span style={{ color: C.gold, fontWeight: 700, marginRight: 6 }}>{f.num}</span>{f.name}{f.restricted ? ' 🔒' : ''}
          </button>
        ))}
        {canWrite && (
          <form onSubmit={addFolder} style={{ marginTop: 10, display: 'grid', gap: 6 }}>
            <input style={S.input} placeholder={cur ? `Subcarpeta en ${idx.num.get(cur.id)}` : 'Nueva carpeta'} value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            <button style={S.btnGhost}>+ Crear carpeta</button>
          </form>
        )}
      </aside>

      <section style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: C.mid }}>
            <a style={crumb} onClick={() => setCurrent(null)}>Raíz</a>
            {path.map((f) => <span key={f.id}> / <a style={crumb} onClick={() => setCurrent(f.id)}>{idx.num.get(f.id)} {f.name}</a></span>)}
          </div>
          <input style={{ ...S.input, width: 220 }} placeholder="Buscar por nombre…" value={q} onChange={(e) => setQ(e.target.value)} />
          {cur && canWrite && <button style={S.btnGhost} onClick={() => renameFolder(cur)}>Renombrar</button>}
          {cur && isAdmin && <button style={S.btnGhost} onClick={() => setAccessFor(cur)}>{cur.restricted ? 'Acceso 🔒' : 'Restringir'}</button>}
          {cur && canWrite && <button style={S.btnGhost} onClick={() => removeFolder(cur)}>Eliminar carpeta</button>}
        </div>

        {canWrite ? (
          <label style={upload}>
            {busy ? 'Subiendo e indexando…' : `+ Subir documentos${cur ? ` a ${idx.num.get(cur.id)} ${cur.name}` : ''} (PDF, DOCX, XLSX, CSV, TXT · máx. 50 MB)`}
            <input ref={fileRef} type="file" multiple onChange={onFiles} disabled={busy} accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md" style={{ display: 'none' }} />
          </label>
        ) : <div style={S.empty}>Acceso de solo lectura: puedes consultar{canDownload ? ' y descargar' : ''}.</div>}
        {Object.values(progress).map((t, i) => <div key={i} style={{ ...S.hint, color: C.gold }}>{t}</div>)}
        {msg && <div style={S.err}>{msg}</div>}

        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {subfolders.map((f) => (
            <div key={f.id} style={{ ...S.row, cursor: 'pointer' }} onClick={() => setCurrent(f.id)}>
              <span style={numTag}>{idx.num.get(f.id)}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>📁 {f.name}{f.restricted ? ' 🔒' : ''}</span>
              {canWrite && <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 4 }}>
                <button style={S.icon} title="Subir" onClick={() => move(f, 'folders', -1)}>↑</button>
                <button style={S.icon} title="Bajar" onClick={() => move(f, 'folders', 1)}>↓</button>
              </span>}
            </div>
          ))}
          {visibleDocs.map((d) => (
            <div key={d.id} style={S.row}>
              <span style={numTag}>{idx.num.get(d.id)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }} onClick={() => openViewer(d)}>{d.name}</div>
                <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 8 }}>
                  <span style={S.tag}>{KIND(d.name)}</span>
                  <span style={{ color: statusCol(d.status), fontWeight: 600 }} title={d.error || ''}>{statusTxt(d)}{d.status === 'error' && d.error ? ` — ${d.error}` : ''}</span>
                  <span style={{ color: C.lo }}>{fmtSize(d.size_bytes)}{d.pages ? ` · ${d.pages} ${isXlsx(d.name) ? 'hojas' : 'págs.'}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={S.icon} onClick={() => openViewer(d)} title="Ver">Ver</button>
                {isXlsx(d.name) && <button style={S.icon} onClick={() => goReview(d)} title="Revisión del modelo">Revisión</button>}
                {canDownload && <button style={S.icon} onClick={() => onDownload(d)} title="Descargar">↓</button>}
                {canWrite && (d.status === 'error' || d.status === 'indexing') && <button style={S.icon} onClick={() => reindex(d)} title="Reintentar indexado">↻</button>}
                {canWrite && !q.trim() && <><button style={S.icon} onClick={() => move(d, 'documents', -1)}>↑</button><button style={S.icon} onClick={() => move(d, 'documents', 1)}>↓</button></>}
                {canWrite && (
                  <select style={{ ...S.icon, maxWidth: 110 }} value="" onChange={(e) => moveDoc(d, e.target.value === '__root' ? null : e.target.value)} title="Mover a carpeta">
                    <option value="">Mover…</option>
                    <option value="__root">Raíz</option>
                    {idx.flat.map((f) => <option key={f.id} value={f.id}>{f.num} {f.name}</option>)}
                  </select>
                )}
                {canWrite && <button style={S.icon} onClick={() => removeDoc(d)} title="Eliminar">✕</button>}
              </div>
            </div>
          ))}
          {!subfolders.length && !visibleDocs.length && <div style={S.empty}>{q.trim() ? 'Ningún documento coincide.' : 'Carpeta vacía.'}</div>}
        </div>
      </section>

      {accessFor && <AccessModal folder={accessFor} members={members} onClose={() => { setAccessFor(null); reload(); }} />}
    </div>
  );
}

function AccessModal({ folder, members, onClose }) {
  const [restricted, setRestricted] = useState(folder.restricted);
  const [allowed, setAllowed] = useState(null);
  const [err, setErr] = useState('');
  const regular = members.filter((m) => m.role !== 'owner' && m.role !== 'admin');
  useEffect(() => {
    dr().from('folder_access').select('user_id').eq('folder_id', folder.id).then(({ data }) => setAllowed(new Set((data || []).map((r) => r.user_id))));
  }, [folder.id]);
  async function save() {
    setErr('');
    const { error } = await dr().from('folders').update({ restricted }).eq('id', folder.id);
    if (error) return setErr(error.message);
    const { data: cur } = await dr().from('folder_access').select('user_id').eq('folder_id', folder.id);
    const before = new Set((cur || []).map((r) => r.user_id));
    const add = [...allowed].filter((u) => !before.has(u)).map((user_id) => ({ folder_id: folder.id, user_id, org_id: folder.org_id }));
    const del = [...before].filter((u) => !allowed.has(u));
    if (add.length) { const { error: e1 } = await dr().from('folder_access').insert(add); if (e1) return setErr(e1.message); }
    if (del.length) { const { error: e2 } = await dr().from('folder_access').delete().eq('folder_id', folder.id).in('user_id', del); if (e2) return setErr(e2.message); }
    onClose();
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,25,22,.45)', zIndex: 40, display: 'grid', placeItems: 'center' }} onClick={onClose}>
      <div style={{ ...S.card, width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div style={S.cardHead}>Acceso a «{folder.name}»</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} /> Carpeta restringida
        </label>
        <p style={S.hint}>Si está restringida, solo la ven los owners/admins y las personas marcadas. Se aplica también a sus subcarpetas, al chat y a las búsquedas.</p>
        {restricted && (
          <div style={{ display: 'grid', gap: 6, margin: '10px 0' }}>
            {regular.map((m) => (
              <label key={m.user_id} style={{ ...S.row, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!allowed && allowed.has(m.user_id)} onChange={(e) => { const n = new Set(allowed); if (e.target.checked) n.add(m.user_id); else n.delete(m.user_id); setAllowed(n); }} />
                <span style={{ flex: 1 }}>{m.email}</span><span style={S.tag}>{m.role}</span>
              </label>
            ))}
            {!regular.length && <div style={S.empty}>No hay miembros sin rol de admin a los que dar acceso.</div>}
          </div>
        )}
        {err && <div style={S.err}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
          <button style={S.btnGhost} onClick={onClose}>Cancelar</button>
          <button style={S.btn} onClick={save} disabled={allowed === null}>Guardar</button>
        </div>
      </div>
    </div>
  );
}

const folderBtn = { display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 0, background: 'transparent', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const folderOn = { ...folderBtn, background: C.soft, fontWeight: 700 };
const crumb = { color: C.ink, cursor: 'pointer', textDecoration: 'none' };
const numTag = { minWidth: 38, fontSize: 12, fontWeight: 700, color: C.gold };
const upload = { display: 'block', textAlign: 'center', padding: 14, border: `1px dashed #cfc7b6`, borderRadius: 10, cursor: 'pointer', color: C.mid, fontSize: 13, background: C.soft };
