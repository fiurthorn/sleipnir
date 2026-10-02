/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { PDFDocument } from "pdf-lib";

function parseBase64DataUrl(
  dataUrl: string,
): { format: "png" | "jpeg"; bytes: Uint8Array } {
  const matches = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!matches) {
    // Falls reines Base64 ohne Prefix übergeben wurde, als jpeg interpretieren
    const clean = dataUrl.replace(/\s/g, "");
    const binaryStr = atob(clean);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { format: "jpeg", bytes };
  }

  const mime = matches[1].toLowerCase();
  const format = mime === "png" ? "png" : "jpeg";
  const binaryStr = atob(matches[2]);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return { format, bytes };
}

/**
 * Erstellt aus einer Liste von Base64-Bildern (Seiten) ein mehrseitiges PDF-Dokument.
 * Jede Seite im PDF entspricht genau den Proportionen des gescannten Bildes.
 */
export async function createPdfFromImages(
  imagesBase64: string[],
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const imgData of imagesBase64) {
    if (!imgData) continue;
    const { format, bytes } = parseBase64DataUrl(imgData);

    const embeddedImage = format === "png"
      ? await pdfDoc.embedPng(bytes)
      : await pdfDoc.embedJpg(bytes);

    const { width, height } = embeddedImage.scale(1);
    const page = pdfDoc.addPage([width, height]);
    page.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width,
      height,
    });
  }

  return await pdfDoc.save();
}
