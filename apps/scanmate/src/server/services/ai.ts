/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { z } from "zod";
import { loadProviderConfig } from "./config.ts";

export const aiExtractionSchema = z.object({
  title: z.string().default("Dokument"),
  category: z.string().default("Sonstiges"),
  date: z.string().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  totalAmount: z.number().optional(),
  currency: z.string().default("EUR"),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).default([]),
  summary: z.string().default(""),
  ocrText: z.string().default(""),
});

export type AiExtractionResult = z.infer<typeof aiExtractionSchema>;

export interface ModelOption {
  id: string; // provider:modelId
  name: string;
  provider: string;
}

export function getAvailableVisionModels(): ModelOption[] {
  const providers = loadProviderConfig();
  const models: ModelOption[] = [];

  for (const p of providers) {
    if (!p.apiKey) continue;
    for (const m of p.visionModels) {
      models.push({
        id: `${p.id}:${m.id}`,
        name: `${p.name} - ${m.name}`,
        provider: p.id,
      });
    }
  }

  return models;
}

function parseJsonSafe<T = unknown>(rawText: string): T {
  let clean = rawText.trim();
  if (clean.startsWith("```")) {
    clean = clean
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }
  const firstBrace = clean.indexOf("{");
  const lastBrace = clean.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  return JSON.parse(clean) as T;
}

export async function extractDocumentMetadataWithAi(
  imagesBase64: string[],
  selectedModel?: string,
): Promise<AiExtractionResult> {
  const providers = loadProviderConfig();

  let targetProvider = providers.find((p) => p.visionModels.length > 0 && p.apiKey);
  let targetModel = targetProvider?.visionModels[0]?.id ??
    "google/gemini-2.5-flash";

  if (selectedModel && selectedModel.includes(":")) {
    const [pId, ...mParts] = selectedModel.split(":");
    const foundP = providers.find((p) => p.id === pId && p.apiKey);
    if (foundP) {
      targetProvider = foundP;
      targetModel = mParts.join(":");
    }
  }

  if (!targetProvider || !targetProvider.apiKey) {
    throw new Error(
      "Kein KI-Provider mit Vision-Unterstützung und konfiguriertem API-Key gefunden.",
    );
  }

  const systemPrompt = `Du bist ein hochpräziser Dokumenten-Scanner- und OCR-Assistent.
Analysiere die übergebenen Seiten eines Dokuments (Brief, Rechnung, Bescheid, Quittung, Vertrag, etc.) gründlich.
Extrahiere die Metadaten und gib AUSSCHLIESSLICH ein valides JSON-Objekt mit folgender Struktur zurück:

{
  "title": "Prägnanter Titel, z. B. 'Nebenkostenabrechnung 2025' oder 'Steuerbescheid'",
  "category": "Kategorie wie: 'Brief', 'Rechnung', 'Quittung', 'Behörde', 'Versicherung', 'Vertrag', 'Bank', 'Rezept', oder 'Sonstiges'",
  "date": "Datum des Dokuments im ISO-Format YYYY-MM-DD (falls erkennbar, sonst null)",
  "sender": "Absender, Unternehmen, Behörde oder Aussteller (z. B. 'Finanzamt Dortmund', 'Telekom')",
  "recipient": "Empfänger des Dokuments, falls angegeben",
  "totalAmount": 123.45 (falls es eine Rechnung/Quittung/Zahlungsaufforderung ist, als Fließkommazahl mit Punkt, sonst null),
  "currency": "EUR",
  "dueDate": "Fälligkeits- oder Zahlungsziel im Format YYYY-MM-DD (falls angegeben, sonst null)",
  "tags": ["Rechnung", "Telekom", "Internet", "2026"],
  "summary": "2 bis 4 prägnante Sätze auf Deutsch, die den wesentlichen Inhalt, Zweck und eventuelle Handlungsanweisungen des Dokuments zusammenfassen.",
  "ocrText": "Vollständiger oder wesentlicher transkribierter Text des Dokuments geordnet nach Seiten."
}

Gib keinen Markdown-Codeblock und keine Einleitung oder Erklärung aus, nur das reine JSON.`;

  // Baue multimodale Nachrichten auf
  const imageContents = imagesBase64.map((img) => ({
    type: "image_url",
    image_url: {
      url: img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`,
    },
  }));

  const endpoint = `${targetProvider.baseUrl}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${targetProvider.apiKey}`,
      "HTTP-Referer": "https://sleipnir.local",
      "X-Title": "Sleipnir Scanmate",
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Bitte analysiere diese ${imagesBase64.length} Seite(n) des Dokuments und extrahiere die Daten als JSON.`,
            },
            ...imageContents,
          ],
        },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `KI-Analyse fehlgeschlagen (${response.status}): ${errorText}`,
    );
  }

  const result = await response.json();
  const rawText = result.choices?.[0]?.message?.content ?? "{}";
  const parsedJson = parseJsonSafe(rawText);

  return aiExtractionSchema.parse(parsedJson);
}
