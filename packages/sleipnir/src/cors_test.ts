/**
 * @project Sleipnir Stack / Core
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { Sleipnir } from "./sleipnir.ts";
import { sleipnirCors } from "./cors.ts";

Deno.test("sleipnirCors - handles preflight OPTIONS request", async () => {
  const app = new Sleipnir();
  app.use("*", sleipnirCors());
  app.get("/api/test", (c) => c.json({ ok: true }));

  const req = new Request("http://localhost/api/test", {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "Content-Type, Authorization",
    },
  });

  const res = await app.fetch(req);
  assertEquals(res.status, 204);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    res.headers.get("access-control-allow-methods")?.includes("POST"),
    true,
  );
  assertEquals(
    res.headers.get("access-control-allow-headers")?.includes("Authorization"),
    true,
  );
});

Deno.test("sleipnirCors - passes GET with CORS headers", async () => {
  const app = new Sleipnir();
  app.use("*", sleipnirCors());
  app.get("/api/data", (c) => c.json({ message: "hello" }));

  const req = new Request("http://localhost/api/data", {
    method: "GET",
    headers: {
      "Origin": "https://dashboard.example.com",
    },
  });

  const res = await app.fetch(req);
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(
    res.headers.get("access-control-expose-headers")?.includes(
      "Content-Length",
    ),
    true,
  );
});
