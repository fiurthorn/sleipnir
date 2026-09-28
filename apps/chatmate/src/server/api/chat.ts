/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Sleipnir, SleipnirContext } from "@sleipnir/core";
import {
  ChatMessage,
  ChatRequest,
  streamChatCompletion,
} from "../services/provider.ts";

export function chatApi(app: Sleipnir, basePath: string) {
  app.post(basePath, handleChat);
}

async function handleChat(c: SleipnirContext) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.text("Invalid JSON body", 400);
  }

  // Bouncer-Pattern
  if (typeof body !== "object" || body === null) {
    return c.text("Request body must be an object", 400);
  }

  const raw = body as Record<string, unknown>;
  const model = typeof raw.model === "string" ? raw.model : "";
  const messages = Array.isArray(raw.messages) ? raw.messages : [];
  const temperature = typeof raw.temperature === "number"
    ? raw.temperature
    : 0.7;

  if (!model) {
    return c.text("Missing 'model' field", 400);
  }

  if (messages.length === 0) {
    return c.text("Messages array cannot be empty", 400);
  }

  const validMessages: ChatMessage[] = [];
  for (const m of messages) {
    if (
      typeof m === "object" &&
      m !== null &&
      "role" in m &&
      "content" in m &&
      typeof m.role === "string" &&
      typeof m.content === "string"
    ) {
      validMessages.push({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      });
    }
  }

  if (validMessages.length === 0) {
    return c.text("No valid messages found in payload", 400);
  }

  const chatRequest: ChatRequest = {
    model,
    messages: validMessages,
    temperature,
  };

  // ZERO LOGGING: Prompts or stream data are never printed
  const stream = await streamChatCompletion(chatRequest);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
