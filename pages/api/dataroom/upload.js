// Alta de documento + URL firmada de subida. El navegador nunca escribe en Storage con su
// propia sesion: sube con un token de un solo uso que solo emite esta ruta, despues de
// comprobar rol, carpeta y limite del plan (el insert pasa por RLS y por el trigger de limite).
import { route, getCtx, loadRoom, canWriteIn, admin, dra, audit, safeStorageName, HttpError } from '../../../lib/dataroom/server';
import { kindOf } from '../../../lib/dataroom/extract';

const MAX_BYTES = 50 * 1024 * 1024;

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { room_id, name, size, mime, replaces_document_id = null, version_note = null } = req.body || {};
  let { folder_id = null } = req.body || {};
  if (!room_id || !name) throw new HttpError(400, 'room_id y name requeridos');
  if (Number(size) > MAX_BYTES) throw new HttpError(413, 'El archivo supera 50 MB');
  if (kindOf(name, mime) === 'other') throw new HttpError(415, 'Formato no soportado. Sube PDF, DOCX, XLSX, CSV o TXT.');
  const { room, access } = await loadRoom(ctx, room_id);
  if (!canWriteIn(access)) throw new HttpError(403, 'Tu acceso es de solo lectura');

  // Nueva version de un documento: hereda carpeta y posicion; la anterior queda en el historial
  // cuando la nueva termina de procesarse (ingest).
  let prev = null;
  if (replaces_document_id) {
    const { data: visible } = await ctx.dr().from('documents').select('id').eq('id', replaces_document_id).maybeSingle();
    if (!visible) throw new HttpError(403, 'sin acceso al documento a sustituir');
    const { data: p } = await dra().from('documents').select('*').eq('id', replaces_document_id).single();
    if (p.room_id !== room.id) throw new HttpError(400, 'el documento es de otra sala');
    if (p.superseded_by) throw new HttpError(409, 'Ese documento ya tiene una versión más reciente');
    prev = p;
    folder_id = p.folder_id;
  }

  const path = `${room.org_id}/${room.id}/${crypto.randomUUID()}/${safeStorageName(name)}`;
  const { data: doc, error } = await ctx.dr().from('documents').insert({
    room_id: room.id, org_id: room.org_id, folder_id, name, storage_path: path,
    mime: mime || null, size_bytes: Number(size) || null, created_by: ctx.user.id, status: 'uploading',
    ...(prev ? { version: (prev.version || 1) + 1, replaces_id: prev.id, position: prev.position, version_note: version_note ? String(version_note).slice(0, 300) : null } : {}),
  }).select().single();
  if (error) throw new HttpError(error.code === '23514' ? 409 : 403, error.message);

  const { data: signed, error: sErr } = await admin.storage.from('datarooms').createSignedUploadUrl(path);
  if (sErr) {
    await admin.schema('dataroom').from('documents').delete().eq('id', doc.id);
    throw sErr;
  }
  await audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: prev ? 'document_version' : 'document_upload', meta: { document_id: doc.id, name, ...(prev ? { replaces: prev.id, version: doc.version } : {}) } });
  return { document: doc, path, token: signed.token };
});
