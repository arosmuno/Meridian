// Chat de due diligence (RAG): respeta NDA y permisos de carpeta, cita documento y pagina.
// Cada conversacion es de su autor y queda guardada; el equipo ve las preguntas en Actividad.
import { route, getCtx, loadRoom, requireNda, dra, audit, HttpError } from '../../../lib/dataroom/server';
import { answer } from '../../../lib/dataroom/rag';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const started = Date.now();
  const ctx = await getCtx(req);
  let { room_id, session_id, message } = req.body || {};
  message = String(message || '').trim().slice(0, 4000);
  if (!room_id || !message) throw new HttpError(400, 'room_id y message requeridos');
  const { room, role } = await loadRoom(ctx, room_id);
  await requireNda(ctx, room, role);

  if (session_id) {
    const { data: s } = await dra().from('chat_sessions').select('id').eq('id', session_id).eq('room_id', room.id).eq('user_id', ctx.user.id).maybeSingle();
    if (!s) session_id = null;
  }
  if (!session_id) {
    const { data: s, error } = await dra().from('chat_sessions').insert({ room_id: room.id, org_id: room.org_id, user_id: ctx.user.id, title: message.slice(0, 80) }).select('id').single();
    if (error) throw error;
    session_id = s.id;
  }
  // Ultimos mensajes de la conversacion (no los primeros) para entender preguntas de seguimiento.
  const { data: last } = await dra().from('messages').select('role, content').eq('session_id', session_id).order('created_at', { ascending: false }).limit(10);
  const history = (last || []).reverse();
  const { data: userMsg } = await dra().from('messages').insert({ session_id, room_id: room.id, role: 'user', content: message }).select('id, created_at').single();

  let out;
  try {
    out = await answer({ room, userId: ctx.user.id, question: message, history, deadline: started + 54000 });
  } catch (e) {
    out = { answer: 'No he podido completar el análisis ahora mismo (' + String((e && e.message) || e).slice(0, 120) + '). Vuelve a intentarlo en un momento.', citations: [] };
  }
  const { data: botMsg } = await dra().from('messages').insert({ session_id, room_id: room.id, role: 'assistant', content: out.answer, citations: out.citations }).select('id, created_at').single();
  await dra().from('chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', session_id);
  await audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: 'chat_question', meta: { question: message.slice(0, 300), session_id } });
  return { session_id, user_message: userMsg, message: botMsg, answer: out.answer, citations: out.citations };
});
