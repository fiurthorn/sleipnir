import { serveStatic } from "hono/deno";

import { randomId } from "../lib/utils.ts";
import { Sleipnir, SleipnirContext } from "./sleipnir.ts";

const ETag = randomId(32);
const isDev = Deno.env.get("APP_ENV") === "development" ? true : false;

function onFound(_path: string, c: SleipnirContext) {
  if (isDev) {
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
  } else {
    c.header("ETag", `"${ETag}"`);
    c.header("Cache-Control", "public, max-age=0, must-revalidate");

    const ifNoneMatch = c.req.header("if-none-match");
    if (ifNoneMatch === ETag) {
      c.status(304);
      c.body(null);
    }
  }
}

export function assets(app: Sleipnir, basePath: string = "") {
  if (basePath === "") {
    app.use(serveStatic({ root: "./", onFound }));
    return;
  }

  app.use(
    serveStatic({
      root: "./",
      rewriteRequestPath: (path) => path.replace(`${basePath}`, "./"),
      onFound,
    }),
  );
}
