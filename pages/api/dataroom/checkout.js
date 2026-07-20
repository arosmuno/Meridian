// Checkout de Stripe para actualizar de plan. Requiere STRIPE_SECRET_KEY y STRIPE_PRICE_PRO (Alberto los añade luego).
import Stripe from 'stripe';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.status(503).json({ error: 'Pagos aún no configurados. Añade STRIPE_SECRET_KEY y STRIPE_PRICE_PRO en Vercel.' });
  try {
    const stripe = new Stripe(key);
    const { plan, org_id, email } = req.body || {};
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_PRO : null;
    if (!priceId) return res.status(400).json({ error: 'Ese plan no tiene checkout configurado.' });
    const origin = req.headers.origin || 'https://www.meridiancapmarkets.com';
    const s = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      client_reference_id: org_id,
      metadata: { org_id: org_id || '', plan },
      success_url: origin + '/dataroom?upgraded=1',
      cancel_url: origin + '/dataroom/precios',
    });
    return res.status(200).json({ url: s.url });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
}
