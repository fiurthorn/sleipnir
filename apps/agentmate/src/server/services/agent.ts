/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output, stepCountIs } from "ai";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";
import { loadAgentConfig, type ResolvedAgentProvider } from "./config.ts";
import { connectMcpPool, invokeMcpTool, parseMcpJsonText } from "./mcp-client.ts";

export interface AgentModelOption {
  id: string;
  name: string;
  provider: string;
  providerName: string;
}

export interface PendingScanSummary {
  id: string;
  label?: string;
  createdAt: string;
  pageCount: number;
}

export interface TriageItemResult {
  pendingId: string;
  label?: string;
  pageCount: number;
  title: string;
  category: string;
  targetPath: string;
  sender?: string;
  date?: string;
  totalAmount?: number;
  summary: string;
  archived: boolean;
  error?: string;
}

export interface TriageRunReport {
  ranAt: string;
  source: "cron" | "manual";
  count: number;
  items: TriageItemResult[];
  error?: string;
}

export interface ChatTurnMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantChatResult {
  reply: string;
  toolsUsed: string[];
}

const optionalString = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const optionalAmount = z.preprocess((val) => {
  if (val === null || val === undefined || val === "") return undefined;
  if (typeof val === "number") return Number.isFinite(val) ? val : undefined;
  if (typeof val === "string") {
    const normalized = val.replace(/[^\d.,-]/g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}, z.number().optional());

const triageSchema = z.object({
  title: z.string().min(1).describe("Prägnanter Dokumenttitel"),
  category: z.string().min(1).describe("Kategorie (z. B. Rechnung, Vertrag, Brief, Beleg, Versicherung, Steuern, Gesundheit, Sonstiges)"),
  targetPath: z
    .string()
    .min(1)
    .describe("Relativer Zielordner nach dem Schema Kategorie/Absender/Jahr (z. B. 'Rechnung/EON/2026')"),
  sender: optionalString.describe("Absender / Aussteller"),
  recipient: optionalString.describe("Empfänger"),
  date: optionalString.describe("Dokumentdatum im Format YYYY-MM-DD"),
  dueDate: optionalString.describe("Fälligkeitsdatum im Format YYYY-MM-DD falls vorhanden"),
  totalAmount: optionalAmount.describe("Gesamtbetrag als Dezimalzahl falls vorhanden"),
  tags: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? [])
    .describe("3-5 kurze Schlagwörter"),
  summary: z.string().min(1).describe("Kurze 1-2-Satz-Zusammenfassung"),
  ocrText: optionalString.describe("Wichtigster erkannter Text / Kennzahlen"),
});

let lastTriageRun: TriageRunReport | null = null;
let triageRunning = false;

export function getTriageCronSchedule(): string {
  return Deno.env.get("TRIAGE_CRON") || "0 3 * * *";
}

export function getLastTriageRun(): TriageRunReport | null {
  return lastTriageRun;
}

function resolveModel(requestedModelId?: string) {
  const config = loadAgentConfig();
  const available = getAvailableAgentModels();
  if (available.length === 0) {
    throw new Error("Keine Modelle in providers.json konfiguriert");
  }

  const selected = requestedModelId ? available.find((m) => m.id === requestedModelId) : available[0];

  if (!selected) {
    throw new Error(`Modell '${requestedModelId}' ist nicht konfiguriert`);
  }

  const [providerId, ...rest] = selected.id.split(":");
  const rawModelId = rest.join(":");
  const provider: ResolvedAgentProvider | undefined = config.providers.find(
    (p) => p.id === providerId,
  );

  if (!provider || !provider.apiKey) {
    throw new Error(`Provider '${providerId}' hat keinen gültigen API-Key`);
  }

  const client = createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    supportsStructuredOutputs: true,
    headers: {
      "HTTP-Referer": "https://sleipnir.local",
      "X-Title": "Sleipnir Agentmate",
    },
  });

  return client.chatModel(rawModelId);
}

/**
 * Lists all configured models across ready providers.
 */
export function getAvailableAgentModels(): AgentModelOption[] {
  const config = loadAgentConfig();
  const list: AgentModelOption[] = [];

  for (const p of config.providers) {
    if (!p.apiKey) continue;
    for (const m of p.models) {
      list.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        provider: p.id,
        providerName: p.name,
      });
    }
  }

  return list;
}

