/**
 * @project Sleipnir Stack / Core
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { Sleipnir } from "./sleipnir.ts";
import { cache } from "./assets.ts";

Deno.test("cache - returns 304 on matching ETag in production mode", async () => {
  const app = new Sleipnir();
  app.use("/asset.js", cache({ developMode: false, version: "v1.2.3" }));
  app.get("/asset.js", (c) => c.text("console.log('asset');"));

  // First request without ETag
  const res1 = await app.fetch(new Request("http://localhost/asset.js"));
  assertEquals(res1.status, 200);
  assertEquals(res1.headers.get("etag"), '"v1.2.3"');
  assertEquals(
    res1.headers.get("cache-control"),
    "public, max-age=0, must-revalidate",
  );

  // Second request with matching If-None-Match
  const res2 = await app.fetch(
    new Request("http://localhost/asset.js", {
      headers: { "if-none-match": '"v1.2.3"' },
    }),
  );
  assertEquals(res2.status, 304);
});

Deno.test("cache - disables caching in developMode", async () => {
  const app = new Sleipnir();
  app.use("/asset.js", cache({ developMode: true, version: "v1.2.3" }));
  app.get("/asset.js", (c) => c.text("console.log('asset');"));

  const res = await app.fetch(
    new Request("http://localhost/asset.js", {
      headers: { "if-none-match": '"v1.2.3"' },
    }),
  );
  assertEquals(res.status, 200); // Does NOT return 304 in developMode
  assertEquals(res.headers.get("cache-control"), "no-cache");
  assertEquals(res.headers.get("pragma"), "no-cache");
  assertEquals(res.headers.get("expires"), "0");
});
