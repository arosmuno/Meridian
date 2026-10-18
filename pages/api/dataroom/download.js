// Descarga firmada de un documento + registro de auditoría. Valida pertenencia por RLS.
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { document_id, access_token } = req.body || {};
    if (!document_id || !access_token) return res.status(400).json({ error: 'document_id y access_token requeridos' });

    // Valida acceso con el token del usuario (RLS): si puede ver el doc, es miembro.
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
    const { data: doc, error } = await userClient.schema('dataroom').from('documents').select('id, name, org_id, room_id, storage_path').eq('id', document_id).single();
    if (error || !doc) return res.status(403).json({ error: 'sin acceso al documento' });
    const { data: userRes } = await userClient.auth.getUser();
    const actor = userRes && userRes.user ? userRes.user.id : null;

    // Enlace firmado y caducable (5 min)
    const { data: signed, error: sErr } = await admin.storage.from('datarooms').createSignedUrl(doc.storage_path, 300, { download: doc.name });
    if (sErr) throw sErr;

    // Auditoría
    await admin.schema('dataroom').from('audit_log').insert({
      org_id: doc.org_id, room_id: doc.room_id, actor, action: 'document_download',
      meta: { document_id: doc.id, name: doc.name },
    });

    return res.status(200).json({ url: signed.signedUrl });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
