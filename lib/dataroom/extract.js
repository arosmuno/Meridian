// lib/dataroom/extract.js -- texto por pagina (PDF), por hoja (Excel) o entero (Word/texto),
// y troceado que nunca mezcla dos paginas: cada chunk sabe de que pagina sale, y el chat
// puede citar "Contrato.pdf, p. 14" en vez de solo el nombre del fichero.
//
// unpdf en lugar de pdf-parse 1.1.1: aquel entraba en "modo debug" al empaquetarse (leia un
// PDF de test inexistente -> ENOENT en Vercel) y su pdf.js de 2017 falla con "bad XRef entry".
import { extractText as pdfText, getDocumentProxy } from 'unpdf';

export const kindOf = (name, mime) => {
  const n = String(name || '').toLowerCase();
  const m = String(mime || '');
  if (n.endsWith('.pdf') || m === 'application/pdf') return 'pdf';
  if (n.endsWith('.docx')) return 'docx';
  if (n.endsWith('.xlsx') || n.endsWith('.xlsm')) return 'xlsx';
  if (n.endsWith('.csv')) return 'csv';
  if (n.endsWith('.txt') || n.endsWith('.md') || m.startsWith('text/')) return 'text';
  return 'other';
};

// Devuelve [{ page, label, text }]. page es 1-based (pagina de PDF u hoja de Excel), o null.
export async function extractPages(buffer, name, mime) {
  const kind = kindOf(name, mime);
  if (kind === 'pdf') {
    const doc = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfText(doc, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text || '')];
    return pages.map((t, i) => ({ page: i + 1, label: `p. ${i + 1}`, text: String(t || '') }));
  }
  if (kind === 'docx') {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ buffer });
    return [{ page: null, label: null, text: value || '' }];
  }
  if (kind === 'xlsx') {
    const { workbookFromBuffer, sheetText } = await import('./xlsx');
    const wb = await workbookFromBuffer(buffer);
    const out = [];
    wb.worksheets.forEach((ws, i) => {
      const t = sheetText(ws);
      if (!t.trim()) return;
      // Cabecera de la hoja (primeras filas: titulos, años, escenarios). Se repite en cada trozo
      // para que una fila suelta como "F45: 1,234 | 5,678" siga sabiendo a que año corresponde.
      const header = t.split('\n').slice(0, 4).join('\n');
      out.push({ page: i + 1, label: `Hoja: ${ws.name}`, text: `[Hoja: ${ws.name}]\n${t}`, header: `[Hoja: ${ws.name} · cabecera]\n${header}` });
    });
    return out;
  }
  if (kind === 'csv' || kind === 'text') return [{ page: null, label: null, text: buffer.toString('utf8') }];
  throw new Error('Formato no soportado. Sube PDF, DOCX, XLSX, CSV o TXT.');
}

// Troceado por pagina con solape. Corta preferentemente en un salto de linea o un punto
// cercano al limite, para no partir una clausula por la mitad.
export function chunkPages(pages, size = 1400, overlap = 200) {
  const out = [];
  for (const p of pages) {
    const clean = String(p.text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    if (clean.length < 20) continue;
    let i = 0;
    while (i < clean.length) {
      let end = Math.min(clean.length, i + size);
      if (end < clean.length) {
        const window = clean.slice(i + Math.floor(size * 0.6), end);
        const cut = Math.max(window.lastIndexOf('\n'), window.lastIndexOf('. '));
        if (cut > 0) end = i + Math.floor(size * 0.6) + cut + 1;
      }
      let content = clean.slice(i, end).trim();
      if (p.header && i > 0) content = `${p.header}\n…\n${content}`;
      if (content.length >= 20) out.push({ page: p.page, content });
      if (end >= clean.length) break;
      i = Math.max(end - overlap, i + 1);
    }
  }
  return out;
}

// Un PDF sin texto extraible casi siempre es un escaneo.
export function looksScanned(pages) {
  const total = pages.reduce((s, p) => s + String(p.text || '').trim().length, 0);
  return pages.length > 0 && total < 30 * pages.length;
}
