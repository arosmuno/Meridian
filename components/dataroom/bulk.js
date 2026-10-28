// Subida masiva: recoge archivos de una carpeta arrastrada, de un selector de carpeta o de un ZIP,
// conservando la ruta relativa para recrear la estructura de carpetas en la sala.
import { unzip } from 'fflate';

export const SUPPORTED = /\.(pdf|docx|xlsx|xlsm|csv|txt|md)$/i;
const JUNK = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|desktop\.ini)(\/|$)|(^|\/)~\$|(^|\/)\._/i;
const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  csv: 'text/csv', txt: 'text/plain', md: 'text/markdown',
};
const ext = (n) => (String(n).match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();

// Arrastrar y soltar: recorre carpetas con la API de entradas del navegador.
export async function filesFromDrop(dataTransfer) {
  const items = Array.from(dataTransfer.items || []);
  const entries = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null)).filter(Boolean);
  if (!entries.length) return Array.from(dataTransfer.files || []).map((file) => ({ file, path: file.name }));
  const out = [];
  const readAll = (reader) => new Promise((resolve) => {
    const acc = [];
    const next = () => reader.readEntries((batch) => { if (!batch.length) resolve(acc); else { acc.push(...batch); next(); } }, () => resolve(acc));
    next();
  });
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: prefix + file.name });
    } else if (entry.isDirectory) {
      const children = await readAll(entry.createReader());
      for (const c of children) await walk(c, `${prefix}${entry.name}/`);
    }
  };
  for (const e of entries) await walk(e, '');
  return out;
}

// Selector de carpeta (<input webkitdirectory>) o de archivos normales.
export function filesFromInput(fileList) {
  return Array.from(fileList || []).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}

// Expande los ZIP (en el navegador; el servidor nunca recibe el ZIP entero).
export async function expandZips(items) {
  const out = [];
  for (const it of items) {
    if (!/\.zip$/i.test(it.file.name)) { out.push(it); continue; }
    const base = it.path.replace(/\.zip$/i, '');
    const buf = new Uint8Array(await it.file.arrayBuffer());
    const files = await new Promise((resolve, reject) => unzip(buf, (err, res) => (err ? reject(err) : resolve(res))));
    for (const [p, data] of Object.entries(files)) {
      if (p.endsWith('/') || !data.length) continue;
      const name = p.split('/').pop();
      const e = ext(name);
      out.push({ file: new File([data], name, { type: MIME[e] || '' }), path: `${base}/${p}` });
    }
  }
  return out;
}

// Separa lo que se puede subir de lo que no (formato o archivos de sistema).
export function classify(items) {
  const ok = [];
  const skipped = [];
  for (const it of items) {
    if (JUNK.test(it.path)) continue;
    if (!SUPPORTED.test(it.file.name)) { skipped.push(it.path); continue; }
    if (it.file.size > 50 * 1024 * 1024) { skipped.push(`${it.path} (más de 50 MB)`); continue; }
    ok.push(it);
  }
  return { ok, skipped };
}
