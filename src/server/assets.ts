import { serveStatic } from "hono/deno";

import { Sleipnir } from "./sleipnir.ts";

export function assets(app: Sleipnir, basePath: string = "") {
  if (basePath === "") {
    app.use(serveStatic({ root: "./" }));
    return;
  }

  app.use(
    serveStatic({
      root: "./",
      rewriteRequestPath: (path) => path.replace(`${basePath}`, "./"),
      onFound: (_path, c) =>
        c.header("Cache-Control", "public, max-age=2592000, immutable"),
    }),
  );
}
