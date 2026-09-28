/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

import { themeStore } from "./theme.ts";
import { createDialogSystem, showAlert } from "./alerts.ts";
import { cookiePersistPlugin } from "./cookie-persist.ts";
import type { AlpineInstance, SleipnirWindow } from "./types.ts";

export function blurOut(
  scope: { show: boolean },
  el: HTMLElement,
  timeout: number = 5000,
): void {
  setTimeout(() => {
    scope.show = false;
    setTimeout(() => el.remove(), 100);
  }, timeout);
}

export function hello(): void {
  alert("Corvus Corax");
}

export function initSleipnirClient(): void {
  const win = globalThis as unknown as SleipnirWindow;
  win.showAlert = showAlert;
  win.blurOut = blurOut;
  win.hello = hello;

  if (typeof document === "undefined") return;

  document.addEventListener("alpine:init", () => {
    const Alpine = (globalThis as unknown as { Alpine?: AlpineInstance })
      .Alpine;
    if (!Alpine) return;

    // Register central stores & plugins
    Alpine.plugin(cookiePersistPlugin);
    Alpine.store("theme", themeStore);

    // Register dialog & autoHide components
    Alpine.data("dialogSystem", createDialogSystem);
    Alpine.data("autoHide", (timeout: unknown = 5000) => ({
      show: true,
      init() {
        setTimeout(() => {
          (this as unknown as { show: boolean }).show = false;
          setTimeout(() => {
            const el = (this as unknown as { $el: HTMLElement }).$el;
            el?.remove();
          }, 100);
        }, typeof timeout === "number" ? timeout : 5000);
      },
    }));

    Alpine.data("globalActions", () => ({
      hello: win.hello,
    }));

    // Safe x-html directive for Alpine CSP
    Alpine.directive(
      "html",
      (el, { expression }, { effect, evaluateLater }) => {
        const evaluate = evaluateLater(expression);
        effect(() => {
          evaluate((value) => {
            Alpine.mutateDom(() => {
              el.innerHTML = (value as string) ?? "";
            });
          });
        });
      },
    );
  });
}

// Auto-run if executed in browser environment
if (typeof globalThis !== "undefined" && "document" in globalThis) {
  initSleipnirClient();
}
