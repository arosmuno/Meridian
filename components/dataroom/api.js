// Cliente de las rutas /api/dataroom/*: adjunta el token de sesion y devuelve errores legibles.
import { supabase } from '../../lib/supabase';

export const dr = () => supabase.schema('dataroom');

export async function token() {
  const { data } = await supabase.auth.getSession();
  return data && data.session ? data.session.access_token : null;
}

export async function api(path, body = {}) {
  const access_token = await token();
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.error || `Error ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return j;
}

// Subida completa: alta + archivo a la URL firmada + indexado por lotes hasta terminar.
// replacesId: sube una version nueva de ese documento. quick=true (subida masiva): extrae y trocea
// pero deja el embebido para despues (lo hace finishRoomIndexing o el cron).
export async function uploadFile({ roomId, folderId, file, onStage, replacesId = null, versionNote = null, quick = false }) {
  onStage && onStage('Subiendo…');
  const up = await api('/api/dataroom/upload', { room_id: roomId, folder_id: folderId || null, name: file.name, size: file.size, mime: file.type, replaces_document_id: replacesId, version_note: versionNote });
  const { error } = await supabase.storage.from('datarooms').uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || undefined });
  if (error) throw new Error('No se pudo subir el archivo: ' + error.message);
  onStage && onStage('Indexando…');
  const p = await api('/api/dataroom/ingest', { document_id: up.document.id, embed: !quick });
  if (!quick) await finishIndexing(up.document.id, onStage, p);
  return up.document;
}

// Embebido pendiente de toda la sala (tras una subida masiva), respetando la cuota de Gemini.
export async function finishRoomIndexing(roomId, onStage) {
  let p = await api('/api/dataroom/embed', { room_id: roomId });
  for (let i = 0; i < 120 && p.total && p.done < p.total; i++) {
    const pct = Math.round((100 * p.done) / p.total);
    onStage && onStage(`Indexando la sala ${pct}%${p.wait_ms ? ' (esperando cuota)' : ''}`);
    if (p.wait_ms) await pause(Math.min(Math.max(p.wait_ms, 3000), 60000));
    p = await api('/api/dataroom/embed', { room_id: roomId });
  }
  return p;
}

// Sigue embebiendo hasta terminar. Si Gemini pide esperar (cuota por minuto), espera y sigue;
// si el usuario cierra la pagina, el cron lo termina.
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function finishIndexing(documentId, onStage, p = null) {
  if (!p) p = await api('/api/dataroom/embed', { document_id: documentId });
  for (let i = 0; i < 60 && p.total && p.done < p.total; i++) {
    const pct = Math.round((100 * p.done) / p.total);
    if (p.wait_ms) {
      onStage && onStage(`Indexando ${pct}% (esperando cuota)`);
      await pause(Math.min(Math.max(p.wait_ms, 3000), 45000));
    }
    onStage && onStage(`Indexando ${pct}%`);
    p = await api('/api/dataroom/embed', { document_id: documentId });
  }
  return p;
}

export const KIND = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.endsWith('.pdf')) return 'PDF';
  if (n.endsWith('.docx')) return 'DOCX';
  if (n.endsWith('.xlsx') || n.endsWith('.xlsm')) return 'XLSX';
  if (n.endsWith('.csv')) return 'CSV';
  return 'TXT';
};
export const isXlsx = (name) => /\.xls[xm]$/i.test(String(name || ''));
export const fmtSize = (b) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const fmtDate = (s) => (s ? new Date(s).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

export function toCsv(rows) {
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  return '\ufeff' + rows.map((r) => r.map(esc).join(';')).join('\n');
}

export function downloadCsv(filename, rows) {
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(';')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
