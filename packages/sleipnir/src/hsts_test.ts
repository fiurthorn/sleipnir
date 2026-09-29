/**
 * @project Sleipnir Stack / Core
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { Sleipnir } from "./sleipnir.ts";
import { hsts } from "./hsts.ts";

Deno.test("hsts - sets default Strict-Transport-Security header", async () => {
  const app = new Sleipnir();
  app.use("*", hsts());
  app.get("/test", (c) => c.text("ok"));

  const res = await app.fetch(new Request("http://localhost/test"));
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
});

Deno.test("hsts - respects custom options including preload", async () => {
  const app = new Sleipnir();
  app.use(
    "*",
    hsts({
      maxAge: 63072000,
      includeSubDomains: false,
      preload: true,
    }),
  );
  app.get("/secure", (c) => c.text("secure"));

  const res = await app.fetch(new Request("http://localhost/secure"));
  assertEquals(res.status, 200);
  assertEquals(
    res.headers.get("strict-transport-security"),
    "max-age=63072000; preload",
  );
});
