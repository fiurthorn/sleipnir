/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { MateSwitcher, ThemeToggle } from "@sleipnir/core";

export const NotesPage = () => {
  return (
    <div class="flex flex-col h-screen overflow-hidden">
      <MateSwitcher current="notes" />
      <div
        x-data="notemate"
        x-bind:data-app-mode="appMode"
        class="flex-1 min-h-0 flex overflow-hidden"
      >
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
          class="w-full md:w-80 bg-base-200 border-r border-base-content/10 flex-col justify-between z-50 md:z-10 md:relative"
          x-bind:class="appMode === 'kanban' ? 'hidden' : (mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex')"
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
                class="input input-bordered input-sm w-full pl-8 text-sm md:text-xs font-sans"
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

            {/* Sidebar Tag Filter */}
            <div
              x-show="activeFilterTags.length > 0"
              class="flex flex-col gap-1.5 pb-1 border-b border-base-content/10"
              style="display: none;"
            >
              <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60 px-0.5">
                <span>🏷️ Tags</span>
                <button
                  type="button"
                  x-show="selectedTag"
                  x-on:click="clearTagFilter()"
                  class="text-primary hover:underline font-mono normal-case"
                >
                  Filter zurücksetzen
                </button>
              </div>
              <div class="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                <template x-for="tagItem in activeFilterTags" x-bind:key="tagItem.tag">
                  <button
                    type="button"
                    x-on:click="toggleTagFilter(tagItem.tag)"
                    class="badge badge-sm md:badge-xs cursor-pointer gap-1 transition"
                    x-bind:class="selectedTag === tagItem.tag ? (isNsfwTag(tagItem.tag) ? 'badge-error text-error-content' : 'badge-primary') : (isNsfwTag(tagItem.tag) ? 'badge-error badge-outline' : 'badge-ghost border-base-content/15 hover:border-primary/50')"
                  >
                    <span x-text="tagItem.tag"></span>
                    <span class="opacity-60 font-mono text-[9px]" x-text="tagItem.count"></span>
                  </button>
                </template>
              </div>
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
                  <div
                    x-show="res.tags && res.tags.length > 0"
                    class="flex flex-wrap gap-1 mt-1"
                  >
                    <template x-for="tag in res.tags" x-bind:key="tag">
                      <span
                        class="badge badge-xs"
                        x-bind:class="isNsfwTag(tag) ? 'badge-error text-error-content' : 'badge-ghost border-base-content/15'"
                        x-text="tag"
                      >
                      </span>
                    </template>
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
              class="flex-1 overflow-y-auto space-y-0.5 pr-1 select-none text-sm md:text-xs"
            >
              <template x-for="item in visibleTreeItems" x-bind:key="item.path">
                <div
                  class="group flex items-center justify-between py-2 md:py-1.5 px-2 rounded-md transition cursor-pointer"
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

                    {/* NSFW / Tag Hint in Tree */}
                    <template x-if="item.type === 'file' && hasNsfwTag(item.tags)">
                      <span class="badge badge-error badge-xs text-[9px] font-mono shrink-0">
                        nsfw
                      </span>
                    </template>
                  </div>

                  {/* Node Action Buttons */}
                  <div class="flex items-center gap-1 shrink-0 ml-1">
                    {/* Add note in folder (always visible) */}
                    <template x-if="item.type === 'directory'">
                      <button
                        type="button"
                        class="opacity-70 md:opacity-0 md:group-hover:opacity-100 hover:text-primary p-0.5 transition"
                        x-on:click="createNewNote(item.path, $event)"
                        title="Notiz in diesem Ordner anlegen"
                      >
                        +
                      </button>
                    </template>

                    {/* Edit/Delete Actions (only in Edit/Split mode) */}
                    <div
                      x-show="viewMode !== 'preview'"
                      class="opacity-80 md:opacity-0 md:group-hover:opacity-100 flex items-center gap-1 transition"
                    >
                      {/* Rename */}
                      <button
                        type="button"
                        class="hover:text-primary p-0.5"
                        x-on:click="renameItem(item.path, $event)"
                        title="Umbenennen"
                      >
                        ✏️
                      </button>

                      {/* Move (notes only) */}
                      <template x-if="item.type === 'file'">
                        <button
                          type="button"
                          class="hover:text-primary p-0.5"
                          x-on:click="openMoveModal(item.path, $event)"
                          title="Verschieben"
                        >
                          📦
                        </button>
                      </template>

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

          {/* NSFW Gate Status Bar */}
          <div x-show="!nsfwUnlocked && nsfwHiddenCount > 0" style="display: none;">
            <button
              type="button"
              class="w-full px-3 py-1.5 border-t border-base-content/10 bg-base-200/70 hover:bg-base-300/70 text-[11px] text-base-content/70 flex items-center justify-between transition cursor-pointer"
              x-on:click="openNsfwUnlockModal()"
              title="Ausgeblendete NSFW-Inhalte für 1 Stunde freischalten"
            >
              <span>
                🔒 <strong x-text="nsfwHiddenCount"></strong> ausgeblendet
              </span>
              <span class="text-[10px] opacity-60">Freischalten</span>
            </button>
          </div>

          <div
            x-show="nsfwUnlocked"
            class="px-3 py-1.5 border-t border-error/20 bg-error/10 text-[11px] text-error flex items-center justify-between"
            style="display: none;"
          >
            <span>🔓 NSFW aktiv (1h)</span>
            <button
              type="button"
              class="font-mono hover:underline cursor-pointer"
              x-on:click="lockNsfw()"
            >
              Sperren
            </button>
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
                x-show="appMode === 'notes'"
                class="btn btn-ghost btn-xs btn-square md:hidden shrink-0"
                x-on:click="mobileMenuOpen = !mobileMenuOpen"
                title="Menü öffnen"
              >
                ☰
              </button>

              {/* App Mode Switch: Notizen | Kanban */}
              <div class="join border border-base-content/20 rounded-lg p-0.5 bg-base-200 shrink-0 mr-1">
                <button
                  type="button"
                  class="join-item btn btn-xs px-2 font-normal"
                  x-bind:class="appMode === 'notes' ? 'btn-primary font-medium' : 'btn-ghost'"
                  x-on:click="switchAppMode('notes')"
                  title="Notizen-Ansicht"
                >
                  📝<span class="hidden sm:inline ml-1">Notizen</span>
                </button>
                <button
                  type="button"
                  class="join-item btn btn-xs px-2 font-normal"
                  x-bind:class="appMode === 'kanban' ? 'btn-primary font-medium' : 'btn-ghost'"
                  x-on:click="switchAppMode('kanban')"
                  title="Kanban-Boards"
                >
                  📋<span class="hidden sm:inline ml-1">Kanban</span>
                </button>
              </div>

              <span
                x-show="appMode === 'notes'"
                class="text-xs font-mono opacity-50 hidden md:inline"
              >
                Root /
              </span>
              <span
                x-show="appMode === 'notes'"
                class="font-bold text-xs sm:text-sm md:text-base text-base-content truncate"
                x-text="notePath ? notePath : 'Keine Notiz gewählt'"
              >
              </span>
              <span
                x-show="appMode === 'notes' && isDirty"
                class="badge badge-warning badge-xs font-mono shrink-0"
              >
                ungespeichert
              </span>
              <span
                x-show="appMode === 'kanban'"
                class="font-bold text-xs sm:text-sm md:text-base text-base-content truncate"
                x-text="kanbanBoardTitle || 'Kanban'"
                style="display: none;"
              >
              </span>
            </div>

            {/* Right Toolbar Controls */}
            <div class="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* View Mode Toggle: Edit | Split | Preview (Notes only) */}
              <div
                x-show="appMode === 'notes'"
                class="join border border-base-content/20 rounded-lg p-0.5 bg-base-200"
              >
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

              {/* Copy Markdown Note Link (Notes only) */}
              <button
                type="button"
                x-show="appMode === 'notes' && notePath"
                class="btn btn-ghost btn-xs sm:btn-sm px-2 gap-1"
                x-on:click="copyNoteLink()"
                title="Markdown-Link für Kanban/Notizen kopieren"
              >
                🔗<span class="hidden sm:inline text-xs">Link</span>
              </button>

              {/* Save Button (Notes Edit/Split only) */}
              <button
                type="button"
                x-show="appMode === 'notes' && viewMode !== 'preview'"
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

              {/* Quick Add Card (Kanban only) */}
              <button
                type="button"
                x-show="appMode === 'kanban'"
                class="btn btn-primary btn-sm px-2.5 sm:px-4 gap-1 shadow-sm"
                x-on:click="openKanbanCardModal(null, activeKanbanColumn)"
                style="display: none;"
              >
                + <span class="hidden sm:inline">Karte</span>
              </button>

              {/* Theme Toggle */}
              <ThemeToggle />
            </div>
          </header>

          {/* Note Tags Bar */}
          <div
            x-show="appMode === 'notes' && notePath"
            class="px-3 md:px-6 py-1.5 border-b border-base-content/10 bg-base-200/40 flex flex-col gap-2"
            style="display: none;"
          >
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-xs opacity-60 mr-0.5" title="Tags dieser Notiz">🏷️</span>

              <template x-for="tag in noteTags" x-bind:key="tag">
                <span
                  class="badge badge-sm gap-1 font-medium"
                  x-bind:class="isNsfwTag(tag) ? 'badge-error text-error-content' : 'badge-primary badge-outline'"
                >
                  <button
                    type="button"
                    class="hover:underline cursor-pointer"
                    x-on:click="toggleTagFilter(tag)"
                    x-text="tag"
                    title="In Sidebar nach diesem Tag filtern"
                  >
                  </button>
                  <button
                    type="button"
                    x-show="viewMode !== 'preview'"
                    class="opacity-70 hover:opacity-100 cursor-pointer ml-0.5"
                    x-on:click="removeNoteTag(tag)"
                    title="Tag entfernen"
                  >
                    ✕
                  </button>
                </span>
              </template>

              <span
                x-show="noteTags.length === 0"
                class="text-[11px] opacity-50 italic"
              >
                Keine Tags
              </span>

              <button
                type="button"
                x-show="viewMode !== 'preview'"
                class="btn btn-ghost btn-xs text-[11px] ml-1"
                x-on:click="showTagPicker = !showTagPicker"
                x-bind:disabled="isSaving"
              >
                <span x-text="showTagPicker ? '✕ Schließen' : '+ Tag'"></span>
              </button>

              <button
                type="button"
                x-show="viewMode !== 'preview'"
                class="btn btn-ghost btn-xs text-[11px] ml-auto gap-1"
                x-on:click="openMoveModal(notePath)"
                title="Aktuelle Notiz in einen anderen Ordner verschieben"
              >
                📦 <span class="hidden sm:inline">Verschieben</span>
              </button>
            </div>

            {/* Tag Picker Dropdown Panel */}
            <div
              x-show="showTagPicker && viewMode !== 'preview'"
              class="p-2 rounded-lg bg-base-100 border border-base-content/15 shadow-sm flex flex-wrap gap-1.5 max-h-40 overflow-y-auto"
              style="display: none;"
            >
              <template x-for="tagDef in availableTagsToAdd" x-bind:key="tagDef.tag">
                <button
                  type="button"
                  class="badge badge-sm cursor-pointer transition hover:scale-105"
                  x-bind:class="isNsfwTag(tagDef.tag) ? 'badge-error badge-outline' : 'badge-ghost border-base-content/20 hover:border-primary'"
                  x-on:click="addNoteTag(tagDef.tag)"
                  x-bind:title="tagDef.category"
                  x-text="tagDef.tag"
                >
                </button>
              </template>
              <span
                x-show="availableTagsToAdd.length === 0"
                class="text-xs opacity-50"
              >
                Alle verfügbaren Tags sind bereits zugewiesen.
              </span>
            </div>
          </div>

          {/* Workspace Body (Notes) */}
          <div x-show="appMode === 'notes'" class="flex-1 flex overflow-hidden">
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
                class="flex-1 p-3 sm:p-6 font-mono text-sm leading-relaxed outline-none resize-none bg-transparent text-base-content/90 placeholder:opacity-40"
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
                  class="prose prose-base markdown-body"
                  x-html="renderMarkdown(noteContent, recipeCurrentServings)"
                  x-on:click="handlePreviewClick($event)"
                >
                </article>
              </div>
            </div>
          </div>

          {/* Workspace Body (Kanban) */}
          <div
            x-show="appMode === 'kanban'"
            class="flex-1 flex flex-col overflow-hidden bg-base-100"
            style="display: none;"
          >
            {/* Kanban Toolbar: Board Select, Search, Tags, NSFW */}
            <div class="px-3 md:px-6 py-2.5 border-b border-base-content/10 bg-base-200/40 flex flex-wrap items-center gap-2 justify-between">
              <div class="flex flex-wrap items-center gap-2">
                <select
                  class="select select-bordered select-xs font-medium"
                  x-bind:value="activeKanbanBoardId"
                  x-on:change="loadKanbanBoard($event.target.value)"
                >
                  <template x-for="b in kanbanBoards" x-bind:key="b.id">
                    <option
                      x-bind:value="b.id"
                      x-text="b.title + ' (' + b.cardCount + ')'"
                    >
                    </option>
                  </template>
                </select>

                <button
                  type="button"
                  class="btn btn-ghost btn-xs"
                  x-on:click="createKanbanBoard()"
                  title="Neues Kanban-Board anlegen"
                >
                  + Board
                </button>

                {/* Search */}
                <div class="relative">
                  <input
                    type="text"
                    placeholder="Karten filtern..."
                    class="input input-bordered input-xs pl-6 w-40 sm:w-52"
                    x-model="kanbanQuery"
                    x-on:input="loadKanbanBoard(activeKanbanBoardId)"
                  />
                  <span class="absolute left-2 top-1 text-[11px] opacity-50">
                    🔍
                  </span>
                  <button
                    type="button"
                    x-show="kanbanQuery"
                    x-on:click="kanbanQuery = ''; loadKanbanBoard(activeKanbanBoardId)"
                    class="absolute right-1.5 top-0.5 text-[11px] opacity-50 hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Tag Filters + NSFW Status */}
              <div class="flex flex-wrap items-center gap-1.5">
                <template x-for="t in kanbanBoardTags" x-bind:key="t">
                  <button
                    type="button"
                    class="badge badge-xs cursor-pointer transition"
                    x-bind:class="kanbanTagFilter.toLowerCase() === t.toLowerCase() ? (isNsfwTag(t) ? 'badge-error text-error-content' : 'badge-primary') : (isNsfwTag(t) ? 'badge-error badge-outline' : 'badge-ghost border-base-content/20')"
                    x-on:click="toggleKanbanTagFilter(t)"
                    x-text="t"
                  >
                  </button>
                </template>

                <button
                  type="button"
                  x-show="!nsfwUnlocked && kanbanHiddenCount > 0"
                  class="badge badge-xs badge-ghost border-base-content/20 cursor-pointer gap-1"
                  x-on:click="openNsfwUnlockModal()"
                  style="display: none;"
                >
                  🔒 <span x-text="kanbanHiddenCount"></span> ausgeblendet
                </button>

                <button
                  type="button"
                  x-show="nsfwUnlocked"
                  class="badge badge-xs badge-error badge-outline cursor-pointer gap-1"
                  x-on:click="lockNsfw()"
                  style="display: none;"
                >
                  🔓 NSFW (Sperren)
                </button>
              </div>
            </div>

            {/* Mobile Column Tabs */}
            <div class="flex lg:hidden border-b border-base-content/10 bg-base-200/30 overflow-x-auto px-2 py-1.5 gap-1 shrink-0">
              <template x-for="col in kanbanColumns" x-bind:key="col">
                <button
                  type="button"
                  class="btn btn-xs whitespace-nowrap gap-1"
                  x-bind:class="activeKanbanColumn === col ? 'btn-primary' : 'btn-ghost'"
                  x-on:click="activeKanbanColumn = col"
                >
                  <span x-text="col"></span>
                  <span
                    class="badge badge-xs font-mono opacity-80"
                    x-text="getKanbanColumnCards(col).length"
                  >
                  </span>
                </button>
              </template>
            </div>

            {/* Columns Grid */}
            <div class="flex-1 grid grid-cols-1 lg:grid-flow-col lg:auto-cols-fr gap-3 p-3 md:p-4 overflow-hidden">
              <template x-for="col in kanbanColumns" x-bind:key="col">
                <section
                  class="flex-col bg-base-200/60 border border-base-content/10 rounded-xl overflow-hidden min-h-0 transition"
                  x-bind:class="(activeKanbanColumn === col ? 'flex' : 'hidden lg:flex') + (dragOverColumn === col ? ' ring-2 ring-primary bg-primary/5' : '')"
                  x-on:dragover="handleKanbanDragOver(col, $event)"
                  x-on:dragleave="handleKanbanDragLeave(col)"
                  x-on:drop="handleKanbanDrop(col, $event)"
                >
                  {/* Column Header */}
                  <div class="px-3 py-2.5 border-b border-base-content/10 flex items-center justify-between bg-base-200/80 shrink-0">
                    <div class="flex items-center gap-2 min-w-0">
                      <h2
                        class="font-bold text-xs uppercase tracking-wider truncate"
                        x-text="col"
                      >
                      </h2>
                      <span
                        class="badge badge-xs badge-ghost font-mono"
                        x-text="getKanbanColumnCards(col).length"
                      >
                      </span>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs btn-square"
                      x-on:click="openKanbanCardModal(null, col)"
                      title="Karte in dieser Spalte anlegen"
                    >
                      +
                    </button>
                  </div>

                  {/* Cards List */}
                  <div class="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                    <template
                      x-for="card in getKanbanColumnCards(col)"
                      x-bind:key="card.id"
                    >
                      <article
                        draggable="true"
                        x-on:dragstart="handleKanbanDragStart(card, $event)"
                        x-on:dragend="handleKanbanDragEnd()"
                        class="bg-base-100 border rounded-lg p-3 shadow-xs transition flex flex-col gap-2 cursor-grab active:cursor-grabbing"
                        x-bind:class="isKanbanCardOverdue(card) ? 'border-error ring-1 ring-error/40' : 'border-base-content/10 hover:border-primary/40'"
                      >
                        <div class="flex items-start justify-between gap-2">
                          <h3
                            class="font-semibold text-sm leading-snug"
                            x-text="card.title"
                          >
                          </h3>
                          <div class="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs btn-square opacity-60 hover:opacity-100"
                              x-on:click="openKanbanCardModal(card)"
                              title="Bearbeiten"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              class="btn btn-ghost btn-xs btn-square opacity-60 hover:text-error hover:opacity-100"
                              x-on:click="deleteKanbanCard(card.id)"
                              title="Löschen"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Markdown Description */}
                        <div
                          x-show="card.description"
                          class="prose prose-sm sm:prose-xs max-w-none text-sm sm:text-xs opacity-80 break-words [&_a]:text-primary [&_a]:underline"
                          x-html="renderKanbanMarkdown(card.description)"
                          x-on:click="handleKanbanBodyClick($event, card)"
                        >
                        </div>

                        {/* Tags */}
                        <div
                          x-show="card.tags && card.tags.length > 0"
                          class="flex flex-wrap gap-1"
                        >
                          <template x-for="tag in card.tags" x-bind:key="tag">
                            <span
                              class="badge badge-xs"
                              x-bind:class="isNsfwTag(tag) ? 'badge-error text-error-content' : 'badge-ghost border-base-content/15'"
                              x-text="tag"
                            >
                            </span>
                          </template>
                        </div>

                        {/* Footer: Card ID, Due Date & Mobile Quick-Move */}
                        <div class="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-base-content/5">
                          <div class="flex items-center gap-1.5 min-w-0 shrink-0">
                            <span
                              class="text-[10px] font-mono opacity-40 shrink-0"
                              x-text="card.id"
                            >
                            </span>
                            <span
                              x-show="card.dueDate"
                              class="badge badge-xs font-mono gap-1 whitespace-nowrap shrink-0"
                              x-bind:class="isKanbanCardOverdue(card) ? 'badge-error text-error-content' : 'badge-ghost border-base-content/15'"
                              x-bind:title="kanbanRecurrenceLabel(card.recurrence)"
                              x-text="'📅 ' + card.dueDate + (card.recurrence ? ' 🔁' : '')"
                            >
                            </span>
                          </div>
                          <select
                            class="select select-bordered select-sm md:select-xs text-xs h-7 min-h-0 w-auto max-w-[11rem] shrink-0 lg:hidden"
                            x-bind:value="card.column"
                            x-on:change="moveKanbanCard(card.id, $event.target.value)"
                            title="In Liste verschieben"
                          >
                            <template
                              x-for="targetCol in kanbanColumns"
                              x-bind:key="targetCol"
                            >
                              <option
                                x-bind:value="targetCol"
                                x-bind:selected="targetCol === card.column"
                                x-text="'→ ' + targetCol"
                              >
                              </option>
                            </template>
                          </select>
                        </div>
                      </article>
                    </template>

                    <div
                      x-show="getKanbanColumnCards(col).length === 0"
                      class="text-[11px] opacity-40 text-center py-8 border border-dashed border-base-content/15 rounded-lg"
                    >
                      Keine Karten
                    </div>
                  </div>
                </section>
              </template>
            </div>
          </div>
        </main>

        {/* Kanban Card Create / Edit Modal */}
        <div
          x-show="kanbanCardModalOpen"
          x-on:click="closeKanbanCardModal()"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          style="display: none;"
        >
          <div
            class="bg-base-100 border border-base-content/15 rounded-xl shadow-2xl max-w-md w-full p-5 flex flex-col gap-3"
            x-on:click="$event.stopPropagation()"
          >
            <h3
              class="font-bold text-base"
              x-text="kanbanEditingCardId ? 'Karte bearbeiten' : 'Neue Karte'"
            >
            </h3>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">Titel</label>
              <input
                type="text"
                class="input input-bordered input-sm w-full"
                placeholder="Kurzer Titel..."
                x-model="kanbanCardFormTitle"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">Liste</label>
              <select
                class="select select-bordered select-sm w-full"
                x-model="kanbanCardFormColumn"
              >
                <template x-for="col in kanbanColumns" x-bind:key="col">
                  <option x-bind:value="col" x-text="col"></option>
                </template>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">
                Fälligkeitsdatum (optional)
              </label>
              <div class="flex items-center gap-2">
                <input
                  type="date"
                  class="input input-bordered input-sm flex-1 font-mono text-xs"
                  x-model="kanbanCardFormDueDate"
                />
                <button
                  type="button"
                  x-show="kanbanCardFormDueDate && !kanbanCardFormRecurrence && !kanbanCardRecurrencePickerOpen"
                  x-on:click="kanbanCardRecurrencePickerOpen = true"
                  class="btn btn-sm btn-outline shrink-0"
                >
                  🔁 Wiederholen
                </button>
              </div>
              <select
                x-show="kanbanCardFormDueDate && (kanbanCardFormRecurrence || kanbanCardRecurrencePickerOpen)"
                x-model="kanbanCardFormRecurrence"
                class="select select-bordered select-sm w-full text-xs mt-1"
              >
                <option value="">Einmalig (keine Wiederholung)</option>
                <option value="weekly">Wöchentlich</option>
                <option value="monthly">Monatlich</option>
                <option value="quarterly">Quartalsweise</option>
                <option value="yearly">Jährlich</option>
              </select>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">
                Tags (kommagetrennt)
              </label>
              <input
                type="text"
                class="input input-bordered input-sm w-full font-mono text-xs"
                placeholder="z. B. Projekt, Dringend"
                x-model="kanbanCardFormTags"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">
                Beschreibung (Markdown)
              </label>
              <textarea
                rows="4"
                class="textarea textarea-bordered textarea-sm w-full font-mono text-xs"
                placeholder="Notiz verlinken: [Titel](?note=Pfad/Notiz.md)"
                x-model="kanbanCardFormDescription"
              >
              </textarea>
            </div>

            <div class="flex justify-end gap-2 mt-1">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                x-on:click="closeKanbanCardModal()"
              >
                Abbrechen
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                x-on:click="saveKanbanCard()"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>

        {/* Move Note / Folder Modal */}
        <div
          x-show="moveModalOpen"
          x-on:click="closeMoveModal()"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          style="display: none;"
        >
          <div
            class="bg-base-100 border border-base-content/15 rounded-xl shadow-2xl max-w-sm w-full p-5 flex flex-col gap-3"
            x-on:click="$event.stopPropagation()"
          >
            <h3 class="font-bold text-base">📦 Element verschieben</h3>
            <div class="text-xs font-mono opacity-70 truncate" x-text="moveSourcePath">
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs font-medium opacity-75">Zielordner</label>
              <select
                class="select select-bordered select-sm w-full font-mono text-xs"
                x-model="moveTargetFolder"
              >
                <option value="">/ (Stammverzeichnis)</option>
                <template x-for="folder in availableMoveFolders" x-bind:key="folder">
                  <option x-bind:value="folder" x-text="folder"></option>
                </template>
              </select>
            </div>

            <div class="flex justify-end gap-2 mt-1">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                x-on:click="closeMoveModal()"
              >
                Abbrechen
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                x-on:click="confirmMoveItem()"
              >
                Verschieben
              </button>
            </div>
          </div>
        </div>

        {/* NSFW Confirmation Modal */}
        <div
          x-show="nsfwModalOpen"
          x-on:click="closeNsfwModal()"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          style="display: none;"
        >
          <div
            class="bg-base-100 border border-base-content/15 rounded-xl shadow-2xl max-w-sm w-full p-5 flex flex-col gap-3"
            x-on:click="$event.stopPropagation()"
          >
            <div class="flex items-center gap-2 text-base font-bold">
              <span>🔞</span>
              <span>NSFW-Inhalte freischalten?</span>
            </div>
            <p class="text-xs opacity-75 leading-relaxed">
              Notizen und Bilder mit dem Tag <code>nsfw</code> werden für <strong>1 Stunde</strong>{" "}
              sichtbar gemacht. Du kannst sie jederzeit über die Sidebar wieder sperren.
            </p>
            <div class="flex justify-end gap-2 mt-2">
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                x-on:click="closeNsfwModal()"
              >
                Abbrechen
              </button>
              <button
                type="button"
                class="btn btn-error btn-sm"
                x-on:click="confirmUnlockNsfw()"
              >
                Freischalten (1h)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
