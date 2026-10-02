/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export function ScannerModal() {
  return (
    <div
      x-data="documentScanner()"
      x-show="open"
      x-cloak
      class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-neutral/80 backdrop-blur-sm overflow-hidden"
    >
      <div
        x-show="open"
        class="bg-base-100 w-full h-full sm:h-auto sm:max-w-4xl sm:rounded-3xl rounded-none shadow-2xl border-0 sm:border border-base-300 overflow-hidden flex flex-col my-0 sm:my-auto max-h-screen"
        {...{ "x-on:click.outside": "close()" }}
      >
        {/* Modal Header */}
        <div class="px-6 py-4 border-b border-base-300 bg-base-200/50 flex items-center justify-between shrink-0">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              📷
            </div>
            <div>
              <h3 class="font-black text-base-content text-base sm:text-lg">
                Dokumenten-Scanner
              </h3>
              <p class="text-[11px] font-bold text-base-content/50 uppercase tracking-widest">
                Seite{" "}
                <span x-text="pageIndex >= 0 ? (pageIndex + 1) : 'Neu'"></span>
              </p>
            </div>
          </div>

          <button
            type="button"
            x-on:click="close()"
            class="btn btn-ghost btn-circle btn-sm text-base-content/60 hover:text-base-content"
            title="Schließen"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div class="p-4 sm:p-6 flex-1 flex flex-col min-h-0 overflow-y-auto justify-between gap-4">
          {/* CAMERA MODE */}
          <div
            x-show="mode === 'camera'"
            class="flex-1 flex flex-col justify-between space-y-4 min-h-0"
          >
            <div class="relative bg-black rounded-2xl overflow-hidden flex-1 min-h-[48vh] sm:min-h-0 flex items-center justify-center border border-base-300 shadow-inner">
              <video
                x-ref="videoEl"
                autoplay
                playsinline
                muted
                class="w-full h-full object-cover"
              >
              </video>

              {/* Rahmen-Hilfe */}
              <div class="absolute inset-4 sm:inset-8 border-2 border-dashed border-white/60 rounded-2xl pointer-events-none flex items-center justify-center">
                <span class="text-white text-xs font-bold bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
                  Dokument / Brief im Rahmen ausrichten
                </span>
              </div>

              {/* Fallback ohne Live-Kamera */}
              <div
                x-show="!hasCamera"
                class="absolute inset-0 bg-base-300/95 p-8 flex flex-col items-center justify-center text-center"
              >
                <div class="text-3xl mb-2">📸</div>
                <p class="font-black text-base mb-1">
                  Kein Live-Kamera-Zugriff
                </p>
                <p class="text-xs text-base-content/70 max-w-md mb-4">
                  Wähle ein Bild oder nimm direkt ein Foto mit der
                  Smartphone-Kamera auf.
                </p>
                <label class="btn btn-primary btn-sm rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2">
                  <span>Foto aufnehmen</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    x-on:change="handleFileUpload($event)"
                  />
                </label>
              </div>
            </div>

            {/* Steuerung Kamera */}
            <div class="flex flex-wrap items-center justify-between gap-3 pt-1 shrink-0">
              <div class="flex items-center gap-2">
                <label class="btn btn-outline btn-sm rounded-xl font-bold cursor-pointer">
                  📁 Datei wählen
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    class="hidden"
                    x-on:change="handleFileUpload($event)"
                  />
                </label>

                <button
                  type="button"
                  x-show="hasCamera"
                  x-on:click="switchCamera()"
                  class="btn btn-outline btn-sm btn-square rounded-xl"
                  title="Kamera wechseln"
                >
                  🔄
                </button>
              </div>

              <button
                type="button"
                x-show="hasCamera"
                x-on:click="capturePhoto()"
                class="btn btn-primary btn-md rounded-2xl font-black text-sm px-8 shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <span>Foto aufnehmen</span>
              </button>
            </div>
          </div>

          {/* CROP & FILTER MODE */}
          <div
            x-show="mode === 'crop'"
            class="flex-1 flex flex-col justify-between space-y-3 min-h-0"
          >
            <div class="relative bg-black/90 rounded-2xl overflow-hidden flex-1 min-h-[48vh] sm:min-h-0 flex items-center justify-center border border-base-300 p-2 touch-none select-none">
              {/* Zuschneide-Canvas mit Ecken */}
              <canvas
                x-show="cropSubMode === 'crop'"
                x-ref="cropCanvas"
                x-on:pointerdown="onPointerDown($event)"
                x-on:pointermove="onPointerMove($event)"
                x-on:pointerup="onPointerUp($event)"
                x-on:pointercancel="onPointerUp($event)"
                class="max-h-full max-w-full block mx-auto rounded-xl object-contain cursor-crosshair touch-none select-none"
              >
              </canvas>

              {/* Vorschau-Canvas */}
              <div
                x-show="cropSubMode === 'preview'"
                class="w-full h-full flex items-center justify-center p-2 overflow-auto"
              >
                <canvas
                  x-ref="previewCanvas"
                  class="max-h-full max-w-full block mx-auto rounded-xl object-contain shadow-2xl bg-white select-none"
                >
                </canvas>
              </div>
            </div>

            {/* Toolbar */}
            <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-base-200/60 rounded-2xl border border-base-300 shrink-0">
              <div class="flex flex-wrap items-center gap-2">
                {/* Modus Zuschneiden / Scan-Vorschau */}
                <div class="join bg-base-100 p-0.5 rounded-xl border border-base-300 shadow-xs">
                  <button
                    type="button"
                    x-on:click="setCropSubMode('crop')"
                    x-bind:class="cropSubMode === 'crop' ? 'btn-primary' : 'btn-ghost'"
                    class="btn btn-xs join-item rounded-lg font-bold"
                  >
                    Zuschneiden
                  </button>
                  <button
                    type="button"
                    x-on:click="setCropSubMode('preview')"
                    x-bind:class="cropSubMode === 'preview' ? 'btn-primary' : 'btn-ghost'"
                    class="btn btn-xs join-item rounded-lg font-bold"
                  >
                    Vorschau
                  </button>
                </div>

                <button
                  type="button"
                  x-show="cropSubMode === 'crop'"
                  x-on:click="autoCrop()"
                  class="btn btn-outline btn-xs rounded-xl font-bold flex items-center gap-1"
                  title="Kanten automatisch ausrichten"
                >
                  <span class="text-accent">⚡</span> Auto-Crop
                </button>

                <button
                  type="button"
                  x-on:click="rotate(-90)"
                  class="btn btn-ghost btn-xs btn-square rounded-xl"
                  title="90° Links"
                >
                  ↺
                </button>
                <button
                  type="button"
                  x-on:click="rotate(90)"
                  class="btn btn-ghost btn-xs btn-square rounded-xl"
                  title="90° Rechts"
                >
                  ↻
                </button>
                <button
                  type="button"
                  x-show="cropSubMode === 'crop'"
                  x-on:click="resetCrop()"
                  class="btn btn-ghost btn-xs rounded-xl"
                >
                  Reset
                </button>
              </div>

              {/* Filter: S/W, Grau, Farbe */}
              <div class="join bg-base-100 p-0.5 rounded-xl border border-base-300 shadow-xs">
                <button
                  type="button"
                  x-on:click="setFilterMode('bw')"
                  x-bind:class="filterMode === 'bw' ? 'btn-primary' : 'btn-ghost'"
                  class="btn btn-xs join-item rounded-lg font-bold"
                  title="Dokumenten-Filter Schwarz/Weiß"
                >
                  S/W
                </button>
                <button
                  type="button"
                  x-on:click="setFilterMode('grayscale')"
                  x-bind:class="filterMode === 'grayscale' ? 'btn-primary' : 'btn-ghost'"
                  class="btn btn-xs join-item rounded-lg font-bold"
                  title="Graustufen"
                >
                  Grau
                </button>
                <button
                  type="button"
                  x-on:click="setFilterMode('color')"
                  x-bind:class="filterMode === 'color' ? 'btn-primary' : 'btn-ghost'"
                  class="btn btn-xs join-item rounded-lg font-bold"
                  title="Original-Farbe"
                >
                  Farbe
                </button>
              </div>

              <button
                type="button"
                x-on:click="mode = 'camera'; startCamera();"
                class="btn btn-link btn-xs text-base-content/60 hover:text-base-content"
              >
                Neu aufnehmen
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div class="px-6 py-4 border-t border-base-300 bg-base-200/50 flex justify-between items-center shrink-0">
          <button
            type="button"
            x-on:click="close()"
            class="btn btn-ghost btn-sm rounded-xl font-bold"
          >
            Abbrechen
          </button>

          <button
            type="button"
            x-show="mode === 'crop'"
            x-on:click="acceptReceipt()"
            class="btn btn-success btn-sm rounded-xl font-black text-white shadow-md flex items-center gap-1.5"
          >
            <span>✓ Seite übernehmen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
