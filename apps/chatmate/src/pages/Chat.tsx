/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export const ChatPage = () => {
  return (
    <div class="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside class="w-72 bg-base-200 border-r border-base-content/10 flex flex-col justify-between hidden md:flex">
        <div class="p-4 flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-black text-primary tracking-wide">
              Chatmate 🤖
            </h1>
            <span class="badge badge-accent badge-sm font-mono">v0.1</span>
          </div>

          <button
            type="button"
            class="btn btn-primary btn-sm w-full gap-2"
            x-on:click="chats.unshift({ id: Date.now(), title: 'Neuer Chat', messages: [] }); currentChatId = chats[0].id"
          >
            + Neuer Dialog
          </button>

          <div class="divider my-1 text-xs opacity-50">Verlauf</div>

          <ul class="menu menu-sm w-full p-0 gap-1 overflow-y-auto max-h-[65vh]">
            <li>
              <a class="active flex justify-between">
                <span class="truncate">Allgemeiner Assistent</span>
                <span class="badge badge-ghost badge-xs">Text</span>
              </a>
            </li>
            <li>
              <a class="flex justify-between">
                <span class="truncate">Cyberpunk Küchenchef</span>
                <span class="badge badge-ghost badge-xs">Bild</span>
              </a>
            </li>
          </ul>
        </div>

        <div class="p-4 border-t border-base-content/10 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="avatar placeholder">
              <div class="bg-neutral text-neutral-content rounded-full w-8">
                <span class="text-xs">SW</span>
              </div>
            </div>
            <span class="text-sm font-semibold truncate">Stefan</span>
          </div>
          <button type="button" class="btn btn-ghost btn-circle btn-xs">
            ⚙️
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main class="flex-1 flex flex-col bg-base-100 overflow-hidden">
        {/* Top Navbar */}
        <header class="navbar bg-base-100 border-b border-base-content/10 px-6 py-2 flex justify-between">
          <div class="flex items-center gap-3">
            <span class="font-bold text-lg">NextChat Studio</span>
            <div class="badge badge-outline badge-primary text-xs">
              Gemini / GPT / Flux
            </div>
          </div>

          <div class="flex items-center gap-2">
            <select class="select select-bordered select-sm">
              <option selected>Text & Reasoning (Chat)</option>
              <option>Bildgenerierung (Studio)</option>
              <option>Multimodal (Text + Bild)</option>
            </select>
          </div>
        </header>

        {/* Message Thread */}
        <div
          id="chat-thread"
          class="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl w-full mx-auto"
        >
          {/* Assistant Welcome */}
          <div class="chat chat-start">
            <div class="chat-image avatar placeholder">
              <div class="bg-primary text-primary-content rounded-full w-10">
                <span class="text-sm">AI</span>
              </div>
            </div>
            <div class="chat-header text-xs opacity-50 mb-1">
              Chatmate AI • Jetzt
            </div>
            <div class="chat-bubble chat-bubble-primary text-sm leading-relaxed">
              Willkommen bei **Chatmate**! Ich kann Textanfragen beantworten,
              Code schreiben und fotorealistische Bilder für dich generieren.
              Worüber sprechen wir?
            </div>
          </div>
        </div>

        {/* Prompt Input Box */}
        <footer class="p-4 bg-base-200/50 border-t border-base-content/10">
          <div class="max-w-4xl mx-auto flex flex-col gap-2">
            <form
              hx-post="./api/chat"
              hx-target="#chat-thread"
              hx-swap="beforeend"
              class="flex gap-2 items-end"
            >
              <textarea
                name="prompt"
                placeholder="Schreibe eine Nachricht oder tippe '/image [prompt]' für Bilder..."
                class="textarea textarea-bordered flex-1 min-h-[52px] max-h-32 resize-none"
                rows={1}
                required
              >
              </textarea>

              <button
                type="submit"
                class="btn btn-primary px-6"
              >
                Senden 🚀
              </button>
            </form>

            <div class="flex justify-between items-center px-1 text-xs opacity-60">
              <span>
                Tipp:{" "}
                <code>
                  /image Ein leckeres Risotto auf rustikalem Holztisch
                </code>{" "}
                generiert direkt ein Bild.
              </span>
              <span>Deno 2 + Hono + HTMX</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
