// Descarga el fichero de Storage, extrae texto y lo manda a la Edge Function de ingesta.
import { createClient } from '@supabase/supabase-js';
// unpdf en lugar de pdf-parse 1.1.1: aquel entraba en "modo debug" al empaquetarse (leia un
// PDF de test inexistente -> ENOENT en Vercel) y su pdf.js de 2017 falla con "bad XRef entry"
// en PDFs modernos. Ningun PDF llegaba a indexarse.
import { extractText as pdfText, getDocumentProxy } from 'unpdf';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } }, maxDuration: 60 };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function extractText(buffer, name, mime) {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.txt') || lower.endsWith('.md') || (mime || '').startsWith('text/')) return buffer.toString('utf8');
  if (lower.endsWith('.pdf') || mime === 'application/pdf') {
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfText(doc, { mergePages: true });
    return text;
  }
  if (lower.endsWith('.docx')) {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }
  return buffer.toString('utf8');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const { document_id, access_token } = req.body || {};
    if (!document_id || !access_token) return res.status(400).json({ error: 'document_id y access_token requeridos' });

    // Valida acceso con el token del usuario (RLS) antes de descargar nada.
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${access_token}` } } });
    const { data: allowed } = await userClient.schema('dataroom').from('documents').select('id').eq('id', document_id).single();
    if (!allowed) return res.status(403).json({ error: 'sin acceso al documento' });

    const { data: doc, error } = await admin.schema('dataroom').from('documents').select('*').eq('id', document_id).single();
    if (error || !doc) return res.status(404).json({ error: 'documento no encontrado' });
    req._docId = document_id;

    const { data: file, error: dlErr } = await admin.storage.from('datarooms').download(doc.storage_path);
    if (dlErr) throw dlErr;
    const buffer = Buffer.from(await file.arrayBuffer());

    const text = await extractText(buffer, doc.name, doc.mime);
    if (!text || text.trim().length < 20) {
      await admin.schema('dataroom').from('documents').update({ status: 'error', error: 'sin texto extraible' }).eq('id', document_id);
      return res.status(422).json({ error: 'no se pudo extraer texto (posible PDF escaneado)' });
    }

    const r = await fetch(`${url}/functions/v1/dataroom-ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access_token}` },
      body: JSON.stringify({ document_id, text }),
    });
    const out = await r.json();
    if (!r.ok) throw new Error(out.error || 'fallo en ingesta');
    return res.status(200).json(out);
  } catch (e) {
    // Que el documento no se quede colgado en "processing" si algo falla.
    if (req._docId) {
      try { await admin.schema('dataroom').from('documents').update({ status: 'error', error: String((e && e.message) || e).slice(0, 300) }).eq('id', req._docId); } catch (_) {}
    }
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
