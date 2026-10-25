// lib/dataroom/modelReview.js -- revisor de modelos Excel (Meridian Modelling).
//
// Analisis estatico del libro: lee formulas y valores cacheados y devuelve hallazgos con hoja y
// celda. Es lo que se mira primero en una revision de modelo de verdad: errores, valores metidos
// a mano en filas de formulas, formulas que rompen el patron de su fila, constantes escondidas
// en formulas, enlaces externos, checks que no cuadran, volatiles y logica dificil de auditar.
// El resumen en texto se escribe SOLO a partir de estos hallazgos: no inventa impactos.
import { workbookFromBuffer, eachCell } from './xlsx';

const SEV_ORDER = { high: 0, medium: 1, low: 2, info: 3 };
const MAX_PER_GROUP = 12;

// Referencias a celdas/rangos (con hoja opcional) -> R1C1 relativo respecto de (row, col).
const REF_RE = /((?:'[^']+'|[A-Za-z_][A-Za-z0-9_. ]*)!)?(\$?)([A-Z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(])/g;
const colNum = (s) => s.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

function stripStrings(f) { return String(f).replace(/"[^"]*"/g, '""'); }

export function toR1C1(formula, row, col) {
  return stripStrings(formula).replace(REF_RE, (m, sheet, ca, c, ra, r) => {
    const cc = colNum(c);
    const rr = Number(r);
    const cPart = ca ? `C${cc}` : `C[${cc - col}]`;
    const rPart = ra ? `R${rr}` : `R[${rr - row}]`;
    return `${sheet || ''}${rPart}${cPart}`;
  }).replace(/\s+/g, '');
}

// Constantes numericas dentro de una formula (fuera de referencias, rangos y textos).
const BENIGN = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 24, 52, 100, 360, 365, 1000, 1000000, 1e6, 1e3]);
export function literalsIn(formula) {
  const s = stripStrings(formula)
    .replace(REF_RE, ' REF ')
    .replace(/\b[A-Z][A-Z0-9.]*\s*\(/g, ' FN(')
    .replace(/\bR\[-?\d+\]C\[-?\d+\]/g, ' REF ');
  const out = [];
  const re = /(^|[^A-Za-z0-9_.$])(\d+(?:\.\d+)?)(%?)(?![A-Za-z0-9_.$])/g;
  let m;
  while ((m = re.exec(s))) {
    const n = Number(m[2]) / (m[3] ? 100 : 1);
    if (!BENIGN.has(n)) out.push(m[2] + m[3]);
  }
  return out;
}

const countIf = (f) => (String(f).match(/\bIF\s*\(/gi) || []).length;
const VOLATILE = /\b(OFFSET|INDIRECT|TODAY|NOW|RAND|RANDBETWEEN)\s*\(/i;
const EXTERNAL = /\[[^\]]+\]|\.xls[xmb]?\b|https?:\/\//i;
const CHECK_LABEL = /\b(check|checks|control|cuadre|diferencia|difference|balance check|error check)\b/i;

export async function reviewWorkbook(buffer) {
  const wb = await workbookFromBuffer(buffer);
  const findings = [];
  const stats = { sheets: 0, hidden_sheets: 0, cells: 0, formulas: 0, numbers: 0, errors: 0 };
  const groups = {};
  const add = (f) => {
    const key = `${f.sheet}|${f.type}`;
    groups[key] = (groups[key] || 0) + 1;
    if (groups[key] <= MAX_PER_GROUP) findings.push(f);
  };

  for (const ws of wb.worksheets) {
    stats.sheets++;
    if (ws.state && ws.state !== 'visible') {
      stats.hidden_sheets++;
      add({ type: 'hidden_sheet', severity: 'info', sheet: ws.name, cell: null, title: 'Hoja oculta', detail: `La hoja «${ws.name}» está oculta. Conviene revisar qué calcula y si algo depende de ella.` });
    }
    const grid = new Map(); // "r,c" -> info
    const litCells = [];
    const rowLabels = new Map();
    eachCell(ws, (ci) => {
      stats.cells++;
      grid.set(`${ci.row},${ci.col}`, ci);
      if (!ci.formula && !ci.isNumber && ci.text && ci.col <= 4 && !rowLabels.has(ci.row)) rowLabels.set(ci.row, ci.text);
      if (ci.formula) stats.formulas++;
      else if (ci.isNumber) stats.numbers++;
      if (ci.isError) {
        stats.errors++;
        add({ type: 'error_value', severity: 'high', sheet: ws.name, cell: ci.addr, title: `Error ${ci.error}`, detail: `La celda devuelve ${ci.error}. Todo lo que dependa de ella está mal o vacío.`, formula: ci.formula });
      }
      if (ci.formula) {
        if (EXTERNAL.test(ci.formula)) add({ type: 'external_link', severity: 'high', sheet: ws.name, cell: ci.addr, title: 'Enlace a otro libro', detail: 'La fórmula toma datos de un archivo externo: si ese archivo cambia o no está, el modelo se rompe sin avisar.', formula: ci.formula });
        const lits = literalsIn(ci.formula);
        if (lits.length) litCells.push({ ci, lits });
        if (VOLATILE.test(ci.formula)) add({ type: 'volatile', severity: 'low', sheet: ws.name, cell: ci.addr, title: 'Función volátil', detail: 'OFFSET, INDIRECT, TODAY o NOW recalculan siempre y son difíciles de auditar; mejor INDEX/MATCH o una fecha de input.', formula: ci.formula });
        if (countIf(ci.formula) >= 3) add({ type: 'nested_if', severity: 'low', sheet: ws.name, cell: ci.addr, title: 'IF anidados', detail: `${countIf(ci.formula)} IF anidados en una celda. Una tabla de búsqueda o filas auxiliares lo hacen auditable.`, formula: ci.formula });
        if (ci.formula.length > 250) add({ type: 'long_formula', severity: 'low', sheet: ws.name, cell: ci.addr, title: 'Fórmula muy larga', detail: `${ci.formula.length} caracteres en una sola celda: conviene partirla en pasos.`, formula: ci.formula });
      }
    });

    // Constantes en formulas: la misma formula copiada a lo largo de una fila es UN hallazgo
    // (D3:H3), no cinco.
    const litGroups = new Map();
    for (const { ci, lits } of litCells) {
      const k = `${ci.row}|${toR1C1(ci.formula, ci.row, ci.col)}`;
      if (!litGroups.has(k)) litGroups.set(k, { cells: [], lits, formula: ci.formula });
      litGroups.get(k).cells.push(ci.addr);
    }
    for (const g of litGroups.values()) {
      const range = g.cells.length > 1 ? `${g.cells[0]}:${g.cells[g.cells.length - 1]}` : g.cells[0];
      add({ type: 'hardcode_in_formula', severity: 'medium', sheet: ws.name, cell: range, title: 'Constante dentro de la fórmula', detail: `La fórmula lleva ${g.lits.slice(0, 3).join(', ')} escrito a mano${g.cells.length > 1 ? ` (en ${g.cells.length} celdas)` : ''}. Si es un supuesto, debería estar en la hoja de inputs y referenciarse.`, formula: g.formula });
    }

    // Patrones por fila: formulas inconsistentes y valores a mano entre formulas.
    const rows = new Map();
    for (const ci of grid.values()) {
      if (!rows.has(ci.row)) rows.set(ci.row, []);
      rows.get(ci.row).push(ci);
    }
    for (const [r, cells] of rows) {
      cells.sort((a, b) => a.col - b.col);
      const fcells = cells.filter((c) => c.formula);
      if (fcells.length >= 4) {
        const pat = new Map();
        for (const c of fcells) {
          const p = toR1C1(c.formula, c.row, c.col);
          c._p = p;
          pat.set(p, (pat.get(p) || 0) + 1);
        }
        const [major, majorN] = [...pat.entries()].sort((a, b) => b[1] - a[1])[0];
        if (majorN >= 3 && majorN / fcells.length >= 0.6) {
          for (const c of fcells) {
            if (c._p !== major) {
              const label = rowLabels.get(r);
              add({ type: 'inconsistent_formula', severity: 'medium', sheet: ws.name, cell: c.addr, title: 'Fórmula distinta al resto de la fila', detail: `${label ? `En «${label}», ` : ''}esta celda no sigue el mismo patrón que las demás de la fila. Puede ser intencionado, pero es el error más típico al copiar fórmulas.`, formula: c.formula });
            }
          }
          // Numero a mano rodeado de formulas del patron mayoritario.
          for (const c of cells) {
            if (c.formula || !c.isNumber) continue;
            const left = grid.get(`${r},${c.col - 1}`);
            const right = grid.get(`${r},${c.col + 1}`);
            if (left && right && left._p === major && right._p === major) {
              const label = rowLabels.get(r);
              add({ type: 'hardcode_in_row', severity: 'high', sheet: ws.name, cell: c.addr, title: 'Valor metido a mano en una fila de fórmulas', detail: `${label ? `En «${label}», ` : ''}${c.addr} vale ${fmt(c.value)} escrito a mano mientras sus vecinas son fórmulas. Si los inputs cambian, esta celda no se mueve.` });
            }
          }
        }
      }
      // Filas de check: cualquier valor distinto de cero es una alarma.
      const label = rowLabels.get(r);
      if (label && CHECK_LABEL.test(label)) {
        const bad = cells.filter((c) => c.isNumber && Math.abs(c.value) > 0.5);
        if (bad.length) add({ type: 'check_failed', severity: 'high', sheet: ws.name, cell: bad[0].addr, title: 'El check no cuadra', detail: `La fila «${label}» tiene ${bad.length} valor(es) distintos de cero (p. ej. ${bad[0].addr} = ${fmt(bad[0].value)}). Si es un check de balance o de caja, el modelo no cuadra.` });
      }
    }
  }

  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || a.sheet.localeCompare(b.sheet));
  const hidden = Object.entries(groups).filter(([, n]) => n > MAX_PER_GROUP).map(([k, n]) => {
    const [sheet, type] = k.split('|');
    return { sheet, type, total: n, shown: MAX_PER_GROUP };
  });
  const bySeverity = findings.reduce((m, f) => ((m[f.severity] = (m[f.severity] || 0) + 1), m), {});
  return { stats: { ...stats, by_severity: bySeverity, truncated: hidden }, findings };
}

function fmt(v) {
  if (typeof v !== 'number') return String(v);
  return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('es-ES') : String(Math.round(v * 1000) / 1000);
}

// Resumen sin LLM (respaldo y base del prompt).
export function plainSummary({ stats, findings }) {
  const s = stats.by_severity || {};
  const head = `${stats.sheets} hojas, ${stats.formulas} fórmulas. ${s.high || 0} hallazgos graves, ${s.medium || 0} medios y ${s.low || 0} menores.`;
  const top = findings.filter((f) => f.severity === 'high').slice(0, 5).map((f) => `${f.title} en ${f.sheet}!${f.cell || ''}`);
  return top.length ? `${head} Lo primero: ${top.join('; ')}.` : `${head} No hay errores graves.`;
}
