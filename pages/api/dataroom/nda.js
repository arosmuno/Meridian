// Aceptacion del acuerdo de confidencialidad de la sala (queda en la auditoria).
import { route, getCtx, loadRoom, dra, audit, HttpError } from '../../../lib/dataroom/server';

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { room_id } = req.body || {};
  if (!room_id) throw new HttpError(400, 'room_id requerido');
  const { room } = await loadRoom(ctx, room_id);
  if (!room.nda_required) return { ok: true };
  const { error } = await dra().from('nda_acceptances').upsert({ room_id: room.id, user_id: ctx.user.id, org_id: room.org_id }, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (error) throw error;
  await audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: 'nda_accept', meta: { email: ctx.user.email } });
  return { ok: true };
});
