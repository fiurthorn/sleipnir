/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Hono } from "hono";
import { z } from "zod";
import { getAvailableModels } from "../services/config.ts";
import { runStoryTurn } from "../services/director.ts";
import { buildCharacterPortraitPrompt, buildPersonaPortraitPrompt, buildSceneImagePrompt, generateAndSaveImage } from "../services/image.ts";
import {
  deleteCharacter,
  deleteGameMaster,
  deleteLocation,
  deletePersona,
  deleteSession,
  getCharacter,
  getLocation,
  getPersona,
  getSession,
  listCharacters,
  listGameMasters,
  listLocations,
  listPersonas,
  listSessions,
  readAssetBytes,
  saveCharacter,
  saveGameMaster,
  saveLocation,
  savePersona,
  saveSession,
  slugifyName,
} from "../services/storage.ts";

export const skaldApi = new Hono();

skaldApi.get("/config", (c) => {
  return c.json({ models: getAvailableModels() });
});

// Personas
const personaBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  role: z.string().default(""),
  appearance: z.string().default(""),
  traits: z.string().default(""),
  background: z.string().default(""),
  portraitFile: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

skaldApi.get("/personas", async (c) => c.json({ items: await listPersonas() }));
skaldApi.post("/personas", async (c) => {
  const parsed = personaBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const item = await savePersona({
    ...parsed.data,
    id: parsed.data.id || slugifyName(parsed.data.name, "persona"),
  });
  return c.json({ item });
});
skaldApi.delete("/personas/:id", async (c) => {
  const ok = await deletePersona(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

skaldApi.post("/personas/:id/portrait", async (c) => {
  const persona = await getPersona(c.req.param("id"));
  if (!persona) return c.json({ error: "Persona nicht gefunden" }, 404);
  const body = await c.req.json().catch(() => ({})) as { prompt?: string; imageModelId?: string };
  const prompt = body.prompt?.trim() || buildPersonaPortraitPrompt(persona);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: body.imageModelId,
      filePrefix: `persona_${persona.id}`,
      aspectRatio: "1:1",
    });
    const updated = await savePersona({ ...persona, portraitFile: fileName });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildfehler" }, 500);
  }
});

// Characters
const characterBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  role: z.string().default(""),
  appearance: z.string().default(""),
  personality: z.string().default(""),
  goals: z.string().default(""),
  speechStyle: z.string().default(""),
  modelId: z.string().optional(),
  portraitFile: z.string().optional(),
});

skaldApi.get("/characters", async (c) => c.json({ items: await listCharacters() }));
skaldApi.post("/characters", async (c) => {
  const parsed = characterBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const item = await saveCharacter({
    ...parsed.data,
    id: parsed.data.id || slugifyName(parsed.data.name, "char"),
  });
  return c.json({ item });
});
skaldApi.delete("/characters/:id", async (c) => {
  const ok = await deleteCharacter(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

skaldApi.post("/characters/:id/portrait", async (c) => {
  const char = await getCharacter(c.req.param("id"));
  if (!char) return c.json({ error: "Charakter nicht gefunden" }, 404);
  const body = await c.req.json().catch(() => ({})) as { prompt?: string; imageModelId?: string };
  const prompt = body.prompt?.trim() || buildCharacterPortraitPrompt(char);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: body.imageModelId,
      filePrefix: `portrait_${char.id}`,
      aspectRatio: "1:1",
    });
    const updated = await saveCharacter({ ...char, portraitFile: fileName });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildfehler" }, 500);
  }
});

// Locations
const locationBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  atmosphere: z.string().default(""),
  details: z.string().default(""),
});

