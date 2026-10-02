/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { loadProviderConfig, type ResolvedProvider } from "./config.ts";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type MessageContent = string | ContentPart[];

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: MessageContent;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
}

export interface ImageRequest {
  prompt: string;
  model?: string;
  aspectRatio?: "1:1" | "16:9" | "9:16";
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  type: "text" | "image";
}

export type ProviderStatus = Record<string, boolean>;

/**
 * Returns dynamic provider status indicating if the provider is ready
 * (either has an apiKey or does not require one).
 */
export function getProviderStatus(): ProviderStatus {
  const providers = loadProviderConfig();
  const status: ProviderStatus = {};
  for (const p of providers) {
    status[p.id] = Boolean(p.apiKey);
  }
  return status;
}

/**
 * Extracts flattened list of available text and image models from config.
 */
export function getAvailableModels(): ModelInfo[] {
  const providers = loadProviderConfig();
  const models: ModelInfo[] = [];

  for (const p of providers) {
    for (const m of p.textModels) {
      models.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        provider: p.id,
        providerName: p.name,
        type: "text",
      });
    }

    for (const m of p.imageModels) {
      models.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        provider: p.id,
        providerName: p.name,
        type: "image",
      });
    }
  }

  return models;
}

function findProvider(
  providers: ResolvedProvider[],
  providerId: string,
): ResolvedProvider | undefined {
  return providers.find((p) => p.id === providerId);
}

/**
 * Streams chat completions based on configured provider baseUrl and apiKey.
 * ZERO LOGGING: Payload and tokens are strictly piped through without logging.
 */
export async function streamChatCompletion(
  req: ChatRequest,
): Promise<ReadableStream<Uint8Array>> {
  const [providerTag, ...modelParts] = req.model.split(":");
  const targetModel = modelParts.join(":");

  const providers = loadProviderConfig();
  const provider = findProvider(providers, providerTag) || providers[0];

  if (!provider) {
    return createSimulatedStream(
      `❌ **Unbekannter Provider:** \`${providerTag}\`. Bitte überprüfe \`providers.json\`.`,
    );
  }

  if (!provider.apiKey) {
    return createSimulatedStream(
      `⚠️ **Kein API-Key für ${provider.name} konfiguriert.**\n\nBitte hinterlege den Key in der \`.env\`-Datei oder als Umgebungsvariable auf dem Server.`,
    );
  }

  const endpoint = `${provider.baseUrl}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${provider.apiKey}`,
  };

  try {
    const upstreamResponse = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: targetModel || req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      const status = upstreamResponse.status;
      let detail = "";
      try {
        const errorText = await upstreamResponse.text();
        const parsed = JSON.parse(errorText);
        detail = parsed.error?.message || parsed.message || errorText;
      } catch {
        // detail remains empty
      }

      const suffix = detail ? `\n> ${detail}` : " Bitte überprüfe Guthaben und Modellnamen.";
      return createSimulatedStream(
        `❌ **Fehler bei ${provider.name} (HTTP ${status}):**${suffix}`,
      );
    }

    return upstreamResponse.body;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return createSimulatedStream(
      `❌ **Verbindungsfehler zu ${provider.name}:** ${msg}`,
    );
  }
}

/**
 * Generates an image using configured providers.
 * ZERO LOGGING: Prompts and images are never logged to console or disk.
 */
export async function generateImage(
  req: ImageRequest,
): Promise<{ imageUrl: string }> {
  const providers = loadProviderConfig();
  const [providerTag, ...modelParts] = (req.model ?? "").split(":");
  const targetModel = modelParts.join(":");

  const provider = findProvider(providers, providerTag) ||
    providers.find((p) => p.imageModels.length > 0);

  if (!provider || !provider.apiKey) {
    throw new Error(
      `Kein API-Key für Bildgenerierung konfiguriert (${provider?.name ?? "Kein Provider"}).`,
    );
  }

  const dimensions = getDimensions(req.aspectRatio);

  // Venice AI Image Generation
  if (provider.id === "venice") {
    const endpoint = `${provider.baseUrl}/image/generate`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: targetModel || "flux-2-pro",
        prompt: req.prompt,
        width: dimensions.width,
        height: dimensions.height,
        hide_watermark: true,
        return_binary: false,
      }),
    });

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson.error) detail += `: ${errJson.error}`;
      } catch {
        // ignore
      }
      throw new Error(`Venice AI: ${detail}`);
    }

    const data = await res.json();
    if (Array.isArray(data.images) && data.images.length > 0) {
      return { imageUrl: `data:image/webp;base64,${data.images[0]}` };
    }
    throw new Error("Venice AI hat kein Bild zurückgegeben.");
  }

  throw new Error(
    `Bildgenerierung für Provider '${provider.name}' nicht implementiert.`,
  );
}

function getDimensions(
  aspectRatio: "1:1" | "16:9" | "9:16" = "1:1",
): { width: number; height: number } {
  if (aspectRatio === "16:9") {
    return { width: 1024, height: 576 };
  }
  if (aspectRatio === "9:16") {
    return { width: 576, height: 1024 };
  }
  return { width: 1024, height: 1024 };
}

function createSimulatedStream(message: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = `data: ${
    JSON.stringify({
      choices: [{ delta: { content: message } }],
    })
  }\n\ndata: [DONE]\n\n`;

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}
