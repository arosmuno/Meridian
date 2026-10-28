// ZIP de la sala, construido en el navegador (los documentos van directos de Storage al ZIP).
// Cada persona se lleva solo lo que puede ver: sus documentos (con la marca de agua de la sala si
// la hay), el indice y las preguntas del Q&A en las que participa su equipo. El admin, ademas, se
// lleva los originales sin marca de agua, el registro de actividad y la actividad por equipo.
import { zipSync, strToU8 } from 'fflate';
import { supabase } from '../../lib/supabase';
import { api, dr, toCsv, fmtDate, fmtSize, KIND } from './api';
import { buildIndex, versionChain } from './DocsTab';

const LABEL = {
  document_view: 'Vio', document_download: 'Descargó', document_upload: 'Subió', document_version: 'Subió versión nueva', document_delete: 'Eliminó',
  chat_question: 'Usó el chat', qa_ask: 'Pregunta Q&A', qa_answer: 'Respuesta Q&A', qa_close: 'Cerró pregunta', qa_reopen: 'Reabrió pregunta',
  qa_visibility: 'Cambió visibilidad de pregunta', nda_accept: 'Aceptó el NDA', model_review: 'Revisión de modelo',
};
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'sin_nombre';

export async function buildArchive({ room, folders, docs, allDocs = docs, members = [], isAdmin = false, orgName = '', withVersions = true, onStage = () => {} }) {
  const email = (id) => (members.find((m) => m.user_id === id) || {}).email || '';
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
    onStage(`Descargando documentos ${i}/${items.length}…`);
    const { url } = await api('/api/dataroom/download', { document_id: it.d.id, original: isAdmin });
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No se pudo descargar «${it.d.name}»`);
    files[it.path] = [new Uint8Array(await r.arrayBuffer()), { level: 0 }];
  }

  onStage('Preparando índice y Q&A…');
  const indexRows = [['Nº', 'Tipo', 'Nombre', 'Carpeta', 'Versión', 'Tamaño', 'Páginas / hojas', 'Subido', 'Subido por']];
  const walk = (fid) => {
    for (const fo of idx.childrenOf(fid)) { indexRows.push([idx.num.get(fo.id), 'Carpeta', fo.name, folderPath(fo.parent_id), '', '', '', '', '']); walk(fo.id); }
    for (const d of idx.docsOf(fid)) indexRows.push([idx.num.get(d.id), KIND(d.name), d.name, folderPath(d.folder_id), d.version || 1, fmtSize(d.size_bytes), d.pages || '', fmtDate(d.created_at), email(d.created_by)]);
  };
  walk(null);
  const [{ data: qs }, { data: groups }] = await Promise.all([
    dr().from('questions').select('*').eq('room_id', room.id).order('created_at'),
    dr().from('room_groups').select('id, name').eq('room_id', room.id),
  ]);
  const team = (id) => (id ? ((groups || []).find((g) => g.id === id) || {}).name || '' : orgName || 'Organizador');
  const qaRows = [['Fecha', 'De', 'Para', 'Preguntado por', 'Pregunta', 'Estado', 'Respuesta', 'Respondido por', 'Fecha respuesta']];
  (qs || []).forEach((q) => qaRows.push([fmtDate(q.created_at), team(q.group_id), team(q.to_group_id), email(q.asked_by), q.question, q.status, q.answer || '', email(q.answered_by), q.answered_at ? fmtDate(q.answered_at) : '']));
  files['Indice.csv'] = strToU8(toCsv(indexRows));
  files['Q&A.csv'] = strToU8(toCsv(qaRows));

  let extra = '';
  if (isAdmin) {
    onStage('Preparando actividad…');
    const [{ data: logs }, { data: rep }] = await Promise.all([
      dr().from('audit_log').select('*').eq('room_id', room.id).order('created_at').limit(20000),
      supabase.rpc('dataroom_bidder_report', { p_room: room.id }),
    ]);
    const logRows = [['Fecha', 'Persona', 'Acción', 'Detalle']];
    (logs || []).forEach((l) => logRows.push([fmtDate(l.created_at), email(l.actor), LABEL[l.action] || l.action, (l.meta && (l.meta.name || l.meta.email)) || '']));
    files['Actividad.csv'] = strToU8(toCsv(logRows));
    if ((rep || []).length) {
      const repRows = [['Equipo', 'Personas', 'Documentos vistos', 'Tiempo de lectura (min)', 'Aperturas', 'Descargas', 'Preguntas Q&A', 'Última actividad']];
      rep.forEach((r) => repRows.push([r.group_name, r.members, r.docs_viewed, Math.round(r.total_seconds / 60), r.views, r.downloads, r.qa_questions, r.last_activity ? fmtDate(r.last_activity) : '']));
      files['Equipos.csv'] = strToU8(toCsv(repRows));
    }
    extra = ' Actividad.csv: registro de accesos, descargas y acciones. Equipos.csv: actividad de cada parte.';
  }
  files['LEEME.txt'] = strToU8(`Sala "${room.name}" descargada el ${new Date().toLocaleString('es-ES')}.\r\n\r\nDocumentos: versión vigente de cada documento, numerados como en el índice${withVersions ? ', con las versiones anteriores en "_versiones anteriores"' : ''}.${isAdmin ? ' Son los originales, sin marca de agua.' : ''}\r\nIndice.csv: índice. Q&A.csv: preguntas y respuestas.${extra}\r\n`);

  onStage('Comprimiendo…');
  const blob = new Blob([zipSync(files)], { type: 'application/zip' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safe(room.name)} - ${new Date().toISOString().slice(0, 10)}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return items.length;
}
