/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { runTriageJob, type TriageRunReport } from "./agent.ts";
import { loadAgentConfig } from "./config.ts";
import { connectMcpPool, invokeMcpTool, parseMcpJsonText } from "./mcp-client.ts";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const ALLOWED_EXTS = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp"]);

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: {
    attachmentId?: string;
    size?: number;
  };
  parts?: GmailPart[];
}

interface GmailMessage {
  id?: string;
  payload?: GmailPart;
}

interface ExtractedAttachment {
  filename: string;
  mimeType: string;
  attachmentId: string;
}

export interface GmailImportResult {
  labelName: string;
  scannedMessages: number;
  enqueuedAttachments: number;
  unlabeledMessages: number;
  triageReport?: TriageRunReport;
}

function getHeader(headers: GmailHeader[] | undefined, targetName: string): string {
  if (!Array.isArray(headers)) return "";
  const lower = targetName.toLowerCase();
  const found = headers.find((h) => h.name?.toLowerCase() === lower);
  return found?.value?.trim() ?? "";
}

function getFileExtension(filename: string): string {
  const dotIdx = filename.lastIndexOf(".");
  if (dotIdx === -1) return "";
  return filename.slice(dotIdx).toLowerCase();
}

export function isInlineAttachment(part: GmailPart): boolean {
  const disposition = getHeader(part.headers, "Content-Disposition").toLowerCase();
  if (disposition.startsWith("inline")) return true;
  if (!disposition && getHeader(part.headers, "Content-ID")) return true;
  return false;
}

export function collectAttachments(part: GmailPart | undefined, acc: ExtractedAttachment[]): void {
  if (!part) return;
  const filename = part.filename?.trim() ?? "";
  const attachmentId = part.body?.attachmentId?.trim() ?? "";
  const ext = getFileExtension(filename);

  if (filename && attachmentId && ALLOWED_EXTS.has(ext) && !isInlineAttachment(part)) {
    acc.push({
      filename,
      mimeType: part.mimeType || "application/octet-stream",
      attachmentId,
    });
  }

  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      collectAttachments(child, acc);
    }
  }
}

export function base64UrlToStandardBase64(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  return pad === 0 ? normalized : normalized + "=".repeat(4 - pad);
}

async function gmailFetchJson<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Google Access-Token abgelaufen oder unzureichende Berechtigung.");
    }
    throw new Error(`Gmail API Fehler (HTTP ${res.status}): ${errBody.slice(0, 200)}`);
  }

  return (await res.json()) as T;
}

/**
 * Fetches messages matching the given Gmail label, extracts non-inline PDF/image
 * attachments into ScanMate's pending queue, removes the Gmail label only after
 * ScanMate confirms receipt, and optionally runs the triage job.
 */
export async function importGmailLabelToScanmate(options: {
  accessToken: string;
  labelName: string;
  modelId?: string;
  runTriage?: boolean;
}): Promise<GmailImportResult> {
  const accessToken = options.accessToken.trim();
  const labelName = options.labelName.trim();
  if (!accessToken) {
    throw new Error("Google Access-Token fehlt.");
  }
  if (!labelName) {
    throw new Error("Gmail-Label fehlt.");
  }

  const labelsRes = await gmailFetchJson<{ labels?: Array<{ id?: string; name?: string }> }>(
    `${GMAIL_API_BASE}/labels`,
    accessToken,
  );
  const targetLabel = (labelsRes.labels ?? []).find(
    (l) => l.name?.toLowerCase() === labelName.toLowerCase(),
  );
  if (!targetLabel?.id) {
    throw new Error(`Gmail-Label '${labelName}' wurde nicht gefunden.`);
  }

  const listRes = await gmailFetchJson<{ messages?: Array<{ id?: string }> }>(
    `${GMAIL_API_BASE}/messages?labelIds=${encodeURIComponent(targetLabel.id)}&maxResults=25`,
    accessToken,
  );
  const messageIds = (listRes.messages ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
  if (messageIds.length === 0) {
    return {
      labelName,
      scannedMessages: 0,
      enqueuedAttachments: 0,
      unlabeledMessages: 0,
    };
  }

  const config = loadAgentConfig();
  const scanmateServer = config.mcpServers.filter((s) => s.id === "scanmate");
  const pool = await connectMcpPool(scanmateServer);
  let enqueuedAttachments = 0;
  let unlabeledMessages = 0;

  try {
    const scanmateStatus = pool.statuses.find((s) => s.id === "scanmate");
    if (!scanmateStatus?.connected) {
      throw new Error("ScanMate MCP nicht erreichbar.");
    }

    for (const msgId of messageIds) {
      const msg = await gmailFetchJson<GmailMessage>(
        `${GMAIL_API_BASE}/messages/${encodeURIComponent(msgId)}?format=full`,
        accessToken,
      );
      const subject = getHeader(msg.payload?.headers, "Subject") || "E-Mail-Anhang";
      const from = getHeader(msg.payload?.headers, "From");

      const attachments: ExtractedAttachment[] = [];
      collectAttachments(msg.payload, attachments);

      if (attachments.length === 0) {
        continue;
      }

      for (const att of attachments) {
        const attRes = await gmailFetchJson<{ data?: string }>(
          `${GMAIL_API_BASE}/messages/${encodeURIComponent(msgId)}/attachments/${encodeURIComponent(att.attachmentId)}`,
          accessToken,
        );
        if (!attRes.data) {
          throw new Error(`Anhang '${att.filename}' konnte nicht von Gmail geladen werden.`);
        }

        const stdB64 = base64UrlToStandardBase64(attRes.data);
        const ext = getFileExtension(att.filename);
        const itemLabel = `${subject} — ${att.filename}${from ? ` (${from})` : ""}`;

        const mcpPayload = ext === ".pdf"
          ? { pdfBase64: stdB64, label: itemLabel }
          : { pages: [`data:${att.mimeType};base64,${stdB64}`], label: itemLabel };

        const queued = await invokeMcpTool(pool.tools, "scanmate_enqueue_pending", mcpPayload);
        parseMcpJsonText<{ queued: boolean }>(queued);
        enqueuedAttachments++;
      }

      // Label erst nach erfolgreicher Übergabe an ScanMate entfernen (Crash-Safety)
      await gmailFetchJson(
        `${GMAIL_API_BASE}/messages/${encodeURIComponent(msgId)}/modify`,
        accessToken,
        {
          method: "POST",
          body: JSON.stringify({ removeLabelIds: [targetLabel.id] }),
        },
      );
      unlabeledMessages++;
    }
  } finally {
    await pool.closeAll();
  }

  let triageReport: TriageRunReport | undefined;
  if (options.runTriage !== false && enqueuedAttachments > 0) {
    triageReport = await runTriageJob("manual", options.modelId);
  }

  return {
    labelName,
    scannedMessages: messageIds.length,
    enqueuedAttachments,
    unlabeledMessages,
    triageReport,
  };
}
