/**
 * @project Sleipnir Stack / Core
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { MiddlewareHandler } from "hono";
import { cors as honoCors } from "hono/cors";

export interface SleipnirCorsOptions {
  origin?: string | string[] | ((origin: string) => string | undefined | null);
  allowMethods?: string[];
  allowHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
  exposeHeaders?: string[];
}

/**
 * Pre-configured CORS middleware for Sleipnir apps.
 * Supports configurable origins via CORS_ORIGIN environment variable,
 * with first-class support for HTMX-specific request and response headers.
 */
export function cors(options?: SleipnirCorsOptions): MiddlewareHandler {
  let envOrigin: string | undefined;
  try {
    envOrigin = Deno.env.get("CORS_ORIGIN");
  } catch {
    // Permission denied or sandboxed environment
  }
  let origin = options?.origin;

  if (!origin) {
    if (envOrigin) {
      const parts = envOrigin
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      origin = parts.length === 1 ? parts[0] : parts;
    } else {
      origin = "*";
    }
  }

  const credentials = options?.credentials ?? origin !== "*";

  return honoCors({
    origin,
    allowMethods: options?.allowMethods ?? [
      "GET",
      "HEAD",
      "PUT",
      "POST",
      "DELETE",
      "PATCH",
      "OPTIONS",
    ],
    allowHeaders: options?.allowHeaders ?? [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "ETag",
      "Cache-Control",
    ],
    exposeHeaders: options?.exposeHeaders ?? ["Content-Length"],
    credentials,
    maxAge: options?.maxAge ?? 86400,
  });
}

export const sleipnirCors = cors;
