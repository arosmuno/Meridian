// Alta de documento + URL firmada de subida. El navegador nunca escribe en Storage con su
// propia sesion: sube con un token de un solo uso que solo emite esta ruta, despues de
// comprobar rol, carpeta y limite del plan (el insert pasa por RLS y por el trigger de limite).
import { route, getCtx, loadRoom, canWriteRole, admin, audit, safeStorageName, HttpError } from '../../../lib/dataroom/server';
import { kindOf } from '../../../lib/dataroom/extract';

const MAX_BYTES = 50 * 1024 * 1024;

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { room_id, folder_id = null, name, size, mime } = req.body || {};
  if (!room_id || !name) throw new HttpError(400, 'room_id y name requeridos');
  if (Number(size) > MAX_BYTES) throw new HttpError(413, 'El archivo supera 50 MB');
  if (kindOf(name, mime) === 'other') throw new HttpError(415, 'Formato no soportado. Sube PDF, DOCX, XLSX, CSV o TXT.');
  const { room, role } = await loadRoom(ctx, room_id);
  if (!canWriteRole(role)) throw new HttpError(403, 'Tu acceso es de solo lectura');

  const path = `${room.org_id}/${room.id}/${crypto.randomUUID()}/${safeStorageName(name)}`;
  const { data: doc, error } = await ctx.dr().from('documents').insert({
    room_id: room.id, org_id: room.org_id, folder_id, name, storage_path: path,
    mime: mime || null, size_bytes: Number(size) || null, created_by: ctx.user.id, status: 'uploading',
  }).select().single();
  if (error) throw new HttpError(error.code === '23514' ? 409 : 403, error.message);

  const { data: signed, error: sErr } = await admin.storage.from('datarooms').createSignedUploadUrl(path);
  if (sErr) {
    await admin.schema('dataroom').from('documents').delete().eq('id', doc.id);
    throw sErr;
  }
  await audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: 'document_upload', meta: { document_id: doc.id, name } });
  return { document: doc, path, token: signed.token };
});
