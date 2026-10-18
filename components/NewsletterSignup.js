// components/NewsletterSignup.js -- bloque de alta en "The Meridian Weekly".
import { useState } from 'react';

export default function NewsletterSignup({ source = 'newsletter', interest = null, compact = false, cta = 'Subscribe' }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | loading | ok | error
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();
    setState('loading');
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source, interest }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong.');
      setState('ok');
    } catch (err) {
      setMsg(err.message);
      setState('error');
    }
  }

  if (state === 'ok') {
    return (
      <p style={{ fontFamily: 'var(--r)', fontSize: 14, color: 'var(--gold)', fontStyle: 'italic', margin: 0 }}>
        {interest ? 'You are on the list. We will email you when it launches.' : 'Subscribed. The next issue lands on Monday.'}
      </p>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: compact ? 'flex-start' : 'center' }}>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" aria-label="Email"
        style={{ flex: '1 1 220px', maxWidth: compact ? 260 : 340, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-hi)', padding: '10px 12px', fontFamily: 'var(--s)', fontSize: 13, outline: 'none' }} />
      <button type="submit" disabled={state === 'loading'}
        style={{ background: 'var(--text-hi)', color: 'var(--bg)', border: 'none', padding: '10px 18px', fontFamily: 'var(--s)', fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', cursor: 'pointer', opacity: state === 'loading' ? 0.6 : 1 }}>
        {state === 'loading' ? '…' : cta}
      </button>
      {state === 'error' && <div style={{ width: '100%', fontFamily: 'var(--s)', fontSize: 11, color: '#e63946' }}>{msg}</div>}
    </form>
  );
}
