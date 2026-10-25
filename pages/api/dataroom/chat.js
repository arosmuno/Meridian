// Chat de due diligence (RAG): respeta NDA y permisos de carpeta, cita documento y pagina.
import { route, getCtx, loadRoom, requireNda, dra, audit, HttpError } from '../../../lib/dataroom/server';
import { answer } from '../../../lib/dataroom/rag';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  let { room_id, session_id, message } = req.body || {};
  if (!room_id || !message || !String(message).trim()) throw new HttpError(400, 'room_id y message requeridos');
  const { room, role } = await loadRoom(ctx, room_id);
  await requireNda(ctx, room, role);

  if (session_id) {
    const { data: s } = await dra().from('chat_sessions').select('id').eq('id', session_id).eq('room_id', room.id).eq('user_id', ctx.user.id).maybeSingle();
    if (!s) session_id = null;
  }
  if (!session_id) {
    const { data: s } = await dra().from('chat_sessions').insert({ room_id: room.id, org_id: room.org_id, user_id: ctx.user.id, title: String(message).slice(0, 60) }).select('id').single();
    session_id = s.id;
  }
  const { data: history } = await dra().from('messages').select('role, content').eq('session_id', session_id).order('created_at').limit(12);
  await dra().from('messages').insert({ session_id, room_id: room.id, role: 'user', content: message });

  const out = await answer({ room, userId: ctx.user.id, question: message, history: history || [] });
  await dra().from('messages').insert({ session_id, room_id: room.id, role: 'assistant', content: out.answer, citations: out.citations });
  await audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: 'chat_question', meta: { question: String(message).slice(0, 200) } });
  return { session_id, ...out };
});