export interface PendingQueueStatus {
  available: boolean;
  count: number;
  items: PendingScanSummary[];
  error?: string;
}

/**
 * Inspects MCP server connectivity and fetches the current ScanMate pending queue
 * in a single MCP pool pass.
 */
export async function getMcpAndQueueStatus(): Promise<{
  mcpServers: Awaited<ReturnType<typeof connectMcpPool>>["statuses"];
  pendingQueue: PendingQueueStatus;
}> {
  const config = loadAgentConfig();
  const pool = await connectMcpPool(config.mcpServers);
  try {
    const scanmateStatus = pool.statuses.find((s) => s.id === "scanmate");
    if (!scanmateStatus?.connected) {
      return {
        mcpServers: pool.statuses,
        pendingQueue: {
          available: false,
          count: 0,
          items: [],
          error: scanmateStatus?.error ?? "ScanMate MCP offline",
        },
      };
    }

    try {
      const pendingRes = await invokeMcpTool(pool.tools, "scanmate_list_pending", {});
      const pendingData = parseMcpJsonText<{ count: number; items: PendingScanSummary[] }>(
        pendingRes,
      );
      const items = Array.isArray(pendingData.items) ? pendingData.items : [];
      return {
        mcpServers: pool.statuses,
        pendingQueue: {
          available: true,
          count: typeof pendingData.count === "number" ? pendingData.count : items.length,
          items,
        },
      };
    } catch (err) {
      return {
        mcpServers: pool.statuses,
        pendingQueue: {
          available: false,
          count: 0,
          items: [],
          error: err instanceof Error ? err.message : "Queue konnte nicht geladen werden",
        },
      };
    }
  } finally {
    await pool.closeAll();
  }
}

/**
 * Inspects MCP server connectivity and returns available tool counts.
 */
export async function getMcpStatuses() {
  const config = loadAgentConfig();
  const pool = await connectMcpPool(config.mcpServers);
  try {
    return pool.statuses;
  } finally {
    await pool.closeAll();
  }
}

async function extractPdfTextSafe(pdfBase64: string): Promise<string> {
  try {
    const clean = pdfBase64.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return typeof text === "string" ? text.trim() : "";
  } catch (err) {
    console.warn("[Agentmate] PDF-Textextraktion fehlgeschlagen:", err instanceof Error ? err.message : err);
    return "";
  }
}

/**
 * Analyzes all pending scans in ScanMate and archives them automatically
 * with `reviewed: false` so the user can review them in ScanMate.
 */
