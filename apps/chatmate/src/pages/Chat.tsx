/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export const ChatPage = () => {
  return (
    <div x-data="chatmate" class="flex h-screen overflow-hidden">
      {/* Sidebar: Dialog-Liste & Lokale Datenhoheit */}
      <aside class="w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between hidden md:flex z-10">
        <div class="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Logo & Status */}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">🤖</span>
              <div>
                <h1 class="text-lg font-black text-primary leading-tight">
                  Chatmate
                </h1>
                <p class="text-[10px] tracking-wider uppercase opacity-60">
                  Zero-Log • Local Store
                </p>
              </div>
            </div>
            <div class="flex items-center gap-1.5" title="Provider Status">
              <div
                class="tooltip tooltip-bottom"
                data-tip="OpenRouter API Key Status"
              >
                <span
                  class="badge badge-xs"
                  x-bind:class="providerStatus.openrouter ? 'badge-success' : 'badge-ghost opacity-40'"
                >
                  OR
                </span>
              </div>
              <div
                class="tooltip tooltip-bottom"
                data-tip="Venice AI Key Status"
              >
                <span
                  class="badge badge-xs"
                  x-bind:class="providerStatus.venice ? 'badge-success' : 'badge-ghost opacity-40'"
                >
                  VN
                </span>
              </div>
            </div>
          </div>

          {/* Neuer Dialog Button */}
          <button
            type="button"
            class="btn btn-primary btn-sm w-full gap-2 shadow-sm mt-1"
            x-on:click="newChat()"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Neuer Dialog
          </button>

          <div class="divider my-0 text-xs opacity-50">Dialoge</div>

          {/* Chat List (Stored in localStorage) */}
          <div class="flex-1 overflow-y-auto space-y-1 pr-1">
            <template x-for="chat in chats" x-bind:key="chat.id">
              <div
                class="group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition cursor-pointer"
                x-bind:class="currentChatId === chat.id ? 'bg-primary text-primary-content font-medium shadow-sm' : 'hover:bg-base-300 text-base-content/80'"
                x-on:click="selectChat(chat.id)"
              >
                <div class="flex items-center gap-2.5 truncate flex-1 min-w-0">
                  <span
                    class="text-xs opacity-70 shrink-0"
                    x-text="chat.messages.some(m => m.type === 'image') ? '🎨' : '💬'"
                  >
                  </span>
                  <span class="truncate" x-text="chat.title"></span>
                </div>

                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 hover:text-error transition px-1.5 text-xs shrink-0"
                  x-on:click="$event.stopPropagation(); deleteChat(chat.id)"
                  title="Löschen"
                >
                  ✕
                </button>
              </div>
            </template>
          </div>
        </div>

        {/* Sidebar Footer: Backup & Local Privacy */}
        <div class="p-4 border-t border-base-content/10 bg-base-200/50 space-y-2">
          <div class="flex items-center justify-between text-xs text-base-content/70">
            <span>
              Speicher: <strong>Browser Local</strong>
            </span>
            <div class="flex gap-2">
              <button
                type="button"
                class="hover:underline font-mono"
                x-on:click="exportData()"
                title="Chats als JSON herunterladen"
              >
                Export
              </button>
              <span>•</span>
              <label class="hover:underline font-mono cursor-pointer">
                Import
                <input
                  type="file"
                  class="hidden"
                  accept="application/json"
                  x-on:change="importData($event)"
                />
              </label>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main class="flex-1 flex flex-col bg-base-100 overflow-hidden relative">
        {/* Top Navbar */}
        <header class="navbar bg-base-100 border-b border-base-content/10 px-6 py-2 flex justify-between z-10">
          <div class="flex items-center gap-3">
            <span
              class="font-bold text-base md:text-lg truncate max-w-xs md:max-w-md"
              x-text="currentChat ? currentChat.title : 'Chatmate'"
            >
            </span>
          </div>

          <div class="flex items-center gap-3">
            {/* Model Selector */}
            <select
              class="select select-bordered select-sm max-w-xs font-mono text-xs"
              x-model="activeModel"
            >
              <optgroup label="OpenRouter (Text & Code)">
                <option value="openrouter:anthropic/claude-3.5-sonnet">
                  Claude 3.5 Sonnet
                </option>
                <option value="openrouter:openai/gpt-4o">GPT-4o</option>
                <option value="openrouter:meta-llama/llama-3.3-70b-instruct">
                  Llama 3.3 70B
                </option>
                <option value="openrouter:deepseek/deepseek-r1">
                  DeepSeek R1
                </option>
              </optgroup>
              <optgroup label="Venice AI (Privacy & Uncensored)">
                <option value="venice:llama-3.3-70b">Venice Llama 3.3</option>
                <option value="venice:deepseek-r1-671b">
                  Venice DeepSeek R1
                </option>
                <option value="venice:mistral-codestral-22b">
                  Venice Codestral 22B
                </option>
              </optgroup>
              <optgroup label="Bildgenerierung">
                <option value="venice:flux-dev">Flux Dev (Venice)</option>
                <option value="venice:flux-dev-uncensored">
                  Flux Dev Uncensored
                </option>
                <option value="venice:fluently-xl">
                  Fluently XL (Venice)
                </option>
                <option value="fallback:pollinations">
                  Pollinations (Fallback)
                </option>
              </optgroup>
            </select>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle opacity-70 hover:opacity-100"
              x-on:click="clearCurrentChat()"
              title="Aktuellen Chat leeren"
            >
              🗑️
            </button>
          </div>
        </header>

        {/* Message Thread */}
        <div
          id="chat-thread"
          class="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl w-full mx-auto"
        >
          <template
            x-for="msg in (currentChat ? currentChat.messages : [])"
            x-bind:key="msg.id"
          >
            <div>
              {/* User Message */}
              <template x-if="msg.role === 'user'">
                <div class="chat chat-end animate-fadeIn">
                  <div class="chat-header text-xs opacity-50 mb-1">Du</div>
                  <div
                    class="chat-bubble chat-bubble-secondary text-sm whitespace-pre-wrap leading-relaxed shadow-sm"
                    x-text="msg.content"
                  >
                  </div>
                </div>
              </template>

              {/* Assistant Message: Text */}
              <template x-if="msg.role === 'assistant' && msg.type === 'text'">
                <div class="chat chat-start animate-fadeIn">
                  <div class="chat-image avatar placeholder">
                    <div class="bg-primary text-primary-content rounded-full w-9">
                      <span class="text-xs font-bold">AI</span>
                    </div>
                  </div>
                  <div class="chat-header text-xs opacity-50 mb-1">
                    Chatmate
                  </div>
                  <div
                    class="chat-bubble chat-bubble-primary text-sm leading-relaxed prose prose-sm max-w-none text-primary-content shadow-sm overflow-x-auto"
                    x-html="renderMarkdown(msg.content)"
                  >
                  </div>
                </div>
              </template>

              {/* Assistant Message: Image */}
              <template x-if="msg.role === 'assistant' && msg.type === 'image'">
                <div class="chat chat-start animate-fadeIn">
                  <div class="chat-image avatar placeholder">
                    <div class="bg-accent text-accent-content rounded-full w-9">
                      <span class="text-xs font-bold">IMG</span>
                    </div>
                  </div>
                  <div class="chat-header text-xs opacity-50 mb-1">
                    Bildgenerator
                  </div>
                  <div class="chat-bubble bg-base-200 border border-base-content/10 p-4 space-y-3 max-w-md shadow-sm">
                    <p
                      class="text-xs opacity-75 font-mono"
                      x-text="'Prompt: ' + msg.content"
                    >
                    </p>

                    {/* Loading State */}
                    <div
                      x-show="msg.loading"
                      class="h-64 flex flex-col items-center justify-center bg-base-300 rounded-xl gap-3 animate-pulse"
                    >
                      <span class="loading loading-spinner loading-lg text-primary">
                      </span>
                      <span class="text-xs opacity-60">
                        Generiere Bild via Flux / Venice...
                      </span>
                    </div>

                    {/* Error State */}
                    <div
                      x-show="msg.error"
                      class="alert alert-error text-xs shadow"
                      x-text="msg.error"
                    >
                    </div>

                    {/* Image Result */}
                    <div
                      x-show="msg.imageUrl && !msg.loading"
                      class="rounded-xl overflow-hidden shadow-lg border border-base-content/10 bg-base-300 group relative"
                    >
                      <img
                        x-bind:src="msg.imageUrl"
                        x-bind:alt="msg.content"
                        class="w-full h-auto object-cover transition duration-300 hover:scale-[1.02]"
                        loading="lazy"
                      />
                    </div>

                    <div
                      x-show="msg.imageUrl && !msg.loading"
                      class="flex justify-between items-center text-xs pt-1"
                    >
                      <span class="badge badge-success badge-sm font-mono">
                        Generiert
                      </span>
                      <a
                        x-bind:href="msg.imageUrl"
                        target="_blank"
                        download="image.png"
                        class="btn btn-ghost btn-xs gap-1"
                      >
                        Vollbild ↗
                      </a>
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </template>

          {/* Real-time Streaming Dots indicator */}
          <div x-show="isLoading" class="chat chat-start">
            <div class="chat-image avatar placeholder">
              <div class="bg-primary/50 text-primary-content rounded-full w-9">
                <span class="text-xs">AI</span>
              </div>
            </div>
            <div class="chat-bubble chat-bubble-primary opacity-80 text-sm py-2 px-4">
              <span class="loading loading-dots loading-sm"></span>
            </div>
          </div>
        </div>

        {/* Prompt Input Box */}
        <footer class="p-4 bg-base-200/50 border-t border-base-content/10">
          <div class="max-w-4xl mx-auto flex flex-col gap-2">
            <form
              x-on:submit="$event.preventDefault(); submitMessage()"
              class="flex gap-2 items-end"
            >
              <textarea
                x-model="inputPrompt"
                x-on:keydown="if ($event.key === 'Enter' && !$event.shiftKey) { $event.preventDefault(); submitMessage(); }"
                placeholder="Nachricht schreiben... (/image für Bilder, Shift+Enter für Zeilenumbruch)"
                class="textarea textarea-bordered flex-1 min-h-[52px] max-h-36 resize-none focus:outline-primary leading-snug"
                rows={1}
                x-bind:disabled="isLoading"
              >
              </textarea>

              <button
                type="submit"
                class="btn btn-primary px-5 shadow-sm"
                x-bind:disabled="isLoading || !inputPrompt.trim()"
              >
                <span x-show="!isLoading">Senden 🚀</span>
                <span
                  x-show="isLoading"
                  class="loading loading-spinner loading-xs"
                >
                </span>
              </button>
            </form>

            <div class="flex justify-between items-center px-1 text-[11px] opacity-60">
              <span>
                💡 Tipp: Schreibe <code>/image Ein futuristisches Schiff</code>
                {" "}
                oder wähle ein Bildmodell oben rechts.
              </span>
              <span>100% Client-Side Storage</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};
