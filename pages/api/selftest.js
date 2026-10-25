// pages/api/selftest.js -- prueba de humo del dataroom de punta a punta, en produccion.
// Crea un usuario temporal, organizacion, sala, sube un PDF, lo indexa, pregunta al chat,
// pide la descarga firmada y lo borra todo. Protegido por SELFTEST_TOKEN (env de Vercel).
import { createClient } from '@supabase/supabase-js';
import { writeAnalysis, fetchArticle, relatedDeals } from '../../lib/analysisWriter';
import { dataroomSelftest } from '../../lib/dataroom/selftest';

export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  const token = process.env.SELFTEST_TOKEN;
  if (!token || req.query.token !== token) return res.status(404).end();

  // Modo de prueba del analisis largo: ?analysis=<id> genera el texto (sin guardarlo).
  if (req.query.analysis) {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: d } = await db.from('deals').select('*').eq('id', Number(req.query.analysis)).maybeSingle();
    if (!d) return res.status(404).json({ error: 'no deal' });
    const out = await writeAnalysis(db, d, { debug: true });
    return res.status(200).json({ headline: d.headline, ...out });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const base = 'https://' + req.headers.host;
  const steps = [];
  const step = async (name, fn) => {
    const t = Date.now();
    try { const out = await fn(); steps.push({ name, ok: true, ms: Date.now() - t, out }); return out; }
    catch (e) { steps.push({ name, ok: false, ms: Date.now() - t, error: String((e && e.message) || e).slice(0, 400) }); throw e; }
  };
  try {
    await step('env', async () => ({
      gemini: !!(process.env.GEMINI_API_KEY || process.env.Gemini_Api_key), groq: !!process.env.GROQ_API_KEY, service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }));
    await step('magic_link_redirect', async () => {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'probe-' + Date.now() + '@meridiancapmarkets.com', options: { redirectTo: base + '/dataroom' } });
      if (error) throw error;
      const u = new URL(data.properties.action_link);
      const out = { redirect_to: u.searchParams.get('redirect_to') };
      if (data.user && data.user.id) await admin.auth.admin.deleteUser(data.user.id);
      return out;
    });
    await dataroomSelftest({ admin, url, anon, base, step });
  } catch (e) {
    // el paso que fallo ya esta registrado
  }
  // --- Resto de la web: APIs publicas ---
  const site = async (name, fn) => { try { await step(name, fn); } catch (_) {} };
  await site('api_deals', async () => {
    const r = await fetch(base + '/api/deals?days=7&limit=150'); const j = await r.json();
    const ds = j.deals || [];
    return { status: r.status, count: ds.length, duplicates: ds.filter((d) => d.dup_of).length, excluded: ds.filter((d) => d.category === 'excluded').length, newest: ds[0] && ds[0].created_at, with_analysis: ds.filter((d) => d.analysis).length };
  });
  await site('api_jobs', async () => { const r = await fetch(base + '/api/jobs'); const j = await r.json(); return { status: r.status, count: j.count }; });
  await site('subscribe', async () => {
    const em = 'selftest+' + Date.now() + '@meridiancapmarkets.com';
    const r = await fetch(base + '/api/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em, source: 'selftest' }) });
    const j = await r.json().catch(() => ({}));
    await admin.from('subscribers').delete().eq('email', em);
    if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j));
    return j;
  });
  await site('newsletter_env', async () => ({ resend: !!process.env.RESEND_API_KEY, from: process.env.NEWSLETTER_FROM || null }));
  return res.status(200).json({ ok: steps.every((s) => s.ok), steps });
}
