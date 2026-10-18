// Chat de due diligence (RAG): valida acceso, busca chunks y responde con Claude citando fuentes.
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.DATAROOM_MODEL || 'claude-sonnet-4-20250514';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    let { room_id, session_id, message, access_token } = req.body || {};
    if (!room_id || !message || !access_token) return res.status(400).json({ error: 'room_id, message y access_token requeridos' });

    // Valida pertenencia con el token del usuario (RLS)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
    const { data: room, error: roomErr } = await userClient.schema('dataroom').from('rooms').select('id, org_id, name').eq('id', room_id).single();
    if (roomErr || !room) return res.status(403).json({ error: 'sin acceso a la sala' });
    const { data: userRes } = await userClient.auth.getUser();
    const userId = userRes && userRes.user ? userRes.user.id : null;

    if (!session_id) {
      const { data: s } = await admin.schema('dataroom').from('chat_sessions')
        .insert({ room_id, org_id: room.org_id, user_id: userId, title: message.slice(0, 60) }).select('id').single();
      session_id = s && s.id;
    }

    // Embedding de la pregunta (Edge Function gte-small)
    const eR = await fetch(`${url}/functions/v1/dataroom-embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({ text: message }),
    });
    const eData = await eR.json();
    if (!eR.ok) throw new Error(eData.error || 'fallo embedding');

    const { data: matches, error: mErr } = await admin.rpc('match_dataroom_chunks', {
      p_room_id: room_id,
      query_embedding: '[' + eData.embedding.join(',') + ']',
      match_count: 8,
    });
    if (mErr) throw mErr;

    const ctx = (matches || []).map((m, i) => `[${i + 1}] (${m.document_name}${m.page ? ', p.' + m.page : ''})\n${m.content}`).join('\n\n');
    const citations = (matches || []).map((m, i) => ({ n: i + 1, document_id: m.document_id, document_name: m.document_name, page: m.page }));

    const system = `Eres el analista de due diligence de Meridian Dataroom para la sala "${room.name}". Responde SOLO con la informacion de los extractos proporcionados. Cita las fuentes con [n]. Si la informacion no esta en los documentos, dilo claramente y no inventes. Se preciso con cifras, fechas y clausulas.`;

    await admin.schema('dataroom').from('messages').insert({ session_id, room_id, role: 'user', content: message });

    const completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: `Extractos del dataroom:\n\n${ctx || '(sin documentos indexados)'}\n\nPregunta: ${message}` }],
    });
    const answer = (completion.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    await admin.schema('dataroom').from('messages').insert({ session_id, room_id, role: 'assistant', content: answer, citations });

    return res.status(200).json({ session_id, answer, citations });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
