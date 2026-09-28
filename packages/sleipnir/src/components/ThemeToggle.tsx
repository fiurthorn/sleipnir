/**
 * @project Sleipnir Stack / Components
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { HtmlEscapedString } from "hono/utils/html";

export const ThemeToggle = ():
  | HtmlEscapedString
  | Promise<HtmlEscapedString> => {
  return (
    <button
      type="button"
      x-on:click="$store.theme.toggle()"
      class="btn btn-ghost btn-sm btn-circle opacity-75 hover:opacity-100 transition-opacity"
      title="Theme wechseln (Hell / Dunkel)"
      aria-label="Theme wechseln"
    >
      <span x-show="$store.theme.mode === 'dark'" style="display: none;">
        ☀️
      </span>
      <span x-show="$store.theme.mode !== 'dark'">🌙</span>
    </button>
  );
};
