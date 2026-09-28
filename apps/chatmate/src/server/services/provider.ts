/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
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
  provider: "openrouter" | "venice" | "fallback";
  type: "text" | "image";
}

export interface ProviderStatus {
  openrouter: boolean;
  venice: boolean;
}

const DEFAULT_MODELS: ModelInfo[] = [
  // OpenRouter Text Models
  {
    id: "openrouter:anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "openrouter",
    type: "text",
  },
  {
    id: "openrouter:openai/gpt-4o",
    name: "GPT-4o",
    provider: "openrouter",
    type: "text",
  },
  {
    id: "openrouter:meta-llama/llama-3.3-70b-instruct",
    name: "Llama 3.3 70B",
    provider: "openrouter",
    type: "text",
  },
  {
    id: "openrouter:deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "openrouter",
    type: "text",
  },

  // Venice Text Models (Privacy/Uncensored)
  {
    id: "venice:llama-3.3-70b",
    name: "Venice Llama 3.3 70B",
    provider: "venice",
    type: "text",
  },
  {
    id: "venice:deepseek-r1-671b",
    name: "Venice DeepSeek R1 (671B)",
    provider: "venice",
    type: "text",
  },
  {
    id: "venice:mistral-codestral-22b",
    name: "Venice Codestral 22B",
    provider: "venice",
    type: "text",
  },

  // Venice Image Models
  {
    id: "venice:flux-dev",
    name: "Flux Dev (Venice)",
    provider: "venice",
    type: "image",
  },
  {
    id: "venice:flux-dev-uncensored",
    name: "Flux Dev Uncensored",
    provider: "venice",
    type: "image",
  },
  {
    id: "venice:fluently-xl",
    name: "Fluently XL (Venice)",
    provider: "venice",
    type: "image",
  },

  // Fallback Image
  {
    id: "fallback:pollinations",
    name: "Pollinations (Keyless Fallback)",
    provider: "fallback",
    type: "image",
  },
];

export function getProviderStatus(): ProviderStatus {
  return {
    openrouter: Boolean(Deno.env.get("OPENROUTER_API_KEY")),
    venice: Boolean(Deno.env.get("VENICE_API_KEY")),
  };
}

export function getAvailableModels(): ModelInfo[] {
  return DEFAULT_MODELS;
}

/**
 * Streams chat completions from OpenRouter or Venice AI.
 * ZERO LOGGING: Payload and tokens are strictly piped through without logging.
 */
export async function streamChatCompletion(
  req: ChatRequest,
): Promise<ReadableStream<Uint8Array>> {
  const [providerTag, ...modelParts] = req.model.split(":");
  const targetModel = modelParts.join(":");

  if (providerTag === "venice") {
    return await handleVeniceChatStream(
      targetModel,
      req.messages,
      req.temperature,
    );
  }

  // Default to OpenRouter
  return await handleOpenRouterChatStream(
    targetModel || req.model,
    req.messages,
    req.temperature,
  );
}

async function handleOpenRouterChatStream(
  model: string,
  messages: ChatMessage[],
  temperature = 0.7,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("OPENROUTER_API_KEY");

  // Fallback stream when no API key is configured
  if (!apiKey) {
    return createSimulatedStream(
      "⚠️ **Kein OpenRouter API-Key konfiguriert.**\n\nBitte hinterlege `OPENROUTER_API_KEY` in der `.env`-Datei oder Systemeinstellung auf dem Server.",
    );
  }

  const upstreamResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3002",
        "X-Title": "Chatmate",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true,
      }),
    },
  );

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const status = upstreamResponse.status;
    return createSimulatedStream(
      `❌ **Fehler bei OpenRouter (HTTP ${status})**. Bitte überprüfe Guthaben und API-Key.`,
    );
  }

  return upstreamResponse.body;
}

async function handleVeniceChatStream(
  model: string,
  messages: ChatMessage[],
  temperature = 0.7,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("VENICE_API_KEY");

  if (!apiKey) {
    return createSimulatedStream(
      "⚠️ **Kein Venice API-Key konfiguriert.**\n\nBitte hinterlege `VENICE_API_KEY` in der `.env`-Datei auf dem Server.",
    );
  }

  const upstreamResponse = await fetch(
    "https://api.venice.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        stream: true,
      }),
    },
  );

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const status = upstreamResponse.status;
    return createSimulatedStream(
      `❌ **Fehler bei Venice AI (HTTP ${status})**. Bitte überprüfe den API-Key.`,
    );
  }

  return upstreamResponse.body;
}

/**
 * Generates an image using Venice AI or Pollinations fallback.
 * ZERO LOGGING: Prompts and images are never logged to console or disk.
 */
export async function generateImage(
  req: ImageRequest,
): Promise<{ imageUrl: string }> {
  const apiKey = Deno.env.get("VENICE_API_KEY");
  const isVenice = req.model?.startsWith("venice:");

  if (isVenice && apiKey) {
    const veniceModel = (req.model ?? "venice:flux-dev").replace(
      "venice:",
      "",
    );
    const dimensions = getDimensions(req.aspectRatio);

    const res = await fetch("https://api.venice.ai/api/v1/image/generate", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: veniceModel,
        prompt: req.prompt,
        width: dimensions.width,
        height: dimensions.height,
        hide_watermark: true,
        return_binary: false,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.images) && data.images.length > 0) {
        return { imageUrl: `data:image/webp;base64,${data.images[0]}` };
      }
    }
  }

  // Keyless Fallback via Pollinations
  const dimensions = getDimensions(req.aspectRatio);
  const encoded = encodeURIComponent(req.prompt);
  const fallbackUrl =
    `https://image.pollinations.ai/prompt/${encoded}?width=${dimensions.width}&height=${dimensions.height}&nologo=true`;

  return { imageUrl: fallbackUrl };
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
