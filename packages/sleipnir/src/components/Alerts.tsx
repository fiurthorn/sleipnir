/**
 * @project Sleipnir Stack / Components
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { HtmlEscapedString } from "hono/utils/html";

export const AlertZone = (): HtmlEscapedString | Promise<HtmlEscapedString> => {
  return (
    <div
      id="alert-zone"
      class="fixed top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-[100] pointer-events-none px-4 flex flex-col gap-2"
      x-data="dialogSystem"
    >
      <template x-for="alert in alerts" x-bind:key="alert.id">
        <div
          x-show="true"
          x-transition:enter="transition ease-out duration-300"
          x-transition:enter-start="opacity-0 -translate-y-4"
          x-transition:leave="transition ease-in duration-300"
          x-transition:leave-end="opacity-0 scale-95"
          role="alert"
          x-bind:class="'alert alert-' + alert.level + ' shadow-lg pointer-events-auto border border-base-content/10 flex items-center gap-3 py-2.5 px-3.5'"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="stroke-current h-5 w-5 shrink-0"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              x-bind:d="alert.path"
            />
          </svg>
          <div class="flex-1 text-xs font-medium">
            <template x-if="alert.items">
              <ul class="list-disc list-inside space-y-0.5">
                <template x-for="item in alert.items" x-bind:key="item">
                  <li x-text="item"></li>
                </template>
              </ul>
            </template>
            <template x-if="!alert.items">
              <span x-text="alert.message"></span>
            </template>
          </div>
          <button
            type="button"
            x-on:click="removeAlert(alert.id)"
            class="btn btn-ghost btn-xs btn-square opacity-60 hover:opacity-100"
            title="Schließen"
          >
            ✕
          </button>
        </div>
      </template>
    </div>
  );
};
