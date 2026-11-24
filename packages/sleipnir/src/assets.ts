/**
 * @project Sleipnir Stack
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { MiddlewareHandler } from "hono";
import { serveStatic } from "@hono/deno";
import type { ServeStaticOptions } from "hono/serve-static";
import type { Sleipnir, SleipnirContext } from "./sleipnir.ts";

export interface CacheOptions {
  developMode?: boolean;
  version: string;
}

export function cache(options?: CacheOptions): MiddlewareHandler {
  return async (c: SleipnirContext, next: () => Promise<void>) => {
    const ETag = `"${options?.version ?? "dev"}"`;

    if (!options?.developMode && c.req.header("if-none-match") === ETag) {
      return c.body(null, 304);
    }

    await next();

    if (options?.developMode) {
      c.header("Cache-Control", "no-cache");
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
    } else {
      c.header("ETag", ETag);
      c.header("Cache-Control", "public, max-age=0, must-revalidate");
    }
  };
}

export function assets(
  app: Sleipnir,
  _basePath: string = "",
  version: string = "0.1.0",
  rootPath: string = "./",
  developMode: boolean = false,
): void {
  let staticRoot = rootPath;
  const candidates = [rootPath, "."];
  for (const c of candidates) {
    try {
      const candidateStatic = `${c.replace(/\/+$/, "")}/static`;
      if (Deno.statSync(candidateStatic).isDirectory) {
        staticRoot = c;
        break;
      }
    } catch {
      // try next
    }
  }

  const param: ServeStaticOptions = {
    root: staticRoot,
    precompressed: true,
  };

  param.rewriteRequestPath = (path) => {
    // If request comes through a mounted sub-app (e.g. /notes/static/...) or with basePath,
    // ensure the path passed to serveStatic starts with /static/...
    const idx = path.indexOf("/static/");
    if (idx !== -1) {
      return path.slice(idx);
    }
    return path;
  };

  app.use("/static/*", cache({ version, developMode }));
  app.use("/static/*", serveStatic(param));
}
