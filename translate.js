import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANG_NAMES = {
  es: 'Spanish',
  fr: 'French',
  de: 'German',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { text, lang } = req.body;
  if (!text || !lang) return res.status(400).json({ error: 'Missing text or lang' });

  const langName = LANG_NAMES[lang];
  if (!langName) return res.status(400).json({ error: 'Invalid language' });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Translate the following financial text to ${langName}. Maintain professional financial terminology. Return ONLY the translation, no explanation:\n\n${text}`,
      }],
    });

    const translated = message.content[0]?.text || text;
    return res.status(200).json({ translated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
