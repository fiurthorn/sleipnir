/**
 * @project Sleipnir Stack / Notemate Kanban
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { DEFAULT_KANBAN_COLUMNS, KanbanStorage } from "./kanban.ts";

Deno.test("KanbanStorage - creates default board, adds, moves, filters, and deletes cards", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const kanban = new KanbanStorage({ dataDir: tempDir });

    const boards = await kanban.listBoards();
    assertEquals(boards.length, 1);
    assertEquals(boards[0].id, "projekte");
    assertEquals(boards[0].columns, [...DEFAULT_KANBAN_COLUMNS]);

    const c1 = await kanban.addCard("projekte", {
      title: "Erste Aufgabe",
      tags: ["Projekt", "Dringend"],
      description: "Siehe [Konzept](?note=chat/AI%20Chat.md)",
    });
    assertEquals(c1.column, "Eingang");
    assertEquals(c1.id.startsWith("k_"), true);

    const c2 = await kanban.addCard("projekte", {
      title: "Geheime Aufgabe",
      tags: ["nsfw"],
    });

    // Move c1 to In Bearbeitung
    const moved = await kanban.moveCard("projekte", c1.id, "In Bearbeitung");
    assertEquals(moved.column, "In Bearbeitung");
    assertEquals(moved.order, 0);

    // NSFW filtering
    const locked = await kanban.getBoard("projekte", { includeNsfw: false });
    assertEquals(locked.hiddenCount, 1);
    assertEquals(locked.board.cards.length, 1);
    assertEquals(locked.board.cards[0].id, c1.id);

    // Search & tag filtering
    const byTag = await kanban.getBoard("projekte", { includeNsfw: true, tag: "dringend" });
    assertEquals(byTag.board.cards.length, 1);

    const byQuery = await kanban.getBoard("projekte", { includeNsfw: true, query: "konzept" });
    assertEquals(byQuery.board.cards.length, 1);

    // Delete card
    await kanban.deleteCard("projekte", c2.id);
    const afterDelete = await kanban.getBoard("projekte", { includeNsfw: true });
    assertEquals(afterDelete.board.cards.length, 1);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("KanbanStorage - supports custom columns per board and rejects invalid board IDs", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const kanban = new KanbanStorage({ dataDir: tempDir });
    const custom = await kanban.createBoard("Code Review", undefined, [
      "Eingang",
      "In Bearbeitung",
      "Review",
      "Fertiggestellt",
    ]);
    assertEquals(custom.id, "code-review");
    assertEquals(custom.columns.includes("Review"), true);

    await assertRejects(
      () => kanban.getBoard("../etc/passwd"),
      Error,
      "Ungültige Board-ID",
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("KanbanStorage - dueDate validation and listOverdueCards", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const kanban = new KanbanStorage({ dataDir: tempDir });
    await kanban.listBoards();

    const overdue = await kanban.addCard("projekte", {
      title: "Überfällig",
      dueDate: "2026-11-10",
    });
    const doneOld = await kanban.addCard("projekte", {
      title: "Schon erledigt",
      column: "Fertiggestellt",
      dueDate: "2026-11-01",
    });
    const future = await kanban.addCard("projekte", {
      title: "Zukunft",
      dueDate: "2026-12-01",
    });

    await assertRejects(
      () => kanban.addCard("projekte", { title: "Bad Date", dueDate: "2026-02-31" }),
      Error,
      "Ungültiges Kalenderdatum",
    );

    const res = await kanban.listOverdueCards({ referenceDate: "2026-11-22" });
    assertEquals(res.items.length, 1);
    assertEquals(res.items[0].card.id, overdue.id);
    assertEquals(doneOld.dueDate, "2026-11-01");
    assertEquals(future.dueDate, "2026-12-01");

    // Clear dueDate
    const cleared = await kanban.updateCard("projekte", overdue.id, { dueDate: null });
    assertEquals(cleared.dueDate, undefined);
    const afterClear = await kanban.listOverdueCards({ referenceDate: "2026-11-22" });
    assertEquals(afterClear.items.length, 0);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("KanbanStorage - uses filename as canonical board id when YAML id differs", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    await Deno.mkdir(join(tempDir, ".kanban"), { recursive: true });
    await Deno.writeTextFile(
      join(tempDir, ".kanban", "Einkauf.yaml"),
      "id: einkauf\ntitle: Einkauf\ncolumns:\n  - Kaufen\ncards: []\n",
    );

    const kanban = new KanbanStorage({ dataDir: tempDir });
    const boards = await kanban.listBoards();
    assertEquals(boards.length, 1);
    assertEquals(boards[0].id, "Einkauf");

    const loaded = await kanban.getBoard(boards[0].id);
    assertEquals(loaded.board.id, "Einkauf");
    assertEquals(loaded.board.title, "Einkauf");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
