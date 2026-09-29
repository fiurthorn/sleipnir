/**
 * @project Sleipnir Stack / Cookmate
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
  basePath: string = "",
  version: string = "0.1.0",
  rootPath: string = "./",
  developMode: boolean = false,
): void {
  let staticRoot = rootPath;
  try {
    const candidate = `${staticRoot.replace(/\/+$/, "")}/static`;
    if (!Deno.statSync(candidate).isDirectory) {
      staticRoot = "./";
    }
  } catch {
    staticRoot = "./";
  }

  const param: ServeStaticOptions = {
    root: staticRoot,
    precompressed: true,
  };

  if (basePath) {
    const cleanBase = basePath.replace(/\/+$/, "");
    param.rewriteRequestPath = (path) => path.replace(cleanBase, "./");
  }

  app.use("/static/*", cache({ version, developMode }));
  app.use("/static/*", serveStatic(param));
}
