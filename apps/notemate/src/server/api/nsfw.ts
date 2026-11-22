/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { SleipnirContext } from "@sleipnir/core";
import { getCookie } from "hono/cookie";

export const NSFW_COOKIE_NAME = "notemate_nsfw";
export const NSFW_COOKIE_MAX_AGE_SECONDS = 3600;

export function isNsfwUnlocked(c: SleipnirContext): boolean {
  return getCookie(c, NSFW_COOKIE_NAME) === "1";
}
