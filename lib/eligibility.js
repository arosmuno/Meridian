// lib/eligibility.js -- que fila cuenta para las league tables (ver /methodology).
//
// Misma regla en dos sitios: el cron la usa para dejar excluded_reason al guardar, y
// /rankings la vuelve a aplicar al leer, asi un error de clasificacion antiguo no se
// cuela en las tablas aunque la fila siga en la base.

const isNA = (s) => !s || /^\s*n\/?a\s*$/i.test(String(s)) || /unspecified|unknown|potential|interested/i.test(String(s));

// Tiene que haber un verbo de transaccion en el titular.
const TXN = /(acquir|acquisition|\bbuys?\b|\bbought\b|takeover|merger|\bmerges?\b|\bsells?\b|\bsold\b|sale of|\bstake\b|buyout|take[- ]private|\bipo\b|listing|debut|\braises?\b|\braised\b|funding round|\bround\b|refinanc|\bbonds?\b|\bnotes\b|\bloans?\b|facility|financing|\bissue|placement|rights issue|joint venture|\bjv\b|spin-?off|carve-?out|disposal|divest|concurso|chapter 11|restructur|tender offer|completes|closes|agrees? to|deal for|to purchase|purchase of|offer for)/i;

// Rumores, pasos intermedios y cosas que no son una operacion.
const RUMOUR = /\b(weighs|considers|explores|exploring|eyes|in talks|nears|seeks|mulls|could|may|plans? to|aims|preparing|prepares|hires|appoints|reportedly|bid for|rejects|pauses|faces|proposes|backs)\b/i;
const NOT_TXN = /(\bhow\b|\bwhy\b|unravel|approv|safeguard|settlement|co-ceo|initiative|leases? total|disclos|\bseize|jet sale|clients|nearing|record international|revenue|turnover|\bsales\b|profit|dividend|buyback|buy-back|repurchase|shareholders|stadium|contract|awarded|\bgrants?\b(?! thornton)|donat|remuneration|court|ruling|awards against|\bfines?\b|treasury|\bbills\b|redemption|redeem|commercial venture|into stocks|computing capacity|programme|to build|to manage|to invest|investment plan|disburse|advises|demand for|greenlight|\bclears?\b|assets surge|underwriting|builds .{0,20}stake|amidst|crypto|aircraft|to raise|tourism|in-house bank|short-term debt|debt at highest|continues|highway project|motorway|increases (?:its )?stake|\bloses\b|raises (?:its )?stake|rises to \d+%|(?:closes|launches|raises) (?:its )?(?:first |new |second |third )?fund\b|first fund)/i;
const VALUATION = /valuation|valued at/i;

export function ineligibleReason(d) {
  const er = editorialReject(d);
  if (er) return er;
  const h = String(d.headline || '');
  const t = d.type;
  if ((t === 'M&A' || t === 'LBO') && (isNA(d.buyer) || isNA(d.target))) return 'M&A/LBO with no identified acquirer or target';
  if (/rumou?r/i.test(String(d.status || '')) || RUMOUR.test(h)) return 'Rumoured or exploratory, not an announced transaction';
  if (!TXN.test(h) || NOT_TXN.test(h)) return 'Not a transaction';
  if (VALUATION.test(h) && (isNA(d.buyer) || /stake|minority|buys into|invests? in/i.test(h))) return 'Valuation, not a transaction size';
  // Compras de participaciones sin importe en el titular: el valor suele ser la valoracion de la empresa.
  if (/\bstake\b/i.test(h) && !/\d/.test(h)) return 'Valuation, not a transaction size';
  return null;
}

