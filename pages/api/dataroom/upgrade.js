// Regenera con el modelo principal una respuesta del chat que salio del modelo de respaldo.
// Solo el autor de la conversacion puede pedirlo (el resto del equipo la ve cuando se actualiza).
import { route, getCtx, rateLimit, dra, HttpError } from '../../../lib/dataroom/server';
import { upgradeMessage } from '../../../lib/dataroom/upgrade';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  await rateLimit(ctx, 'upgrade');
  const { message_id } = req.body || {};
  if (!message_id) throw new HttpError(400, 'message_id requerido');
  const { data: msg } = await dra().from('messages').select('session_id').eq('id', message_id).maybeSingle();
  if (!msg) throw new HttpError(404, 'mensaje no encontrado');
  const { data: s } = await dra().from('chat_sessions').select('user_id').eq('id', msg.session_id).single();
  if (!s || s.user_id !== ctx.user.id) throw new HttpError(403, 'no es tu conversación');
  return upgradeMessage(message_id, { deadline: started + 54000 });
});
