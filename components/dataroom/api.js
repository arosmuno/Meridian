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
export async function uploadFile({ roomId, folderId, file, onStage }) {
  onStage && onStage('Subiendo…');
  const up = await api('/api/dataroom/upload', { room_id: roomId, folder_id: folderId || null, name: file.name, size: file.size, mime: file.type });
  const { error } = await supabase.storage.from('datarooms').uploadToSignedUrl(up.path, up.token, file, { contentType: file.type || undefined });
  if (error) throw new Error('No se pudo subir el archivo: ' + error.message);
  onStage && onStage('Indexando…');
  let p = await api('/api/dataroom/ingest', { document_id: up.document.id });
  for (let i = 0; i < 40 && p.total && p.done < p.total; i++) {
    onStage && onStage(`Indexando ${Math.round((100 * p.done) / p.total)}%`);
    p = await api('/api/dataroom/embed', { document_id: up.document.id });
  }
  return up.document;
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
