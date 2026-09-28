/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Sleipnir, SleipnirContext } from "@sleipnir/core";

export function chatApi(app: Sleipnir, basePath: string) {
  app.post(basePath, handleChatPrompt);
}

async function handleChatPrompt(c: SleipnirContext) {
  const body = await c.req.parseBody();
  const rawPrompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  // Bouncer-Pattern: sofort validieren
  if (!rawPrompt) {
    return c.html("");
  }

  const isImageGen = rawPrompt.startsWith("/image");
  const cleanPrompt = isImageGen
    ? rawPrompt.replace(/^\/image\s*/, "")
    : rawPrompt;

  const userBubble = (
    <div class="chat chat-end animate-fadeIn">
      <div class="chat-header text-xs opacity-50 mb-1">Du • Jetzt</div>
      <div class="chat-bubble chat-bubble-secondary text-sm">
        {rawPrompt}
      </div>
    </div>
  );

  let assistantBubble;
  if (isImageGen) {
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    // Placeholder generator (e.g. pollinations.ai or standard image endpoint)
    const imageUrl =
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;

    assistantBubble = (
      <div class="chat chat-start animate-fadeIn">
        <div class="chat-image avatar placeholder">
          <div class="bg-accent text-accent-content rounded-full w-10">
            <span class="text-sm">IMG</span>
          </div>
        </div>
        <div class="chat-header text-xs opacity-50 mb-1">
          Chatmate Studio • Bildgenerator
        </div>
        <div class="chat-bubble bg-base-200 border border-base-content/10 p-4 space-y-3 max-w-lg">
          <p class="text-xs opacity-75 font-mono">Prompt: "{cleanPrompt}"</p>
          <div class="rounded-xl overflow-hidden shadow-lg border border-base-content/10 bg-base-300">
            <img
              src={imageUrl}
              alt={cleanPrompt}
              class="w-full h-auto object-cover hover:scale-105 transition duration-300"
              loading="lazy"
            />
          </div>
          <div class="flex justify-between items-center text-xs">
            <span class="badge badge-success badge-sm">Generiert</span>
            <a
              href={imageUrl}
              target="_blank"
              download="image.png"
              class="btn btn-ghost btn-xs"
            >
              Vollbild öffnen ↗
            </a>
          </div>
        </div>
      </div>
    );
  } else {
    assistantBubble = (
      <div class="chat chat-start animate-fadeIn">
        <div class="chat-image avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-10">
            <span class="text-sm">AI</span>
          </div>
        </div>
        <div class="chat-header text-xs opacity-50 mb-1">
          Chatmate AI • Jetzt
        </div>
        <div class="chat-bubble chat-bubble-primary text-sm leading-relaxed">
          <p>
            Du hast gefragt: <em>"{cleanPrompt}"</em>
          </p>
          <p class="mt-2 text-xs opacity-80">
            (Das LLM-Backend kann hier via Streaming SSE oder API-Key angebunden
            werden.)
          </p>
        </div>
      </div>
    );
  }

  return c.html(
    <>
      {userBubble}
      {assistantBubble}
    </>,
  );
}
