/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Sleipnir, SleipnirContext } from "@sleipnir/core";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { NoteStorage } from "../services/storage.ts";
import { hasNsfwTag } from "../services/tags.ts";

const NSFW_COOKIE_NAME = "notemate_nsfw";
const NSFW_COOKIE_MAX_AGE_SECONDS = 3600;

function isNsfwUnlocked(c: SleipnirContext): boolean {
  return getCookie(c, NSFW_COOKIE_NAME) === "1";
}

function getCookiePath(basePath?: string): string {
  const trimmed = basePath?.trim();
  return trimmed ? trimmed : "/";
}

function isHttpsRequest(c: SleipnirContext): boolean {
  return (
    c.req.header("x-forwarded-proto") === "https" ||
    c.req.url.startsWith("https://")
  );
}

export function notesApi(app: Sleipnir, storage: NoteStorage, basePath?: string) {
  const cookiePath = getCookiePath(basePath);

  // NSFW Gate (1h Cookie)
  app.post("/api/nsfw/unlock", (c: SleipnirContext) => {
    setCookie(c, NSFW_COOKIE_NAME, "1", {
      path: cookiePath,
      maxAge: NSFW_COOKIE_MAX_AGE_SECONDS,
      httpOnly: true,
      sameSite: "Lax",
      secure: isHttpsRequest(c),
    });
    return c.json({
      ok: true,
      nsfwUnlocked: true,
      maxAgeSeconds: NSFW_COOKIE_MAX_AGE_SECONDS,
    });
  });

  app.post("/api/nsfw/lock", (c: SleipnirContext) => {
    deleteCookie(c, NSFW_COOKIE_NAME, { path: cookiePath });
    return c.json({ ok: true, nsfwUnlocked: false });
  });

  // Tree & Hierarchy
  app.get("/api/tree", async (c: SleipnirContext) => {
    try {
      const nsfwUnlocked = isNsfwUnlocked(c);
      const { tree, hiddenCount } = await storage.getTreeFiltered(nsfwUnlocked);
      return c.json({ tree, nsfwUnlocked, hiddenCount });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Internal error";
      return c.json({ error: err }, 500);
    }
  });

  // Note CRUD
  app.get("/api/notes", async (c: SleipnirContext) => {
    const path = c.req.query("path");
    if (!path) {
      return c.json({ error: "Missing 'path' query parameter" }, 400);
    }

    try {
      const note = await storage.getNote(path);
      if (hasNsfwTag(note.tags) && !isNsfwUnlocked(c)) {
        return c.json(
          { error: "NSFW_LOCKED", message: "Diese Notiz ist als NSFW markiert." },
          403,
        );
      }
      return c.json({ note });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Note not found";
      return c.json({ error: err }, 404);
    }
  });

  app.post("/api/notes", async (c: SleipnirContext) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    // Bouncer-Pattern
    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { path, content } = body as Record<string, unknown>;
    if (typeof path !== "string" || !path.trim()) {
      return c.json({ error: "Path must be a non-empty string" }, 400);
    }
    if (typeof content !== "string") {
      return c.json({ error: "Content must be a string" }, 400);
    }

    try {
      const note = await storage.saveNote(path.trim(), content);
      return c.json({ ok: true, note });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to save note";
      return c.json({ error: err }, 500);
    }
  });

  app.delete("/api/notes", async (c: SleipnirContext) => {
    const path = c.req.query("path");
    if (!path) {
      return c.json({ error: "Missing 'path' query parameter" }, 400);
    }

    try {
      await storage.deleteItem(path);
      return c.json({ ok: true });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to delete item";
      return c.json({ error: err }, 500);
    }
  });

  // Folder Operations
  app.post("/api/folders", async (c: SleipnirContext) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { path } = body as Record<string, unknown>;
    if (typeof path !== "string" || !path.trim()) {
      return c.json({ error: "Path must be a non-empty string" }, 400);
    }

    try {
      await storage.createFolder(path.trim());
      return c.json({ ok: true });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to create folder";
      return c.json({ error: err }, 500);
    }
  });

  app.post("/api/rename", async (c: SleipnirContext) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { oldPath, newPath } = body as Record<string, unknown>;
    if (typeof oldPath !== "string" || typeof newPath !== "string") {
      return c.json({ error: "Both oldPath and newPath are required" }, 400);
    }

    try {
      await storage.renameItem(oldPath.trim(), newPath.trim());
      return c.json({ ok: true });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to rename item";
      return c.json({ error: err }, 500);
    }
  });

  // Search
  app.get("/api/search", async (c: SleipnirContext) => {
    const q = c.req.query("q") ?? "";
    try {
      const results = await storage.searchNotes(q, 25, {
        includeNsfw: isNsfwUnlocked(c),
      });
      return c.json({ results });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Search error";
      return c.json({ error: err }, 500);
    }
  });

  // Tags
  app.get("/api/tags", async (c: SleipnirContext) => {
    try {
      const tags = await storage.listAllTags(undefined, {
        includeNsfw: isNsfwUnlocked(c),
      });
      return c.json({ tags });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to list tags";
      return c.json({ error: err }, 500);
    }
  });

  app.post("/api/notes/tags", async (c: SleipnirContext) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 400);
    }

    if (typeof body !== "object" || body === null) {
      return c.json({ error: "Body must be an object" }, 400);
    }

    const { path, tags } = body as Record<string, unknown>;
    if (typeof path !== "string" || !path.trim()) {
      return c.json({ error: "Path must be a non-empty string" }, 400);
    }
    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "string")) {
      return c.json({ error: "Tags must be an array of strings" }, 400);
    }

    try {
      const note = await storage.setNoteTags(path.trim(), tags);
      return c.json({ ok: true, note });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to update tags";
      return c.json({ error: err }, 400);
    }
  });

  // Attachments (Image Upload via Paste or Form)
  app.post("/api/attachments", async (c: SleipnirContext) => {
    try {
      const contentType = c.req.header("content-type") || "";

      if (contentType.includes("application/json")) {
        const body = await c.req.json() as {
          filename?: string;
          dataUrl?: string;
          notePath?: string;
        };
        if (!body.dataUrl || typeof body.dataUrl !== "string") {
          return c.json({ error: "Missing 'dataUrl'" }, 400);
        }

        // Parse data URL: data:image/png;base64,....
        const matches = body.dataUrl.match(
          /^data:([A-Za-z-+\/]+);base64,(.+)$/,
        );
        if (!matches || matches.length !== 3) {
          return c.json({ error: "Invalid data URL format" }, 400);
        }

        const mime = matches[1];
        const base64Data = matches[2];
        const rawBytes = Uint8Array.from(
          atob(base64Data),
          (char) => char.charCodeAt(0),
        );

        let ext = ".png";
        if (mime.includes("jpeg")) ext = ".jpg";
        else if (mime.includes("webp")) ext = ".webp";
        else if (mime.includes("gif")) ext = ".gif";

        const filename = body.filename || `pasted_image${ext}`;
        const result = await storage.saveAttachment(
          filename,
          rawBytes,
          body.notePath,
        );

        return c.json({
          ok: true,
          url: result.url,
          filename: result.filename,
          markdown: `![Bild](${result.url})`,
        });
      }

      // Multipart form upload fallback
      const form = await c.req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return c.json({ error: "No file uploaded" }, 400);
      }

      const notePath = form.get("notePath");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await storage.saveAttachment(
        file.name,
        bytes,
        typeof notePath === "string" ? notePath : undefined,
      );

      return c.json({
        ok: true,
        url: result.url,
        filename: result.filename,
        markdown: `![${file.name}](${result.url})`,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Failed to save attachment";
      return c.json({ error: err }, 500);
    }
  });

  // Serve Attachments directly (including nested paths e.g. /attachments/Rezepte/Pasta/Carbonara/img.png)
  const attachmentHandler = async (c: SleipnirContext) => {
    const rawPath = c.req.path.replace(/^\/(?:api\/)?attachments\/?/, "");
    const decoded = decodeURIComponent(rawPath);
    if (!decoded) {
      return c.text("Not found", 404);
    }

    const isNsfw = await storage.isAttachmentNsfw(decoded);
    if (isNsfw && !isNsfwUnlocked(c)) {
      return c.text("NSFW content locked", 403);
    }

    const attachment = await storage.getAttachment(decoded);
    if (!attachment) {
      return c.text("Attachment not found", 404);
    }

    return new Response(attachment.data.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": attachment.contentType,
        "Cache-Control": isNsfw ? "private, no-store" : "public, max-age=31536000, immutable",
      },
    });
  };

  app.get("/attachments/*", attachmentHandler);
  app.get("/api/attachments/*", attachmentHandler);
  app.get("/attachments/:filename", attachmentHandler);
  app.get("/api/attachments/:filename", attachmentHandler);
}
