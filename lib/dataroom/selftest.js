// lib/dataroom/selftest.js -- prueba de punta a punta del dataroom v2 en produccion.
// Crea tres usuarios temporales (owner, miembro, solo lectura), una organizacion, una sala con
// carpeta publica y carpeta restringida, sube un PDF en espanol y un Excel con errores, y
// comprueba indexado, chat con citas por pagina, permisos, descargas, marca de agua, NDA, Q&A,
// revision del modelo y auditoria. Al final lo borra todo.
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import ExcelJS from 'exceljs';
import { extractText, getDocumentProxy } from 'unpdf';

async function samplePdf() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = [
    ['CONTRATO DE COMPRAVENTA DE ACCIONES', 'El precio de compra acordado es de 12,5 millones de euros, pagadero al cierre.', 'Fecha de locked box: 31 de diciembre de 2025.'],
    ['Cláusula 7. Cambio de control.', 'Los contratos con los tres principales clientes pueden resolverse en caso de cambio de control.', 'El vendedor garantiza la ausencia de litigios relevantes.'],
    ['Anexo financiero.', 'EBITDA 2025: 3,2 millones de euros. Deuda financiera neta a cierre: 8 millones de euros.'],
  ];
  for (const lines of pages) {
    const p = pdf.addPage([595, 842]);
    lines.forEach((t, i) => p.drawText(t, { x: 40, y: 780 - i * 22, size: 12, font: f }));
  }
  return Buffer.from(await pdf.save());
}