// ── FILTRO EDITORIAL ─────────────────────────────────────────────────────────
// Lo que no se publica en absoluto (ni en Deals ni en Markets). Se aplica al guardar
// (cron) y al servir (API, Weekly, rankings), asi que tambien limpia filas antiguas.
// El modelo pasa estas noticias porque llevan un verbo de operacion ("Kremlin takeover",
// "to buy military supplies"); aqui se cortan por lo que realmente cuentan.
const NOT_NEWS_FOR_US = [
  [/\b(?:reports?|posts?)\b.{0,40}\b(?:results|revenues?|sales|earnings|profits?)\b|\b(?:earns|net (?:profit|income) of)\b.{0,30}\b(?:billion|bn|million|mn)\b|\b[1-4]Q\d{2}\b|\bQ[1-4] (?:results|20\d\d)\b|\brevenue of\b|\bsales target\b/i, 'Results or trading update'],
  [/\b(?:takes?|booked?|records?) (?:a )?.{0,25}\b(?:hit|charge|write-?(?:down|off)|impairment)\b|\bremoves? .{0,40}from (?:its )?accounts\b|\bwrites? (?:down|off)\b/i, 'Accounting charge'],
  [/\b(?:military|weapons|ammunition|munitions|arms) (?:supplies|aid|purchases?|package)\b|\bvia nato\b/i, 'Defence procurement'],
  [/\b(?:credit|junk|investment[- ]grade) rating\b|\brating (?:upgrade|downgrade|action)\b|\b(?:upgraded|downgraded) (?:to|by)\b/i, 'Credit rating'],
  [/\bdefault risk\b|\bfaces? default\b|\bauditor (?:flags|warns|raises)\b|\bloan conditions? breached\b/i, 'Credit warning, not a process'],
  [/\b(?:supreme|high|national) court\b|\bcourt orders?\b|\bordered to repay\b|\b(?:merger|legal|contract|court|shareholder) dispute\b|\bsues?\b|\blawsuit\b|\bheading to court\b/i, 'Litigation'],
  [/\bsubsid(?:y|ies|ised|ized)\b|\b(?:eu|state|government|public) (?:grant|funding|aid|backing)\b|\binnovation fund\b|\bbrussels funds?\b|\bgrants?\b(?! thornton)/i, 'Public grant or subsidy'],
  [/\b(?:computing|compute) (?:power|capacity|deal|contract)\b|\b(?:train|fleet|aircraft|vessel) (?:order|contract)\b|\bfleet contract\b|\bsupply (?:deal|contract|agreement)\b/i, 'Commercial contract'],
  [/\bfaces? (?:eu |ec |cma |sec |antitrust )?charges\b|\b(?:opens?|launch(?:es|ed)?) (?:formal )?proceedings\b|\bmerger inquiry\b|\bantitrust (?:charges|probe|investigation)\b|\bmisleading information\b/i, 'Regulatory proceedings on an existing deal'],
  [/\bhalts?\b|\bhits? (?:a )?snag\b|\bsetback\b|\bto approve (?:the )?development\b|\b(?:begins?|starts?|announces?) (?:the )?(?:manufacturing|production)\b|\bmanufacturing of\b|\bto relocate\b|\bexpand(?:s)? (?:its )?(?:\w+ )?(?:factory|plant)\b|\bnew (?:factory|plant)\b/i, 'Operational or capex news'],
  [/\b(?:appoints?|names?|hires?) .{0,30}\b(?:ceo|chair(?:man|woman)?|cfo|president|director)\b|\bas chair(?:man)?\b/i, 'Appointment'],
  [/\bunite to challenge\b|\bform (?:a )?united front\b/i, 'Industry alliance'],
];

const NON_EUROPE = /^(north america|asia pacific|asia|latin america|middle east|africa|middle east & africa|americas)$/i;
const EUROPEAN_PARTY = /\b(europ\w*|spain|spanish|portug\w*|france|french|german\w*|brit\w*|uk\b|u\.k\.|england|scot\w*|irish|ireland|ital\w*|dutch|netherlands|belgi\w*|swiss|switzerland|swed\w*|norw\w*|danish|denmark|finn\w*|austria\w*|polish|poland|nordic|luxembourg|london|paris|madrid|barcelona|lisbon|frankfurt|milan|amsterdam|santander|bbva|caixabank|iberdrola|telef[oó]nica|inditex|repsol|naturgy|ferrovial|acs|acciona|volkswagen|siemens|eqt|cvc|permira|cinven|bc partners|pai partners|ardian|eurazeo|a&g|hr path|sophos|beretta|amancio ortega|pontegadea|inditex|zara|softbank europe)\b/i;
const toMillionsEur = (d) => {
  if (Number(d.value_eur) > 0) return Number(d.value_eur);
  const v = Number(d.value) || 0;
  return d.currency === 'GBP' ? v * 1.15 : d.currency === 'USD' ? v * 0.87 : v;
};

