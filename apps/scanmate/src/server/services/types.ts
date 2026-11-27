/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { z } from "zod";

export const documentMetadataSchema = z.object({
  id: z.string().min(1),
  title: z.string().default("Unbenanntes Dokument"),
  category: z.string().default("Sonstiges"), // z.B. Brief, Rechnung, Quittung, Vertrag, Behörde, Rezept
  date: z.string().optional(), // Beleg-/Briefdatum YYYY-MM-DD
  createdAt: z.string(), // ISO-String des Scans
  sender: z.string().optional(), // Aussteller / Absender / Behörde / Firma
  recipient: z.string().optional(), // Empfänger
  totalAmount: z.number().optional(), // Betrag falls Rechnung / Quittung
  currency: z.string().default("EUR"),
  dueDate: z.string().optional(), // Fälligkeitsdatum
  tags: z.array(z.string()).default([]),
  summary: z.string().default(""), // Kompakte Inhalts-Zusammenfassung
  ocrText: z.string().default(""), // Volltext-Transkript
  pageCount: z.number().int().positive().default(1),
  targetPath: z.string().default(""), // Relativer Unterordner z.B. "Rechnungen/2026"
  fileNamePdf: z.string(), // z.B. 2026-09-30_Finanzamt_Bescheid.pdf
  fileNameYaml: z.string().optional(), // z.B. 2026-09-30_Finanzamt_Bescheid.yaml
  fileNameJson: z.string().optional(), // Legacy-Sidecar .json (Abwärtskompatibilität)
  reviewed: z.boolean().optional(), // false = vom Agent archiviert, noch zu prüfen
});

export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

export interface ScanPage {
  id: string;
  dataUrl: string; // Base64 data url des optimierten Bildes
  rotation: number; // 0, 90, 180, 270
}

export interface SaveDocumentPayload {
  title?: string;
  category?: string;
  date?: string;
  sender?: string;
  recipient?: string;
  totalAmount?: number;
  dueDate?: string;
  tags?: string[];
  summary?: string;
  ocrText?: string;
  targetPath?: string; // Optionaler Zielordner
  reviewed?: boolean; // Optional: false für Agent-Ablage ("Zu prüfen")
  pages?: string[]; // Base64 Data URLs (PNG oder JPEG)
  pdfBytes?: Uint8Array; // Optional: direktes Original-PDF (z. B. aus E-Mail-Anhang)
  pageCount?: number; // Optional: Seitenanzahl bei direktem PDF
}
