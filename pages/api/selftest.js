// pages/api/selftest.js -- prueba de humo del dataroom de punta a punta, en produccion.
// Crea un usuario temporal, organizacion, sala, sube un PDF, lo indexa, pregunta al chat,
// pide la descarga firmada y lo borra todo. Protegido por SELFTEST_TOKEN (env de Vercel).
import { createClient } from '@supabase/supabase-js';
import { writeAnalysis, fetchArticle, relatedDeals } from '../../lib/analysisWriter';

export const config = { maxDuration: 300 };

const PDF_B64 = 'JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSCj4+CmVuZG9iagoyIDAgb2JqCjw8Ci9CYXNlRm9udCAvSGVsdmV0aWNhIC9FbmNvZGluZyAvV2luQW5zaUVuY29kaW5nIC9OYW1lIC9GMSAvU3VidHlwZSAvVHlwZTEgL1R5cGUgL0ZvbnQKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL0NvbnRlbnRzIDcgMCBSIC9NZWRpYUJveCBbIDAgMCA1OTUuMjc1NiA4NDEuODg5OCBdIC9QYXJlbnQgNiAwIFIgL1Jlc291cmNlcyA8PAovRm9udCAxIDAgUiAvUHJvY1NldCBbIC9QREYgL1RleHQgL0ltYWdlQiAvSW1hZ2VDIC9JbWFnZUkgXQo+PiAvUm90YXRlIDAgL1RyYW5zIDw8Cgo+PiAKICAvVHlwZSAvUGFnZQo+PgplbmRvYmoKNCAwIG9iago8PAovUGFnZU1vZGUgL1VzZU5vbmUgL1BhZ2VzIDYgMCBSIC9UeXBlIC9DYXRhbG9nCj4+CmVuZG9iago1IDAgb2JqCjw8Ci9BdXRob3IgKGFub255bW91cykgL0NyZWF0aW9uRGF0ZSAoRDoyMDI2MTAyMDIzMDQwMiswMicwMCcpIC9DcmVhdG9yIChhbm9ueW1vdXMpIC9LZXl3b3JkcyAoKSAvTW9kRGF0ZSAoRDoyMDI2MTAyMDIzMDQwMiswMicwMCcpIC9Qcm9kdWNlciAoUmVwb3J0TGFiIFBERiBMaWJyYXJ5IC0gXChvcGVuc291cmNlXCkpIAogIC9TdWJqZWN0ICh1bnNwZWNpZmllZCkgL1RpdGxlICh1bnRpdGxlZCkgL1RyYXBwZWQgL0ZhbHNlCj4+CmVuZG9iago2IDAgb2JqCjw8Ci9Db3VudCAxIC9LaWRzIFsgMyAwIFIgXSAvVHlwZSAvUGFnZXMKPj4KZW5kb2JqCjcgMCBvYmoKPDwKL0ZpbHRlciBbIC9BU0NJSTg1RGVjb2RlIC9GbGF0ZURlY29kZSBdIC9MZW5ndGggMzk3Cj4+CnN0cmVhbQpHYXMyRT51LzxrJ1NjKVAoJTd1ZjM0REpwRSFPUGhQRHRbK3JkW0BbQCJrYTA/MUh0ND5ELEJ0UGRHL1FZTkw9W1JOTihscSZYKVBiUUp1WSctbyRGIzBBUDs2NTdNWytLUXJXVVozJ0s7JTFrMlZIdXJzKjM3W0A+PjQ/JmRzNzVBQVxKa2dhMyonVTk5NigoZURFVVorUl00LyU1L2pUUmJcKiJDTmJSRCgwM0JCVTVrKjpaZkM0X0NNQj5YZjFuMi03UmRYRThSazM3KWc2WiVJbUE7aT08M3JLV0ZtM0BPdXUmMD4ob0pka2BqWkApTUNsNDxwbU43ZzQhRihddC9yWGNlLjc/N1JLQFkqdHNrUVU2KkNaLXBrYldWXVtQWCldTE9SRyZzWyNCOHBpNWkoJFJVSHRIKkpJLjZIUzJiUyZAcF4rNjtSQSItIkFJIzMmKiNaayJAJGYzLiM3Im4rZmc9MGIiU0k+KWxKJ2M1Nj11OyhwRiFTOVJTYCYlMV5xKHVYTGFmTX4+ZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgOAowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwNjEgMDAwMDAgbiAKMDAwMDAwMDA5MiAwMDAwMCBuIAowMDAwMDAwMTk5IDAwMDAwIG4gCjAwMDAwMDA0MDIgMDAwMDAgbiAKMDAwMDAwMDQ3MCAwMDAwMCBuIAowMDAwMDAwNzMxIDAwMDAwIG4gCjAwMDAwMDA3OTAgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8Njc4ZWRmNzNhNWZlMTg2ZjFiYzFmZDdmNGQ4NWM0MjE+PDY3OGVkZjczYTVmZTE4NmYxYmMxZmQ3ZjRkODVjNDIxPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA1IDAgUgovUm9vdCA0IDAgUgovU2l6ZSA4Cj4+CnN0YXJ0eHJlZgoxMjc3CiUlRU9GCg==';

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
  const email = 'selftest+' + Date.now() + '@meridiancapmarkets.com';
  const password = 'St-' + Math.random().toString(36).slice(2) + 'A1!';
  let userId = null, orgId = null, path = null;

  try {
    await step('env', async () => ({
      anthropic: !!process.env.ANTHROPIC_API_KEY, service: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY, model: process.env.DATAROOM_MODEL || null,
    }));
    await step('magic_link_redirect', async () => {
      const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'probe-' + Date.now() + '@meridiancapmarkets.com', options: { redirectTo: base + '/dataroom' } });
      if (error) throw error;
      const u = new URL(data.properties.action_link);
      const out = { redirect_to: u.searchParams.get('redirect_to') };
      if (data.user && data.user.id) await admin.auth.admin.deleteUser(data.user.id);
      return out;
    });
    userId = await step('create_user', async () => {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error; return data.user.id;
    });
    const user = createClient(url, anon, { auth: { persistSession: false } });
    const access = await step('sign_in', async () => {
      const { data, error } = await user.auth.signInWithPassword({ email, password });
      if (error) throw error; return data.session.access_token;
    });
    orgId = await step('create_org', async () => {
      const { data, error } = await user.rpc('dataroom_create_org', { p_name: 'Selftest org' });
      if (error) throw error; return data.id;
    });
    const roomId = await step('create_room', async () => {
      const { data, error } = await user.schema('dataroom').from('rooms').insert({ org_id: orgId, name: 'Selftest room', kind: 'mna', created_by: userId }).select().single();
      if (error) throw error; return data.id;
    });
    path = orgId + '/' + roomId + '/selftest/spa.pdf';
    await step('upload_storage', async () => {
      const { error } = await user.storage.from('datarooms').upload(path, Buffer.from(PDF_B64, 'base64'), { contentType: 'application/pdf' });
      if (error) throw error; return path;
    });
    const docId = await step('insert_document', async () => {
      const { data, error } = await user.schema('dataroom').from('documents').insert({ room_id: roomId, org_id: orgId, name: 'spa.pdf', storage_path: path, mime: 'application/pdf', size_bytes: 1600, created_by: userId }).select().single();
      if (error) throw error; return data.id;
    });
    await step('ingest', async () => {
      const r = await fetch(base + '/api/dataroom/ingest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: docId, access_token: access }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j));
      return j;
    });
    await step('chat', async () => {
      const r = await fetch(base + '/api/dataroom/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room_id: roomId, message: 'What is the purchase price and the locked box date?', access_token: access }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(r.status + ' ' + JSON.stringify(j));
      return { answer: String(j.answer || '').slice(0, 300), citations: (j.citations || []).length };
    });
    await step('download', async () => {
      const r = await fetch(base + '/api/dataroom/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ document_id: docId, access_token: access }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error(r.status + ' ' + JSON.stringify(j));
      const f = await fetch(j.url);
      return { status: f.status, bytes: (await f.arrayBuffer()).byteLength };
    });
    await step('isolation', async () => {
      // Un segundo usuario no debe ver la sala del primero.
      const e2 = 'selftest2+' + Date.now() + '@meridiancapmarkets.com';
      const { data: u2 } = await admin.auth.admin.createUser({ email: e2, password, email_confirm: true });
      const c2 = createClient(url, anon, { auth: { persistSession: false } });
      await c2.auth.signInWithPassword({ email: e2, password });
      const { data: rooms } = await c2.schema('dataroom').from('rooms').select('id').eq('id', roomId);
      await admin.auth.admin.deleteUser(u2.user.id);
      return { other_user_sees_room: (rooms || []).length > 0 };
    });
    await step('viewer_role', async () => {
      // Un invitado "Solo lectura" ve los documentos pero no puede subir ni borrar,
      // y un usuario cualquiera no puede colarse como miembro.
      const e3 = 'selftest3+' + Date.now() + '@meridiancapmarkets.com';
      const { error: ie } = await user.rpc('dataroom_invite_member', { p_org_id: orgId, p_email: e3, p_role: 'viewer' });
      if (ie) throw ie;
      const { data: u3 } = await admin.auth.admin.createUser({ email: e3, password, email_confirm: true });
      const c3 = createClient(url, anon, { auth: { persistSession: false } });
      await c3.auth.signInWithPassword({ email: e3, password });
      await c3.rpc('dataroom_accept_invites');
      const { data: seen } = await c3.schema('dataroom').from('documents').select('id').eq('room_id', roomId);
      const up = await c3.storage.from('datarooms').upload(orgId + '/' + roomId + '/selftest/viewer.txt', Buffer.from('x'), { contentType: 'text/plain' });
      const { data: delRows } = await c3.schema('dataroom').from('documents').delete().eq('id', docId).select();
      const e4 = 'selftest4+' + Date.now() + '@meridiancapmarkets.com';
      const { data: u4 } = await admin.auth.admin.createUser({ email: e4, password, email_confirm: true });
      const c4 = createClient(url, anon, { auth: { persistSession: false } });
      await c4.auth.signInWithPassword({ email: e4, password });
      const { error: joinErr } = await c4.schema('dataroom').from('memberships').insert({ org_id: orgId, user_id: u4.user.id, role: 'owner' });
      await admin.schema('dataroom').from('memberships').delete().eq('org_id', orgId).in('user_id', [u3.user.id, u4.user.id]);
      await admin.auth.admin.deleteUser(u3.user.id); await admin.auth.admin.deleteUser(u4.user.id);
      const out = { viewer_sees_docs: (seen || []).length, viewer_upload_blocked: !!up.error, viewer_delete_blocked: !(delRows || []).length, outsider_join_blocked: !!joinErr };
      if (!out.viewer_sees_docs || !out.viewer_upload_blocked || !out.viewer_delete_blocked || !out.outsider_join_blocked) throw new Error(JSON.stringify(out));
      return out;
    });
  } catch (e) {
    // el paso que fallo ya esta registrado
  } finally {
    try { if (path) await admin.storage.from('datarooms').remove([path, path.replace('spa.pdf', 'viewer.txt')]); } catch (_) {}
    try { if (orgId) await admin.schema('dataroom').from('orgs').delete().eq('id', orgId); } catch (_) {}
    try { if (userId) await admin.auth.admin.deleteUser(userId); } catch (_) {}
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