async function sampleXlsx() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Modelo');
  ws.getRow(1).values = ['', 'Concepto', 2025, 2026, 2027, 2028, 2029];
  ws.getCell('B2').value = 'Ingresos'; ws.getCell('C2').value = 1000;
  ws.getCell('D2').value = { formula: 'C2*1.05', result: 1050 };
  ws.getCell('E2').value = { formula: 'D2*1.05', result: 1102.5 };
  ws.getCell('F2').value = 1200;
  ws.getCell('G2').value = { formula: 'F2*1.05', result: 1260 };
  ws.getCell('B3').value = 'Balance check';
  ws.getCell('D3').value = { formula: 'D2-D2', result: 0 };
  ws.getCell('E3').value = { formula: 'E2-E2+500', result: 500 };
  ws.getCell('B4').value = 'Margen';
  ws.getCell('D4').value = { formula: 'D2/0', result: { error: '#DIV/0!' } };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function dataroomSelftest({ admin, url, anon, base, step }) {
  const stamp = Date.now();
  const password = 'St-' + Math.random().toString(36).slice(2) + 'A1!';
  const users = {};
  let orgId = null;
  const call = async (who, path, body) => {
    const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, access_token: users[who].token }) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, ok: r.ok, ...j };
  };
  const must = (cond, info) => { if (!cond) throw new Error(typeof info === 'string' ? info : JSON.stringify(info)); };

  try {
    await step('dr_users', async () => {
      for (const k of ['owner', 'member', 'viewer']) {
        const email = `selftest-${k}+${stamp}@meridiancapmarkets.com`;
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        if (error) throw error;
        const c = createClient(url, anon, { auth: { persistSession: false } });
        const { data: s, error: se } = await c.auth.signInWithPassword({ email, password });
        if (se) throw se;
        users[k] = { id: data.user.id, email, client: c, token: s.session.access_token };
      }
      return Object.keys(users);
    });
    const O = users.owner.client;
    const dr = (k) => users[k].client.schema('dataroom');

    const roomId = await step('dr_org_room', async () => {
      const { data: org, error } = await O.rpc('dataroom_create_org', { p_name: 'Selftest v2' });
      if (error) throw error;
      orgId = org.id;
      await admin.schema('dataroom').from('orgs').update({ plan: 'pro' }).eq('id', orgId);
      const { data: room, error: re } = await dr('owner').from('rooms').insert({ org_id: orgId, name: 'Proyecto Atlas', kind: 'mna', created_by: users.owner.id }).select().single();
      if (re) throw re;
      for (const [k, role] of [['member', 'member'], ['viewer', 'viewer']]) {
        const { error: ie } = await O.rpc('dataroom_invite_member', { p_org_id: orgId, p_email: users[k].email, p_role: role });
        if (ie) throw ie;
        await users[k].client.rpc('dataroom_accept_invites');
      }
      const { error: bad } = await O.rpc('dataroom_invite_member', { p_org_id: orgId, p_email: 'x' + stamp + '@x.com', p_role: 'owner' });
      must(!!bad, 'se pudo invitar como owner');
      return room.id;
    });

    const folders = await step('dr_folders', async () => {
      const { data: legal, error: e1 } = await dr('owner').from('folders').insert({ room_id: roomId, org_id: orgId, name: 'Legal', position: 0 }).select().single();
      if (e1) throw e1;
      const { data: fin, error: e2 } = await dr('owner').from('folders').insert({ room_id: roomId, org_id: orgId, name: 'Financiero', position: 1, restricted: true }).select().single();
      if (e2) throw e2;
      const { error: e3 } = await dr('owner').from('folder_access').insert({ folder_id: fin.id, user_id: users.member.id, org_id: orgId });
      if (e3) throw e3;
      return { legal: legal.id, fin: fin.id };
    });

    const upload = async (who, folderId, name, buffer, mime) => {
      const up = await call(who, '/api/dataroom/upload', { room_id: roomId, folder_id: folderId, name, size: buffer.length, mime });
      if (!up.ok) return up;
      const { error } = await users[who].client.storage.from('datarooms').uploadToSignedUrl(up.path, up.token, buffer, { contentType: mime });
      if (error) throw error;
      let p = await call(who, '/api/dataroom/ingest', { document_id: up.document.id });
      for (let i = 0; i < 10 && p.ok && p.total && p.done < p.total; i++) p = await call(who, '/api/dataroom/embed', { document_id: up.document.id });
      return { ...p, document: up.document };
    };

    const pdfDoc = await step('dr_upload_pdf', async () => {
      const r = await upload('owner', folders.legal, 'SPA Atlas.pdf', await samplePdf(), 'application/pdf');
      must(r.ok && r.total > 0 && r.done === r.total, r);
      const { data: ch } = await admin.schema('dataroom').from('chunks').select('page, embed_model').eq('document_id', r.document.id);
      must((ch || []).every((c) => c.page) && new Set(ch.map((c) => c.page)).size === 3, { pages: (ch || []).map((c) => c.page) });
      return { id: r.document.id, chunks: r.total, model: ch[0].embed_model };
    });
    const xlsDoc = await step('dr_upload_xlsx', async () => {
      const r = await upload('owner', folders.fin, 'Modelo Atlas.xlsx', await sampleXlsx(), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      must(r.ok, r);
      return { id: r.document.id };
    });

    await step('dr_chat_es_citations', async () => {
      const r = await call('owner', '/api/dataroom/chat', { room_id: roomId, message: '¿Cuál es el precio de compra y qué pasa con el cambio de control?' });
      must(r.ok, r);
      const pages = (r.citations || []).map((c) => c.page);
      must(pages.includes(1) || pages.includes(2), { citations: r.citations });
      return { answer: String(r.answer).slice(0, 220), citations: (r.citations || []).map((c) => c.label) };
    });

    await step('dr_folder_permissions', async () => {
      const { data: vDocs } = await dr('viewer').from('documents').select('id').eq('room_id', roomId);
      const { data: mDocs } = await dr('member').from('documents').select('id').eq('room_id', roomId);
      const vIds = (vDocs || []).map((d) => d.id);
      const out = { viewer_sees_pdf: vIds.includes(pdfDoc.id), viewer_sees_restricted: vIds.includes(xlsDoc.id), member_sees_restricted: (mDocs || []).some((d) => d.id === xlsDoc.id) };
      const v = await call('viewer', '/api/dataroom/view', { document_id: xlsDoc.id });
      out.viewer_view_restricted_status = v.status;
      const c = await call('viewer', '/api/dataroom/chat', { room_id: roomId, message: '¿Qué valor tiene el balance check del modelo?' });
      out.viewer_chat_cites_restricted = (c.citations || []).some((x) => x.document_id === xlsDoc.id);
      must(out.viewer_sees_pdf && !out.viewer_sees_restricted && out.member_sees_restricted && v.status === 403 && !out.viewer_chat_cites_restricted, out);
      return out;
    });

    await step('dr_write_blocked_for_viewer', async () => {
      const up = await call('viewer', '/api/dataroom/upload', { room_id: roomId, folder_id: folders.legal, name: 'x.txt', size: 3, mime: 'text/plain' });
      const del = await call('viewer', '/api/dataroom/delete', { document_id: pdfDoc.id });
      const ing = await call('viewer', '/api/dataroom/ingest', { document_id: pdfDoc.id });
      const st = await users.viewer.client.storage.from('datarooms').list(`${orgId}/${roomId}`);
      const out = { upload: up.status, delete: del.status, ingest: ing.status, direct_storage_list: (st.data || []).length };
      must(up.status === 403 && del.status === 403 && ing.status === 403 && out.direct_storage_list === 0, out);
      return out;
    });

    await step('dr_download_watermark', async () => {
      await dr('owner').from('rooms').update({ allow_download: false, watermark: true }).eq('id', roomId);
      const v = await call('viewer', '/api/dataroom/download', { document_id: pdfDoc.id });
      const o = await call('owner', '/api/dataroom/download', { document_id: pdfDoc.id });
      must(v.status === 403 && o.ok && o.watermarked, { viewer: v.status, owner: o });
      const bytes = Buffer.from(await (await fetch(o.url)).arrayBuffer());
      const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
      must(String(text).includes(users.owner.email), 'la marca de agua no aparece en el PDF');
      return { viewer_download: v.status, owner_watermarked: true };
    });

    await step('dr_nda', async () => {
      await dr('owner').from('rooms').update({ nda_required: true, nda_text: 'Confidencial.' }).eq('id', roomId);
      const before = await call('viewer', '/api/dataroom/view', { document_id: pdfDoc.id });
      const acc = await call('viewer', '/api/dataroom/nda', { room_id: roomId });
      const after = await call('viewer', '/api/dataroom/view', { document_id: pdfDoc.id });
      must(before.status === 451 && acc.ok && after.ok && after.mode === 'pdf', { before: before.status, after: after.status });
      return { before: before.status, after: after.mode };
    });

    await step('dr_qa', async () => {
      const ask = await call('viewer', '/api/dataroom/qa', { action: 'ask', room_id: roomId, question: '¿Cuál es la deuda neta a cierre?' });
      must(ask.ok, ask);
      const qid = ask.question.id;
      const vAnswer = await call('viewer', '/api/dataroom/qa', { action: 'answer', room_id: roomId, question_id: qid, answer: 'x' });
      const draft = await call('member', '/api/dataroom/qa', { action: 'draft', room_id: roomId, question_id: qid });
      const ans = await call('member', '/api/dataroom/qa', { action: 'answer', room_id: roomId, question_id: qid, answer: draft.ai_draft || 'Ver anexo financiero.' });
      const { data: q } = await dr('viewer').from('questions').select('status, answer').eq('id', qid).single();
      must(vAnswer.status === 403 && draft.ok && ans.ok && q.status === 'answered', { viewer_answer: vAnswer.status, draft: draft.status, q });
      return { draft: String(draft.ai_draft || '').slice(0, 160), status: q.status };
    });

    await step('dr_model_review', async () => {
      const { data: rev } = await admin.schema('dataroom').from('model_reviews').select('status, findings, summary').eq('document_id', xlsDoc.id).order('created_at', { ascending: false }).limit(1).single();
      const types = new Set((rev.findings || []).map((f) => f.type));
      must(rev.status === 'done' && types.has('hardcode_in_row') && types.has('check_failed') && types.has('error_value'), { status: rev.status, types: [...types] });
      const { data: vr } = await dr('viewer').from('model_reviews').select('id').eq('document_id', xlsDoc.id);
      must(!(vr || []).length, 'el viewer ve la revision de un modelo restringido');
      return { findings: rev.findings.length, summary: String(rev.summary).slice(0, 200) };
    });

    await step('dr_audit', async () => {
      const { data: a } = await dr('owner').from('audit_log').select('action').eq('room_id', roomId);
      const { data: v } = await dr('viewer').from('audit_log').select('action').eq('room_id', roomId);
      const acts = new Set((a || []).map((x) => x.action));
      must(acts.has('document_upload') && acts.has('document_view') && acts.has('document_download') && acts.has('nda_accept') && !(v || []).length, { owner: [...acts], viewer_rows: (v || []).length });
      return { actions: [...acts] };
    });
  } finally {
    try {
      if (orgId) {
        const { data: rooms } = await admin.schema('dataroom').from('rooms').select('id').eq('org_id', orgId);
        for (const r of rooms || []) {
          const { data: dirs } = await admin.storage.from('datarooms').list(`${orgId}/${r.id}`, { limit: 1000 });
          for (const d of dirs || []) {
            const { data: files } = await admin.storage.from('datarooms').list(`${orgId}/${r.id}/${d.name}`, { limit: 1000 });
            const paths = (files || []).map((f) => `${orgId}/${r.id}/${d.name}/${f.name}`);
            if (paths.length) await admin.storage.from('datarooms').remove(paths);
          }
        }
        for (const u of Object.values(users)) {
          const { data: wm } = await admin.storage.from('datarooms').list(`_wm/${u.id}`, { limit: 1000 });
          const paths = (wm || []).map((f) => `_wm/${u.id}/${f.name}`);
          if (paths.length) await admin.storage.from('datarooms').remove(paths);
        }
        await admin.schema('dataroom').from('orgs').delete().eq('id', orgId);
      }
    } catch (_) {}
    for (const u of Object.values(users)) { try { await admin.auth.admin.deleteUser(u.id); } catch (_) {} }
  }
}
