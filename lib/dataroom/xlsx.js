// lib/dataroom/xlsx.js -- lectura de libros Excel con exceljs (formulas + valores cacheados).
// No SheetJS: la version publicada en npm (0.18.5) tiene una vulnerabilidad conocida al abrir
// ficheros manipulados, y aqui se abren Excel subidos por terceros.
import ExcelJS from 'exceljs';

export async function workbookFromBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

// Celda normalizada: { addr, row, col, formula, value, isError, error, isNumber, text }.
export function cellInfo(cell) {
  const v = cell.value;
  let formula = null;
  let value = v;
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('formula' in v || 'sharedFormula' in v) {
      try { formula = cell.formula || v.formula || null; } catch (_) { formula = v.formula || null; }
      value = v.result;
    } else if ('richText' in v) {
      value = (v.richText || []).map((r) => r.text).join('');
    } else if ('text' in v && 'hyperlink' in v) {
      value = v.text;
    } else if ('error' in v) {
      value = v;
    }
  }
  const err = value && typeof value === 'object' && 'error' in value ? value.error : null;
  return {
    addr: cell.address,
    row: Number(cell.row),
    col: Number(cell.col),
    formula: formula ? String(formula).replace(/^=/, '') : null,
    value: err ? null : value,
    isError: !!err,
    error: err,
    isNumber: typeof value === 'number' && isFinite(value),
    text: value == null ? '' : value instanceof Date ? value.toISOString().slice(0, 10) : String(value),
  };
}

export function eachCell(ws, fn) {
  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Merge) return;
      fn(cellInfo(cell));
    });
  });
}

// Texto legible de la hoja para el chat: una linea por fila, etiquetas y cifras.
export function sheetText(ws, maxRows = 400, maxCols = 30) {
  const lines = [];
  ws.eachRow({ includeEmpty: false }, (row, r) => {
    if (lines.length >= maxRows) return;
    const parts = [];
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      if (c > maxCols) return;
      const ci = cellInfo(cell);
      if (ci.isError) parts.push(ci.error);
      else if (ci.isNumber) parts.push(Number.isInteger(ci.value) && ci.value >= 1900 && ci.value <= 2100 ? String(ci.value) : Math.abs(ci.value) >= 1000 ? Math.round(ci.value).toLocaleString('en-US') : String(Math.round(ci.value * 1000) / 1000));
      else if (ci.text) parts.push(ci.text.slice(0, 80));
    });
    if (parts.length) lines.push(`F${r}: ${parts.join(' | ')}`);
  });
  return lines.join('\n');
}

export const colLetter = (n) => {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
};