async function archiveAllPendingScans(modelId?: string): Promise<TriageItemResult[]> {
  const model = resolveModel(modelId);
  const config = loadAgentConfig();
  const scanmateServer = config.mcpServers.filter((s) => s.id === "scanmate");
  const pool = await connectMcpPool(scanmateServer);

  try {
    const scanmateStatus = pool.statuses.find((s) => s.id === "scanmate");
    if (!scanmateStatus?.connected) {
      throw new Error(
        `ScanMate MCP nicht erreichbar (${scanmateStatus?.url ?? "unbekannt"}): ${scanmateStatus?.error ?? "offline"}`,
      );
    }

    const pendingRes = await invokeMcpTool(pool.tools, "scanmate_list_pending", {});
    const pendingData = parseMcpJsonText<{ count: number; items: PendingScanSummary[] }>(
      pendingRes,
    );

    if (!pendingData.items || pendingData.items.length === 0) {
      return [];
    }

    const foldersRes = await invokeMcpTool(pool.tools, "scanmate_list_folders", {});
    const foldersData = parseMcpJsonText<{ folders: string[] }>(foldersRes);
    const existingFolders = foldersData.folders ?? [];

    const results: TriageItemResult[] = [];

    for (const item of pendingData.items) {
      try {
        const imgRes = await invokeMcpTool(pool.tools, "scanmate_get_pending_images", {
          id: item.id,
        });
        const textPart = (imgRes.content ?? []).find((p) => p.type === "text" && typeof p.text === "string");
        let pendingPdfBase64 = "";
        if (textPart?.text) {
          try {
            const meta = JSON.parse(textPart.text) as { sourceType?: string; pdfBase64?: string };
            if (meta.sourceType === "pdf" && typeof meta.pdfBase64 === "string" && meta.pdfBase64) {
              pendingPdfBase64 = meta.pdfBase64;
            }
          } catch {
            // ignore non-json
          }
        }

        const imageParts = (imgRes.content ?? [])
          .filter((part) => part.type === "image" && typeof part.data === "string")
          .map((part) => ({
            type: "image" as const,
            image: `data:${part.mimeType ?? "image/jpeg"};base64,${part.data}`,
          }));

        let pdfExtractedText = "";
        if (pendingPdfBase64) {
          pdfExtractedText = await extractPdfTextSafe(pendingPdfBase64);
        }

        const mediaParts = pendingPdfBase64 && pdfExtractedText.length < 20
          ? [{
            type: "file" as const,
            data: pendingPdfBase64,
            mediaType: "application/pdf",
          }]
          : imageParts;

        if (mediaParts.length === 0 && !pdfExtractedText) {
          results.push({
            pendingId: item.id,
            label: item.label,
            pageCount: item.pageCount,
            title: item.label || `Scan ${item.id}`,
            category: "Sonstiges",
            targetPath: "Sonstiges",
            summary: "Keine Bild- oder PDF-Daten gefunden.",
            archived: false,
            error: "Keine Bild- oder PDF-Daten im Pending-Scan",
          });
          continue;
        }

        const promptText = [
          "Analysiere diesen gescannten Beleg / dieses Dokument für die Archivierung.",
          item.label ? `Hinweis-Label vom Nutzer: "${item.label}".` : "",
          existingFolders.length > 0
            ? `Bestehende Archiv-Ordner (bevorzuge konsistente Schreibweisen): ${existingFolders.join(", ")}`
            : "Es existieren noch keine Unterordner.",
          pdfExtractedText ? `\n--- EXTRAHIERTER PDF-TEXT ---\n${pdfExtractedText.slice(0, 12_000)}\n--- ENDE PDF-TEXT ---` : "",
          "Wichtige Extraktionsregeln:",
          "- `sender`: Extrahiere den vollständigen Absender/Aussteller aus dem Briefkopf oder Text.",
          "- `recipient`: Extrahiere den Empfänger falls angegeben.",
          "- `date`: Dokument- oder Bescheiddatum im Format YYYY-MM-DD.",
          "- `dueDate`: Fälligkeitsdatum oder nächster Zahlungstermin im Format YYYY-MM-DD, falls im Dokument genannt.",
          "- `totalAmount`: Gesamtbetrag als Dezimalzahl (z. B. 3191.97), falls genannt.",
          "- `tags`: Vergib IMMER 3 bis 5 prägnante deutsche Schlagwörter (niemals leeres Array).",
          "- `targetPath`: Möglichst das Schema `Kategorie/Absender/Jahr` (z. B. `Rechnung/EON/2026` oder `Bescheid/Stadt_Betzenstein/2026`).",
        ]
          .filter(Boolean)
          .join("\n");

        let extracted: z.infer<typeof triageSchema>;
        try {
          const result = await generateText({
            model,
            abortSignal: AbortSignal.timeout(45_000),
            system:
              "Du bist ein präziser deutscher Dokumenten-Archivar. Extrahiere alle relevanten Metadaten vollständig aus den Belegbildern (insbesondere Absender, Empfänger, Datum, Fälligkeit/Zahlungstermin, Betrag und 3-5 deutsche Tags). Antworte strikt im geforderten JSON-Schema.",
            output: Output.object({
              schema: triageSchema,
            }),
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  ...mediaParts,
                ],
              },
            ],
          });
          extracted = result.output;
        } catch (structuredErr) {
          console.warn(
            "[Agentmate] Structured output failed, retrying with plain JSON extraction:",
            structuredErr instanceof Error ? structuredErr.message : structuredErr,
          );
          const jsonFallbackPrompt = [
            promptText,
            "",
            "Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt (ohne Markdown-Codeblock) mit diesen Feldern:",
            '{ "title": string, "category": string, "targetPath": string, "sender"?: string, "recipient"?: string, "date"?: "YYYY-MM-DD", "dueDate"?: "YYYY-MM-DD", "totalAmount"?: number, "tags": string[], "summary": string, "ocrText"?: string }',
          ].join("\n");

          const fallbackRes = await generateText({
            model,
            abortSignal: AbortSignal.timeout(45_000),
            system: "Du bist ein präziser deutscher Dokumenten-Archivar. Antworte ausschließlich mit einem validen JSON-Objekt.",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: jsonFallbackPrompt },
                  ...mediaParts,
                ],
              },
            ],
          });

          const match = fallbackRes.text.match(/\{[\s\S]*\}/);
          if (!match) {
            throw structuredErr;
          }
          extracted = triageSchema.parse(JSON.parse(match[0]));
        }

        await invokeMcpTool(pool.tools, "scanmate_archive_pending", {
          pendingId: item.id,
          title: extracted.title,
          category: extracted.category,
          targetPath: extracted.targetPath,
          sender: extracted.sender,
          recipient: extracted.recipient,
          date: extracted.date,
          dueDate: extracted.dueDate,
          totalAmount: extracted.totalAmount,
          tags: extracted.tags,
          summary: extracted.summary,
          ocrText: extracted.ocrText,
          reviewed: false,
        });

        results.push({
          pendingId: item.id,
          label: item.label,
          pageCount: item.pageCount,
          title: extracted.title,
          category: extracted.category,
          targetPath: extracted.targetPath,
          sender: extracted.sender,
          date: extracted.date,
          totalAmount: extracted.totalAmount,
          summary: extracted.summary,
          archived: true,
        });
      } catch (err) {
        results.push({
          pendingId: item.id,
          label: item.label,
          pageCount: item.pageCount,
          title: item.label || `Scan ${item.id}`,
          category: "Sonstiges",
          targetPath: "Sonstiges",
          summary: "Analyse oder Archivierung fehlgeschlagen",
          archived: false,
          error: err instanceof Error ? err.message : "Unbekannter Fehler",
        });
      }
    }

    return results;
  } finally {
    await pool.closeAll();
  }
}