skaldApi.get("/locations", async (c) => c.json({ items: await listLocations() }));
skaldApi.post("/locations", async (c) => {
  const parsed = locationBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const item = await saveLocation({
    ...parsed.data,
    id: parsed.data.id || slugifyName(parsed.data.name, "loc"),
  });
  return c.json({ item });
});
skaldApi.delete("/locations/:id", async (c) => {
  const ok = await deleteLocation(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

// Game Masters
const gmBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  style: z.string().default("neutral"),
  systemPrompt: z.string().default(""),
  modelId: z.string().optional(),
});

skaldApi.get("/gamemasters", async (c) => c.json({ items: await listGameMasters() }));
skaldApi.post("/gamemasters", async (c) => {
  const parsed = gmBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const item = await saveGameMaster({
    ...parsed.data,
    id: parsed.data.id || slugifyName(parsed.data.name, "gm"),
  });
  return c.json({ item });
});
skaldApi.delete("/gamemasters/:id", async (c) => {
  const ok = await deleteGameMaster(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

// Sessions
const createSessionBody = z.object({
  title: z.string().min(1),
  locationId: z.string().min(1),
  personaId: z.string().optional(),
  characterIds: z.array(z.string()).default([]),
  gameMasterId: z.string().min(1).default("chronist"),
  modelId: z.string().optional(),
  imageModelId: z.string().optional(),
  sceneState: z.string().default(""),
});

skaldApi.get("/sessions", async (c) => c.json({ items: await listSessions() }));
skaldApi.get("/sessions/:id", async (c) => {
  const item = await getSession(c.req.param("id"));
  return item ? c.json({ item }) : c.json({ error: "Szene nicht gefunden" }, 404);
});

skaldApi.post("/sessions", async (c) => {
  const parsed = createSessionBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const now = new Date().toISOString();
  const item = await saveSession({
    ...parsed.data,
    id: crypto.randomUUID().slice(0, 12),
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
  return c.json({ item }, 201);
});

skaldApi.patch("/sessions/:id", async (c) => {
  const existing = await getSession(c.req.param("id"));
  if (!existing) return c.json({ error: "Szene nicht gefunden" }, 404);
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const updated = await saveSession({
    ...existing,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : existing.title,
    locationId: typeof body.locationId === "string" ? body.locationId : existing.locationId,
    personaId: typeof body.personaId === "string" ? body.personaId || undefined : existing.personaId,
    characterIds: Array.isArray(body.characterIds) ? body.characterIds.filter((id): id is string => typeof id === "string") : existing.characterIds,
    gameMasterId: typeof body.gameMasterId === "string" ? body.gameMasterId : existing.gameMasterId,
    modelId: typeof body.modelId === "string" ? body.modelId || undefined : existing.modelId,
    imageModelId: typeof body.imageModelId === "string" ? body.imageModelId || undefined : existing.imageModelId,
    sceneState: typeof body.sceneState === "string" ? body.sceneState : existing.sceneState,
  });
  return c.json({ item: updated });
});

skaldApi.delete("/sessions/:id", async (c) => {
  const ok = await deleteSession(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

skaldApi.post("/sessions/:id/turn", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Szene nicht gefunden" }, 404);
  const body = await c.req.json().catch(() => ({})) as {
    message?: string;
    forceCharacterId?: string;
  };

  try {
    const result = await runStoryTurn({
      session,
      userMessage: body.message,
      forceCharacterId: body.forceCharacterId,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Turn fehlgeschlagen" }, 500);
  }
});

skaldApi.post("/sessions/:id/scene-image", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Szene nicht gefunden" }, 404);
  const body = await c.req.json().catch(() => ({})) as {
    customPrompt?: string;
    imageModelId?: string;
  };

  try {
    const [location, allChars] = await Promise.all([
      getLocation(session.locationId),
      listCharacters(),
    ]);
    const activeChars = allChars.filter((ch) => session.characterIds.includes(ch.id));
    const prompt = body.customPrompt?.trim() || buildSceneImagePrompt(session, location, activeChars);
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: body.imageModelId || session.imageModelId,
      filePrefix: `scene_${session.id}`,
      aspectRatio: "16:9",
    });

    const imgMsg = {
      id: crypto.randomUUID(),
      kind: "image" as const,
      speakerName: "Szenenbild",
      content: prompt,
      imageFile: fileName,
      imagePrompt: prompt,
      createdAt: new Date().toISOString(),
    };
    const updated = await saveSession({
      ...session,
      messages: [...session.messages, imgMsg],
    });
    return c.json({ session: updated, message: imgMsg });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildgenerierung fehlgeschlagen" }, 500);
  }
});

// Assets
skaldApi.get("/assets/:file", async (c) => {
  const asset = await readAssetBytes(c.req.param("file"));
  if (!asset) return c.text("Not found", 404);
  return new Response(asset.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": asset.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
});
