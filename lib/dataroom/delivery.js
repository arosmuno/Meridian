// lib/dataroom/delivery.js -- entrega de ficheros: PDF con marca de agua (copia temporal en
// _wm/, enlace firmado de 5 min) o el original. Se usa un enlace firmado y no la respuesta de
// la funcion porque Vercel corta las respuestas de mas de 4,5 MB.
import { admin } from './server';
import { kindOf } from './extract';
import { stampPdf } from './watermark';

export async function deliver({ doc, room, user, download }) {
  const isPdf = kindOf(doc.name, doc.mime) === 'pdf';
  let path = doc.storage_path;
  if (isPdf && room.watermark) {
    const { data: file, error } = await admin.storage.from('datarooms').download(doc.storage_path);
    if (error || !file) throw new Error('archivo no encontrado');
    const stamped = await stampPdf(Buffer.from(await file.arrayBuffer()), { email: user.email, roomName: room.name });
    path = `_wm/${user.id}/${doc.id}-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from('datarooms').upload(path, stamped, { contentType: 'application/pdf', upsert: true });
    if (upErr) throw upErr;
  }
  const opts = download ? { download: doc.name } : {};
  const { data: signed, error: sErr } = await admin.storage.from('datarooms').createSignedUrl(path, 300, opts);
  if (sErr) throw sErr;
  return { url: signed.signedUrl, watermarked: path !== doc.storage_path, kind: kindOf(doc.name, doc.mime) };
}

// Borra copias con marca de agua de mas de una hora (lo llama el cron).
export async function sweepWatermarks() {
  const { data: users } = await admin.storage.from('datarooms').list('_wm', { limit: 1000 });
  const cutoff = Date.now() - 3600e3;
  for (const u of users || []) {
    const { data: files } = await admin.storage.from('datarooms').list(`_wm/${u.name}`, { limit: 1000 });
    const old = (files || []).filter((f) => Number(String(f.name).split('-').pop().replace('.pdf', '')) < cutoff).map((f) => `_wm/${u.name}/${f.name}`);
    if (old.length) await admin.storage.from('datarooms').remove(old);
  }
}
