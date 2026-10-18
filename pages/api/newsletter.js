// pages/api/newsletter.js -- "The Meridian Weekly": resumen de los deals de la semana.
//
// GET /api/newsletter?preview=1  -> devuelve el HTML del numero (sin enviar)
// GET /api/newsletter            -> envia a los suscriptores activos (Vercel Cron, lunes)
//
// Sin generacion: solo deals reales de la tabla, con su fuente. Cero tokens de Anthropic.
// Envio con Resend (plan gratuito, 3.000 emails/mes). Sin RESEND_API_KEY no envia nada.

import { supabaseAdmin } from '../../lib/supabase';

export const config = { maxDuration: 60 };

const SITE = 'https://www.meridiancapmarkets.com';
const FROM = process.env.NEWSLETTER_FROM || 'Meridian Weekly <weekly@meridiancapmarkets.com>';

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fmtEur(v) {
  const n = Math.round(Number(v || 0));
  if (!n) return '';
  return n >= 1000 ? '€' + (n / 1000).toFixed(1) + 'bn' : '€' + n + 'm';
}

async function loadDeals() {
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data, error } = await supabaseAdmin
    .from('deals')
    .select('id, headline, summary, value_eur, type, sector, geography, is_iberian, source, source_url')
    .eq('category', 'deal')
    .is('excluded_reason', null)
    .is('dup_of', null)
    .gte('fetched_at', since)
    .order('value_eur', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  const deals = data || [];
  return {
    top: deals.slice(0, 8),
    iberia: deals.filter((d) => d.is_iberian).slice(0, 5),
    count: deals.length,
  };
}

function dealRow(d) {
  const url = SITE + '/deal/' + slugify(d.headline) + '-' + d.id;
  const meta = [d.type, d.sector, fmtEur(d.value_eur)].filter(Boolean).join(' · ');
  const summary = d.summary ? esc(d.summary.length > 260 ? d.summary.slice(0, 257) + '…' : d.summary) : '';
  return `<tr><td style="padding:14px 0;border-bottom:1px solid #ddd7ca">
<div style="font:700 10px Arial,sans-serif;letter-spacing:.08em;color:#9a7d1e;text-transform:uppercase">${esc(meta)}</div>
<a href="${url}" style="display:block;font:700 17px Georgia,serif;color:#1c1916;text-decoration:none;margin:4px 0">${esc(d.headline)}</a>
<div style="font:14px/1.6 Georgia,serif;color:#403a33">${summary}</div>
${d.source ? `<div style="font:11px Arial,sans-serif;color:#a59d8f;margin-top:4px">Source: ${esc(d.source)}</div>` : ''}
</td></tr>`;
}

function renderIssue({ top, iberia, count }, unsubscribeUrl) {
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const section = (title, rows) => rows.length ? `
<tr><td style="padding:26px 0 4px;font:800 11px Arial,sans-serif;letter-spacing:.16em;color:#736c61;text-transform:uppercase;border-bottom:2px solid #1c1916">${title}</td></tr>
${rows.map(dealRow).join('')}` : '';
  return `<!doctype html><html><body style="margin:0;background:#faf8f3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f3"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px">
<tr><td style="text-align:center;border-bottom:3px double #ddd7ca;padding-bottom:16px">
<div style="font:10px Arial,sans-serif;letter-spacing:.3em;color:#736c61">THE CAPITAL MARKETS INTELLIGENCE REVIEW</div>
<div style="font:800 34px Georgia,serif;color:#1c1916;letter-spacing:.04em;margin-top:6px">MERIDIAN WEEKLY</div>
<div style="font:italic 13px Georgia,serif;color:#736c61">${date} · ${count} deals tracked this week</div>
</td></tr>
${section('The week’s largest deals', top)}
${section('Iberia', iberia)}
<tr><td style="padding:28px 0;text-align:center">
<a href="${SITE}/academy" style="display:inline-block;border:1px solid #9a7d1e;color:#9a7d1e;font:700 12px Arial,sans-serif;letter-spacing:.08em;padding:10px 18px;text-decoration:none">MERIDIAN ACADEMY · MODELS, GUIDE &amp; COACHING</a>
</td></tr>
<tr><td style="font:11px/1.6 Arial,sans-serif;color:#a59d8f;text-align:center;border-top:1px solid #ddd7ca;padding-top:14px">
Deals are compiled from public press releases, regulatory filings and news. Figures as reported by the source.<br>
<a href="${SITE}" style="color:#a59d8f">meridiancapmarkets.com</a> · <a href="${unsubscribeUrl}" style="color:#a59d8f">Unsubscribe</a>
</td></tr></table></td></tr></table></body></html>`;
}

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasSecret = process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET;
  if (!isVercelCron && !hasSecret) return res.status(401).json({ error: 'unauthorized' });
  if (!supabaseAdmin) return res.status(503).json({ error: 'no service key' });

  const issue = await loadDeals();

  if (req.query.preview) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(renderIssue(issue, SITE + '/api/unsubscribe?t=preview'));
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: already } = await supabaseAdmin.from('newsletter_sends').select('id').eq('issue_date', today).maybeSingle();
  if (already) return res.status(200).json({ skipped: 'already sent today' });
  if (!issue.count) return res.status(200).json({ skipped: 'no deals this week' });
  if (!process.env.RESEND_API_KEY) return res.status(200).json({ skipped: 'RESEND_API_KEY not set', deals: issue.count });

  const { data: subs } = await supabaseAdmin.from('subscribers')
    .select('email, unsubscribe_token').is('unsubscribed_at', null).limit(3000);

  const subject = `Meridian Weekly · ${issue.count} deals · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
  let sent = 0;
  // Resend batch: hasta 100 emails por llamada, cada uno con su enlace de baja.
  for (let i = 0; i < (subs || []).length; i += 100) {
    const batch = subs.slice(i, i + 100).map((s) => {
      const unsub = SITE + '/api/unsubscribe?t=' + s.unsubscribe_token;
      return {
        from: FROM, to: [s.email], subject,
        html: renderIssue(issue, unsub),
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      };
    });
    const r = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(batch),
    });
    if (r.ok) sent += batch.length; else console.error('[newsletter] resend', r.status, await r.text());
  }

  await supabaseAdmin.from('newsletter_sends').insert({
    issue_date: today, subject, recipients: sent, deals_included: issue.count, status: sent ? 'sent' : 'failed',
  });
  return res.status(200).json({ sent, deals: issue.count });
}
