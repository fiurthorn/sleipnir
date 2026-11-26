/**
 * @project Sleipnir Stack / Notemate Kanban
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Sleipnir, SleipnirContext } from "@sleipnir/core";
import { buildKanbanCalendarIcs } from "../services/calendar.ts";
import type { KanbanStorage } from "../services/kanban.ts";
import { isNsfwUnlocked } from "./nsfw.ts";

async function computeWeakOrStrongEtag(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `"${hex}"`;
}

export function kanbanApi(app: Sleipnir, kanban: KanbanStorage, basePath?: string) {
  const calendarHandler = async (c: SleipnirContext) => {
    const expectedToken = Deno.env.get("NOTEMATE_CALENDAR_TOKEN")?.trim();
    if (expectedToken) {
      const providedToken = c.req.query("token")?.trim();
      if (providedToken !== expectedToken) {
        return c.json({ error: "Unauthorized" }, 401);
      }
    }

    const configuredBaseUrl = Deno.env.get("NOTEMATE_PUBLIC_URL")?.trim();
    const requestOrigin = new URL(c.req.url).origin;
    const normalizedBasePath = basePath ? `/${basePath.replace(/^\/+|\/+$/g, "")}` : "";
    const baseUrl = configuredBaseUrl || `${requestOrigin}${normalizedBasePath}`;

    try {
      const ics = await buildKanbanCalendarIcs(kanban, {
        baseUrl,
        includeNsfw: true,
      });
      const etag = await computeWeakOrStrongEtag(ics);
      const ifNoneMatch = c.req.header("if-none-match");

      if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
        return c.body(null, 304, {
          "ETag": etag,
          "Cache-Control": "public, max-age=3600",
        });
      }

      return c.body(ics, 200, {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="notemate-kanban.ics"',
        "Cache-Control": "public, max-age=3600",
        "ETag": etag,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to build calendar feed";
      return c.json({ error: err }, 500);
    }
  };

  app.get("/api/kanban/calendar.ics", calendarHandler);
  app.get("/calendar.ics", calendarHandler);
  app.get("/api/kanban/boards", async (c: SleipnirContext) => {
    try {
      const boards = await kanban.listBoards({ includeNsfw: isNsfwUnlocked(c) });
      return c.json({ boards });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to list boards";
      return c.json({ error: err }, 500);
    }
  });

  app.post("/api/kanban/boards", async (c: SleipnirContext) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { title, id, columns } = body as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim()) {
      return c.json({ error: "Title must be a non-empty string" }, 400);
    }

    const validColumns = Array.isArray(columns) && columns.every((col) => typeof col === "string") ? columns : undefined;

    try {
      const board = await kanban.createBoard(
        title,
        typeof id === "string" ? id : undefined,
        validColumns,
      );
      return c.json({ ok: true, board }, 201);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to create board";
      return c.json({ error: err }, 400);
    }
  });

  app.get("/api/kanban/boards/:id", async (c: SleipnirContext) => {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing board id" }, 400);
    }

    const query = c.req.query("q") ?? undefined;
    const tag = c.req.query("tag") ?? undefined;
    const nsfwUnlocked = isNsfwUnlocked(c);

    try {
      const { board, hiddenCount } = await kanban.getBoard(id, {
        includeNsfw: nsfwUnlocked,
        query,
        tag,
      });
      return c.json({ board, hiddenCount, nsfwUnlocked });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Board not found";
      return c.json({ error: err }, 404);
    }
  });

  app.post("/api/kanban/boards/:id/cards", async (c: SleipnirContext) => {
    const id = c.req.param("id");
    if (!id) {
      return c.json({ error: "Missing board id" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { title, column, tags, description, dueDate } = body as Record<string, unknown>;
    if (typeof title !== "string" || !title.trim()) {
      return c.json({ error: "Title must be a non-empty string" }, 400);
    }

    try {
      const card = await kanban.addCard(id, {
        title,
        column: typeof column === "string" ? column : undefined,
        tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
        description: typeof description === "string" ? description : undefined,
        dueDate: typeof dueDate === "string" ? dueDate : undefined,
      });
      return c.json({ ok: true, card }, 201);
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to add card";
      return c.json({ error: err }, 400);
    }
  });

  app.patch("/api/kanban/boards/:id/cards/:cardId", async (c: SleipnirContext) => {
    const id = c.req.param("id");
    const cardId = c.req.param("cardId");
    if (!id || !cardId) {
      return c.json({ error: "Missing board id or card id" }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { title, column, order, tags, description, dueDate } = body as Record<string, unknown>;

    try {
      const card = await kanban.updateCard(id, cardId, {
        title: typeof title === "string" ? title : undefined,
        column: typeof column === "string" ? column : undefined,
        order: typeof order === "number" ? order : undefined,
        tags: Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string") : undefined,
        description: typeof description === "string" ? description : undefined,
        dueDate: dueDate === null || typeof dueDate === "string" ? dueDate : undefined,
      });
      return c.json({ ok: true, card });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to update card";
      return c.json({ error: err }, 400);
    }
  });

  app.delete("/api/kanban/boards/:id/cards/:cardId", async (c: SleipnirContext) => {
    const id = c.req.param("id");
    const cardId = c.req.param("cardId");
    if (!id || !cardId) {
      return c.json({ error: "Missing board id or card id" }, 400);
    }

    try {
      await kanban.deleteCard(id, cardId);
      return c.json({ ok: true });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to delete card";
      return c.json({ error: err }, 404);
    }
  });
}
