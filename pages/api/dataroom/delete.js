// Borrado de documento: archivo, fila (chunks y revisiones caen en cascada) y auditoria.
import { route, getCtx, loadDoc, canWriteIn, isAdminRole, admin, dra, audit, HttpError } from '../../../lib/dataroom/server';

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { document_id } = req.body || {};
  if (!document_id) throw new HttpError(400, 'document_id requerido');
  const { doc, access } = await loadDoc(ctx, document_id);
  if (!canWriteIn(access)) throw new HttpError(403, 'sin permiso de escritura');
  if (!isAdminRole(access.role) && doc.created_by !== ctx.user.id) throw new HttpError(403, 'Solo quien subió el documento (o un admin) puede borrarlo');
  // Versiones: se reenlaza la cadena para que borrar una version no resucite otra antigua.
  // Si se borra la vigente, la anterior vuelve a ser la vigente.
  await dra().from('documents').update({ superseded_by: doc.superseded_by || null }).eq('superseded_by', doc.id);
  await dra().from('documents').update({ replaces_id: doc.replaces_id || null }).eq('replaces_id', doc.id);
  await admin.storage.from('datarooms').remove([doc.storage_path]);
  const { error } = await dra().from('documents').delete().eq('id', doc.id);
  if (error) throw error;
  await audit({ org_id: doc.org_id, room_id: doc.room_id, actor: ctx.user.id, action: 'document_delete', meta: { document_id: doc.id, name: doc.name } });
  return { ok: true };
});
