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
  getMcpStatuses,
  getTriageCronSchedule,
  runAssistantChat,
  runTriageJob,
} from "../services/agent.ts";

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
  const mcpServers = await getMcpStatuses();
  return c.json({
    models,
    mcpServers,
    cronSchedule: getTriageCronSchedule(),
    lastTriageRun: getLastTriageRun(),
  });
});

agentApi.post("/triage", async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = {};
  }

  const parsed = triageRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  try {
    const report = await runTriageJob("manual", parsed.data.model);
    if (report.error) {
      return c.json({ error: report.error, report }, 500);
    }
    return c.json({ report });
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
