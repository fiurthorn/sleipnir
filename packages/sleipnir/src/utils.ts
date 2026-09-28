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
  globalThis.HTMX_BASE_PATH = path.endsWith("/") ? path : path + "/";
}.toString();

export function parseInteger(input: string | undefined = "0"): number {
  const parsed = parseInt(input);
  return isNaN(parsed) ? 0 : parsed;
}

export function randomId(n: number = 9): string {
  const buffer = randomBytes(Math.ceil(n / 2));
  return buffer.toString("hex").slice(0, n);
}
