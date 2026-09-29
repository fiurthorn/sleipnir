/**
 * @project Sleipnir Stack / Core
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { MiddlewareHandler } from "hono";

export interface HstsOptions {
  /**
   * Time in seconds that the browser should remember that a site is only to be accessed using HTTPS.
   * Default: 31536000 (1 year).
   */
  maxAge?: number;
  /**
   * If true, applies this rule to all of the site's subdomains as well.
   * Default: true.
   */
  includeSubDomains?: boolean;
  /**
   * If true, allows the site to be included in browsers' HSTS preload lists.
   * Default: false.
   */
  preload?: boolean;
}

export function hsts(options: HstsOptions = {}): MiddlewareHandler {
  const {
    maxAge = 31536000,
    includeSubDomains = true,
    preload = false,
  } = options;

  let headerValue = `max-age=${maxAge}`;
  if (includeSubDomains) {
    headerValue += "; includeSubDomains";
  }
  if (preload) {
    headerValue += "; preload";
  }

  return async (c, next) => {
    await next();
    c.header("Strict-Transport-Security", headerValue);
  };
}
