// Pestana Documentos: arbol de carpetas con indice numerado (1, 1.1, 1.1.2...), subida de
// archivos, carpetas enteras o ZIP (respetando la estructura), versiones con historial,
// mover/reordenar, carpetas restringidas por persona o por grupo de postores y exportacion del indice.
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, dr, uploadFile, finishIndexing, finishRoomIndexing, KIND, isXlsx, fmtSize, fmtDate, downloadCsv } from './api';
import { filesFromDrop, filesFromInput, expandZips, classify } from './bulk';
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
// Error legible en una linea; el detalle completo queda en el tooltip.
const shortErr = (e) => {
  const t = String(e || '');
  if (/embeddings/i.test(t)) return 'falló el indexado; pulsa ↻ para reanudarlo';
  return t.length > 90 ? t.slice(0, 90) + '…' : t;
};
const statusCol = (s) => s === 'ready' ? C.green : s === 'error' ? C.red : C.gold;

// Cadena de versiones de un documento, de la mas reciente a la primera.
export function versionChain(doc, allDocs) {
  const chain = [doc];
  let cur = doc;
  const seen = new Set([doc.id]);
  while (cur && cur.replaces_id && !seen.has(cur.replaces_id)) {
    cur = allDocs.find((x) => x.id === cur.replaces_id);
    if (!cur) break;
    seen.add(cur.id);
    chain.push(cur);
  }
  return chain;
}

