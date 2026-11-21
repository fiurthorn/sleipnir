/**
 * @project Sleipnir Stack / Scanmate Session-Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ThemeToggle } from "@sleipnir/core";
import { ScannerModal } from "../components/ScannerModal.tsx";

interface SessionScanPageProps {
  token: string;
}

export const SessionScanPage = ({ token }: SessionScanPageProps) => {
  return (
    <div
      x-data={`sessionScanApp(${JSON.stringify(token)})`}
      class="flex flex-col min-h-screen bg-base-100"
    >
      <script defer src="./static/session-client.js"></script>

      {/* Header */}
      <header class="navbar bg-base-200 border-b border-base-content/10 px-4">
        <div class="flex-1 flex items-center gap-2">
          <span class="text-xl">📄</span>
          <span class="font-bold text-base">ScanMate Session</span>
          <span class="badge badge-primary badge-xs">10-Min-Link</span>
        </div>
        <div class="flex-none">
          <ThemeToggle />
        </div>
      </header>

      <main class="flex-1 container mx-auto max-w-2xl p-4 flex flex-col gap-4">
        {/* Loading */}
        <div x-show="isLoading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-md"></span>
        </div>

        {/* Error / Expired */}
        <div x-show="!isLoading && errorMessage && !session" class="alert alert-error">
          <span x-text="errorMessage"></span>
        </div>

        {/* Submitted Success */}
        <div x-show="!isLoading && submitted" class="card bg-base-200 border border-success/30">
          <div class="card-body items-center text-center gap-3">
            <div class="text-4xl">✅</div>
            <h2 class="card-title">Scans an Agent übermittelt!</h2>
            <p class="text-sm opacity-75">
              Die beschnittenen Seiten liegen jetzt in der Agent-Inbox bereit. Du kannst dieses Fenster schließen.
            </p>
          </div>
        </div>

        {/* Active Scan Session */}
        <template x-if="!isLoading && session && !submitted">
          <div class="flex flex-col gap-4">
            <div class="card bg-base-200/60 border border-base-content/10">
              <div class="card-body p-4 gap-3">
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs opacity-70">
                    Gültig bis <span class="font-mono" x-text="new Date(session.expiresAt).toLocaleTimeString('de-DE')"></span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-primary btn-sm"
                    x-on:click="openScannerForPage(-1)"
                  >
                    + Seite scannen / zuschneiden
                  </button>
                </div>

                <div class="form-control">
                  <input
                    type="text"
                    x-model="label"
                    placeholder="Optionales Label (z. B. Rechnung)"
                    class="input input-bordered input-sm w-full"
                  />
                </div>
              </div>
            </div>

            {/* Scanned Pages Grid */}
            <div x-show="pages.length === 0" class="text-center py-10 border-2 border-dashed border-base-content/15 rounded-xl">
              <p class="text-sm opacity-70 mb-3">Noch keine Seiten erfasst.</p>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                x-on:click="openScannerForPage(-1)"
              >
                Kamera / Scanner öffnen
              </button>
            </div>

            <div x-show="pages.length > 0" class="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <template x-for="(page, idx) in pages" x-bind:key="page.id">
                <div class="card bg-base-200 border border-base-content/15 overflow-hidden">
                  <figure class="aspect-[3/4] bg-base-300 relative">
                    <img
                      x-bind:src="page.dataUrl"
                      class="w-full h-full object-contain cursor-pointer"
                      x-on:click="openScannerForPage(idx)"
                      title="Zum erneuten Zuschneiden antippen"
                    />
                    <span class="badge badge-neutral badge-xs absolute top-1.5 left-1.5" x-text="'Seite ' + (idx + 1)"></span>
                  </figure>
                  <div class="flex items-center justify-between p-1.5">
                    <div class="flex gap-1">
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        x-bind:disabled="idx === 0"
                        x-on:click="movePageUp(idx)"
                        title="Nach vorne"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        class="btn btn-ghost btn-xs"
                        x-on:click="openScannerForPage(idx)"
                        title="Zuschneiden / Filter"
                      >
                        ✂️
                      </button>
                    </div>
                    <button
                      type="button"
                      class="btn btn-ghost btn-xs text-error"
                      x-on:click="removePage(idx)"
                      title="Entfernen"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </template>
            </div>

            <div x-show="errorMessage" class="alert alert-error text-sm py-2" x-text="errorMessage"></div>

            <div class="flex justify-end pt-2">
              <button
                type="button"
                class="btn btn-success btn-md w-full sm:w-auto"
                x-bind:disabled="pages.length === 0 || isSubmitting"
                x-on:click="submitSession()"
              >
                <span x-show="!isSubmitting" x-text="'An Agent senden (' + pages.length + ' Seite/n)'"></span>
                <span x-show="isSubmitting">Wird übertragen...</span>
              </button>
            </div>
          </div>
        </template>
      </main>

      {/* Wiederverwendeter OpenCV/jscanify Scanner mit Kantenerkennung, Trimming & Filter */}
      <ScannerModal />
    </div>
  );
};
