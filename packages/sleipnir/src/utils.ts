/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference path="./global.d.ts" />
import { randomBytes } from "node:crypto";

export const proxyRedirect: string = function () {
  const path = globalThis.location.pathname;
  if (path.match(/.*\/proxy\/\d+$/) && !path.endsWith("/")) {
    globalThis.location.replace(path + "/");
  }
}.toString();

export const themeInit: string = function () {
  try {
    const g = globalThis as unknown as {
      localStorage?: { getItem(k: string): string | null };
      matchMedia?: (q: string) => { matches: boolean };
      document?: {
        documentElement: { setAttribute(k: string, v: string): void };
      };
    };
    const saved = g.localStorage?.getItem("sleipnir_theme");
    const prefersDark = g.matchMedia &&
      g.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved === "dark" || saved === "corvus-dark" ||
      (!saved && prefersDark);
    g.document?.documentElement.setAttribute(
      "data-theme",
      isDark ? "corvus-dark" : "corvus",
    );
  } catch (_) {
    // ignore
  }
}.toString();

export function parseInteger(input: string | undefined = "0"): number {
  const parsed = parseInt(input);
  return isNaN(parsed) ? 0 : parsed;
}

export function randomId(n: number = 9): string {
  const buffer = randomBytes(Math.ceil(n / 2));
  return buffer.toString("hex").slice(0, n);
}
