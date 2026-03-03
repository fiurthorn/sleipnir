import { serveStatic } from "hono/deno";

import { VERSION } from "../version.g.ts";

import { ServeStaticOptions } from "hono/serve-static";
import { Sleipnir, SleipnirContext } from "./sleipnir.ts";

export function cache() {
  return async (c: SleipnirContext, next: () => Promise<void>) => {
    const developMode = Deno.env.get("APP_ENV") === "development";
    const ETag = `"${VERSION}"`;

    if (c.req.header("if-none-match") === ETag) {
      return c.body(null, 304);
    }

    if (developMode) {
      c.header("Cache-Control", "no-cache");
      c.header("Pragma", "no-cache");
      c.header("Expires", "0");
    } else {
      c.header("ETag", ETag);
      c.header("Cache-Control", "public, max-age=0, must-revalidate");
    }

    await next();
  };
}

export function assets(app: Sleipnir, basePath: string = "") {
  const param: ServeStaticOptions = {
    root: "./",
    precompressed: true,
  };

  if (basePath) {
    param.rewriteRequestPath = (path) => path.replace(`${basePath}`, "./");
  }

  app.use("/static/*", cache());
  app.use("/static/*", serveStatic(param));
}
