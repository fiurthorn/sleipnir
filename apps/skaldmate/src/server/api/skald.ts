/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { generateText, Output, stepCountIs } from "ai";
import { stringify as stringifyYaml } from "@std/yaml";
import { type Context, Hono } from "hono";
import { z } from "zod";
import { createSkaldmateWorkshopTools, SKALD_MUTATING_TOOL_NAMES } from "../mcp.ts";
import { getAvailableModels } from "../services/config.ts";
import { buildSessionPromptPreview, initializeSceneSession, resolveTextModel, runStoryTurn } from "../services/director.ts";
import { expandMacros } from "../services/macros.ts";
import {
  buildCharacterPortraitPrompt,
  buildLocationImagePrompt,
  buildLocationMapPrompt,
  buildPersonaPortraitPrompt,
  buildSceneImagePrompt,
  generateAndSaveImage,
} from "../services/image.ts";
import {
  deleteCharacter,
  deleteGameMaster,
  deleteLocation,
  deletePersona,
  deleteScene,
  deleteSession,
  EntityInUseError,
  getCharacter,
  getGameMaster,
  getLocation,
  getPersona,
  getScene,
  getSession,
  listCharacters,
  listGameMasters,
  listLocations,
  listPersonas,
  listScenes,
  listSessions,
  readAssetBytes,
  saveCharacter,
  saveGameMaster,
  saveLocation,
  savePersona,
  saveScene,
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
  voiceGender: z.enum(["", "female", "male"]).optional().default(""),
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
async function handleDeleteEntity(c: Context, deleter: (id: string) => Promise<boolean>) {
  try {
    const id = c.req.param("id") ?? "";
    const ok = await deleter(id);
    return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
  } catch (err) {
    if (err instanceof EntityInUseError) {
      return c.json({ error: err.message, references: err.references }, 409);
    }
    throw err;
  }
}

skaldApi.delete("/personas/:id", (c) => handleDeleteEntity(c, deletePersona));

const imagePromptBody = z.object({
  prompt: z.string().optional(),
  imageModelId: z.string().optional(),
});

async function parseOptionalJsonBody(c: { req: { text: () => Promise<string> } }): Promise<
  { ok: true; data: unknown } | { ok: false }
> {
  try {
    const text = await c.req.text();
    return { ok: true, data: text.trim() ? JSON.parse(text) : {} };
  } catch {
    return { ok: false };
  }
}

skaldApi.post("/personas/:id/portrait", async (c) => {
  const persona = await getPersona(c.req.param("id"));
  if (!persona) return c.json({ error: "Persona nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = imagePromptBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const prompt = parsed.data.prompt?.trim() || buildPersonaPortraitPrompt(persona);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: parsed.data.imageModelId,
      filePrefix: `persona_${persona.id}`,
      aspectRatio: "1:1",
    });
    const updated = await savePersona({ ...persona, portraitFile: fileName });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildfehler" }, 500);
  }
});