export default function DocsTab({ room, canWrite, isAdmin, canDownload, members, folders, docs, allDocs = docs, reload, openViewer, onDownload, goReview }) {
  const [current, setCurrent] = useState(null);
  const [progress, setProgress] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [newFolder, setNewFolder] = useState('');
  const [accessFor, setAccessFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const dirRef = useRef();
  const versionRef = useRef();
  const versionTarget = useRef(null);
  const idx = useMemo(() => buildIndex(folders, docs), [folders, docs]);
  const cur = folders.find((f) => f.id === current) || null;
  const path = [];
  for (let f = cur; f; f = folders.find((x) => x.id === f.parent_id)) path.unshift(f);
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '';

  const visibleDocs = q.trim()
    ? docs.filter((d) => d.name.toLowerCase().includes(q.trim().toLowerCase()))
    : idx.docsOf(current);
  const subfolders = q.trim() ? [] : idx.childrenOf(current);
  const setStage = (key, text) => setProgress((p) => { const n = { ...p }; if (text) n[key] = text; else delete n[key]; return n; });

  // ---------- Subida (archivos sueltos, carpetas, ZIP) ----------
  async function ensureFolderPath(parts, baseId, cache) {
    let parent = baseId || null;
    for (const name of parts) {
      const key = `${parent || 'root'}/${name.toLowerCase()}`;
      if (!cache.has(key)) {
        const siblings = [...cache.keys()].filter((k) => k.startsWith(`${parent || 'root'}/`)).length;
        const { data, error } = await dr().from('folders').insert({ room_id: room.id, org_id: room.org_id, parent_id: parent, name, position: siblings }).select().single();
        if (error) throw new Error(`No se pudo crear la carpeta «${name}»: ${error.message}`);
        cache.set(key, data.id);
      }
      parent = cache.get(key);
    }
    return parent;
  }

  async function uploadItems(rawItems) {
    if (!rawItems.length) return;
    setBusy(true); setMsg('');
    let items;
    try { items = await expandZips(rawItems); } catch (e) { setBusy(false); return setMsg('No se pudo abrir el ZIP: ' + e.message); }
    const { ok, skipped } = classify(items);
    const bulk = ok.length > 3 || ok.some((it) => it.path.includes('/'));
    const errors = [];
    const cache = new Map(folders.map((f) => [`${f.parent_id || 'root'}/${f.name.toLowerCase()}`, f.id]));
    let done = 0;
    const queue = [...ok];
    const worker = async () => {
      while (queue.length) {
        const it = queue.shift();
        const key = it.path;
        try {
          const dirs = it.path.split('/').slice(0, -1).filter(Boolean);
          const folderId = await ensureFolderPath(dirs, current, cache);
          await uploadFile({ roomId: room.id, folderId, file: it.file, quick: bulk, onStage: bulk ? null : (s) => setStage(key, `${it.file.name}: ${s}`) });
        } catch (err) {
          errors.push(`${it.path}: ${err.message}`);
        }
        done++;
        setStage(key, null);
        if (bulk) setStage('_bulk', `Subiendo ${done}/${ok.length} archivos…`);
      }
    };
    // Las carpetas se crean en serie (para no duplicarlas) y las subidas van de 3 en 3.
    if (bulk) {
      for (const it of ok) { try { await ensureFolderPath(it.path.split('/').slice(0, -1).filter(Boolean), current, cache); } catch (e) { errors.push(e.message); } }
      await Promise.all([worker(), worker(), worker()]);
    } else {
      await worker();
    }
    setStage('_bulk', null);
    await reload();
    if (fileRef.current) fileRef.current.value = '';
    if (dirRef.current) dirRef.current.value = '';
    const notes = [];
    if (errors.length) notes.push(errors.slice(0, 8).join(' · ') + (errors.length > 8 ? ` · y ${errors.length - 8} más` : ''));
    if (skipped.length) notes.push(`No se subieron ${skipped.length} archivo(s) con formato no soportado: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '…' : ''}`);
    if (notes.length) setMsg(notes.join(' — '));
    setBusy(false);
    // Indexado de todo lo subido en segundo plano: se puede seguir trabajando (o cerrar; lo acaba el cron).
    if (bulk && ok.length) {
      finishRoomIndexing(room.id, (s) => setStage('_index', s)).catch(() => {}).finally(() => { setStage('_index', null); reload(); });
    }
  }

  async function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    if (!canWrite || busy) return;
    uploadItems(await filesFromDrop(e.dataTransfer));
  }

  async function onVersionFile(e) {
    const file = (e.target.files || [])[0];
    const d = versionTarget.current;
    e.target.value = '';
    if (!file || !d) return;
    const note = window.prompt(`Nota de la nueva versión de «${d.name}» (opcional), p. ej. «actualizado con cifras de junio»`, '') || null;
    setBusy(true); setMsg('');
    try {
      await uploadFile({ roomId: room.id, folderId: d.folder_id, file, replacesId: d.id, versionNote: note, onStage: (s) => setStage(d.id, `${file.name}: ${s}`) });
    } catch (err) { setMsg(`${file.name}: ${err.message}`); }
    setStage(d.id, null);
    setBusy(false);
    reload();
  }

  // ---------- Carpetas y documentos ----------
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
    // Se mueve la version vigente y todo su historial juntos.
    const ids = versionChain(d, allDocs).map((x) => x.id);
    const { error } = await dr().from('documents').update({ folder_id: folderId || null, position: idx.docsOf(folderId).length }).in('id', ids);
    if (error) setMsg(error.message); else reload();
  }
  async function removeDoc(d) {
    const older = d.replaces_id ? ' La versión anterior volverá a ser la vigente.' : '';
    if (!window.confirm(`¿Eliminar «${d.name}»${d.version > 1 ? ` (v${d.version})` : ''}? No se puede deshacer.${older}`)) return;
    try { await api('/api/dataroom/delete', { document_id: d.id }); } catch (e) { setMsg(e.message); }
    reload();
  }
  async function reindex(d) {
    setStage(d.id, `${d.name}: Indexando…`);
    try {
      const stage = (s) => setStage(d.id, `${d.name}: ${s}`);
      // Si el texto ya esta troceado, solo falta embeber: no hace falta reprocesar el archivo.
      if (d.chunk_count > 0 && d.embedded_count < d.chunk_count) await finishIndexing(d.id, stage);
      else await finishIndexing(d.id, stage, await api('/api/dataroom/ingest', { document_id: d.id }));
    } catch (e) { setMsg(`${d.name}: ${e.message}`); }
    setStage(d.id, null);
    reload();
  }

  // Indice completo (lo que este usuario puede ver) en CSV.
  function exportIndex() {
    const rows = [['Nº', 'Tipo', 'Nombre', 'Carpeta', 'Versión', 'Tamaño', 'Páginas / hojas', 'Subido']];
    const folderPath = (fid) => {
      const parts = [];
      for (let f = folders.find((x) => x.id === fid); f; f = folders.find((x) => x.id === f.parent_id)) parts.unshift(`${idx.num.get(f.id)} ${f.name}`);
      return parts.join(' / ');
    };
    const walk = (fid) => {
      for (const f of idx.childrenOf(fid)) { rows.push([idx.num.get(f.id), 'Carpeta', f.name, folderPath(f.parent_id), '', '', '', '']); walk(f.id); }
      for (const d of idx.docsOf(fid)) rows.push([idx.num.get(d.id), KIND(d.name), d.name, folderPath(d.folder_id), d.version || 1, fmtSize(d.size_bytes), d.pages || '', fmtDate(d.created_at)]);
    };
    walk(null);
    downloadCsv(`Indice-${room.name}.csv`, rows);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 18, alignItems: 'start' }}>
      <aside style={{ ...S.card, padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ ...S.cardHead, fontSize: 15, margin: 0 }}>Índice</div>
          <a style={{ fontSize: 12, color: C.gold, cursor: 'pointer' }} onClick={exportIndex}>Exportar</a>
        </div>
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

      <section style={S.card} onDragOver={(e) => { if (canWrite) { e.preventDefault(); setDragOver(true); } }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
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
          <div style={{ ...upload, ...(dragOver ? { borderColor: C.gold, background: '#fbf6e8' } : null) }}>
            <div style={{ marginBottom: 8 }}>{busy ? 'Subiendo…' : `Arrastra aquí archivos, carpetas enteras o un ZIP${cur ? ` (a ${idx.num.get(cur.id)} ${cur.name})` : ''}: se respeta la estructura de carpetas.`}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <label style={{ ...S.btnGhost, background: '#fff' }}>Elegir archivos<input ref={fileRef} type="file" multiple disabled={busy} onChange={(e) => uploadItems(filesFromInput(e.target.files))} accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md,.zip" style={{ display: 'none' }} /></label>
              <label style={{ ...S.btnGhost, background: '#fff' }}>Elegir carpeta<input ref={dirRef} type="file" multiple disabled={busy} onChange={(e) => uploadItems(filesFromInput(e.target.files))} webkitdirectory="" directory="" style={{ display: 'none' }} /></label>
            </div>
            <div style={{ fontSize: 11, color: C.lo, marginTop: 6 }}>PDF, DOCX, XLSX, CSV, TXT o ZIP · máx. 50 MB por archivo</div>
          </div>
        ) : <div style={S.empty}>Acceso de solo lectura: puedes consultar{canDownload ? ' y descargar' : ''}.</div>}
        <input ref={versionRef} type="file" style={{ display: 'none' }} accept=".pdf,.docx,.xlsx,.xlsm,.csv,.txt,.md" onChange={onVersionFile} />
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
                <div style={{ fontSize: 11, marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <span style={S.tag}>{KIND(d.name)}</span>
                  {d.version > 1 && <span style={{ ...S.tag, color: C.gold, borderColor: C.gold, cursor: 'pointer' }} title="Ver historial de versiones" onClick={() => setHistoryFor(d)}>v{d.version}</span>}
                  <span style={{ color: statusCol(d.status), fontWeight: 600 }} title={d.error || ''}>{statusTxt(d)}{d.status === 'error' && d.error ? ` — ${shortErr(d.error)}` : ''}</span>
                  <span style={{ color: C.lo }}>{fmtSize(d.size_bytes)}{d.pages ? ` · ${d.pages} ${isXlsx(d.name) ? 'hojas' : 'págs.'}` : ''}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button style={S.icon} onClick={() => openViewer(d)} title="Ver">Ver</button>
                {isXlsx(d.name) && <button style={S.icon} onClick={() => goReview(d)} title="Revisión del modelo">Revisión</button>}
                {canDownload && <button style={S.icon} onClick={() => onDownload(d)} title="Descargar">↓</button>}
                {d.version > 1 && <button style={S.icon} onClick={() => setHistoryFor(d)} title="Historial de versiones">Historial</button>}
                {canWrite && <button style={S.icon} disabled={busy} onClick={() => { versionTarget.current = d; versionRef.current && versionRef.current.click(); }} title="Subir una versión nueva de este documento">Nueva versión</button>}
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

      {accessFor && <AccessModal folder={accessFor} room={room} members={members} onClose={() => { setAccessFor(null); reload(); }} />}
      {historyFor && <HistoryModal doc={historyFor} allDocs={allDocs} email={email} canDownload={canDownload} canWrite={canWrite} openViewer={(d) => { setHistoryFor(null); openViewer(d); }} onDownload={onDownload} onRemove={(d) => { setHistoryFor(null); removeDoc(d); }} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

function HistoryModal({ doc, allDocs, email, canDownload, canWrite, openViewer, onDownload, onRemove, onClose }) {
  const chain = versionChain(doc, allDocs);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...S.card, width: 620, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={S.cardHead}>Historial de versiones</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {chain.map((d, i) => (
            <div key={d.id} style={{ ...S.row, alignItems: 'flex-start' }}>
              <span style={{ ...S.tag, color: i === 0 ? C.green : C.mid, borderColor: i === 0 ? C.green : C.line }}>v{d.version || 1}{i === 0 ? ' · vigente' : ''}</span>
              <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                <div style={{ color: C.mid, fontSize: 12 }}>{fmtDate(d.created_at)}{email(d.created_by) ? ` · ${email(d.created_by)}` : ''}</div>
                {d.version_note && <div style={{ fontSize: 12, marginTop: 2 }}>{d.version_note}</div>}
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={S.icon} onClick={() => openViewer(d)}>Ver</button>
                {canDownload && <button style={S.icon} onClick={() => onDownload(d)}>↓</button>}
                {canWrite && <button style={S.icon} title="Eliminar esta versión" onClick={() => onRemove(d)}>✕</button>}
              </div>
            </div>
          ))}
        </div>
        <p style={S.hint}>El chat, las búsquedas y la revisión de modelos usan siempre la versión vigente. Las anteriores se pueden consultar aquí.</p>
        <div style={{ textAlign: 'right' }}><button style={S.btnGhost} onClick={onClose}>Cerrar</button></div>
      </div>
    </div>
  );
}

function AccessModal({ folder, room, members, onClose }) {
  const [restricted, setRestricted] = useState(folder.restricted);
  const [allowed, setAllowed] = useState(null);
  const [groups, setGroups] = useState([]);
  const [allowedGroups, setAllowedGroups] = useState(new Set());
  const [err, setErr] = useState('');
  const [bidderIds, setBidderIds] = useState(new Set());
  useEffect(() => {
    dr().from('folder_access').select('user_id').eq('folder_id', folder.id).then(({ data }) => setAllowed(new Set((data || []).map((r) => r.user_id))));
    dr().from('room_groups').select('id, name').eq('room_id', room.id).order('name').then(({ data }) => setGroups(data || []));
    dr().from('folder_group_access').select('group_id').eq('folder_id', folder.id).then(({ data }) => setAllowedGroups(new Set((data || []).map((r) => r.group_id))));
    dr().from('group_members').select('user_id').eq('room_id', room.id).then(({ data }) => setBidderIds(new Set((data || []).map((r) => r.user_id))));
  }, [folder.id, room.id]);
  // Personas individuales: solo el equipo vendedor; a los postores se les da acceso por grupo.
  const regular = members.filter((m) => m.role !== 'owner' && m.role !== 'admin' && !bidderIds.has(m.user_id));
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
    const { data: curG } = await dr().from('folder_group_access').select('group_id').eq('folder_id', folder.id);
    const beforeG = new Set((curG || []).map((r) => r.group_id));
    const addG = [...allowedGroups].filter((g) => !beforeG.has(g)).map((group_id) => ({ folder_id: folder.id, group_id, org_id: folder.org_id }));
    const delG = [...beforeG].filter((g) => !allowedGroups.has(g));
    if (addG.length) { const { error: e3 } = await dr().from('folder_group_access').insert(addG); if (e3) return setErr(e3.message); }
    if (delG.length) { const { error: e4 } = await dr().from('folder_group_access').delete().eq('folder_id', folder.id).in('group_id', delG); if (e4) return setErr(e4.message); }
    onClose();
  }
  const toggle = (set, setter, id, on) => { const n = new Set(set); if (on) n.add(id); else n.delete(id); setter(n); };
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...S.card, width: 480, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={S.cardHead}>Acceso a «{folder.name}»</div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
          <input type="checkbox" checked={restricted} onChange={(e) => setRestricted(e.target.checked)} /> Carpeta restringida
        </label>
        <p style={S.hint}>Si no está restringida, la ve todo el equipo y todos los postores. Si lo está, solo los owners/admins y los grupos o personas marcados. Se aplica también a sus subcarpetas, al chat y a las búsquedas.</p>
        {restricted && (
          <>
            {groups.length > 0 && <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: C.lo, margin: '12px 0 6px' }}>GRUPOS DE POSTORES</div>}
            <div style={{ display: 'grid', gap: 6 }}>
              {groups.map((g) => (
                <label key={g.id} style={{ ...S.row, cursor: 'pointer' }}>
                  <input type="checkbox" checked={allowedGroups.has(g.id)} onChange={(e) => toggle(allowedGroups, setAllowedGroups, g.id, e.target.checked)} />
                  <span style={{ flex: 1 }}>{g.name}</span>
                </label>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: C.lo, margin: '12px 0 6px' }}>EQUIPO VENDEDOR</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {regular.map((m) => (
                <label key={m.user_id} style={{ ...S.row, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!allowed && allowed.has(m.user_id)} onChange={(e) => toggle(allowed, setAllowed, m.user_id, e.target.checked)} />
                  <span style={{ flex: 1 }}>{m.email}</span><span style={S.tag}>{m.role}</span>
                </label>
              ))}
              {!regular.length && <div style={S.empty}>No hay miembros del equipo sin rol de admin.</div>}
            </div>
          </>
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

const overlay = { position: 'fixed', inset: 0, background: 'rgba(28,25,22,.45)', zIndex: 40, display: 'grid', placeItems: 'center' };
const folderBtn = { display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', border: 0, background: 'transparent', borderRadius: 7, cursor: 'pointer', fontSize: 13, color: C.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const folderOn = { ...folderBtn, background: C.soft, fontWeight: 700 };
const crumb = { color: C.ink, cursor: 'pointer', textDecoration: 'none' };
const numTag = { minWidth: 38, fontSize: 12, fontWeight: 700, color: C.gold };
const upload = { display: 'block', textAlign: 'center', padding: 14, border: `1px dashed #cfc7b6`, borderRadius: 10, color: C.mid, fontSize: 13, background: C.soft };
