/**
 * @project Sleipnir Stack / Notemate Kanban
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { Sleipnir } from "@sleipnir/core";
import { KanbanStorage } from "../services/kanban.ts";
import { kanbanApi } from "./kanban.ts";

Deno.test("kanbanApi - CRUD, move, search/tag filter, and NSFW cookie gate", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const kanban = new KanbanStorage({ dataDir: tempDir });
    const app = new Sleipnir();
    kanbanApi(app, kanban);

    const boardsRes = await app.request("/api/kanban/boards");
    assertEquals(boardsRes.status, 200);
    const boardsData = await boardsRes.json();
    assertEquals(boardsData.boards.length, 1);

    const addRes = await app.request("/api/kanban/boards/projekte/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "API Test Karte",
        tags: ["Backend"],
        dueDate: "2026-11-15",
        description: "[Notiz](?note=Willkommen.md)",
      }),
    });
    assertEquals(addRes.status, 201);
    const { card } = await addRes.json();
    assertEquals(card.dueDate, "2026-11-15");

    await app.request("/api/kanban/boards/projekte/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "NSFW Karte",
        tags: ["nsfw"],
      }),
    });

    // Move card
    const patchRes = await app.request(`/api/kanban/boards/projekte/cards/${card.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: "Fertiggestellt" }),
    });
    assertEquals(patchRes.status, 200);
    const patched = await patchRes.json();
    assertEquals(patched.card.column, "Fertiggestellt");

    // Locked view hides nsfw
    const lockedRes = await app.request("/api/kanban/boards/projekte");
    const locked = await lockedRes.json();
    assertEquals(locked.hiddenCount, 1);
    assertEquals(locked.board.cards.length, 1);

    // Unlocked view shows both
    const unlockedRes = await app.request("/api/kanban/boards/projekte", {
      headers: { Cookie: "notemate_nsfw=1" },
    });
    const unlocked = await unlockedRes.json();
    assertEquals(unlocked.hiddenCount, 0);
    assertEquals(unlocked.board.cards.length, 2);

    // Delete card
    const delRes = await app.request(`/api/kanban/boards/projekte/cards/${card.id}`, {
      method: "DELETE",
    });
    assertEquals(delRes.status, 200);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("kanbanApi - serves ICS calendar feed with title-only summary, server link, ETag and optional token", async () => {
  const tempDir = await Deno.makeTempDir();
  const prevPublicUrl = Deno.env.get("NOTEMATE_PUBLIC_URL");
  const prevToken = Deno.env.get("NOTEMATE_CALENDAR_TOKEN");
  try {
    Deno.env.set("NOTEMATE_PUBLIC_URL", "https://notes.tailnet.ts.net");
    Deno.env.delete("NOTEMATE_CALENDAR_TOKEN");

    const kanban = new KanbanStorage({ dataDir: tempDir });
    const app = new Sleipnir();
    kanbanApi(app, kanban);

    // Default-Board initialisieren
    await app.request("/api/kanban/boards");

    const addRes = await app.request("/api/kanban/boards/projekte/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Steuererklärung abgeben",
        dueDate: "2026-12-01",
        description: "Geheimer Body mit Details, der nicht ins ICS darf",
      }),
    });
    assertEquals(addRes.status, 201);

    const icsRes = await app.request("/api/kanban/calendar.ics");
    assertEquals(icsRes.status, 200);
    assertEquals(icsRes.headers.get("content-type"), "text/calendar; charset=utf-8");
    assertEquals(icsRes.headers.get("cache-control"), "public, max-age=3600");
    const etag = icsRes.headers.get("etag");
    assertEquals(typeof etag === "string" && etag.length > 0, true);

    const body = await icsRes.text();
    assertEquals(body.includes("SUMMARY:Steuererklärung abgeben"), true);
    assertEquals(body.includes("DTSTART;VALUE=DATE:20261201"), true);
    assertEquals(body.includes("DTEND;VALUE=DATE:20261202"), true);
    assertEquals(body.includes("DESCRIPTION:https://notes.tailnet.ts.net/?board=projekte"), true);
    assertEquals(body.includes("Geheimer Body"), false);

    // ETag 304 check
    const cachedRes = await app.request("/api/kanban/calendar.ics", {
      headers: { "If-None-Match": etag ?? "" },
    });
    assertEquals(cachedRes.status, 304);

    // Optional token check
    Deno.env.set("NOTEMATE_CALENDAR_TOKEN", "secret-123");
    const unauthRes = await app.request("/api/kanban/calendar.ics");
    assertEquals(unauthRes.status, 401);

    const authRes = await app.request("/api/kanban/calendar.ics?token=secret-123");
    assertEquals(authRes.status, 200);
  } finally {
    if (prevPublicUrl === undefined) Deno.env.delete("NOTEMATE_PUBLIC_URL");
    else Deno.env.set("NOTEMATE_PUBLIC_URL", prevPublicUrl);
    if (prevToken === undefined) Deno.env.delete("NOTEMATE_CALENDAR_TOKEN");
    else Deno.env.set("NOTEMATE_CALENDAR_TOKEN", prevToken);
    await Deno.remove(tempDir, { recursive: true });
  }
});
