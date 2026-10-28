// Q&A de la sala: preguntas formales de un equipo a otro, que quedan registradas.
// Cada pregunta va de un equipo (el de quien pregunta) a otro (to_group_id; null = equipo
// organizador). La ven los dos equipos y los admins; responde el equipo al que va dirigida.
// El borrador de IA usa los documentos que puede ver quien responde.
import { route, getCtx, loadRoom, requireNda, canWriteIn, isAdminRole, sameTeam, dra, audit, READ_ONLY_MSG, HttpError } from '../../../lib/dataroom/server';
import { answer } from '../../../lib/dataroom/rag';
import { enqueue } from '../../../lib/dataroom/notify';

export const config = { maxDuration: 60 };

export default route(async (req) => {
  const ctx = await getCtx(req);
  const { action, room_id, question_id, question, answer: text, document_id = null, to_group_id = null } = req.body || {};
  const { room, role, access } = await loadRoom(ctx, room_id);
  await requireNda(ctx, room, role);
  const log = (a, meta) => audit({ org_id: room.org_id, room_id: room.id, actor: ctx.user.id, action: a, meta });
  if (access.reason === 'closed') throw new HttpError(403, READ_ONLY_MSG);
  const myTeam = access.group_id || null;
  const teamName = async (id) => {
    if (!id) {
      const { data: o } = await dra().from('orgs').select('name').eq('id', room.org_id).single();
      return o ? o.name : 'Organizador';
    }
    const { data: g } = await dra().from('room_groups').select('name').eq('id', id).maybeSingle();
    return g ? g.name : '';
  };

  if (action === 'ask') {
    if (!question || !String(question).trim()) throw new HttpError(400, 'pregunta vacía');
    let to = to_group_id || null;
    if (to) {
      const { data: g } = await dra().from('room_groups').select('id').eq('id', to).eq('room_id', room.id).maybeSingle();
      if (!g) throw new HttpError(400, 'equipo de destino no válido');
    }
    if (sameTeam(to, myTeam)) throw new HttpError(400, 'Elige otro equipo: las preguntas del Q&A van a otra parte. Para hablar dentro de tu equipo usa el chat.');
    const { data, error } = await ctx.dr().from('questions').insert({ room_id: room.id, org_id: room.org_id, asked_by: ctx.user.id, question: String(question).trim(), document_id, to_group_id: to }).select().single();
    if (error) throw new HttpError(403, error.message);
    await log('qa_ask', { question_id: data.id });
    await enqueue({ room, kind: 'qa_new', team: to, exclude: ctx.user.id, payload: { question_id: data.id, question: data.question, group: await teamName(myTeam) } });
    return { question: data };
  }

  const { data: q } = await dra().from('questions').select('*').eq('id', question_id).eq('room_id', room.id).maybeSingle();
  if (!q) throw new HttpError(404, 'pregunta no encontrada');
  const canAnswer = canWriteIn(access) && (isAdminRole(role) || sameTeam(q.to_group_id, myTeam));
  if (!canAnswer) throw new HttpError(403, 'Responde el equipo al que va dirigida la pregunta');

  if (action === 'draft') {
    const out = await answer({ room, userId: ctx.user.id, question: q.question });
    await dra().from('questions').update({ ai_draft: out.answer, ai_citations: out.citations }).eq('id', q.id);
    return { ai_draft: out.answer, ai_citations: out.citations };
  }
  if (action === 'answer') {
    if (!text || !String(text).trim()) throw new HttpError(400, 'respuesta vacía');
    const { data } = await dra().from('questions').update({ answer: String(text).trim(), status: 'answered', answered_by: ctx.user.id, answered_at: new Date().toISOString() }).eq('id', q.id).select().single();
    await log('qa_answer', { question_id: q.id });
    await enqueue({ room, kind: 'qa_answer', team: q.group_id || null, exclude: ctx.user.id, payload: { question_id: q.id, question: q.question } });
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
