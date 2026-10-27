// Markdown minimo para las respuestas del analista: parrafos, **negrita**, listas, tablas y
// citas [n] clicables. Sin HTML crudo: todo se construye como elementos de React.
import { C } from './styles';

function inline(text, onCite, keyBase) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|\[\d+\](?:\s*\[\d+\])*|`[^`]+`)/g;
  let last = 0;
  let m;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={keyBase + '-' + k++}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={keyBase + '-' + k++} style={{ background: '#efe9dc', padding: '0 4px', borderRadius: 4, fontSize: '0.92em' }}>{tok.slice(1, -1)}</code>);
    else {
      const nums = (tok.match(/\d+/g) || []).map(Number);
      nums.forEach((n) => out.push(
        <sup key={keyBase + '-' + k++} onClick={() => onCite && onCite(n)} style={{ color: C.gold, fontWeight: 700, cursor: onCite ? 'pointer' : 'default', fontSize: 11, padding: '0 1px' }}>[{n}]</sup>,
      ));
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const isRow = (l) => /^\s*\|.*\|\s*$/.test(l);
const isSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export default function Markdown({ text, onCite }) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) { blocks.push({ t: 'hr' }); i++; continue; }
    if (isRow(l) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = cells(l);
      const rows = [];
      i += 2;
      while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordered = /^\s*\d+[.)]/.test(l);
      const items = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) {
        items.push({ text: lines[i].replace(/^\s*([-*•]|\d+[.)])\s+/, ''), sub: /^\s{2,}/.test(lines[i]) });
        i++;
      }
      blocks.push({ t: ordered ? 'ol' : 'ul', items });
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isRow(lines[i]) && !/^\s*([-*•]|\d+[.)])\s+/.test(lines[i]) && !/^\s*([-*_])\1{2,}\s*$/.test(lines[i])) {
      para.push(lines[i].replace(/^#+\s*/, ''));
      i++;
    }
    blocks.push({ t: 'p', text: para.join('\n') });
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {blocks.map((b, bi) => {
        if (b.t === 'hr') return <hr key={bi} style={{ border: 0, borderTop: `1px solid ${C.line}`, margin: '4px 0' }} />;
        if (b.t === 'p') return <p key={bi} style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{inline(b.text, onCite, bi)}</p>;
        if (b.t === 'ul' || b.t === 'ol') {
          const Tag = b.t;
          return (
            <Tag key={bi} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 3 }}>
              {b.items.map((it, ii) => <li key={ii} style={it.sub ? { marginLeft: 16 } : null}>{inline(it.text, onCite, `${bi}-${ii}`)}</li>)}
            </Tag>
          );
        }
        return (
          <div key={bi} style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '60%' }}>
              <thead><tr>{b.head.map((h, hi) => <th key={hi} style={th}>{inline(h, onCite, `${bi}-h${hi}`)}</th>)}</tr></thead>
              <tbody>{b.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci} style={{ ...td, textAlign: ci > 0 && /^[-(]?[\d.,%€$x ]+\)?$/.test(c.replace(/\[\d+\]/g, '').trim()) ? 'right' : 'left' }}>{inline(c, onCite, `${bi}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
const th = { textAlign: 'left', padding: '6px 10px', borderBottom: `2px solid ${C.line2}`, fontWeight: 700, whiteSpace: 'nowrap' };
const td = { padding: '5px 10px', borderBottom: `1px solid ${C.line}`, verticalAlign: 'top' };
