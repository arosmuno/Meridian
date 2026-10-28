// Q&A de la sala: preguntar (cualquier miembro), responder/cerrar (equipo vendedor) y borrador
// de respuesta con IA a partir de los documentos (con citas), que el equipo revisa.
// Con postores: cada pregunta pertenece al grupo de quien la hace y solo la ve ese grupo y el
// vendedor, salvo que el vendedor la publique para todos (visibility = 'all', tipo FAQ).
import { route, getCtx, loadRoom, requireNda, canWriteIn, dra, audit, HttpError } from '../../../lib/dataroom/server';
import { enqueue } from '../../../lib/dataroom/notify';
import { answer } from '../../../lib/dataroom/rag';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { action, room_id, question_id, question, answer: text, document_id = null } = req.body || {};
  const { room, role, access } = await loadRoom(ctx, room_id);
  await requireNda(ctx, room, role);
  const log = (a, meta) => audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: a, meta });

  if (action === 'ask') {
    if (!question || !String(question).trim()) throw new HttpError(400, 'pregunta vacía');
    const { data, error } = await ctx.dr().from('questions').insert({ room_id: room.id, org_id: room.org_id, asked_by: ctx.user.id, question: String(question).trim(), document_id }).select().single();
    if (error) throw new HttpError(403, error.message);
    await log('qa_ask', { question_id: data.id });
    await enqueue({ room, kind: 'qa_new', sellersOnly: true, exclude: ctx.user.id, payload: { question_id: data.id, question: data.question, group: access.group_name || null } });
    return { question: data };
  }

  if (!canWriteIn(access)) throw new HttpError(403, 'solo el equipo vendedor puede responder');
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
    // Aviso a quien pregunto y a su grupo (o a todos si la pregunta esta publicada para todos).
    let onlyUsers = [q.asked_by];
    if (q.visibility === 'all') onlyUsers = null;
    else if (q.group_id) {
      const { data: gm } = await dra().from('group_members').select('user_id').eq('group_id', q.group_id);
      onlyUsers = (gm || []).map((r) => r.user_id);
    }
    await enqueue({ room, kind: 'qa_answer', exclude: ctx.user.id, onlyUsers, payload: { question_id: q.id, question: q.question } });
    return { question: data };
  }
  if (action === 'visibility') {
    const visibility = req.body.visibility === 'all' ? 'all' : 'group';
    const { data } = await dra().from('questions').update({ visibility }).eq('id', q.id).select().single();
    await log('qa_visibility', { question_id: q.id, visibility });
    if (visibility === 'all' && q.answer) await enqueue({ room, kind: 'qa_published', exclude: ctx.user.id, payload: { question_id: q.id, question: q.question } });
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
