/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

import type { ThemeStore } from "./types.ts";

export const themeStore: ThemeStore = {
  mode: "light",
  init() {
    const saved = localStorage.getItem("sleipnir_theme");
    if (saved === "dark" || saved === "corvus-dark") {
      this.mode = "dark";
    } else if (saved === "light" || saved === "corvus") {
      this.mode = "light";
    } else if (
      typeof globalThis !== "undefined" &&
      "matchMedia" in globalThis &&
      typeof (globalThis as unknown as Window).matchMedia === "function" &&
      (globalThis as unknown as Window).matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches
    ) {
      this.mode = "dark";
    }
    this.apply();
  },
  toggle() {
    this.mode = this.mode === "light" ? "dark" : "light";
    this.apply();
  },
  apply() {
    const themeName = this.mode === "dark" ? "corvus-dark" : "corvus";
    document.documentElement.setAttribute("data-theme", themeName);
    localStorage.setItem("sleipnir_theme", this.mode);
  },
};