skaldApi.delete("/personas/:id/portrait", async (c) => {
  const persona = await getPersona(c.req.param("id"));
  if (!persona) return c.json({ error: "Persona nicht gefunden" }, 404);
  const updated = await savePersona({ ...persona, portraitFile: undefined });
  return c.json({ item: updated });
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
  greeting: z.string().default(""),
  exampleDialogue: z.string().default(""),
  relationships: z.string().default(""),
  portraitPrompt: z.string().default(""),
  voiceGender: z.enum(["", "female", "male"]).optional().default(""),
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
skaldApi.delete("/characters/:id", (c) => handleDeleteEntity(c, deleteCharacter));

skaldApi.post("/characters/:id/portrait", async (c) => {
  const char = await getCharacter(c.req.param("id"));
  if (!char) return c.json({ error: "Charakter nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = imagePromptBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const prompt = parsed.data.prompt?.trim() || char.portraitPrompt?.trim() || buildCharacterPortraitPrompt(char);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: parsed.data.imageModelId,
      filePrefix: `portrait_${char.id}`,
      aspectRatio: "1:1",
    });
    const updated = await saveCharacter({
      ...char,
      portraitFile: fileName,
      portraitPrompt: prompt,
    });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildfehler" }, 500);
  }
});

skaldApi.delete("/characters/:id/portrait", async (c) => {
  const char = await getCharacter(c.req.param("id"));
  if (!char) return c.json({ error: "Charakter nicht gefunden" }, 404);
  const updated = await saveCharacter({ ...char, portraitFile: undefined });
  return c.json({ item: updated });
});

// Locations
const locationBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  parentId: z.string().optional(),
  residentIds: z.array(z.string()).default([]),
  description: z.string().default(""),
  atmosphere: z.string().default(""),
  details: z.string().default(""),
  openingMessage: z.string().default(""),
  defaultSceneState: z.string().default(""),
  imagePrompt: z.string().default(""),
  imageFile: z.string().optional(),
  mapPrompt: z.string().default(""),
  mapFile: z.string().optional(),
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
skaldApi.delete("/locations/:id", (c) => handleDeleteEntity(c, deleteLocation));

skaldApi.post("/locations/:id/image", async (c) => {
  const loc = await getLocation(c.req.param("id"));
  if (!loc) return c.json({ error: "Ort nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = imagePromptBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const prompt = parsed.data.prompt?.trim() || loc.imagePrompt?.trim() || buildLocationImagePrompt(loc);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: parsed.data.imageModelId,
      filePrefix: `loc_${loc.id}`,
      aspectRatio: "16:9",
    });
    const updated = await saveLocation({
      ...loc,
      imageFile: fileName,
      imagePrompt: prompt,
    });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Bildfehler" }, 500);
  }
});

skaldApi.post("/locations/:id/map", async (c) => {
  const loc = await getLocation(c.req.param("id"));
  if (!loc) return c.json({ error: "Ort nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = imagePromptBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const allLocations = await listLocations();
  const childLocations = allLocations.filter((item) => item.parentId === loc.id);
  const prompt = parsed.data.prompt?.trim() || loc.mapPrompt?.trim() || buildLocationMapPrompt(loc, childLocations);

  try {
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: parsed.data.imageModelId,
      filePrefix: `locmap_${loc.id}`,
      aspectRatio: "16:9",
    });
    const updated = await saveLocation({
      ...loc,
      mapFile: fileName,
      mapPrompt: parsed.data.prompt?.trim() || loc.mapPrompt || "",
    });
    return c.json({ item: updated, fileName });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Kartenfehler" }, 500);
  }
});

const elaborateLocationBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(""),
  atmosphere: z.string().default(""),
  details: z.string().default(""),
  mapPrompt: z.string().default(""),
  modelId: z.string().optional(),
});