export function editorialReject(d) {
  const h = String(d.headline || '');
  const isFinancingOrDeal = /\b(?:loans?|financing|refinanc\w*|bonds?|notes|acquir\w*|takeover|buys?|sells?|sale of)\b/i.test(h);
  for (const [re, why] of NOT_NEWS_FOR_US) {
    if (why === 'Results or trading update' && isFinancingOrDeal && !/sales target/i.test(h)) continue;
    if (re.test(h)) return why;
  }
  // Meridian es europeo con foco en Iberia: fuera de Europa, solo operaciones de 1bn o mas,
  // o con una parte europea. Sin importe y sin parte europea, tampoco.
  const text = `${h} ${d.buyer || ''} ${d.target || ''} ${d.summary || ''}`;
  const size = Math.max(toMillionsEur(d), toMillionsEur({ value: valueFromHeadline(h), currency: d.currency }));
  const bigByWords = /(?:\bbillion|\btrillion|\d\s?bn|\d\s?tn)\b/i.test(h);
  if (NON_EUROPE.test(String(d.geography || '').trim()) && d.is_iberian !== true && d.iberian !== true
      && size < 1000 && !bigByWords && !EUROPEAN_PARTY.test(text)) return 'Outside coverage (non-European, under 1bn)';
  return null;
}

// Sector: el modelo usa "General" como cajon de sastre. Clubes y deporte van a Consumer.
const SPORTS = /\b(?:football|soccer|basketball|baloncesto|f[uú]tbol|club|cf|fc|sad|la liga|laliga|premier league|serie a|bundesliga|stadium|camp nou|real madrid|atl[eé]tico|valencia cf|bayern|joventut|barça|barcelona fc|fc barcelona)\b/i;
export function fixSector(d) {
  if (d.sector && d.sector !== 'General') return d.sector;
  const text = `${d.headline || ''} ${d.target || ''}`;
  if (SPORTS.test(text)) return 'Consumer';
  if (/\b(?:defen[cs]e|aerospace|drones?|industrial|manufactur\w*)\b/i.test(text)) return 'Industrials';
  if (/\b(?:software|cloud|data cent(?:re|er)s?|telecom\w*|media|ai\b|tech\w*)\b/i.test(text)) return 'TMT';
  return d.sector || 'General';
}

// Importe: si el modelo dejo 0 pero el titular trae UNA sola cifra y no es una valoracion,
// ingresos o cargo contable, esa cifra es el tamano de la operacion.
const NOT_DEAL_SIZE = /valuation|valued|fees?\b|mobili[sz]e|programme|program\b|revenue|turnover|sales|hit|loss|profit|market cap|worth|entity|aum|fund size|to exceed|aims|by 20\d\d|\d+%/i;
export function valueFromHeadline(headline) {
  const h = String(headline || '');
  if (NOT_DEAL_SIZE.test(h)) return 0;
  const re = /(?:US\$|\$|€|£)\s?(\d+(?:[.,]\d+)?)\s*(billion|bn|million|mn|m\b)|(\d+(?:[.,]\d+)?)\s*(billion|bn|million|mn|m\b)\s*(?:euros?|dollars?|pounds?)?/gi;
  const found = [];
  let m;
  while ((m = re.exec(h))) {
    const n = parseFloat((m[1] || m[3]).replace(',', '.'));
    const unit = (m[2] || m[4]).toLowerCase();
    if (isFinite(n)) found.push(/^b/.test(unit) ? n * 1000 : n);
  }
  return found.length === 1 ? found[0] : 0;
}

