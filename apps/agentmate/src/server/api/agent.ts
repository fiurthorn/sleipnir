/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  getAvailableAgentModels,
  getLastTriageRun,
  getMcpAndQueueStatus,
  getTriageCronSchedule,
  runAssistantChat,
  runTriageJob,
} from "../services/agent.ts";
import { importGmailLabelToScanmate } from "../services/gmail.ts";

export const agentApi = new Hono();

const triageRequestSchema = z.object({
  model: z.string().optional(),
});

const chatRequestSchema = z.object({
  model: z.string().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .min(1),
});

agentApi.get("/config", async (c) => {
  const models = getAvailableAgentModels();
  const { mcpServers, pendingQueue } = await getMcpAndQueueStatus();
  return c.json({
    models,
    mcpServers,
    pendingQueue,
    cronSchedule: getTriageCronSchedule(),
    lastTriageRun: getLastTriageRun(),
    googleClientId: Deno.env.get("GOOGLE_CLIENT_ID")?.trim() || "",
    defaultGmailLabel: Deno.env.get("GOOGLE_GMAIL_LABEL")?.trim() || "ScanMate",
  });
});

const gmailImportSchema = z.object({
  accessToken: z.string().trim().min(10, "Google Access-Token fehlt"),
  labelName: z.string().trim().min(1, "Gmail-Label fehlt"),
  model: z.string().optional(),
  runTriage: z.boolean().optional(),
});

agentApi.post("/gmail/import", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Ungültiger JSON-Body" }, 400);
  }

  const parsed = gmailImportSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || "Ungültige Eingabe" }, 400);
  }

  try {
    const result = await importGmailLabelToScanmate({
      accessToken: parsed.data.accessToken,
      labelName: parsed.data.labelName,
      modelId: parsed.data.model,
      runTriage: parsed.data.runTriage,
    });
    const { pendingQueue } = await getMcpAndQueueStatus();
    return c.json({ ...result, pendingQueue });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Gmail-Import fehlgeschlagen" },
      400,
    );
  }
});

agentApi.post("/triage", async (c) => {
  let raw: unknown = {};
  try {
    const text = await c.req.text();
    if (text.trim()) {
      raw = JSON.parse(text);
    }
  } catch {
    return c.json({ error: "Ungültiger JSON-Body" }, 400);
  }

  const parsed = triageRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  try {
    const report = await runTriageJob("manual", parsed.data.model);
    const { pendingQueue } = await getMcpAndQueueStatus();
    if (report.error) {
      return c.json({ error: report.error, report, pendingQueue }, 500);
    }
    return c.json({ report, pendingQueue });
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Triage fehlgeschlagen" },
      409,
    );
  }
});

agentApi.post("/chat", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: "Ungültiger JSON-Body" }, 400);
  }

  const parsed = chatRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  try {
    const result = await runAssistantChat({
      modelId: parsed.data.model,
      messages: parsed.data.messages,
    });
    return c.json(result);
  } catch (err) {
    return c.json(
      { error: err instanceof Error ? err.message : "Chat-Anfrage fehlgeschlagen" },
      500,
    );
  }
});