skaldApi.post("/locations/elaborate-map", async (c) => {
  const parsed = elaborateLocationBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const input = parsed.data;
  const allLocations = await listLocations();
  const childLocations = input.id ? allLocations.filter((item) => item.parentId === input.id) : [];
  const childSummary = childLocations.length > 0
    ? childLocations.map((ch) => `- ${ch.name}${ch.description ? `: ${ch.description}` : ""}`).join("\n")
    : "Keine expliziten Unter-Orte angelegt.";

  try {
    const model = resolveTextModel(input.modelId);
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: z.object({
          description: z.string().min(1).describe("Lebendige, räumlich klare Ortsbeschreibung auf Deutsch (3-5 Sätze)"),
          mapPrompt: z
            .string()
            .min(1)
            .describe("Präziser englischer Bild-Prompt für eine Top-Down-Landkarte oder einen Grundriss dieses Ortes"),
        }),
      }),
      system:
        "Du bist ein präziser Weltenbauer und Kartograph für ein deutschsprachiges Rollenspiel. Erstelle aus den Ortsdaten sowohl eine atmosphärische, räumlich nachvollziehbare Ortsbeschreibung (Deutsch) als auch einen klaren, bildlichen Top-Down-Karten-/Grundriss-Prompt (Englisch, ohne Textlabels-Spam, ohne Personen).",
      prompt: [
        `Ortsname: ${input.name}`,
        input.description ? `Bisherige Beschreibung: ${input.description}` : "",
        input.atmosphere ? `Atmosphäre: ${input.atmosphere}` : "",
        input.details ? `Details/Requisiten: ${input.details}` : "",
        input.mapPrompt ? `Bisherige Karten-Notizen: ${input.mapPrompt}` : "",
        `Untergeordnete Orte:\n${childSummary}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });

    return c.json(output);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "KI-Ausarbeitung fehlgeschlagen" }, 500);
  }
});

// Game Masters
const gmBody = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  style: z.string().default("neutral"),
  narrationFrequency: z.enum(["immer", "dann_und_wann", "nur_bei_aenderungen"]).default("dann_und_wann"),
  systemPrompt: z.string().default(""),
  voiceGender: z.enum(["", "female", "male"]).optional().default(""),
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
skaldApi.delete("/gamemasters/:id", (c) => handleDeleteEntity(c, deleteGameMaster));

// Scene Templates
const sceneBody = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  locationId: z.string().min(1),
  personaId: z.string().optional(),
  characterIds: z.array(z.string()).default([]),
  gameMasterId: z.string().min(1).default("chronist"),
  modelId: z.string().optional(),
  imageModelId: z.string().optional(),
  openingMessage: z.string().default(""),
  sceneState: z.string().default(""),
  gmNotes: z.string().default(""),
});

skaldApi.get("/scenes", async (c) => c.json({ items: await listScenes() }));
skaldApi.post("/scenes", async (c) => {
  const parsed = sceneBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const item = await saveScene({
    ...parsed.data,
    id: parsed.data.id || slugifyName(parsed.data.title, "scene"),
  });
  return c.json({ item });
});
skaldApi.delete("/scenes/:id", async (c) => {
  const ok = await deleteScene(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Szene nicht gefunden" }, 404);
});
skaldApi.post("/scenes/:id/start", async (c) => {
  const scene = await getScene(c.req.param("id"));
  if (!scene) return c.json({ error: "Szene nicht gefunden" }, 404);
  const [loc, persona, existingSessions] = await Promise.all([
    getLocation(scene.locationId),
    scene.personaId ? getPersona(scene.personaId) : Promise.resolve(null),
    listSessions(),
  ]);
  const variables: Record<string, string> = {};
  const baseTitle = expandMacros(scene.title.trim(), { userName: persona?.name, vars: variables }) || scene.title.trim();
  const samePrefixCount = existingSessions.filter((s) => s.title === baseTitle || s.title.startsWith(`${baseTitle} #`)).length;
  const chatTitle = samePrefixCount === 0 ? baseTitle : `${baseTitle} #${samePrefixCount + 1}`;
  const now = new Date().toISOString();
  const created = await saveSession({
    id: crypto.randomUUID().slice(0, 12),
    title: chatTitle,
    locationId: scene.locationId,
    personaId: scene.personaId,
    characterIds: scene.characterIds,
    gameMasterId: scene.gameMasterId,
    modelId: scene.modelId,
    imageModelId: scene.imageModelId,
    sceneState: scene.sceneState || loc?.defaultSceneState || "",
    inventory: [],
    variables,
    gmNotes: scene.gmNotes || "",
    resolvedContext: "",
    compressedSummary: "",
    compressedUntilIndex: 0,
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
  const initialized = await initializeSceneSession(created, scene.openingMessage || undefined);
  return c.json({ item: initialized }, 201);
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
  inventory: z.array(z.string()).default([]),
  gmNotes: z.string().default(""),
  openingMessage: z.string().optional(),
});

skaldApi.get("/sessions", async (c) => c.json({ items: await listSessions() }));
skaldApi.get("/sessions/:id", async (c) => {
  const item = await getSession(c.req.param("id"));
  return item ? c.json({ item }) : c.json({ error: "Szene nicht gefunden" }, 404);
});
skaldApi.get("/sessions/:id/prompt-preview", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Szene nicht gefunden" }, 404);
  const preview = await buildSessionPromptPreview(session);
  return c.json({ preview });
});

skaldApi.post("/sessions", async (c) => {
  const parsed = createSessionBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const [loc, persona] = await Promise.all([
    getLocation(parsed.data.locationId),
    parsed.data.personaId ? getPersona(parsed.data.personaId) : Promise.resolve(null),
  ]);
  const now = new Date().toISOString();
  const { openingMessage, ...sessionData } = parsed.data;
  const variables: Record<string, string> = {};
  const expandedTitle = expandMacros(sessionData.title.trim(), { userName: persona?.name, vars: variables }) || sessionData.title.trim();
  const created = await saveSession({
    ...sessionData,
    title: expandedTitle,
    sceneState: sessionData.sceneState || loc?.defaultSceneState || "",
    variables,
    id: crypto.randomUUID().slice(0, 12),
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
  const initialized = await initializeSceneSession(created, openingMessage);
  return c.json({ item: initialized }, 201);
});

const cloneSessionBody = z.object({
  title: z.string().min(1).optional(),
  includeHistory: z.boolean().optional().default(true),
});

skaldApi.post("/sessions/:id/clone", async (c) => {
  const existing = await getSession(c.req.param("id"));
  if (!existing) return c.json({ error: "Szene nicht gefunden" }, 404);
  const raw = await c.req.json().catch(() => ({}));
  const parsed = cloneSessionBody.safeParse(raw);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const now = new Date().toISOString();
  const newTitle = parsed.data.title?.trim() || `${existing.title} (Kopie)`;

  if (parsed.data.includeHistory) {
    const cloned = await saveSession({
      ...existing,
      id: crypto.randomUUID().slice(0, 12),
      title: newTitle,
      createdAt: now,
      updatedAt: now,
    });
    return c.json({ item: cloned }, 201);
  }

  const loc = await getLocation(existing.locationId);
  const freshBase = await saveSession({
    ...existing,
    id: crypto.randomUUID().slice(0, 12),
    title: newTitle,
    sceneState: loc?.defaultSceneState || existing.sceneState,
    gmNotes: "",
    resolvedContext: "",
    compressedSummary: "",
    compressedUntilIndex: 0,
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
  const initialized = await initializeSceneSession(freshBase);
  return c.json({ item: initialized }, 201);
});

async function buildSessionMarkdown(sessionId: string): Promise<{ title: string; markdown: string } | null> {
  const session = await getSession(sessionId);
  if (!session) return null;

  const [location, persona, gm, allCharacters] = await Promise.all([
    getLocation(session.locationId),
    session.personaId ? getPersona(session.personaId) : Promise.resolve(null),
    getGameMaster(session.gameMasterId),
    listCharacters(),
  ]);

  const charById = new Map(allCharacters.map((c) => [c.id, c]));
  const presentCharacters = session.characterIds
    .map((id) => charById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  // Voice map keyed by speakerName so NoteMate TTS can assign female/male voices per speaker
  const voices: Record<string, string> = {};
  if (gm) voices[gm.name] = gm.voiceGender || "";
  if (persona) voices[persona.name] = persona.voiceGender || "";
  for (const ch of presentCharacters) {
    voices[ch.name] = ch.voiceGender || "";
  }
  for (const msg of session.messages) {
    if (msg.kind === "image" || voices[msg.speakerName] !== undefined) continue;
    if (msg.speakerId && charById.has(msg.speakerId)) {
      voices[msg.speakerName] = charById.get(msg.speakerId)?.voiceGender || "";
    }
  }

  const frontmatterObj: Record<string, unknown> = {
    title: session.title,
    tags: ["skaldmate", "geschichte"],
    created: session.createdAt,
    updated: session.updatedAt,
    scene: {
      sessionId: session.id,
      modelId: session.modelId || null,
      imageModelId: session.imageModelId || null,
      sceneState: session.sceneState || "",
      variables: session.variables || {},
    },
    location: {
      id: session.locationId,
      name: location?.name || session.locationId,
    },
    gamemaster: {
      id: session.gameMasterId,
      name: gm?.name || session.gameMasterId,
      style: gm?.style || "",
      narrationFrequency: gm?.narrationFrequency || "dann_und_wann",
      voiceGender: gm?.voiceGender || "",
    },
    ...(persona
      ? {
        persona: {
          id: persona.id,
          name: persona.name,
          voiceGender: persona.voiceGender || "",
        },
      }
      : {}),
    characters: presentCharacters.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      voiceGender: c.voiceGender || "",
      modelId: c.modelId || null,
    })),
    voices,
  };

  const yamlHeader = stringifyYaml(frontmatterObj, { lineWidth: 120 }).trim();

  const lines: string[] = [
    "---",
    yamlHeader,
    "---",
    "",
    `# ${session.title}`,
    "",
    `- **Ort:** ${location?.name || session.locationId}`,
    `- **Spielleiter:** ${gm?.name || session.gameMasterId}`,
    persona ? `- **Persona:** ${persona.name}` : "",
    presentCharacters.length > 0 ? `- **Charaktere:** ${presentCharacters.map((c) => c.name).join(", ")}` : "",
    session.sceneState ? `- **Zustand:** ${session.sceneState}` : "",
    "",
  ].filter((line, idx, arr) => !(line === "" && arr[idx - 1] === "") && line !== undefined);

  if (session.compressedSummary?.trim()) {
    lines.push("## Bisherige Handlung", "", session.compressedSummary.trim(), "");
  }

  lines.push("## Geschichte", "");
  for (const msg of session.messages) {
    if (msg.kind === "narrator") {
      lines.push(`> *${msg.speakerName}:* ${msg.content}`, "");
    } else if (msg.kind === "image") {
      lines.push(`*(Szenenbild: ${msg.imagePrompt || msg.imageFile || "Bild"})*`, "");
    } else {
      lines.push(`**${msg.speakerName}:** ${msg.content}`, "");
    }
  }

  return { title: session.title, markdown: lines.join("\n").trim() + "\n" };
}

async function postNoteToNotemate(path: string, content: string): Promise<{ ok: boolean; path: string; note?: unknown }> {
  const configured = Deno.env.get("NOTEMATE_URL")?.trim();
  const candidates = configured ? [configured.replace(/\/$/, "")] : ["http://notemate:3003", "http://localhost:3003"];

  let lastError = "NoteMate nicht erreichbar";
  for (const baseUrl of candidates) {
    try {
      const res = await fetch(`${baseUrl}/api/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, content }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        lastError = typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
        continue;
      }
      return { ok: true, path, note: data.note };
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Netzwerkfehler";
    }
  }
  throw new Error(lastError);
}

skaldApi.get("/sessions/:id/markdown", async (c) => {
  const doc = await buildSessionMarkdown(c.req.param("id"));
  if (!doc) return c.json({ error: "Szene nicht gefunden" }, 404);
  return c.json(doc);
});

const exportNotemateBody = z.object({
  path: z.string().trim().min(1).refine(
    (val) => !val.startsWith("/") && !val.includes("..") && !val.includes("\0"),
    "Ungültiger Zielpfad",
  ).optional(),
});

skaldApi.post("/sessions/:id/export-notemate", async (c) => {
  const doc = await buildSessionMarkdown(c.req.param("id"));
  if (!doc) return c.json({ error: "Szene nicht gefunden" }, 404);

  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = exportNotemateBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const defaultSlug = slugifyName(doc.title, "geschichte");
  let targetPath = parsed.data.path?.trim() || `Geschichten/${defaultSlug}.md`;
  if (!targetPath.toLowerCase().endsWith(".md")) {
    targetPath = `${targetPath}.md`;
  }

  try {
    const result = await postNoteToNotemate(targetPath, doc.markdown);
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "NoteMate-Export fehlgeschlagen" }, 502);
  }
});

const patchSessionBody = z.object({
  title: z.string().trim().min(1).optional(),
  locationId: z.string().trim().min(1).optional(),
  personaId: z.string().optional(),
  characterIds: z.array(z.string()).optional(),
  inventory: z.array(z.string()).optional(),
  gmNotes: z.string().optional(),
  gameMasterId: z.string().trim().min(1).optional(),
  modelId: z.string().optional(),
  imageModelId: z.string().optional(),
  sceneState: z.string().optional(),
  compressedSummary: z.string().optional(),
});

skaldApi.patch("/sessions/:id", async (c) => {
  const existing = await getSession(c.req.param("id"));
  if (!existing) return c.json({ error: "Szene nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = patchSessionBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const body = parsed.data;
  const nextLocationId = body.locationId ?? existing.locationId;
  const nextPersonaId = body.personaId !== undefined ? body.personaId || undefined : existing.personaId;
  const nextCharacterIds = body.characterIds ?? existing.characterIds;
  const nextInventory = body.inventory ? body.inventory.map((item) => item.trim()).filter(Boolean) : existing.inventory;
  const nextSceneState = body.sceneState ?? existing.sceneState;
  const nextGmNotes = body.gmNotes ?? existing.gmNotes;
  const contextChanged = nextLocationId !== existing.locationId ||
    nextPersonaId !== existing.personaId ||
    nextSceneState !== existing.sceneState ||
    JSON.stringify(nextCharacterIds) !== JSON.stringify(existing.characterIds) ||
    JSON.stringify(nextInventory) !== JSON.stringify(existing.inventory);

  const updated = await saveSession({
    ...existing,
    title: body.title ?? existing.title,
    locationId: nextLocationId,
    personaId: nextPersonaId,
    characterIds: nextCharacterIds,
    inventory: nextInventory,
    gmNotes: nextGmNotes,
    gameMasterId: body.gameMasterId ?? existing.gameMasterId,
    modelId: body.modelId !== undefined ? body.modelId || undefined : existing.modelId,
    imageModelId: body.imageModelId !== undefined ? body.imageModelId || undefined : existing.imageModelId,
    sceneState: nextSceneState,
    resolvedContext: contextChanged ? "" : existing.resolvedContext,
    compressedSummary: body.compressedSummary ?? existing.compressedSummary,
  });
  return c.json({ item: updated });
});

skaldApi.delete("/sessions/:id", async (c) => {
  const ok = await deleteSession(c.req.param("id"));
  return ok ? c.json({ ok: true }) : c.json({ error: "Nicht gefunden" }, 404);
});

const editMessageBody = z.object({
  content: z.string().trim().min(1, "Nachricht darf nicht leer sein"),
});

skaldApi.patch("/sessions/:id/messages/:messageId", async (c) => {
  const existing = await getSession(c.req.param("id"));
  if (!existing) return c.json({ error: "Szene nicht gefunden" }, 404);

  const parsed = editMessageBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const messageId = c.req.param("messageId");
  const idx = existing.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return c.json({ error: "Nachricht nicht gefunden" }, 404);

  const nextMessages = existing.messages.map((m, i) => (i === idx ? { ...m, content: parsed.data.content } : m));
  const updated = await saveSession({
    ...existing,
    messages: nextMessages,
  });
  return c.json({ item: updated });
});

skaldApi.delete("/sessions/:id/messages/:messageId", async (c) => {
  const existing = await getSession(c.req.param("id"));
  if (!existing) return c.json({ error: "Szene nicht gefunden" }, 404);

  const messageId = c.req.param("messageId");
  const idx = existing.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return c.json({ error: "Nachricht nicht gefunden" }, 404);

  const fromHere = c.req.query("fromHere") === "1" || c.req.query("fromHere") === "true";
  const nextMessages = fromHere ? existing.messages.slice(0, idx) : existing.messages.filter((m) => m.id !== messageId);
  const updated = await saveSession({
    ...existing,
    messages: nextMessages,
    compressedUntilIndex: Math.min(existing.compressedUntilIndex, nextMessages.length),
  });
  return c.json({ item: updated });
});

const turnBody = z.object({
  message: z.string().optional(),
  forceCharacterId: z.string().optional(),
});

skaldApi.post("/sessions/:id/turn", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Szene nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = turnBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  try {
    const result = await runStoryTurn({
      session,
      userMessage: parsed.data.message,
      forceCharacterId: parsed.data.forceCharacterId,
    });
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Turn fehlgeschlagen" }, 500);
  }
});

const sceneImageBody = z.object({
  customPrompt: z.string().optional(),
  imageModelId: z.string().optional(),
});

skaldApi.post("/sessions/:id/scene-image", async (c) => {
  const session = await getSession(c.req.param("id"));
  if (!session) return c.json({ error: "Szene nicht gefunden" }, 404);
  const raw = await parseOptionalJsonBody(c);
  if (!raw.ok) return c.json({ error: "Ungültiger JSON-Body" }, 400);
  const parsed = sceneImageBody.safeParse(raw.data);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  try {
    const [location, allChars] = await Promise.all([
      getLocation(session.locationId),
      listCharacters(),
    ]);
    const activeChars = allChars.filter((ch) => session.characterIds.includes(ch.id));
    const prompt = parsed.data.customPrompt?.trim() || buildSceneImagePrompt(session, location, activeChars);
    const fileName = await generateAndSaveImage({
      prompt,
      modelId: parsed.data.imageModelId || session.imageModelId,
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

// Neutral Workshop Chat (right-side drawer with context-aware MCP tools)
const workshopBody = z.object({
  modelId: z.string().optional(),
  context: z.object({
    activeSessionId: z.string().optional(),
    activeSessionTitle: z.string().optional(),
    activeLocationId: z.string().optional(),
    sidebarTab: z.string().optional(),
    viewMode: z.string().optional(),
  }).optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1),
    }),
  ).min(1),
});

skaldApi.post("/workshop", async (c) => {
  const parsed = workshopBody.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  try {
    const model = resolveTextModel(parsed.data.modelId);
    const tools = createSkaldmateWorkshopTools();
    const ctx = parsed.data.context;
    const contextHint = [
      ctx?.viewMode ? `Aktuelle Ansicht: ${ctx.viewMode}` : "",
      ctx?.sidebarTab ? `Aktiver Sidebar-Tab: ${ctx.sidebarTab}` : "",
      ctx?.activeSessionId
        ? `Geöffneter Chat: "${ctx.activeSessionTitle ?? ctx.activeSessionId}" (ID: ${ctx.activeSessionId}, Ort-ID: ${
          ctx.activeLocationId ?? "unbekannt"
        })`
        : "Kein aktiver Chat geöffnet.",
    ].filter(Boolean).join(" | ");

    const systemPrompt = [
      "Du bist der kontextsensitive Werkstatt-Assistent in Skaldmate.",
      "Du hast direkten Zugriff auf die Skaldmate-MCP-Tools (skaldmate_list_*, skaldmate_get_*, skaldmate_save_*, skaldmate_delete_*), um bestehende Charaktere, Spielleiter, Personas, Orte, Szenen und aktive Sessions auszulesen und auf Wunsch direkt neu anzulegen oder zu aktualisieren.",
      `Aktueller UI-Kontext: ${contextHint}`,
      "Wenn der Nutzer sich auf den aktuellen Chat, vorhandene Figuren/Orte/Szenen bezieht, lies diese zuerst per Tool nach statt zu raten. Wenn du etwas anlegst oder änderst, bestätige kurz die erzeugte ID und wichtigsten Felder. Unterstützte Makros in Skaldmate: {{random:...}}, {{roll:2d20}}, {{rand:1-10}}, {{time}}, {{var:=wert}}, {{$var}}. Antworte präzise auf Deutsch.",
    ].join("\n\n");

    let result;
    let toolsFallbackNote = "";
    try {
      result = await generateText({
        model,
        system: systemPrompt,
        messages: parsed.data.messages,
        tools,
        stopWhen: stepCountIs(8),
      });
    } catch (toolErr) {
      const msg = toolErr instanceof Error ? toolErr.message : String(toolErr);
      const isBadRequest = /bad request|tool|function/i.test(msg);
      if (!isBadRequest) {
        throw toolErr;
      }
      console.warn("[Skaldmate Workshop] Modell unterstützt keine Tools, Fallback ohne Tools:", msg);
      result = await generateText({
        model,
        system: systemPrompt,
        messages: parsed.data.messages,
      });
      toolsFallbackNote = "\n\n_(Hinweis: Das gewählte Modell unterstützt keine Werkstatt-Tools, daher reine Text-Antwort.)_";
    }

    const toolsUsed = Array.from(
      new Set(
        (result.steps ?? []).flatMap((step) => (step.toolCalls ?? []).map((call) => call.toolName)),
      ),
    );
    const mutated = toolsUsed.some((name) => SKALD_MUTATING_TOOL_NAMES.has(name));
    const replyText = result.text.trim() || (toolsUsed.length > 0 ? "Werkstatt-Aktion ausgeführt." : "Keine Antwort erhalten.");

    return c.json({
      reply: `${replyText}${toolsFallbackNote}`,
      toolsUsed,
      mutated,
    });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "Werkstatt-Fehler" }, 500);
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
