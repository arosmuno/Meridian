// Q&A de la sala: preguntar (cualquier miembro), responder/cerrar (quien puede escribir) y
// borrador de respuesta con IA a partir de los documentos (con citas), que el equipo revisa.
import { route, getCtx, loadRoom, requireNda, canWriteRole, dra, audit, HttpError } from '../../../lib/dataroom/server';
import { answer } from '../../../lib/dataroom/rag';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { action, room_id, question_id, question, answer: text, document_id = null } = req.body || {};
  const { room, role } = await loadRoom(ctx, room_id);
  await requireNda(ctx, room, role);
  const log = (a, meta) => audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: a, meta });

  if (action === 'ask') {
    if (!question || !String(question).trim()) throw new HttpError(400, 'pregunta vacía');
    const { data, error } = await ctx.dr().from('questions').insert({ room_id: room.id, org_id: room.org_id, asked_by: ctx.user.id, question: String(question).trim(), document_id }).select().single();
    if (error) throw new HttpError(403, error.message);
    await log('qa_ask', { question_id: data.id });
    return { question: data };
  }

  if (!canWriteRole(role)) throw new HttpError(403, 'solo el equipo de la sala puede responder');
  const { data: q } = await dra().from('questions').select('*').eq('id', question_id).eq('room_id', room.id).maybeSingle();
  if (!q) throw new HttpError(404, 'pregunta no encontrada');

  if (action === 'draft') {
    const out = await answer({ room, userId: ctx.user.id, question: q.question });
    await dra().from('questions').update({ ai_draft: out.answer, ai_citations: out.citations }).eq('id', q.id);
    return { ai_draft: out.answer, ai_citations: out.citations };
  }
  if (action === 'answer') {
    if (!text || !String(text).trim()) throw new HttpError(400, 'respuesta vacía');
    const { data } = await dra().from('questions').update({ answer: String(text).trim(), status: 'answered', answered_by: ctx.user.id, answered_at: new Date().toISOString() }).eq('id', q.id).select().single();
    await log('qa_answer', { question_id: q.id });
    return { question: data };
  }
  if (action === 'close' || action === 'reopen') {
    const status = action === 'close' ? 'closed' : (q.answer ? 'answered' : 'open');
    const { data } = await dra().from('questions').update({ status }).eq('id', q.id).select().single();
    await log('qa_' + action, { question_id: q.id });
    return { question: data };
  }
  throw new HttpError(400, 'acción no válida');
});
