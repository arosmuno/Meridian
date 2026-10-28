// Continua el embebido pendiente: de un documento (document_id) o de toda la sala (room_id, tras
// una subida masiva). Lo llama el cliente mientras quede trabajo; si se cierra la pagina, el cron.
import { route, getCtx, loadDoc, loadRoom, canWriteIn, dra, HttpError } from '../../../lib/dataroom/server';
import { processPending, refreshDocStatus } from '../../../lib/dataroom/embed';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  const { document_id, room_id } = req.body || {};
  if (document_id) {
    const { doc } = await loadDoc(ctx, document_id);
    const run = await processPending({ documentId: doc.id, deadline: started + 52000 });
    return { ok: true, ...(await refreshDocStatus(doc.id)), wait_ms: run.wait_ms };
  }
  if (!room_id) throw new HttpError(400, 'document_id o room_id requerido');
  const { room, access } = await loadRoom(ctx, room_id);
  if (!canWriteIn(access)) throw new HttpError(403, 'sin permiso de escritura');
  const run = await processPending({ roomId: room.id, deadline: started + 52000 });
  const { count: total } = await dra().from('chunks').select('id', { count: 'exact', head: true }).eq('room_id', room.id);
  const { count: pending } = await dra().from('chunks').select('id', { count: 'exact', head: true }).eq('room_id', room.id).is('embedding', null);
  return { ok: true, total: total || 0, done: (total || 0) - (pending || 0), wait_ms: run.wait_ms };
});
