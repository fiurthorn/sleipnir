/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { serveStatic } from "hono/deno";
import type { ServeStaticOptions } from "hono/serve-static";
import type { MiddlewareHandler } from "hono";
import type { Sleipnir, SleipnirContext } from "./sleipnir.ts";

export function cache(version: string = "0.1.0"): MiddlewareHandler {
  return async (c: SleipnirContext, next: () => Promise<void>) => {
    const developMode = Deno.env.get("APP_ENV") === "development";
    const ETag = `"${version}"`;

    if (c.req.header("if-none-match") === ETag) {
      return c.body(null, 304);
    }

    if (developMode) {
      c.header("Cache-Control", "no-cache");
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
      await next();
      return;
    }

    c.header("ETag", ETag);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");
    await next();
  };
}

export function assets(
  app: Sleipnir,
  basePath: string = "",
  version: string = "0.1.0",
): void {
  const param: ServeStaticOptions = {
    root: "./",
    precompressed: true,
  };

  if (basePath) {
    param.rewriteRequestPath = (path) => path.replace(`${basePath}`, "./");
  }

  app.use("/static/*", cache(version));
  app.use("/static/*", serveStatic(param));
}
