import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANG_INSTRUCTIONS = {
  es: 'European Spanish (Spain) — use Castilian Spanish, NOT Latin American Spanish. Use "vosotros" forms where appropriate, Spain-specific financial vocabulary (e.g. "operación" not "negocio", "adquisición", "fusión", "consejo de administración").',
  fr: 'French — use standard French financial terminology.',
  de: 'German — use standard German financial terminology.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, lang } = req.body;
  if (!text || !lang) return res.status(400).json({ error: 'Missing text or lang' });

  const langInstruction = LANG_INSTRUCTIONS[lang];
  if (!langInstruction) return res.status(400).json({ error: 'Invalid language' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Translate the following financial text to ${langInstruction}

Keep all company names, proper nouns, financial figures (€/$), percentages and deal values exactly as they are. Only translate the surrounding text. Return ONLY the translation, no explanation, no preamble:\n\n${text}`,
      }],
    });

    const translated = message.content[0]?.text || text;
    return res.status(200).json({ translated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
