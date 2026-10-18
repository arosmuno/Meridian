// pages/api/subscribe.js -- alta en la newsletter / lista de espera de Academy.
// POST { email, source?, interest? }
import { supabaseAdmin } from '../../lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!supabaseAdmin) return res.status(503).json({ error: 'unavailable' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const source = String(req.body?.source || 'newsletter').slice(0, 40);
  const interest = req.body?.interest ? String(req.body.interest).slice(0, 40) : null;

  if (!EMAIL_RE.test(email) || email.length > 200) {
    return res.status(400).json({ error: 'Please enter a valid email.' });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('subscribers').select('id, interests').eq('email', email).maybeSingle();

    if (existing) {
      const interests = new Set(existing.interests || []);
      if (interest) interests.add(interest);
      await supabaseAdmin.from('subscribers')
        .update({ interests: [...interests], unsubscribed_at: null })
        .eq('id', existing.id);
    } else {
      const { error } = await supabaseAdmin.from('subscribers')
        .insert({ email, source, interests: interest ? [interest] : [] });
      if (error) throw error;
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[subscribe]', e.message);
    return res.status(500).json({ error: 'Something went wrong. Try again later.' });
  }
}
