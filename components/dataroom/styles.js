// Estilos compartidos del dataroom (misma paleta que la portada del dataroom).
export const serif = "Georgia, 'Times New Roman', serif";
export const ui = "ui-sans-serif, system-ui, -apple-system, sans-serif";
export const C = { ink: '#1c1916', mid: '#736c61', lo: '#a59d8f', line: '#e2ddd0', line2: '#d8d2c4', paper: '#f3f0e8', card: '#fff', soft: '#faf8f3', gold: '#9a7d1e', red: '#a3341f', green: '#1a7a3a', amber: '#b7791f' };
export const S = {
  page: { minHeight: '100vh', background: C.paper, color: C.ink, fontFamily: ui },
  top: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', borderBottom: `1px solid ${C.line}`, background: '#fffdf9' },
  brand: { fontFamily: serif, fontSize: 20, fontWeight: 700 },
  brandSub: { fontSize: 11, letterSpacing: '.3em', color: C.gold, fontWeight: 700 },
  ghost: { padding: '6px 12px', border: `1px solid ${C.line2}`, borderRadius: 8, textDecoration: 'none', color: C.ink, fontSize: 13, background: 'transparent', cursor: 'pointer' },
  wrap: { maxWidth: 1240, margin: '0 auto', padding: '22px 28px 60px' },
  kind: { fontSize: 11, fontWeight: 800, letterSpacing: '.14em', color: C.gold },
  title: { fontFamily: serif, fontSize: 30, fontWeight: 700, margin: '4px 0 0' },
  tabs: { display: 'flex', gap: 4, borderBottom: `1px solid ${C.line}`, margin: '18px 0 18px', flexWrap: 'wrap' },
  tab: { padding: '10px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: C.mid, borderBottom: '2px solid transparent', marginBottom: -1 },
  tabOn: { padding: '10px 14px', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: C.ink, fontWeight: 700, borderBottom: `2px solid ${C.ink}`, marginBottom: -1 },
  card: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18 },
  cardHead: { fontFamily: serif, fontSize: 17, fontWeight: 700, marginBottom: 12 },
  input: { padding: '9px 11px', border: `1px solid ${C.line2}`, borderRadius: 8, fontSize: 14, background: '#fff', color: C.ink, outline: 'none', fontFamily: ui },
  btn: { padding: '9px 16px', background: C.ink, color: '#fff', border: 0, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  btnGhost: { padding: '8px 12px', background: 'transparent', color: C.ink, border: `1px solid ${C.line2}`, borderRadius: 8, cursor: 'pointer', fontSize: 13 },
  icon: { flexShrink: 0, minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8, border: `1px solid ${C.line2}`, background: '#fff', cursor: 'pointer', fontSize: 13 },
  empty: { color: C.lo, fontSize: 13, padding: '10px 2px' },
  hint: { fontSize: 12, color: C.lo, marginTop: 6, lineHeight: 1.5 },
  err: { color: C.red, fontSize: 13, margin: '8px 0' },
  tag: { fontSize: 10, fontWeight: 800, letterSpacing: '.06em', padding: '2px 7px', borderRadius: 999, border: `1px solid ${C.line}`, background: C.soft, color: C.mid, textTransform: 'uppercase' },
  row: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: C.soft, borderRadius: 8 },
};
export const sevColor = { high: C.red, medium: C.amber, low: C.mid, info: C.lo };
export const sevLabel = { high: 'Grave', medium: 'Medio', low: 'Menor', info: 'Info' };