// Colapsa repeticiones de la misma operacion que dedupeDeals no ve porque el modelo
// escribio el objetivo de dos formas ("Warner Bros." / "Warner Bros Discovery") o el
// importe en dos monedas: mismo comprador o mismo objetivo (prefijo) e importe en euros
// a menos de un 20%.
const sig = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
function firstWord(x) {
  if (isNA(x)) return '';
  const w = String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[a-z0-9]+/);
  return w && w[0].length >= 3 && !/^(the|grupo|group|fondo|fund|spanish|german|french|italian|british|uk|us|european|former|new|stake|portfolio|its|majority|minority|residential|office|hotel|shopping|data|solar|wind)$/.test(w[0]) ? w[0] : '';
}
export function collapseSameDeal(rows) {
  const kept = [];
  for (const d of rows) {
    const b = sig(d.buyer).slice(0, 8);
    const t = sig(d.target).slice(0, 8);
    const v = Number(d.value_eur) || 0;
    const fb = firstWord(d.buyer), ft = firstWord(d.target);
    const dup = kept.some((k) => {
      // Mismo comprador y mismo objetivo por su primera palabra ("GTCR, Elliott" / "GTCR and
      // Elliott"; "CCC" / "CCC Intelligent Solutions"): es la misma operacion aunque las
      // cifras difieran (una fuente da el equity value y otra el EV).
      if (fb && ft && fb === firstWord(k.buyer) && ft === firstWord(k.target)) return true;
      const kv = Number(k.value_eur) || 0;
      const close = v > 0 && kv > 0 && Math.abs(kv - v) <= 0.2 * Math.max(kv, v);
      const sameT = t.length >= 4 && sig(k.target).slice(0, 8) === t;
      const sameB = b.length >= 4 && sig(k.buyer).slice(0, 8) === b;
      const near = v > 0 && kv > 0 && Math.abs(kv - v) <= 0.03 * Math.max(kv, v);
      return (near && sameB) || close && (sameT || (sameB && sameT) || (sameB && !isNA(d.target) && sig(k.target).includes(t.slice(0, 5))));
    });
    if (!dup) kept.push(d);
  }
  return kept;
}

// Noticias de mercado que si interesan a un lector de M&A / financiacion: tipos, credito,
// mercados de deuda, actividad de M&A y private equity. Lo demas (clima, IA, guerras de
// precios, regulacion general, resultados) no entra en la seccion Markets.
const MACRO_OK = /\b(yields?|bonds?|gilts?|bunds?|treasur(?:y|ies)|spreads?|interest rates?|rates? (?:cut|hike|rise|decision)|inflation|ECB|Fed\b|Federal Reserve|central bank|Bank of England|BoE|credit|lending|lenders?|loans?|debt|defaults?|CDS|refinanc\w*|private (?:credit|equity|markets)|buyouts?|M&A|deal ?making|IPOs?|listings?|issuance|capital markets|risk premium|borrowing|fundrais\w*|liquidity|leverage[d]?|real estate investment|investment (?:volume|record)|insolvenc\w*|restructuring)\b/i;
export function isRelevantMacro(headline) {
  return MACRO_OK.test(String(headline || ''));
}

// Titular en espanol (el diario es en ingles; los que se cuelan se traducen en el cron).
export function looksSpanish(h) {
  const s = String(h || '');
  return /[ñ¿¡]/.test(s) || /\b(del|los|las|una|por|para|con|millones|adquiere|compra|vende|deuda|cr[eé]dito|pr[eé]stamo|fusi[oó]n|ampliaci[oó]n|accionista|espa[nñ]ola?|empresa|negocio|bolsa|beneficio|salida|puja|retrasa|frena|tropieza|prepara|lanza|financia|proyectos?|verdes?|sobrecoste)\b/i.test(s);
}
