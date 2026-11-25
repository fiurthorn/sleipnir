/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ScannerModal } from "../components/ScannerModal.tsx";
import { ThemeToggle } from "@sleipnir/core";

export function ScanPage({ basePath: _basePath }: { basePath: string }) {
  return (
    <div
      x-data="scanApp"
      class="flex h-screen overflow-hidden bg-base-100"
    >
      {/* ========================================================================= */}
      {/* MOBILE BACKDROP                                                           */}
      {/* ========================================================================= */}
      <div
        x-show="mobileMenuOpen"
        x-on:click="mobileMenuOpen = false"
        class="fixed inset-0 bg-black/50 z-40 md:hidden"
        style="display: none;"
      >
      </div>

      {/* ========================================================================= */}
      {/* SIDEBAR: NAVIGATION & ARCHIV-DOKUMENTE (DRAWER AUF MOBILE)                 */}
      {/* ========================================================================= */}
      <aside
        class="w-full md:w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between z-50 md:z-10 md:relative"
        x-bind:class="mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex'"
      >
        <div class="p-4 flex flex-col gap-3 flex-1 overflow-hidden">
          {/* Logo & Header */}
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">📄</span>
              <div>
                <h1 class="text-lg font-black text-primary leading-tight">
                  Scanmate
                </h1>
                <p class="text-[10px] tracking-wider uppercase opacity-60">
                  Document & Receipt Scanner
                </p>
              </div>
            </div>

            <div class="flex items-center gap-1">
              <ThemeToggle />
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
          </div>

          {/* Schnellsuchleiste */}
          <div class="relative mt-1">
            <input
              type="text"
              placeholder="Dokumente durchsuchen..."
              class="input input-bordered input-sm w-full pl-8 text-sm md:text-xs font-sans"
              x-model="searchQuery"
            />
            <span class="absolute left-2.5 top-2 text-xs opacity-50">🔍</span>
            <button
              type="button"
              x-show="searchQuery"
              x-on:click="searchQuery = ''"
              class="absolute right-2 top-2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          {/* Filter: Zu prüfen (Agent-Ablage) */}
          <div
            x-show="unreviewedCount > 0 || onlyUnreviewed"
            class="flex items-center justify-between gap-2 pb-1 border-b border-base-content/10"
            style="display: none;"
          >
            <button
              type="button"
              x-on:click="toggleUnreviewedFilter()"
              class="btn btn-xs w-full justify-between"
              x-bind:class="onlyUnreviewed ? 'btn-warning' : 'btn-ghost border border-warning/40 text-warning'"
            >
              <span>🔍 Zu prüfen</span>
              <span class="badge badge-xs font-mono" x-text="unreviewedCount"></span>
            </button>
          </div>

          {/* Sidebar Tag Filter (wie NoteMate) */}
          <div
            x-show="availableTags.length > 0"
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
              <template x-for="tagItem in availableTags" {...{ ":key": "tagItem.tag" }}>
                <button
                  type="button"
                  x-on:click="toggleTagFilter(tagItem.tag)"
                  class="badge badge-sm md:badge-xs cursor-pointer gap-1 transition"
                  x-bind:class="isTagSelected(tagItem.tag) ? 'badge-primary' : 'badge-ghost border-base-content/15 hover:border-primary/50'"
                >
                  <span x-text="tagItem.tag"></span>
                  <span class="opacity-60 font-mono text-[9px]" x-text="tagItem.count"></span>
                </button>
              </template>
            </div>
          </div>

          {/* Hierarchischer Archiv-Baum (wie NoteMate) */}
          <div
            x-show="expandedFolders.length > 0"
            class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider opacity-60 px-0.5"
            style="display: none;"
          >
            <span>📁 Ordner</span>
            <button
              type="button"
              x-on:click="collapseAllFolders()"
              class="text-primary hover:underline font-mono normal-case"
              title="Alle Ordner einklappen"
            >
              Alle einklappen
            </button>
          </div>
          <div class="flex-1 overflow-y-auto space-y-0.5 pr-1 select-none text-sm md:text-xs">
            <template x-if="isLoading">
              <div class="text-center py-6 text-xs opacity-60">
                <span class="loading loading-spinner loading-xs text-primary">
                </span>
                <p class="mt-2">Lade Dokumente...</p>
              </div>
            </template>

            <template x-if="!isLoading && visibleTreeItems.length === 0">
              <div class="text-xs opacity-50 text-center py-8">
                Keine Dokumente gefunden.
              </div>
            </template>

            <template
              x-for="item in visibleTreeItems"
              {...{ ":key": "item.treeKey" }}
            >
              <div
                class="group flex items-center justify-between py-2 md:py-1.5 px-2 rounded-md transition cursor-pointer"
                x-bind:class="isTreeItemActive(item) ? 'bg-primary text-primary-content font-medium shadow-sm' : 'hover:bg-base-300 text-base-content/85'"
                x-bind:style="getTreeItemStyle(item)"
                x-on:click="selectTreeItem(item)"
              >
                <div class="flex items-center gap-1.5 truncate flex-1 min-w-0">
                  <template x-if="item.type === 'directory'">
                    <span
                      class="text-[10px] opacity-60 w-3 text-center"
                      x-text="isTreeDirExpanded(item.path) ? '▼' : '▶'"
                    >
                    </span>
                  </template>
                  <template x-if="item.type === 'doc'">
                    <span class="w-3"></span>
                  </template>

                  <span
                    class="text-xs shrink-0"
                    x-text="item.type === 'directory' ? (isTreeDirExpanded(item.path) ? '📂' : '📁') : '📄'"
                  >
                  </span>

                  <span
                    class="truncate"
                    x-text="item.type === 'directory' ? item.name : item.doc.title"
                  >
                  </span>
                </div>

                <template x-if="item.type === 'doc' && item.doc.totalAmount">
                  <span
                    class="text-[10px] font-mono opacity-75 shrink-0 ml-1"
                    x-text="formatAmount(item.doc.totalAmount)"
                  >
                  </span>
                </template>
              </div>
            </template>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div class="p-3 border-t border-base-content/10 bg-base-200/50 flex justify-between items-center text-[11px] text-base-content/60 font-mono">
          <span>📁 ./data/documents</span>
          <button
            type="button"
            class="hover:underline cursor-pointer"
            x-on:click="loadDocuments(); loadFolders();"
            title="Neu laden"
          >
            ↻ Sync
          </button>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN CONTENT AREA: WORKSPACE VIEW (ARCHIV DETAIL vs. SCAN-MASKE)         */}
      {/* ========================================================================= */}
      <main class="flex-1 flex flex-col bg-base-100 overflow-hidden relative">
        {/* Top Navbar */}
        <header class="navbar bg-base-100 border-b border-base-content/10 px-3 md:px-6 py-2 flex justify-between z-10 min-h-12 gap-2 shrink-0">
          <div class="flex items-center gap-1.5 md:gap-2 truncate min-w-0">
            {/* Hamburger Button auf Mobile */}
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square md:hidden shrink-0"
              x-on:click="mobileMenuOpen = !mobileMenuOpen"
              title="Menü öffnen"
            >
              ☰
            </button>

            <span class="text-xs font-mono opacity-50 hidden md:inline">
              Scanmate /
            </span>
            <span
              class="font-bold text-xs sm:text-sm md:text-base text-base-content truncate"
              x-text="getHeaderTitle()"
            >
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <div class="join">
              <button
                type="button"
                x-on:click="activeTab = 'archive'"
                x-bind:class="activeTab === 'archive' ? 'btn-active btn-primary' : 'btn-ghost'"
                class="btn btn-xs join-item"
              >
                Archiv
              </button>
              <button
                type="button"
                x-on:click="activeTab = 'new'"
                x-bind:class="activeTab === 'new' ? 'btn-active btn-primary' : 'btn-ghost'"
                class="btn btn-xs join-item"
              >
                Erfassung{" "}
                <span x-show="pages.length > 0" x-text="'(' + pages.length + ')'">
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT: TAB 1 - DOKUMENT DETAILANSICHT */}
        <div
          x-show="activeTab === 'archive'"
          class="flex-1 flex flex-col p-3 md:p-6 overflow-y-auto"
        >
          <template x-if="activeDoc">
            <div class="max-w-5xl mx-auto w-full flex flex-col gap-6">
              {/* Header Box */}
              <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      class="badge badge-primary font-bold"
                      x-text="activeDoc.category"
                    >
                    </span>
                    <span
                      class="text-xs opacity-60"
                      x-text="formatDocDate(activeDoc)"
                    >
                    </span>
                    <span
                      class="badge badge-ghost text-xs font-mono"
                      x-text="activeDoc.pageCount + ' Seite(n)'"
                    >
                    </span>
                    <span
                      x-show="activeDoc.targetPath"
                      class="badge badge-outline text-xs font-mono whitespace-nowrap max-w-full"
                      x-bind:title="activeDoc.targetPath"
                      x-text="'📁 ' + formatShortPath(activeDoc.targetPath)"
                    >
                    </span>
                    <span
                      x-show="activeDoc.reviewed === false"
                      class="badge badge-warning badge-sm font-semibold"
                      style="display: none;"
                    >
                      Zu prüfen
                    </span>
                  </div>
                  <h2
                    class="text-xl sm:text-2xl font-black text-base-content"
                    x-text="activeDoc.title"
                  >
                  </h2>
                  <p
                    x-show="activeDoc.sender"
                    class="text-xs sm:text-sm opacity-80 mt-1"
                  >
                    Absender:{" "}
                    <span
                      class="font-semibold"
                      x-text="activeDoc.sender"
                    >
                    </span>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    type="button"
                    x-show="activeDoc.reviewed === false"
                    x-on:click="markDocumentReviewed(activeDoc)"
                    class="btn btn-success btn-xs sm:btn-sm gap-1"
                    title="Beleg als geprüft markieren"
                    style="display: none;"
                  >
                    <span>✓ Geprüft</span>
                  </button>
                  <button
                    type="button"
                    x-on:click="openEditModal(activeDoc)"
                    class="btn btn-outline btn-xs sm:btn-sm gap-1"
                    title="Metadaten bearbeiten"
                  >
                    <span>✎ Bearbeiten</span>
                  </button>
                  <button
                    type="button"
                    x-on:click="copyDocDeeplink(activeDoc)"
                    class="btn btn-outline btn-xs sm:btn-sm gap-1"
                    title="Deeplink zu diesem Dokument kopieren"
                  >
                    <span x-text="deeplinkCopied ? '✓ Kopiert' : '🔗 Link'"></span>
                  </button>
                  <a
                    x-bind:href="getPdfUrl(activeDoc)"
                    target="_blank"
                    class="btn btn-outline btn-xs sm:btn-sm gap-1.5"
                    title="PDF in neuem Tab öffnen"
                  >
                    <span>Öffnen ↗</span>
                  </a>
                  <a
                    x-bind:href="getPdfUrl(activeDoc)"
                    download
                    class="btn btn-primary btn-xs sm:btn-sm gap-1.5"
                    title="PDF herunterladen"
                  >
                    <span>Download ⬇</span>
                  </a>
                  <button
                    type="button"
                    x-on:click="deleteDoc(activeDoc)"
                    class="btn btn-ghost btn-xs sm:btn-sm btn-square text-error"
                    title="Dokument löschen"
                  >
                    🗑
                  </button>
                </div>
              </div>

              {/* Inhaltsanalyse & Details Grid */}
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Metadaten Spalte */}
                <div class="flex flex-col gap-4">
                  {/* Betrag / Fälligkeit Box */}
                  <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                    <div class="text-xs font-bold uppercase tracking-wider opacity-60">
                      Finanzen & Fristen
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-xs opacity-70">Betrag:</span>
                      <span
                        class="text-base sm:text-lg font-black text-success"
                        x-text="formatAmount(activeDoc.totalAmount)"
                      >
                      </span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-xs opacity-70">Fälligkeit:</span>
                      <span
                        class="text-xs font-bold text-error"
                        x-text="activeDoc.dueDate || '—'"
                      >
                      </span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-xs opacity-70">Empfänger:</span>
                      <span
                        class="text-xs font-medium"
                        x-text="activeDoc.recipient || '—'"
                      >
                      </span>
                    </div>
                  </div>

                  {/* Tags */}
                  <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5">
                    <div class="text-xs font-bold uppercase tracking-wider opacity-60 mb-2">
                      Schlagwörter
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                      <template
                        x-for="t in activeDoc.tags"
                        {...{ ":key": "t" }}
                      >
                        <span
                          class="badge badge-neutral badge-sm"
                          x-text="'#' + t"
                        >
                        </span>
                      </template>
                      <span
                        x-show="!activeDoc.tags || activeDoc.tags.length === 0"
                        class="text-xs opacity-40 italic"
                      >
                        Keine Tags vorhanden
                      </span>
                    </div>
                  </div>

                  {/* KI Zusammenfassung */}
                  <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5">
                    <div class="text-xs font-bold uppercase tracking-wider text-primary mb-2">
                      ✨ KI-Zusammenfassung
                    </div>
                    <p
                      class="text-sm sm:text-xs leading-relaxed opacity-80"
                      x-text="activeDoc.summary || 'Keine Zusammenfassung hinterlegt.'"
                    >
                    </p>
                  </div>
                </div>

                {/* Beleg-Vorschau Spalte (2 Spalten breit, klickbar zum PDF-Öffnen auf allen Geräten) */}
                <div class="md:col-span-2 flex flex-col gap-4">
                  <div class="bg-base-200 border border-base-content/10 rounded-2xl overflow-hidden max-w-[600px] flex flex-col">
                    <div class="p-3 bg-base-300 border-b border-base-content/10 flex justify-between items-center text-xs">
                      <span
                        class="font-mono opacity-60 truncate"
                        x-text="activeDoc.fileNamePdf"
                      >
                      </span>
                      <span class="badge badge-xs shrink-0">Vorschau · Seite 1</span>
                    </div>
                    <a
                      x-bind:href="getPdfUrl(activeDoc)"
                      target="_blank"
                      class="block relative group bg-base-100 overflow-hidden"
                      title="Volles PDF im Browser öffnen"
                    >
                      <img
                        x-show="!previewError"
                        x-bind:src="getPreviewUrl(activeDoc)"
                        x-on:error="previewError = true"
                        alt="Beleg-Vorschau"
                        class="w-full h-auto max-h-[380px] object-cover object-top transition group-hover:opacity-90"
                      />
                      <div
                        x-show="previewError"
                        class="p-8 text-center text-xs opacity-70 flex flex-col items-center gap-2"
                        style="display: none;"
                      >
                        <span class="text-3xl">📄</span>
                        <span>Vorschau-Bild nicht vorhanden · PDF öffnen ↗</span>
                      </div>
                      <div
                        x-show="!previewError"
                        class="absolute bottom-2 right-2 badge badge-neutral badge-sm shadow-md opacity-90 group-hover:badge-primary transition"
                      >
                        🔍 PDF öffnen ↗
                      </div>
                    </a>
                  </div>

                  {/* Volltext Transkript */}
                  <div
                    x-show="activeDoc.ocrText"
                    class="collapse collapse-arrow bg-base-200 border border-base-content/10 rounded-2xl"
                  >
                    <input type="checkbox" />
                    <div class="collapse-title text-xs font-bold">
                      📄 OCR-Transkript / Volltext anzeigen
                    </div>
                    <div class="collapse-content">
                      <pre
                        class="text-[11px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-base-100 p-3 rounded-xl border border-base-content/5"
                        x-text="activeDoc.ocrText"
                      ></pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template x-if="!activeDoc">
            <div class="h-full flex flex-col items-center justify-center text-center opacity-60 p-8">
              <span class="text-5xl mb-3">📑</span>
              <h3 class="font-bold text-lg">Kein Dokument ausgewählt</h3>
              <p class="text-xs max-w-sm mt-1 mb-4">
                Wähle ein Dokument aus der linken Seitenleiste oder erfasse einen neuen Scan.
              </p>
              <button
                type="button"
                x-on:click="openNewScan()"
                class="btn btn-primary btn-sm"
              >
                + Neues Dokument erfassen
              </button>
            </div>
          </template>
        </div>

        {/* WORKSPACE CONTENT: TAB 2 - ERFASSUNG FÜR AGENT-QUEUE */}
        <div
          x-show="activeTab === 'new'"
          class="flex-1 flex flex-col p-3 md:p-6 overflow-y-auto"
        >
          <div class="max-w-5xl mx-auto w-full flex flex-col gap-6">
            {/* Header & Aktionen */}
            <div class="flex justify-between items-center border-b border-base-content/10 pb-4">
              <div>
                <h2 class="text-lg sm:text-xl font-black text-base-content">
                  Neues Dokument erfassen
                </h2>
                <p class="text-xs opacity-60">
                  Seiten scannen und direkt in die Agent-Queue legen
                </p>
              </div>

              <div class="flex items-center gap-2">
                <button
                  type="button"
                  x-on:click="activeTab = 'archive'"
                  class="btn btn-ghost btn-xs sm:btn-sm"
                >
                  Abbrechen
                </button>
                <button
                  type="button"
                  x-on:click="queueCurrentScan()"
                  x-bind:disabled="pages.length === 0 || isSaving"
                  class="btn btn-primary btn-xs sm:btn-sm gap-2 font-bold shadow-md"
                >
                  <span x-show="!isSaving">📥 In Agent-Queue legen</span>
                  <span
                    x-show="isSaving"
                    class="loading loading-spinner loading-xs"
                  >
                  </span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Linke Seite: Seiten-Galerie */}
              <div class="md:col-span-6 flex flex-col gap-4">
                <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 flex flex-col gap-3">
                  <div class="flex justify-between items-center">
                    <span class="text-xs font-bold uppercase tracking-wider opacity-70">
                      Gescannte Seiten (<span x-text="pages.length"></span>)
                    </span>
                    <button
                      type="button"
                      x-on:click="openScannerForPage(-1)"
                      class="btn btn-primary btn-xs font-bold"
                    >
                      + Seite scannen
                    </button>
                  </div>

                  <template x-if="pages.length === 0">
                    <div class="border border-dashed border-base-content/20 rounded-xl p-8 text-center bg-base-100/50">
                      <div class="text-3xl mb-2">📸</div>
                      <p class="text-xs opacity-70 mb-3">
                        Noch keine Seiten erfasst.
                      </p>
                      <button
                        type="button"
                        x-on:click="openScannerForPage(-1)"
                        class="btn btn-outline btn-primary btn-xs"
                      >
                        Kamera starten
                      </button>
                    </div>
                  </template>

                  <div class="grid grid-cols-2 gap-3">
                    <template
                      x-for="(page, idx) in pages"
                      {...{ ":key": "page.id" }}
                    >
                      <div class="bg-base-100 rounded-xl border border-base-content/10 overflow-hidden group shadow-2xs">
                        <div class="aspect-3/4 bg-base-300 flex items-center justify-center overflow-hidden">
                          <img
                            {...{ ":src": "page.dataUrl" }}
                            class="w-full h-full object-contain"
                          />
                        </div>
                        <div class="p-2 flex justify-between items-center text-xs bg-base-200/50">
                          <span
                            class="font-bold text-[11px]"
                            x-text="'S. ' + (idx + 1)"
                          >
                          </span>
                          <div class="flex items-center gap-1">
                            <button
                              type="button"
                              x-on:click="openScannerForPage(idx)"
                              class="btn btn-ghost btn-xs btn-square"
                              title="Erneut zuschneiden"
                            >
                              ✂
                            </button>
                            <button
                              type="button"
                              x-on:click="removePage(idx)"
                              class="btn btn-ghost btn-xs btn-square text-error"
                              title="Löschen"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    </template>
                  </div>
                </div>
              </div>

              {/* Rechte Seite: Label & Warteschlange */}
              <div class="md:col-span-6 flex flex-col gap-4">
                <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                  <div class="text-xs font-bold uppercase tracking-wider opacity-70 border-b border-base-content/10 pb-2">
                    Agent-Queue Übergabe
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70 font-bold">
                      Optionales Label
                    </label>
                    <input
                      type="text"
                      x-model="queueLabel"
                      placeholder="z.B. Stromrechnung, Steuerbescheid..."
                      class="input input-bordered input-sm text-xs"
                    />
                  </div>

                  <p class="text-[11px] opacity-70 leading-relaxed">
                    Der Scan landet in der Pending-Queue. Dein Agent analysiert die Seiten einheitlich und legt das Dokument nach{" "}
                    <code>Kategorie/Absender/Jahr</code> im Archiv ab.
                  </p>

                  <button
                    type="button"
                    x-on:click="queueCurrentScan()"
                    x-bind:disabled="pages.length === 0 || isSaving"
                    class="btn btn-primary btn-sm w-full gap-2 font-bold shadow-sm mt-1"
                  >
                    <span x-show="!isSaving">📥 In Agent-Queue legen</span>
                    <span
                      x-show="isSaving"
                      class="loading loading-spinner loading-xs"
                    >
                    </span>
                  </button>
                </div>

                {/* Offene Queue */}
                <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-3">
                  <div class="flex items-center justify-between border-b border-base-content/10 pb-2">
                    <span class="text-xs font-bold uppercase tracking-wider opacity-70">
                      Offene Agent-Queue (<span x-text="pendingScans.length"></span>)
                    </span>
                    <button
                      type="button"
                      x-on:click="loadPendingScans()"
                      class="btn btn-ghost btn-xs font-mono"
                    >
                      ↻
                    </button>
                  </div>

                  <template x-if="pendingScans.length === 0">
                    <p class="text-xs opacity-50 italic py-2">
                      Keine wartenden Scans in der Queue.
                    </p>
                  </template>

                  <div class="flex flex-col gap-2 max-h-64 overflow-y-auto">
                    <template
                      x-for="item in pendingScans"
                      {...{ ":key": "item.id" }}
                    >
                      <div class="bg-base-100 border border-base-content/10 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div class="min-w-0">
                          <div
                            class="font-semibold truncate"
                            x-text="item.label || item.id"
                          >
                          </div>
                          <div class="text-[10px] opacity-60 font-mono">
                            <span x-text="item.pageCount + ' Seite(n)'"></span>
                            {" · "}
                            <span x-text="item.createdAt.slice(0, 16).replace('T', ' ')"></span>
                          </div>
                        </div>
                        <button
                          type="button"
                          x-on:click="deletePendingScanItem(item.id)"
                          class="btn btn-ghost btn-xs btn-square text-error shrink-0"
                          title="Aus Queue entfernen"
                        >
                          ✕
                        </button>
                      </div>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Kamera & Scanner Modal */}
      <ScannerModal />

      {/* Metadaten Bearbeiten Modal */}
      <div
        x-show="editModalOpen"
        x-cloak
        class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-neutral/80 backdrop-blur-sm overflow-y-auto"
        style="display: none;"
      >
        <div
          class="bg-base-100 w-full max-w-2xl rounded-2xl shadow-2xl border border-base-300 overflow-hidden flex flex-col max-h-[92vh]"
          {...{ "x-on:click.outside": "closeEditModal()" }}
        >
          <div class="px-5 py-4 border-b border-base-300 bg-base-200/50 flex items-center justify-between shrink-0">
            <h3 class="font-black text-base sm:text-lg">Dokumentdaten bearbeiten</h3>
            <button
              type="button"
              x-on:click="closeEditModal()"
              class="btn btn-ghost btn-circle btn-sm"
              title="Schließen"
            >
              ✕
            </button>
          </div>

          <form {...{ "x-on:submit.prevent": "saveEditedDoc()" }} class="p-5 overflow-y-auto flex flex-col gap-3">
            <label class="form-control w-full">
              <div class="label py-1">
                <span class="label-text text-xs font-bold">Titel *</span>
              </div>
              <input type="text" x-model="editForm.title" required class="input input-bordered input-sm w-full" />
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Kategorie</span>
                </div>
                <input type="text" x-model="editForm.category" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Datum (YYYY-MM-DD)</span>
                </div>
                <input type="text" x-model="editForm.date" placeholder="YYYY-MM-DD" class="input input-bordered input-sm w-full" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Absender</span>
                </div>
                <input type="text" x-model="editForm.sender" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Empfänger</span>
                </div>
                <input type="text" x-model="editForm.recipient" class="input input-bordered input-sm w-full" />
              </label>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Betrag (EUR)</span>
                </div>
                <input type="text" x-model="editForm.totalAmount" placeholder="z. B. 3191.97" class="input input-bordered input-sm w-full" />
              </label>
              <label class="form-control w-full">
                <div class="label py-1">
                  <span class="label-text text-xs font-bold">Fälligkeit (YYYY-MM-DD)</span>
                </div>
                <input type="text" x-model="editForm.dueDate" placeholder="YYYY-MM-DD" class="input input-bordered input-sm w-full" />
              </label>
            </div>

            <label class="form-control w-full">
              <div class="label py-1">
                <span class="label-text text-xs font-bold">Tags (kommagetrennt)</span>
              </div>
              <input type="text" x-model="editForm.tagsText" placeholder="Rechnung, Steuer, ..." class="input input-bordered input-sm w-full" />
              <div x-show="availableTags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                <template x-for="tagItem in availableTags" {...{ ":key": "tagItem.tag" }}>
                  <button
                    type="button"
                    x-on:click="toggleEditTag(tagItem.tag)"
                    x-bind:class="isEditTagActive(tagItem.tag) ? 'badge-primary' : 'badge-ghost border-base-content/20 hover:border-primary/50'"
                    class="badge badge-sm cursor-pointer transition-colors"
                    x-text="(isEditTagActive(tagItem.tag) ? '✓ ' : '+ ') + tagItem.tag"
                  />
                </template>
              </div>
            </label>

            <label class="form-control w-full">
              <div class="label py-1">
                <span class="label-text text-xs font-bold">Zusammenfassung</span>
              </div>
              <textarea x-model="editForm.summary" rows={2} class="textarea textarea-bordered textarea-sm w-full"></textarea>
            </label>

            <label class="form-control w-full">
              <div class="label py-1">
                <span class="label-text text-xs font-bold">Erkannter Text (OCR)</span>
              </div>
              <textarea x-model="editForm.ocrText" rows={4} class="textarea textarea-bordered textarea-sm font-mono text-xs w-full"></textarea>
            </label>

            <div class="pt-3 border-t border-base-300 flex justify-end gap-2">
              <button type="button" x-on:click="closeEditModal()" class="btn btn-ghost btn-sm rounded-xl font-bold">
                Abbrechen
              </button>
              <button
                type="submit"
                x-bind:disabled="editSaving"
                class="btn btn-primary btn-sm rounded-xl font-bold"
              >
                <span x-show="editSaving" class="loading loading-spinner loading-xs" style="display: none;"></span>
                <span>Speichern</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
