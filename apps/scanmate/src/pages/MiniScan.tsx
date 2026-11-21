/**
 * @project Sleipnir Stack / Scanmate Mini-Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ThemeToggle } from "@sleipnir/core";

export const MiniScanPage = () => {
  return (
    <div x-data="miniScanClient" class="flex flex-col min-h-screen">
      <script defer src="./static/mini-client.js"></script>

      {/* Header */}
      <header class="navbar bg-base-100 border-b border-base-content/10 px-4">
        <div class="flex-1 flex items-center gap-3">
          <span class="font-bold text-lg tracking-tight">ScanMate Mini</span>
          <span class="badge badge-primary badge-sm">Agent-Inbox</span>
        </div>
        <div class="flex-none flex items-center gap-2">
          <a href="./" class="btn btn-ghost btn-sm">Zum Voll-Client</a>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main class="flex-1 container mx-auto max-w-2xl p-4 flex flex-col gap-6">
        {/* Capture Card */}
        <section class="card bg-base-100 shadow-sm border border-base-content/10">
          <div class="card-body gap-4">
            <h2 class="card-title text-base">Neuer Roh-Scan für Agent-Analyse</h2>
            <p class="text-sm opacity-75">
              Seiten fotografieren oder hochladen. Die Analyse, OCR und Archivierung übernimmt dein Agent über <code>/mcp</code>.
            </p>

            <div class="form-control">
              <label class="label">
                <span class="label-text text-xs">Optionales Label / Notiz</span>
              </label>
              <input
                type="text"
                x-model="label"
                placeholder="z. B. Stromrechnung November"
                class="input input-bordered input-sm w-full"
              />
            </div>

            <div class="flex flex-wrap gap-2">
              <label class="btn btn-outline btn-sm cursor-pointer">
                <span>Kamera / Foto aufnehmen</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  class="hidden"
                  x-on:change="handleFiles($event)"
                />
              </label>

              <label class="btn btn-outline btn-sm cursor-pointer">
                <span>Bilder wählen</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  class="hidden"
                  x-on:change="handleFiles($event)"
                />
              </label>
            </div>

            {/* Preview Grid */}
            <div x-show="pages.length > 0" class="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-2">
              <template x-for="(page, idx) in pages" x-bind:key="idx">
                <div class="relative group rounded border border-base-content/15 overflow-hidden bg-base-200 aspect-[3/4]">
                  <img x-bind:src="page" class="w-full h-full object-cover" />
                  <button
                    type="button"
                    class="btn btn-circle btn-xs btn-error absolute top-1 right-1"
                    x-on:click="removePage(idx)"
                    title="Seite entfernen"
                  >
                    ✕
                  </button>
                  <span
                    class="badge badge-neutral badge-xs absolute bottom-1 left-1"
                    x-text="'S. ' + (idx + 1)"
                  >
                  </span>
                </div>
              </template>
            </div>

            <div x-show="errorMessage" class="alert alert-error text-sm py-2" x-text="errorMessage"></div>
            <div x-show="statusMessage" class="alert alert-success text-sm py-2" x-text="statusMessage"></div>

            <div class="card-actions justify-end pt-2">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                x-bind:disabled="pages.length === 0 || isSubmitting"
                x-on:click="submitToInbox()"
              >
                <span x-show="!isSubmitting" x-text="'In Agent-Inbox ablegen (' + pages.length + ')'"></span>
                <span x-show="isSubmitting">Wird gespeichert...</span>
              </button>
            </div>
          </div>
        </section>

        {/* Pending Inbox List */}
        <section class="card bg-base-100 shadow-sm border border-base-content/10">
          <div class="card-body gap-3">
            <div class="flex items-center justify-between">
              <h2 class="card-title text-base">
                Offene Scans in Agent-Inbox (<span x-text="pendingItems.length"></span>)
              </h2>
              <button
                type="button"
                class="btn btn-ghost btn-xs"
                x-on:click="loadPending()"
                x-bind:disabled="isLoadingPending"
              >
                Aktualisieren
              </button>
            </div>

            <div x-show="pendingItems.length === 0" class="text-sm opacity-60 py-2">
              Keine offenen Scans vorhanden.
            </div>

            <div class="flex flex-col gap-2">
              <template x-for="item in pendingItems" x-bind:key="item.id">
                <div class="flex items-center justify-between p-2.5 rounded bg-base-200/70 border border-base-content/10">
                  <div class="min-w-0">
                    <div class="font-medium text-sm truncate" x-text="item.label"></div>
                    <div class="text-xs opacity-65">
                      <span x-text="item.pageCount + ' Seite(n)'"></span>
                      <span>·</span>
                      <span x-text="new Date(item.createdAt).toLocaleString('de-DE')"></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs text-error"
                    x-on:click="deletePending(item.id)"
                    title="Verwerfen"
                  >
                    Löschen
                  </button>
                </div>
              </template>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