/**
 * Executes a triage run (scheduled by Deno.cron or triggered manually) and stores its report.
 */
export async function runTriageJob(
  source: "cron" | "manual",
  modelId?: string,
): Promise<TriageRunReport> {
  if (triageRunning) {
    throw new Error("Ein Triage-Lauf ist bereits aktiv.");
  }

  triageRunning = true;
  const ranAt = new Date().toISOString();

  try {
    const items = await archiveAllPendingScans(modelId);
    const report: TriageRunReport = {
      ranAt,
      source,
      count: items.length,
      items,
    };
    lastTriageRun = report;
    return report;
  } catch (err) {
    const report: TriageRunReport = {
      ranAt,
      source,
      count: 0,
      items: [],
      error: err instanceof Error ? err.message : "Triage fehlgeschlagen",
    };
    lastTriageRun = report;
    return report;
  } finally {
    triageRunning = false;
  }
}

/**
 * Runs a general assistant chat turn with MCP tool access (ScanMate & NoteMate).
 */
export async function runAssistantChat(options: {
  modelId?: string;
  messages: ChatTurnMessage[];
}): Promise<AssistantChatResult> {
  const model = resolveModel(options.modelId);
  const config = loadAgentConfig();
  const pool = await connectMcpPool(config.mcpServers);

  try {
    const result = await generateText({
      model,
      abortSignal: AbortSignal.timeout(90_000),
      system:
        "Du bist Agentmate, ein hilfreicher persönlicher Assistent im Sleipnir-System. Du hast über MCP Zugriff auf ScanMate (Belege & Dokumente) und NoteMate (Notizen & Kanban). Antworte präzise auf Deutsch und nutze die verfügbaren Tools, wenn der Nutzer nach Dokumenten, Belegen, Notizen oder Aufgaben fragt.",
      tools: pool.tools,
      stopWhen: stepCountIs(10),
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    const toolsUsed = new Set<string>();
    for (const step of result.steps) {
      for (const call of step.toolCalls) {
        toolsUsed.add(call.toolName);
      }
    }

    return {
      reply: result.text || "(Keine Textantwort erhalten)",
      toolsUsed: Array.from(toolsUsed),
    };
  } finally {
    await pool.closeAll();
  }
}
