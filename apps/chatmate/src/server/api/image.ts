/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Sleipnir, SleipnirContext } from "@sleipnir/core";
import { generateImage, type ImageRequest } from "../services/provider.ts";

export function imageApi(app: Sleipnir, basePath: string) {
  app.post(basePath, handleImageGen);
}

async function handleImageGen(c: SleipnirContext) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Bouncer-Pattern
  if (typeof body !== "object" || body === null) {
    return c.json({ error: "Request body must be an object" }, 400);
  }

  const raw = body as Record<string, unknown>;
  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  const model = typeof raw.model === "string" ? raw.model : undefined;
  const aspectRatio = raw.aspectRatio === "16:9" || raw.aspectRatio === "9:16" ? raw.aspectRatio : "1:1";

  if (!prompt) {
    return c.json({ error: "Missing or empty prompt" }, 400);
  }

  const req: ImageRequest = {
    prompt,
    model,
    aspectRatio,
  };

  // ZERO LOGGING: Prompt and image data are not logged
  const result = await generateImage(req);
  return c.json(result);
}
