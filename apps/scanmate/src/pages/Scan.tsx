/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ScannerModal } from "../components/ScannerModal.tsx";
import { ThemeToggle } from "@sleipnir/core";

export function ScanPage({ basePath }: { basePath: string }) {
  return (
    <div
      x-data={`scanApp('${basePath}')`}
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
        class="w-80 bg-base-200 border-r border-base-content/10 flex flex-col justify-between z-50 md:z-10 md:relative"
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

          {/* Neuer Scan Button */}
          <button
            type="button"
            class="btn btn-primary btn-sm w-full gap-2 shadow-sm mt-1 font-bold"
            x-on:click="openNewScan(); mobileMenuOpen = false;"
          >
            <span>📸 Neuer Scan</span>
          </button>

          {/* Schnellsuchleiste */}
          <div class="relative mt-1">
            <input
              type="text"
              placeholder="Dokumente durchsuchen..."
              class="input input-bordered input-sm w-full pl-8 text-xs font-sans"
              x-model="Alpine.store('scanmate').searchQuery"
            />
            <span class="absolute left-2.5 top-2 text-xs opacity-50">🔍</span>
            <button
              type="button"
              x-show="Alpine.store('scanmate').searchQuery"
              x-on:click="Alpine.store('scanmate').searchQuery = ''"
              class="absolute right-2 top-2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          </div>

          {/* Filterleiste: Ordner & Kategorie */}
          <div class="grid grid-cols-2 gap-2 text-xs px-0.5">
            <div>
              <span class="text-[10px] font-bold uppercase opacity-50 block mb-0.5">
                Ordner
              </span>
              <select
                x-model="Alpine.store('scanmate').filterFolder"
                class="select select-bordered select-xs w-full text-[11px]"
              >
                <option value="">Alle Ordner</option>
                <template
                  x-for="f in Alpine.store('scanmate').folders"
                  {...{ ":key": "f" }}
                >
                  <option
                    {...{ ":value": "f" }}
                    x-text="f ? f : 'Hauptordner (/) '"
                  >
                  </option>
                </template>
              </select>
            </div>

            <div>
              <span class="text-[10px] font-bold uppercase opacity-50 block mb-0.5">
                Kategorie
              </span>
              <select
                x-model="Alpine.store('scanmate').filterCategory"
                class="select select-bordered select-xs w-full text-[11px]"
              >
                <option value="">Alle</option>
                <option value="Brief">Brief</option>
                <option value="Rechnung">Rechnung</option>
                <option value="Quittung">Quittung</option>
                <option value="Behörde">Behörde</option>
                <option value="Vertrag">Vertrag</option>
                <option value="Versicherung">Versicherung</option>
                <option value="Bank">Bank</option>
                <option value="Rezept">Rezept</option>
                <option value="Sonstiges">Sonstiges</option>
              </select>
            </div>
          </div>

          <div class="divider my-0 text-xs opacity-50">
            Archiv (<span x-text="filteredDocuments().length"></span>)
          </div>

          {/* Dokumentenliste in der Sidebar */}
          <div class="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            <template x-if="Alpine.store('scanmate').isLoading">
              <div class="text-center py-6 text-xs opacity-60">
                <span class="loading loading-spinner loading-xs text-primary">
                </span>
                <p class="mt-2">Lade Dokumente...</p>
              </div>
            </template>

            <template x-if="!Alpine.store('scanmate').isLoading && filteredDocuments().length === 0">
              <div class="text-xs opacity-50 text-center py-8">
                Keine Dokumente gefunden.
              </div>
            </template>

            <template
              x-for="doc in filteredDocuments()"
              {...{ ":key": "doc.id" }}
            >
              <div
                class="p-2.5 rounded-xl text-xs hover:bg-base-300 cursor-pointer transition flex flex-col gap-1 border border-base-content/5 relative group"
                x-bind:class="Alpine.store('scanmate').activeDoc?.id === doc.id && activeTab === 'archive' ? 'bg-primary/10 border-primary/40' : 'bg-base-100/50'"
                x-on:click="activeTab = 'archive'; Alpine.store('scanmate').activeDoc = doc; mobileMenuOpen = false;"
              >
                <div class="flex items-center justify-between gap-1">
                  <span
                    class="badge badge-xs font-bold"
                    x-bind:class="doc.category === 'Rechnung' ? 'badge-warning' : (doc.category === 'Quittung' ? 'badge-success' : 'badge-neutral')"
                    x-text="doc.category"
                  >
                  </span>
                  <span
                    class="text-[10px] opacity-60"
                    x-text="doc.date || doc.createdAt.split('T')[0]"
                  >
                  </span>
                </div>

                <div
                  class="font-bold text-base-content truncate flex items-center gap-1.5"
                  x-text="doc.title"
                >
                </div>

                <div class="flex items-center justify-between gap-1 text-[11px] opacity-70">
                  <span class="truncate" x-text="doc.sender || 'Kein Absender'">
                  </span>
                  <span
                    x-show="doc.targetPath"
                    class="text-[9px] font-mono bg-base-300 px-1 py-0.5 rounded text-base-content/70 truncate max-w-[90px]"
                    x-text="doc.targetPath"
                  >
                  </span>
                </div>

                <div class="flex items-center justify-between mt-0.5 pt-1 border-t border-base-content/5 text-[10px]">
                  <span class="opacity-50" x-text="`${doc.pageCount} Seite(n)`">
                  </span>
                  <span
                    x-show="doc.totalAmount"
                    class="font-black text-success"
                    x-text="`${doc.totalAmount.toFixed(2)} €`"
                  >
                  </span>
                </div>
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
              x-text="activeTab === 'new' ? 'Neues Dokument erfassen' : (Alpine.store('scanmate').activeDoc ? Alpine.store('scanmate').activeDoc.title : 'Archiv Übersicht')"
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
                <span x-show="pages.length > 0" x-text="`(${pages.length})`">
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
          <template x-if="Alpine.store('scanmate').activeDoc">
            <div class="max-w-5xl mx-auto w-full flex flex-col gap-6">
              {/* Header Box */}
              <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start gap-4">
                <div>
                  <div class="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      class="badge badge-primary font-bold"
                      x-text="Alpine.store('scanmate').activeDoc.category"
                    >
                    </span>
                    <span
                      class="text-xs opacity-60"
                      x-text="Alpine.store('scanmate').activeDoc.date || Alpine.store('scanmate').activeDoc.createdAt.split('T')[0]"
                    >
                    </span>
                    <span
                      class="badge badge-ghost text-xs font-mono"
                      x-text="`${Alpine.store('scanmate').activeDoc.pageCount} Seite(n)`"
                    >
                    </span>
                    <span
                      x-show="Alpine.store('scanmate').activeDoc.targetPath"
                      class="badge badge-outline text-xs font-mono"
                      x-text="`📁 ${Alpine.store('scanmate').activeDoc.targetPath}`"
                    >
                    </span>
                  </div>
                  <h2
                    class="text-xl sm:text-2xl font-black text-base-content"
                    x-text="Alpine.store('scanmate').activeDoc.title"
                  >
                  </h2>
                  <p
                    x-show="Alpine.store('scanmate').activeDoc.sender"
                    class="text-xs sm:text-sm opacity-80 mt-1"
                  >
                    Absender:{" "}
                    <span
                      class="font-semibold"
                      x-text="Alpine.store('scanmate').activeDoc.sender"
                    >
                    </span>
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <a
                    x-bind:href="`${basePath}/api/pdf/${Alpine.store('scanmate').activeDoc.fileNamePdf}`"
                    target="_blank"
                    class="btn btn-outline btn-xs sm:btn-sm gap-1.5"
                    title="PDF in neuem Tab öffnen"
                  >
                    <span>Öffnen ↗</span>
                  </a>
                  <a
                    x-bind:href="`${basePath}/api/pdf/${Alpine.store('scanmate').activeDoc.fileNamePdf}`"
                    download
                    class="btn btn-primary btn-xs sm:btn-sm gap-1.5"
                    title="PDF herunterladen"
                  >
                    <span>Download ⬇</span>
                  </a>
                  <button
                    type="button"
                    x-on:click="deleteDoc(Alpine.store('scanmate').activeDoc)"
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
                        x-text="Alpine.store('scanmate').activeDoc.totalAmount ? `${Alpine.store('scanmate').activeDoc.totalAmount.toFixed(2)} €` : '—'"
                      >
                      </span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-xs opacity-70">Fälligkeit:</span>
                      <span
                        class="text-xs font-bold text-error"
                        x-text="Alpine.store('scanmate').activeDoc.dueDate || '—'"
                      >
                      </span>
                    </div>
                    <div class="flex justify-between items-center">
                      <span class="text-xs opacity-70">Empfänger:</span>
                      <span
                        class="text-xs font-medium"
                        x-text="Alpine.store('scanmate').activeDoc.recipient || '—'"
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
                        x-for="t in Alpine.store('scanmate').activeDoc.tags"
                        {...{ ":key": "t" }}
                      >
                        <span
                          class="badge badge-neutral badge-sm"
                          x-text="`#${t}`"
                        >
                        </span>
                      </template>
                      <span
                        x-show="!Alpine.store('scanmate').activeDoc.tags || Alpine.store('scanmate').activeDoc.tags.length === 0"
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
                      class="text-xs leading-relaxed opacity-80"
                      x-text="Alpine.store('scanmate').activeDoc.summary || 'Keine Zusammenfassung hinterlegt.'"
                    >
                    </p>
                  </div>
                </div>

                {/* PDF Viewer Spalte (2 Spalten breit) */}
                <div class="md:col-span-2 flex flex-col gap-4">
                  <div class="bg-base-200 border border-base-content/10 rounded-2xl overflow-hidden h-[450px] sm:h-[600px] flex flex-col">
                    <div class="p-3 bg-base-300 border-b border-base-content/10 flex justify-between items-center text-xs">
                      <span
                        class="font-mono opacity-60 truncate"
                        x-text="Alpine.store('scanmate').activeDoc.fileNamePdf"
                      >
                      </span>
                      <span class="badge badge-xs">PDF Preview</span>
                    </div>
                    <iframe
                      x-bind:src="`${basePath}/api/pdf/${Alpine.store('scanmate').activeDoc.fileNamePdf}`"
                      class="w-full flex-1 border-0 bg-base-100"
                    >
                    </iframe>
                  </div>

                  {/* Volltext Transkript */}
                  <div
                    x-show="Alpine.store('scanmate').activeDoc.ocrText"
                    class="collapse collapse-arrow bg-base-200 border border-base-content/10 rounded-2xl"
                  >
                    <input type="checkbox" />
                    <div class="collapse-title text-xs font-bold">
                      📄 OCR-Transkript / Volltext anzeigen
                    </div>
                    <div class="collapse-content">
                      <pre
                        class="text-[11px] font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-base-100 p-3 rounded-xl border border-base-content/5"
                        x-text="Alpine.store('scanmate').activeDoc.ocrText"
                      ></pre>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template x-if="!Alpine.store('scanmate').activeDoc">
            <div class="h-full flex flex-col items-center justify-center text-center opacity-60 p-8">
              <span class="text-5xl mb-3">📑</span>
              <h3 class="font-bold text-lg">Kein Dokument ausgewählt</h3>
              <p class="text-xs max-w-sm mt-1 mb-4">
                Wähle ein Dokument aus der linken Seitenleiste oder erfasse
                einen neuen Scan.
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

        {/* WORKSPACE CONTENT: TAB 2 - ERFASSUNG & KI SYNTHESE */}
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
                  Seiten ablichten, per Vision-KI analysieren & archivieren
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
                  x-on:click="saveCurrentDocument()"
                  x-bind:disabled="pages.length === 0 || isSaving"
                  class="btn btn-primary btn-xs sm:btn-sm gap-2 font-bold shadow-md"
                >
                  <span x-show="!isSaving">💾 Speichern</span>
                  <span
                    x-show="isSaving"
                    class="loading loading-spinner loading-xs"
                  >
                  </span>
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Linke Seite: Seiten-Galerie & KI Steuerung */}
              <div class="md:col-span-5 flex flex-col gap-4">
                {/* Galerie Box */}
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
                            x-text="`S. ${idx + 1}`"
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

                {/* KI Analyse Card */}
                <div class="bg-base-200 border border-base-content/10 rounded-2xl p-4 flex flex-col gap-3">
                  <div class="flex items-center gap-1.5 font-bold text-xs">
                    <span>✨</span>
                    <span>KI-Vision Analyse & OCR</span>
                  </div>
                  <p class="text-[11px] opacity-60">
                    Extrahiert Titel, Absender, Beträge, Tags und
                    Inhaltszusammenfassung automatisch aus den Scans.
                  </p>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Vision-Modell
                    </label>
                    <select
                      x-model="Alpine.store('scanmate').selectedModel"
                      class="select select-bordered select-xs w-full text-xs"
                    >
                      <template
                        x-for="m in Alpine.store('scanmate').models"
                        {...{ ":key": "m.id" }}
                      >
                        <option {...{ ":value": "m.id" }} x-text="m.name">
                        </option>
                      </template>
                    </select>
                  </div>

                  <button
                    type="button"
                    x-on:click="runAiExtraction()"
                    x-bind:disabled="pages.length === 0 || isAnalyzing"
                    class="btn btn-primary btn-sm w-full gap-2 mt-1 shadow-sm font-bold"
                  >
                    <span x-show="!isAnalyzing">✨ Jetzt analysieren</span>
                    <span
                      x-show="isAnalyzing"
                      class="loading loading-spinner loading-xs"
                    >
                    </span>
                    <span x-show="isAnalyzing">Analysiere...</span>
                  </button>
                </div>
              </div>

              {/* Rechte Seite: Metadaten-Formular */}
              <div class="md:col-span-7 bg-base-200 border border-base-content/10 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
                <div class="text-xs font-bold uppercase tracking-wider opacity-70 border-b border-base-content/10 pb-2 flex justify-between items-center">
                  <span>Metadaten & Zielordner</span>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Zielordner / Ablagepfad wie bei Notemate */}
                  <div class="form-control sm:col-span-2">
                    <label class="label py-1 text-[11px] opacity-70 font-bold">
                      📁 Zielordner (Ablagepfad)
                    </label>
                    <div class="flex gap-2">
                      <select
                        x-model="metadata.targetPath"
                        class="select select-bordered select-sm text-xs flex-1"
                      >
                        <option value="">Hauptordner (./data/documents)</option>
                        <template
                          x-for="f in Alpine.store('scanmate').folders"
                          {...{ ":key": "f" }}
                        >
                          <option x-show="f" {...{ ":value": "f" }} x-text="f">
                          </option>
                        </template>
                      </select>
                      <input
                        type="text"
                        x-model="metadata.targetPath"
                        placeholder="oder neuen Pfad tippen (z.B. Finanzen/2026)"
                        class="input input-bordered input-sm text-xs flex-1 font-mono"
                      />
                    </div>
                    <span class="text-[10px] opacity-50 mt-1">
                      Wähle einen bestehenden Ordner oder erstelle flexibel neue
                      Unterverzeichnisse.
                    </span>
                  </div>

                  <div class="form-control sm:col-span-2">
                    <label class="label py-1 text-[11px] opacity-70">
                      Titel / Betreff
                    </label>
                    <input
                      type="text"
                      x-model="metadata.title"
                      placeholder="z.B. Bescheid / Rechnung"
                      class="input input-bordered input-sm text-xs font-bold"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Kategorie
                    </label>
                    <select
                      x-model="metadata.category"
                      class="select select-bordered select-sm text-xs"
                    >
                      <option value="Brief">Brief</option>
                      <option value="Rechnung">Rechnung</option>
                      <option value="Quittung">Quittung</option>
                      <option value="Behörde">Behörde</option>
                      <option value="Vertrag">Vertrag</option>
                      <option value="Versicherung">Versicherung</option>
                      <option value="Bank">Bank</option>
                      <option value="Rezept">Rezept</option>
                      <option value="Sonstiges">Sonstiges</option>
                    </select>
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Dokumentdatum
                    </label>
                    <input
                      type="date"
                      x-model="metadata.date"
                      class="input input-bordered input-sm text-xs"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Absender / Aussteller
                    </label>
                    <input
                      type="text"
                      x-model="metadata.sender"
                      placeholder="z.B. Telekom, Finanzamt"
                      class="input input-bordered input-sm text-xs"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Empfänger
                    </label>
                    <input
                      type="text"
                      x-model="metadata.recipient"
                      placeholder="z.B. Stefan"
                      class="input input-bordered input-sm text-xs"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Gesamtbetrag (€)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      x-model="metadata.totalAmount"
                      placeholder="0.00"
                      class="input input-bordered input-sm text-xs font-mono"
                    />
                  </div>

                  <div class="form-control">
                    <label class="label py-1 text-[11px] opacity-70">
                      Fälligkeitsdatum
                    </label>
                    <input
                      type="date"
                      x-model="metadata.dueDate"
                      class="input input-bordered input-sm text-xs"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div class="form-control">
                  <label class="label py-1 text-[11px] opacity-70">Tags</label>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      x-model="metadata.tagInput"
                      {...{ "x-on:keydown.enter.prevent": "addTag()" }}
                      placeholder="Tag tippen & Enter..."
                      class="input input-bordered input-sm text-xs flex-1"
                    />
                    <button
                      type="button"
                      x-on:click="addTag()"
                      class="btn btn-outline btn-sm"
                    >
                      +
                    </button>
                  </div>
                  <div class="flex flex-wrap gap-1 mt-2">
                    <template
                      x-for="(t, idx) in metadata.tags"
                      {...{ ":key": "idx" }}
                    >
                      <span class="badge badge-neutral badge-sm gap-1">
                        <span x-text="`#${t}`"></span>
                        <button
                          type="button"
                          x-on:click="removeTag(idx)"
                          class="hover:text-error"
                        >
                          ×
                        </button>
                      </span>
                    </template>
                  </div>
                </div>

                {/* Zusammenfassung */}
                <div class="form-control">
                  <label class="label py-1 text-[11px] opacity-70">
                    Zusammenfassung
                  </label>
                  <textarea
                    x-model="metadata.summary"
                    rows="3"
                    class="textarea textarea-bordered text-xs leading-relaxed"
                    placeholder="Wird durch KI ausgefüllt oder manuell eingegeben..."
                  >
                  </textarea>
                </div>

                {/* OCR Text */}
                <div class="form-control">
                  <label class="label py-1 text-[11px] opacity-70">
                    OCR-Transkript
                  </label>
                  <textarea
                    x-model="metadata.ocrText"
                    rows="4"
                    class="textarea textarea-bordered text-xs font-mono leading-relaxed"
                    placeholder="Erkannter Volltext..."
                  >
                  </textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Kamera & Scanner Modal */}
      <ScannerModal />
    </div>
  );
}
