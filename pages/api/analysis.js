// pages/api/analysis.js
// DESACTIVADO a proposito. No genera comentario editorial.
//
// La version anterior le pasaba a un LLM SOLO el titular, el comprador, el objetivo,
// el valor y el resumen, y le pedia "la lectura financiera y estructural (valoracion,
// apalancamiento, prima, financiacion)". El modelo no tenia ninguno de esos datos,
// asi que se los inventaba: multiplos de EBITDA, tramos de deuda, primas. Publicado
// como analisis de un medio financiero, con el nombre de un periodico real encima.
//
// Meridian no tiene mesa editorial. Mientras no la tenga, no publica analisis.
// Cuando haya comentario escrito por una persona, se guarda en deals.analysis
// y se renderiza desde ahi. Este endpoint NO vuelve a generar nada.

export default function handler(req, res) {
  return res.status(200).json({ analysis: '', disabled: true });
}
