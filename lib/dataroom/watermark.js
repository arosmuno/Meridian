// lib/dataroom/watermark.js -- marca de agua en cada pagina de un PDF (vista y descarga).
// Diagonal suave con el email del usuario y la fecha, mas una linea al pie: si el documento
// circula fuera de la sala, se sabe de que cuenta salio.
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

// Las fuentes estandar de PDF solo cubren WinAnsi: se quitan caracteres fuera de ese juego.
const latin = (s) => String(s || '').normalize('NFC').replace(/[\u2012-\u2015]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^\x20-\x7E -ÿ]/g, '?');

export async function stampPdf(buffer, { email, roomName, when = new Date() }) {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const stamp = latin(`${email} · ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  const footer = latin(`Confidencial · ${roomName || 'Meridian Dataroom'} · descargado por ${email} el ${when.toISOString().slice(0, 10)}`);
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    const size = Math.max(14, Math.min(28, width / 26));
    const textWidth = font.widthOfTextAtSize(stamp, size);
    const angle = Math.atan2(height, width);
    page.drawText(stamp, {
      x: width / 2 - (Math.cos(angle) * textWidth) / 2,
      y: height / 2 - (Math.sin(angle) * textWidth) / 2,
      size, font, color: rgb(0.55, 0.55, 0.55), opacity: 0.18, rotate: degrees((angle * 180) / Math.PI),
    });
    page.drawText(footer, { x: 24, y: 12, size: 7, font, color: rgb(0.45, 0.45, 0.45), opacity: 0.7 });
  }
  return Buffer.from(await pdf.save());
}
