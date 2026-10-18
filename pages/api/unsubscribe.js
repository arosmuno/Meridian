// pages/api/unsubscribe.js -- baja con un clic desde el enlace del email.
// GET /api/unsubscribe?t=<unsubscribe_token>
import { supabaseAdmin } from '../../lib/supabase';

const UUID_RE = /^[0-9a-f-]{36}$/i;

export default async function handler(req, res) {
  const token = String(req.query.t || '');
  let ok = false;
  if (supabaseAdmin && UUID_RE.test(token)) {
    const { data } = await supabaseAdmin.from('subscribers')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token).select('id');
    ok = !!(data && data.length);
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Meridian</title></head>
<body style="font-family:Georgia,serif;background:#faf8f3;color:#1c1916;text-align:center;padding:80px 20px">
<h1 style="font-size:28px;letter-spacing:.1em">MERIDIAN</h1>
<p>${ok ? 'You have been unsubscribed. You will not receive more emails.' : 'This link is not valid or has already been used.'}</p>
<p><a href="/" style="color:#9a7d1e">Back to Meridian</a></p></body></html>`);
}
