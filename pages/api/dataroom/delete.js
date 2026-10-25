// Borrado de documento: archivo, fila (chunks y revisiones caen en cascada) y auditoria.
import { route, getCtx, loadDoc, canWriteRole, admin, dra, audit, HttpError } from '../../../lib/dataroom/server';

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, role } = await loadDoc(ctx, document_id);
  if (!canWriteRole(role)) throw new HttpError(403, 'sin permiso de escritura');
  await admin.storage.from('datarooms').remove([doc.storage_path]);
  const { error } = await dra().from('documents').delete().eq('id', doc.id);
  if (error) throw error;
  await audit({ org_id: doc.org_id, room_id: doc.room_id, actor: ctx.user.id, action: 'document_delete', meta: { document_id: doc.id, name: doc.name } });
  return { ok: true };
});
