/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ThemeToggle } from "@sleipnir/core";

export const ChatPage = () => {
  return (
    <div x-data="chatmate" class="flex h-screen overflow-hidden">
      {/* Mobile Backdrop */}
      <div
        x-show="mobileMenuOpen"
        x-on:click="mobileMenuOpen = false"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        style="display: none;"
      >
      </div>

      {/* Sidebar: Dialog-Liste & Lokale Datenhoheit */}
      <aside
        class="w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between z-50 md:z-10 md:relative"
        x-bind:class="mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex'"
      >
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
            {/* Close-Button nur Mobile */}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square md:hidden opacity-70 hover:opacity-100"
              x-on:click="mobileMenuOpen = false"
              title="Menü schließen"
            >
              ✕
            </button>
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
                    x-text="getChatIcon(chat)"
                  >
                  </span>
                  <span class="truncate" x-text="chat.title"></span>
                </div>

                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 hover:text-error transition px-1.5 text-xs shrink-0"
                  x-on:click="deleteChat(chat.id, $event)"
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
        <header class="navbar bg-base-100 border-b border-base-content/10 px-3 md:px-6 py-2 flex justify-between z-10 min-h-12 gap-2">
          <div class="flex items-center gap-1.5 md:gap-3 truncate min-w-0">
            {/* Hamburger: nur Mobile */}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square md:hidden shrink-0"
              x-on:click="mobileMenuOpen = !mobileMenuOpen"
              title="Chats"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <span
              class="font-bold text-sm md:text-lg truncate"
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
              <template x-for="group in modelGroups" x-bind:key="group.id">
                <optgroup x-bind:label="group.label">
                  <template x-for="m in group.models" x-bind:key="m.id">
                    <option x-bind:value="m.id" x-text="m.name"></option>
                  </template>
                </optgroup>
              </template>
            </select>

            <button
              type="button"
              class="btn btn-ghost btn-sm btn-circle opacity-70 hover:opacity-100"
              x-on:click="clearCurrentChat()"
              title="Aktuellen Chat leeren"
            >
              🗑️
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />
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
                  <div class="chat-bubble chat-bubble-secondary text-sm whitespace-pre-wrap leading-relaxed shadow-sm flex flex-col gap-2">
                    <template x-if="msg.imageUrl">
                      <div class="rounded-lg overflow-hidden max-w-xs max-h-60 bg-base-300">
                        <img
                          x-bind:src="msg.imageUrl"
                          alt="Angehängtes Bild"
                          class="w-full h-full object-cover"
                        />
                      </div>
                    </template>
                    <span x-show="msg.content" x-text="msg.content"></span>
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
                  <div class="chat-bubble chat-bubble-primary text-sm leading-relaxed prose prose-sm max-w-none text-primary-content shadow-sm overflow-x-auto">
                    <template x-if="msg.content && msg.content.length > 0">
                      <div x-html="renderMarkdown(msg.content)"></div>
                    </template>
                    <template x-if="!msg.content || msg.content.length === 0">
                      <span class="loading loading-dots loading-sm py-1"></span>
                    </template>
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
        </div>

        {/* Prompt Input Box */}
        <footer class="p-4 bg-base-200/50 border-t border-base-content/10">
          <div class="max-w-4xl mx-auto flex flex-col gap-2">
            {/* Image Preview if attachedImage exists */}
            <template x-if="attachedImage">
              <div class="relative inline-flex items-center gap-3 p-2 bg-base-300 rounded-lg w-fit border border-base-content/10 animate-fadeIn">
                <img
                  x-bind:src="attachedImage"
                  alt="Vorschau"
                  class="h-16 w-16 object-cover rounded-md border border-base-content/10"
                />
                <div class="text-xs flex flex-col justify-center pr-6">
                  <span class="font-medium text-base-content">
                    Bild im Zwischenspeicher
                  </span>
                  <span class="opacity-60 text-[10px]">
                    Wird mit deiner Nachricht analysiert
                  </span>
                </div>
                <button
                  type="button"
                  class="btn btn-circle btn-xs btn-ghost absolute top-1 right-1 text-base-content/70 hover:text-error"
                  x-on:click="removeAttachedImage()"
                  title="Bild entfernen"
                >
                  ✕
                </button>
              </div>
            </template>

            <form
              x-on:submit="onSubmitForm($event)"
              class="flex gap-2 items-end"
            >
              {/* Attachment Button */}
              <label
                class="btn btn-square btn-ghost border border-base-content/20 hover:border-primary shrink-0"
                title="Bild anhängen (oder per Strg+V einfügen)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 opacity-70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <input
                  type="file"
                  class="hidden"
                  accept="image/*"
                  x-on:change="handleFileSelect($event)"
                />
              </label>

              <textarea
                x-model="inputPrompt"
                x-on:keydown="onPromptKeydown($event)"
                x-on:paste="handlePaste($event)"
                x-on:drop="handleDrop($event)"
                x-on:dragover="onDragOver($event)"
                x-bind:placeholder="isImageModelSelected() ? 'Bild-Prompt eingeben... (z.B. Ein Espresso auf Marmor)' : 'Nachricht schreiben... (Bilder per Strg+V pasten, /image für Generierung)'"
                class="textarea textarea-bordered flex-1 min-h-[52px] max-h-36 resize-none focus:outline-primary leading-snug"
                rows={1}
                x-bind:disabled="isLoading"
              >
              </textarea>

              <button
                type="submit"
                class="btn btn-primary px-5 shadow-sm"
                x-bind:disabled="isLoading || (!inputPrompt.trim() && !attachedImage)"
              >
                <span
                  x-show="!isLoading"
                  x-text="isImageModelSelected() ? 'Generieren 🎨' : 'Senden 🚀'"
                >
                  Senden 🚀
                </span>
                <span
                  x-show="isLoading"
                  class="loading loading-spinner loading-xs"
                >
                </span>
              </button>
            </form>

            <div class="flex justify-between items-center px-1 text-[11px] opacity-60">
              <span>
                💡 Tipp: Bilder direkt per <code>Strg+V</code> einfügen oder <code>/image Prompt</code> nutzen.
              </span>
              <span>100% Client-Side Storage</span>
            </div>
          </div>
        </footer>
      </main>

      {/* Bestätigungs-Dialog: Chat löschen */}
      <dialog id="confirm-delete-dialog" class="modal">
        <div class="modal-box max-w-sm">
          <h3 class="font-bold text-lg mb-1">Chat löschen?</h3>
          <p class="text-sm text-base-content/70 mb-6">
            Dieser Chat und alle Nachrichten darin werden unwiderruflich gelöscht.
          </p>
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-ghost"
              x-on:click="cancelDeleteChat()"
            >
              Abbrechen
            </button>
            <button
              type="button"
              class="btn btn-error"
              x-on:click="confirmDeleteChat()"
            >
              Löschen
            </button>
          </div>
        </div>
        {/* Backdrop-Klick schließt den Dialog */}
        <form method="dialog" class="modal-backdrop">
          <button type="button" x-on:click="cancelDeleteChat()">
            close
          </button>
        </form>
      </dialog>
    </div>
  );
};
