// lib/academy.js -- catalogo de Meridian Academy.
//
// Cada producto se vende fuera (Gumroad / Whop / Cal.com) para no programar pagos.
// Mientras `url` este vacio, la tarjeta muestra "Join the waitlist" y apunta el
// email en `subscribers` con el interes correspondiente. Cuando el producto
// exista, basta con pegar aqui su enlace.

export const PRODUCTS = [
  {
    id: 'pf-model',
    group: 'Templates',
    name: 'Renewables Project Finance Model',
    price: '€49',
    blurb: 'Solar / wind PF model: construction and operations periods, debt sizing on target DSCR, sculpted repayment, DSRA, distribution lock-up and equity IRR. Clean layout, no hard-codes.',
    bullets: ['Debt sizing on P50 / P90 DSCR', 'Sculpted repayment + DSRA', 'Sensitivities and scenario selector'],
    url: '',
  },
  {
    id: 'lbo-model',
    group: 'Templates',
    name: 'LBO Model',
    price: '€39',
    blurb: 'Sponsor-style LBO: sources and uses, senior / TLB / RCF debt schedule with cash sweep, covenant tests and returns (IRR, MoM) across entry and exit multiples.',
    bullets: ['Multi-tranche debt with cash sweep', 'Leverage and ICR covenant tests', 'Returns grid by entry / exit multiple'],
    url: '',
  },
  {
    id: 'dcf-model',
    group: 'Templates',
    name: 'DCF & Trading Comps',
    price: '€29',
    blurb: 'Fully linked DCF with WACC build-up, terminal value by perpetuity and exit multiple, plus a comps sheet feeding a football-field summary.',
    bullets: ['WACC build-up', 'Two terminal value methods', 'Football field output'],
    url: '',
  },
  {
    id: 'bundle',
    group: 'Templates',
    name: 'Full Modelling Bundle',
    price: '€89',
    blurb: 'The three models above plus every future update.',
    bullets: ['PF + LBO + DCF', 'Free future updates'],
    url: '',
    featured: true,
  },
  {
    id: 'guide',
    group: 'Guide',
    name: 'Breaking into M&A, LevFin & Project Finance in Spain',
    price: '€19',
    blurb: 'A practical guide for students and junior profiles: how the Madrid market is organised, which teams hire and when, the technical questions that actually come up, modelling tests and how to frame your CV.',
    bullets: ['Who hires in Madrid and when', 'Technical questions with model answers', 'Modelling-test walkthrough and CV framing'],
    url: '',
  },
  {
    id: 'cv-review',
    group: 'Coaching',
    name: 'CV Review',
    price: '€60',
    blurb: 'Line-by-line review of your CV for IB, LevFin, PF and infrastructure roles, with written feedback within 72 hours.',
    bullets: ['Written mark-up', 'Deal-list framing', 'One revision round'],
    url: '',
  },
  {
    id: 'mock-interview',
    group: 'Coaching',
    name: 'Mock Interview (60 min)',
    price: '€90',
    blurb: 'A live technical and fit interview in English or Spanish, followed by direct feedback on what to fix before the real one.',
    bullets: ['Technicals: valuation, LBO, PF, debt', 'Fit and deal discussion', 'Written feedback after the call'],
    url: '',
  },
];

export const GROUPS = ['Templates', 'Guide', 'Coaching'];

export const GROUP_META = {
  Templates: { accent: '#d4a853', tag: 'Build faster', desc: 'Excel models built the way they are built on the desk. Formula-driven, readable and ready to adapt to your own case.' },
  Guide: { accent: '#4a9eff', tag: 'Get the map', desc: 'Everything you need to understand the Spanish market and prepare a credible application, in one place.' },
  Coaching: { accent: '#a78bfa', tag: 'One to one', desc: 'Limited slots each month. Practical, honest feedback from someone who has been through the processes.' },
};
