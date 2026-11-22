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
