/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ThemeToggle } from "@sleipnir/core";

export const NotesPage = () => {
  return (
    <div x-data="notemate" class="flex h-screen overflow-hidden">
      {/* Mobile Backdrop */}
      <div
        x-show="mobileMenuOpen"
        x-on:click="mobileMenuOpen = false"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        style="display: none;"
      >
      </div>

      {/* Sidebar: Hierarchischer Verzeichnisbaum & Suche */}
      <aside
        class="w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between z-50 md:z-10 md:relative"
        x-bind:class="mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex'"
      >
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
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square md:hidden ml-1 opacity-70 hover:opacity-100"
                x-on:click="mobileMenuOpen = false"
                title="Menü schließen"
              >
                ✕
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
              x-on:keydown="onSearchKeydown($event)"
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
              Suchergebnisse (<span x-text="searchResults.length"></span>)
            </div>

            <template x-for="res in searchResults" x-bind:key="res.path">
              <div
                class="p-2 rounded-lg text-xs hover:bg-base-300 cursor-pointer transition flex flex-col gap-0.5 border border-base-content/5"
                x-bind:class="notePath === res.path ? 'bg-primary/10 border-primary/30' : ''"
                x-on:click="selectSearchResult(res.path)"
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
            <template x-for="item in visibleTreeItems" x-bind:key="item.path">
              <div
                class="group flex items-center justify-between py-1.5 px-2 rounded-md transition cursor-pointer"
                x-bind:class="notePath === item.path ? 'bg-primary text-primary-content font-medium shadow-sm' : 'hover:bg-base-300 text-base-content/85'"
                x-bind:style="'padding-left: ' + (item.depth * 14 + 8) + 'px'"
                x-on:click="selectTreeItem(item)"
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
                      x-on:click="createNewNote(item.path, $event)"
                      title="Notiz in diesem Ordner anlegen"
                    >
                      +
                    </button>
                  </template>

                  {/* Rename */}
                  <button
                    type="button"
                    class="hover:text-primary p-0.5"
                    x-on:click="renameItem(item.path, $event)"
                    title="Umbenennen"
                  >
                    ✏️
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    class="hover:text-error p-0.5"
                    x-on:click="deleteItem(item.path, item.type === 'directory', $event)"
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
        <header class="navbar bg-base-100 border-b border-base-content/10 px-3 md:px-6 py-2 flex justify-between z-10 min-h-12 gap-2">
          {/* Breadcrumbs & Title */}
          <div class="flex items-center gap-1.5 md:gap-2 truncate min-w-0">
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square md:hidden shrink-0"
              x-on:click="mobileMenuOpen = !mobileMenuOpen"
              title="Menü öffnen"
            >
              ☰
            </button>
            <span class="text-xs font-mono opacity-50 hidden md:inline">
              Root /
            </span>
            <span
              class="font-bold text-xs sm:text-sm md:text-base text-base-content truncate"
              x-text="notePath ? notePath : 'Keine Notiz gewählt'"
            >
            </span>
            <span
              x-show="isDirty"
              class="badge badge-warning badge-xs font-mono shrink-0"
            >
              ungespeichert
            </span>
          </div>

          {/* Right Toolbar Controls */}
          <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* View Mode Toggle: Edit | Split | Preview */}
            <div class="join border border-base-content/20 rounded-lg p-0.5 bg-base-200">
              <button
                type="button"
                class="join-item btn btn-xs px-2 sm:px-2.5 font-normal"
                x-bind:class="viewMode === 'edit' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'edit'"
                title="Reiner Editor"
              >
                ✏️<span class="hidden sm:inline ml-1">Edit</span>
              </button>
              <button
                type="button"
                class="join-item btn btn-xs px-2.5 font-normal hidden lg:inline-flex"
                x-bind:class="viewMode === 'split' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'split'"
                title="Split View (Editor & Vorschau)"
              >
                🌓<span class="ml-1">Split</span>
              </button>
              <button
                type="button"
                class="join-item btn btn-xs px-2 sm:px-2.5 font-normal"
                x-bind:class="viewMode === 'preview' ? 'btn-primary font-medium' : 'btn-ghost'"
                x-on:click="viewMode = 'preview'"
                title="Reine Vorschau"
              >
                👁️<span class="hidden sm:inline ml-1">Preview</span>
              </button>
            </div>

            {/* Save Button */}
            <button
              type="button"
              class="btn btn-primary btn-sm px-2.5 sm:px-4 gap-1 shadow-sm"
              x-on:click="saveCurrentNote()"
              x-bind:disabled="!notePath || isSaving"
              title="Notiz speichern & formatieren (Strg+S)"
            >
              <span x-show="!isSaving" class="flex items-center gap-1">
                <span class="hidden sm:inline">Speichern</span> 💾
              </span>
              <span
                x-show="isSaving"
                class="loading loading-spinner loading-xs"
              >
              </span>
            </button>

            {/* Theme Toggle */}
            <ThemeToggle />
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
              x-model="noteContent"
              x-on:input="markDirty()"
              x-on:paste="handlePaste($event)"
              x-on:drop="handleDrop($event)"
              x-on:dragover="$event.preventDefault()"
              placeholder="Beginne hier zu schreiben... (Markdown unterstützt. Bilder direkt per Strg+V einfügen!)"
              class="flex-1 p-3 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed outline-none resize-none bg-transparent text-base-content/90 placeholder:opacity-40"
              x-bind:disabled="!notePath || isLoading"
            >
            </textarea>

            {/* Footer Statusbar */}
            <div class="px-3 sm:px-6 py-2 border-t border-base-content/5 bg-base-200/30 flex justify-between items-center text-[10px] sm:text-[11px] opacity-60 font-mono">
              <div class="flex gap-3 sm:gap-4">
                <span>
                  Zeichen: <strong x-text="charCount"></strong>
                </span>
                <span>
                  Wörter: <strong x-text="wordCount"></strong>
                </span>
              </div>
              <div class="hidden sm:inline">
                💡 <code>Strg+V</code> für Bilder • <code>Strg+S</code> zum Speichern
              </div>
            </div>
          </div>

          {/* Preview Pane */}
          <div
            class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-base-100 text-base-content"
            x-show="viewMode === 'preview' || viewMode === 'split'"
          >
            <div class="max-w-3xl mx-auto">
              {/* Recipe Portion Scaler Banner (Sticky on scroll) */}
              <template x-if="recipeBaseServings">
                <div class="sticky top-0 z-20 mb-6 p-3.5 rounded-xl bg-base-200/95 backdrop-blur-md border border-primary/25 flex flex-wrap items-center justify-between gap-3 shadow-md select-none transition-all">
                  <div class="flex items-center gap-2.5">
                    <span class="text-2xl">🍳</span>
                    <div>
                      <div class="font-bold text-xs text-primary flex items-center gap-1.5">
                        <span>Rezept-Skalierung</span>
                        <span
                          x-show="recipeCurrentServings !== recipeBaseServings"
                          class="badge badge-warning badge-xs font-mono font-medium"
                        >
                          skaliert
                        </span>
                      </div>
                      <div class="text-[11px] opacity-60">
                        Basis: <strong x-text="recipeBaseServings"></strong> Portionen
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      x-show="recipeCurrentServings !== recipeBaseServings"
                      class="btn btn-ghost btn-xs text-[11px] opacity-60 hover:opacity-100 font-mono"
                      x-on:click="resetServings()"
                      title="Auf Original zurücksetzen"
                      style="display: none;"
                    >
                      ↺ Reset
                    </button>

                    <div class="join border border-base-content/20 rounded-lg bg-base-100 shadow-sm items-center h-7 overflow-hidden">
                      <button
                        type="button"
                        class="join-item btn btn-xs btn-ghost h-full px-2.5 font-bold rounded-none"
                        x-on:click="decrementServings()"
                        x-bind:disabled="recipeCurrentServings <= 1"
                        title="Eine Portion weniger"
                      >
                        -
                      </button>
                      <div class="join-item flex items-center px-1 h-full bg-transparent">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          x-model="recipeCurrentServings"
                          class="w-12 bg-transparent text-center font-mono font-bold text-xs p-0 m-0 border-none outline-none focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          title="Portionen oder Mehlmenge (z.B. 1375)"
                        />
                        <span class="text-[11px] opacity-60 pl-0.5 pr-1 font-normal select-none">
                          Port.
                        </span>
                      </div>
                      <button
                        type="button"
                        class="join-item btn btn-xs btn-ghost h-full px-2.5 font-bold rounded-none"
                        x-on:click="incrementServings()"
                        title="Eine Portion mehr"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </template>

              <article
                class="prose prose-sm md:prose-base markdown-body"
                x-html="renderMarkdown(noteContent, recipeCurrentServings)"
              >
              </article>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
