/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { loadProviderConfig, type ResolvedProvider } from "./config.ts";
import { saveAssetBytes } from "./storage.ts";
import type { Character, Location, Persona, StorySession } from "./types.ts";

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  const extRaw = match ? match[1].toLowerCase() : "png";
  if (extRaw.includes("svg")) {
    throw new Error("SVG-Bilder werden aus Sicherheitsgründen nicht unterstützt.");
  }
  const b64 = match ? match[2] : dataUrl;
  let bin: string;
  try {
    bin = atob(b64);
  } catch {
    throw new Error("Ungültige Base64-Bilddaten.");
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  const ext = extRaw === "jpeg" ? "jpg" : extRaw === "webp" ? "webp" : "png";
  return { bytes, ext };
}

function findImageProvider(
  providers: ResolvedProvider[],
  requestedModel?: string,
): { provider: ResolvedProvider; modelId: string } {
  const [providerTag, ...rest] = (requestedModel ?? "").split(":");
  const requestedRawModel = rest.join(":");

  const provider = (providerTag ? providers.find((p) => p.id === providerTag && Boolean(p.apiKey)) : undefined) ||
    providers.find((p) => Boolean(p.apiKey) && p.imageModels.length > 0);

  if (!provider || !provider.apiKey) {
    throw new Error("Kein API-Key für Bildgenerierung konfiguriert.");
  }

  const modelId = requestedRawModel || provider.imageModels[0]?.id || "";
  if (!modelId) {
    throw new Error(`Kein Bildmodell für Provider '${provider.name}' konfiguriert.`);
  }

  return { provider, modelId };
}

async function fetchProviderImageDataUrl(
  provider: ResolvedProvider,
  modelId: string,
  prompt: string,
  width: number,
  height: number,
): Promise<string> {
  if (provider.id === "venice") {
    const res = await fetch(`${provider.baseUrl}/image/generate`, {
      method: "POST",
      signal: AbortSignal.timeout(90_000),
      headers: {
        "Authorization": `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        width,
        height,
        hide_watermark: true,
        return_binary: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Venice AI Bildfehler: HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.images) || data.images.length === 0) {
      throw new Error("Venice AI hat kein Bild zurückgegeben.");
    }
    return `data:image/webp;base64,${data.images[0]}`;
  }

  // OpenRouter image-capable chat/completions endpoint
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(90_000),
    headers: {
      "Authorization": `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sleipnir.local",
      "X-Title": "Sleipnir Skaldmate",
    },
    body: JSON.stringify({
      model: modelId,
      modalities: ["image", "text"],
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`${provider.name} Bildfehler: HTTP ${res.status}`);
  }
  const data = await res.json();
  const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (
    typeof imgUrl !== "string" ||
    !imgUrl.startsWith("data:image/") ||
    imgUrl.startsWith("data:image/svg")
  ) {
    throw new Error(`${provider.name} hat kein Base64-Bild zurückgegeben.`);
  }
  return imgUrl;
}

/**
 * Generates an image via Venice AI or OpenRouter and persists it to ./data/skaldmate/assets/.
 */
export async function generateAndSaveImage(options: {
  prompt: string;
  modelId?: string;
  filePrefix: string;
  aspectRatio?: "1:1" | "16:9";
}): Promise<string> {
  const providers = loadProviderConfig();
  const { provider, modelId } = findImageProvider(providers, options.modelId);
  const width = options.aspectRatio === "16:9" ? 1024 : 768;
  const height = options.aspectRatio === "16:9" ? 576 : 768;

  const dataUrl = await fetchProviderImageDataUrl(provider, modelId, options.prompt, width, height);
  const { bytes, ext } = decodeDataUrl(dataUrl);
  const fileName = `${options.filePrefix}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
  return saveAssetBytes(fileName, bytes);
}

/**
 * Builds an atmospheric portrait prompt from a persona sheet.
 */
export function buildPersonaPortraitPrompt(persona: Persona): string {
  return [
    `Detailed character portrait of ${persona.name}`,
    persona.role ? `Role: ${persona.role}` : "",
    persona.appearance ? `Appearance: ${persona.appearance}` : "",
    persona.traits ? `Expression and vibe: ${persona.traits}` : "",
    "cinematic lighting, expressive portrait, high detail, no text, no watermark",
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Builds an atmospheric portrait prompt from a character sheet.
 */
export function buildCharacterPortraitPrompt(char: Character): string {
  return [
    `Detailed character portrait of ${char.name}`,
    char.role ? `Role: ${char.role}` : "",
    char.appearance ? `Appearance: ${char.appearance}` : "",
    char.personality ? `Expression and vibe: ${char.personality}` : "",
    "cinematic lighting, expressive portrait, high detail, no text, no watermark",
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Builds an atmospheric environment prompt from a location sheet.
 */
export function buildLocationImagePrompt(location: Location): string {
  return [
    `Atmospheric environment illustration of ${location.name}`,
    location.description ? location.description : "",
    location.atmosphere ? `Atmosphere: ${location.atmosphere}` : "",
    location.details ? `Details: ${location.details}` : "",
    "wide shot, detailed environment art, cinematic lighting, no people, no text, no watermark",
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Builds a top-down cartography or floorplan prompt from a location and its child locations.
 */
export function buildLocationMapPrompt(location: Location, childLocations: Location[] = []): string {
  const landmarks = childLocations
    .map((child) => child.description ? `${child.name} (${child.description.slice(0, 80)})` : child.name)
    .join("; ");

  return [
    `Detailed top-down RPG map or architectural floorplan of ${location.name}`,
    location.mapPrompt ? `Spatial layout: ${location.mapPrompt}` : "",
    !location.mapPrompt && location.description ? `Area overview: ${location.description}` : "",
    location.details ? `Key features and paths: ${location.details}` : "",
    landmarks ? `Sub-locations and landmarks to place on the map: ${landmarks}` : "",
    "bird's-eye view, clean hand-drawn cartography or blueprint layout, clear paths, entrances and landmarks, high readability, no characters, no watermark",
  ]
    .filter(Boolean)
    .join(". ");
}

/**
 * Builds a scene illustration prompt from the current location, characters, and latest messages.
 */
export function buildSceneImagePrompt(
  session: StorySession,
  location: Location | null,
  characters: Character[],
): string {
  const recentText = session.messages
    .slice(-4)
    .map((m) => `${m.speakerName}: ${m.content}`)
    .join(" | ")
    .slice(0, 500);

  const castDesc = characters
    .map((c) => `${c.name}${c.appearance ? ` (${c.appearance})` : ""}`)
    .join(", ");

  return [
    location ? `Setting: ${location.name} - ${location.description}. ${location.atmosphere}` : "",
    castDesc ? `Characters present: ${castDesc}` : "",
    session.sceneState ? `Current situation: ${session.sceneState}` : "",
    recentText ? `Moment to illustrate: ${recentText}` : "",
    "cinematic storytelling illustration, atmospheric lighting, no text, no speech bubbles",
  ]
    .filter(Boolean)
    .join(". ");
}
