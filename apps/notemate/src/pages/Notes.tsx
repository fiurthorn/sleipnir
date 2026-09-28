/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export const NotesPage = () => {
  return (
    <div x-data="notemate" class="flex h-screen overflow-hidden">
      {/* Toast Notification */}
      <div
        x-show="toastMessage"
        x-transition
        class="fixed bottom-5 right-5 z-50 alert alert-info shadow-lg w-auto py-2 px-4 text-xs font-medium"
        x-text="toastMessage"
        style="display: none;"
      >
      </div>

      {/* Sidebar: Hierarchischer Verzeichnisbaum & Suche */}
      <aside class="w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between hidden md:flex z-10">
        <div class="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Logo & Header */}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📝</span>
              <div>
                <h1 class="text-lg font-black text-primary leading-tight">
                  Notemate
                </h1>
                <p class="text-[10px] tracking-wider uppercase opacity-60">
                  Hierarchical Markdown
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square"
                x-on:click="createNewFolder()"
                title="Neuer Ordner im Stammverzeichnis"
              >
                📁+
              </button>
              <button
                type="button"
                class="btn btn-primary btn-xs btn-square"
                x-on:click="createNewNote()"
                title="Neue Notiz im Stammverzeichnis"
              >
                +
              </button>
            </div>
          </div>

          {/* Quick Search Input */}
          <div class="relative">
            <input
              type="text"
              placeholder="Notizen durchsuchen..."
              class="input input-bordered input-sm w-full pl-8 text-xs font-sans"
              x-model="searchQuery"
              x-on:input="performSearch()"
              x-on:keydown="if ($event.key === 'Escape') clearSearch()"
            />
            <span class="absolute left-2.5 top-2 text-xs opacity-50">🔍</span>
            <button
              type="button"
              x-show="searchQuery"
              x-on:click="clearSearch()"
              class="absolute right-2 top-2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          {/* Search Results List (if searching) */}
          <div
            x-show="searchQuery.trim().length > 0"
            class="flex-1 overflow-y-auto space-y-1 pr-1"
          >
            <div class="text-[11px] font-bold uppercase opacity-50 px-1 py-1">
              Suchergebnisse (
              <span x-text="searchResults.length"></span>)
            </div>

            <template x-for="res in searchResults" x-bind:key="res.path">
              <div
                class="p-2 rounded-lg text-xs hover:bg-base-300 cursor-pointer transition flex flex-col gap-0.5 border border-base-content/5"
                x-bind:class="currentNote.path === res.path ? 'bg-primary/10 border-primary/30' : ''"
                x-on:click="loadNote(res.path); clearSearch()"
              >
                <div class="font-semibold text-primary truncate flex items-center gap-1.5">
                  <span>📄</span>
                  <span x-text="res.title"></span>
                </div>
                <div
                  class="text-[10px] opacity-50 truncate font-mono"
                  x-text="res.path"
                >
                </div>
                <div
                  class="text-[11px] opacity-75 line-clamp-2 mt-0.5 italic"
                  x-text="res.snippet"
                >
                </div>
              </div>
            </template>

            <div
              x-show="searchResults.length === 0"
              class="text-xs opacity-50 text-center py-6"
            >
              Keine Notizen gefunden.
            </div>
          </div>

          {/* Hierarchical Tree View (Default view) */}
          <div
            x-show="!searchQuery.trim()"
            class="flex-1 overflow-y-auto space-y-0.5 pr-1 select-none text-xs"
          >
            <template
              x-for="item in visibleTreeItems"
              x-bind:key="item.path"
            >
              <div
                class="group flex items-center justify-between py-1.5 px-2 rounded-md transition cursor-pointer"
                x-bind:class="currentNote.path === item.path ? 'bg-primary text-primary-content font-medium shadow-sm' : 'hover:bg-base-300 text-base-content/85'"
                x-bind:style="'padding-left: ' + (item.depth * 14 + 8) + 'px'"
                x-on:click="if (item.type === 'directory') toggleFolder(item.path); else loadNote(item.path);"
              >
                <div class="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  {/* Folder Toggle Icon */}
                  <template x-if="item.type === 'directory'">
                    <span
                      class="text-[10px] opacity-60 w-3 text-center"
                      x-text="isFolderExpanded(item.path) ? '▼' : '▶'"
                    >
                    </span>
                  </template>
                  <template x-if="item.type === 'file'">
                    <span class="w-3"></span>
                  </template>

                  {/* Icon */}
                  <span
                    class="text-xs shrink-0"
                    x-text="item.type === 'directory' ? (isFolderExpanded(item.path) ? '📂' : '📁') : '📄'"
                  >
                  </span>

                  {/* Name */}
                  <span class="truncate" x-text="item.name"></span>
                </div>

                {/* Node Action Buttons */}
                <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-1 transition">
                  {/* If directory: Add file / Add subfolder buttons */}
                  <template x-if="item.type === 'directory'">
                    <button
                      type="button"
                      class="hover:text-primary p-0.5"
                      x-on:click="$event.stopPropagation(); createNewNote(item.path)"
                      title="Notiz in diesem Ordner anlegen"
                    >
                      +
                    </button>
                  </template>

                  {/* Rename */}
                  <button
                    type="button"
                    class="hover:text-primary p-0.5"
                    x-on:click="$event.stopPropagation(); renameItem(item.path)"
                    title="Umbenennen"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    class="hover:text-error p-0.5"
                    x-on:click="$event.stopPropagation(); deleteItem(item.path, item.type === 'directory')"
                    title="Löschen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </template>

            <div
              x-show="visibleTreeItems.length === 0"
              class="text-xs opacity-50 text-center py-6"
            >
              Noch keine Notizen vorhanden.
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div class="p-3 border-t border-base-content/10 bg-base-200/50 flex justify-between items-center text-[11px] text-base-content/60 font-mono">
          <span>📁 ./data/notes</span>
          <button
            type="button"
            class="hover:underline"
            x-on:click="refreshTree()"
            title="Dateibaum neu laden"
          >
            ↻ Sync
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <main class="flex-1 flex flex-col bg-base-100 overflow-hidden relative">
        {/* Top Navbar: Breadcrumbs & View Controls */}
        <header class="navbar bg-base-100 border-b border-base-content/10 px-6 py-2 flex justify-between z-10 min-h-12">
          {/* Breadcrumbs & Title */}
          <div class="flex items-center gap-2 truncate">
            <span class="text-xs font-mono opacity-50">Root /</span>
            <span
              class="font-bold text-sm md:text-base text-base-content truncate"
              x-text="currentNote.path ? currentNote.path : 'Keine Notiz gewählt'"
            >
            </span>
            <span
              x-show="currentNote.dirty"
              class="badge badge-warning badge-xs font-mono"
            >
              ungespeichert
            </span>
          </div>

          {/* Right Toolbar Controls */}
          <div class="flex items-center gap-3">
            {/* View Mode Toggle: Edit | Split | Preview */}
            <div class="join border border-base-content/20 rounded-lg p-0.5 bg-base-200">
              <button
                type="button"
                class="join-item btn btn-xs px-2.5 font-normal"
                x-bind:class="viewMode === 'edit' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'edit'"
                title="Reiner Editor"
              >
                ✏️ Edit
              </button>
              <button
                type="button"
                class="join-item btn btn-xs px-2.5 font-normal hidden lg:inline-flex"
                x-bind:class="viewMode === 'split' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'split'"
                title="Split View (Editor & Vorschau)"
              >
                🌓 Split
              </button>
              <button
                type="button"
                class="join-item btn btn-xs px-2.5 font-normal"
                x-bind:class="viewMode === 'preview' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'preview'"
                title="Reine Vorschau"
              >
                👁️ Preview
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              class="btn btn-primary btn-sm px-4 gap-1.5 shadow-sm"
              x-on:click="saveCurrentNote()"
              x-bind:disabled="!currentNote.path || isSaving"
              title="Notiz speichern (Strg+S)"
            >
              <span x-show="!isSaving">Speichern 💾</span>
              <span
                x-show="isSaving"
                class="loading loading-spinner loading-xs"
              >
              </span>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <div class="flex-1 flex overflow-hidden">
          {/* Editor Pane */}
          <div
            class="flex-1 flex flex-col bg-base-100 overflow-hidden relative border-r border-base-content/5"
            x-show="viewMode === 'edit' || viewMode === 'split'"
          >
            {/* Editor Textarea with Clipboard Paste & Drop */}
            <textarea
              x-model="currentNote.content"
              x-on:input="markDirty()"
              x-on:paste="handlePaste($event)"
              x-on:drop="handleDrop($event)"
              x-on:dragover="$event.preventDefault()"
              placeholder="Beginne hier zu schreiben... (Markdown unterstützt. Bilder direkt per Strg+V einfügen!)"
              class="flex-1 p-6 font-mono text-sm leading-relaxed outline-none resize-none bg-transparent text-base-content/90 placeholder:opacity-40"
              x-bind:disabled="!currentNote.path || isLoading"
            >
            </textarea>

            {/* Footer Statusbar */}
            <div class="px-6 py-2 border-t border-base-content/5 bg-base-200/30 flex justify-between items-center text-[11px] opacity-60 font-mono">
              <div class="flex gap-4">
                <span>
                  Zeichen:{" "}
                  <strong x-text="currentNote.content ? currentNote.content.length : 0">
                  </strong>
                </span>
                <span>
                  Wörter:{" "}
                  <strong x-text="currentNote.content ? currentNote.content.trim().split(/\s+/).filter(Boolean).length : 0">
                  </strong>
                </span>
              </div>
              <div>
                💡 <code>Strg+V</code> für Bilder • <code>Strg+S</code>{" "}
                zum Speichern
              </div>
            </div>
          </div>

          {/* Preview Pane */}
          <div
            class="flex-1 overflow-y-auto p-6 md:p-8 bg-base-100 text-base-content"
            x-show="viewMode === 'preview' || viewMode === 'split'"
          >
            <article
              class="prose prose-sm md:prose-base markdown-body max-w-3xl mx-auto"
              x-html="renderMarkdown(currentNote.content)"
            >
            </article>
          </div>
        </div>
      </main>
    </div>
  );
};
