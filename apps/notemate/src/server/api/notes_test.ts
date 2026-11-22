/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { Sleipnir } from "@sleipnir/core";
import { NoteStorage } from "../services/storage.ts";
import { notesApi } from "./notes.ts";

Deno.test("notesApi - enforces 1h NSFW cookie gate across tree, notes, search, tags, and attachments", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const storage = new NoteStorage({ dataDir: tempDir });
    await storage.saveNote("Public.md", "---\ntags:\n  - Notiz\n---\n\nÖffentlich");
    await storage.saveNote("Private/Spicy.md", "---\ntags:\n  - nsfw\n---\n\nGeheimwort");
    const attach = await storage.saveAttachment(
      "pic.png",
      new Uint8Array([137, 80, 78, 71]),
      "Private/Spicy.md",
    );

    const app = new Sleipnir();
    notesApi(app, storage);

    // 1. Locked by default: /api/tree hides NSFW and reports count
    const treeLockedRes = await app.request("/api/tree");
    assertEquals(treeLockedRes.status, 200);
    const treeLocked = await treeLockedRes.json();
    assertEquals(treeLocked.nsfwUnlocked, false);
    assertEquals(treeLocked.hiddenCount, 1);

    // 2. Locked: /api/notes returns 403 NSFW_LOCKED
    const noteLockedRes = await app.request("/api/notes?path=Private%2FSpicy.md");
    assertEquals(noteLockedRes.status, 403);
    const noteLocked = await noteLockedRes.json();
    assertEquals(noteLocked.error, "NSFW_LOCKED");

    // 3. Locked: /attachments/* returns 403
    const attachLockedRes = await app.request(attach.url);
    assertEquals(attachLockedRes.status, 403);

    // 4. Unlock sets 1h HttpOnly cookie
    const unlockRes = await app.request("/api/nsfw/unlock", { method: "POST" });
    assertEquals(unlockRes.status, 200);
    const setCookieHeader = unlockRes.headers.get("set-cookie") ?? "";
    assertEquals(setCookieHeader.includes("notemate_nsfw=1"), true);
    assertEquals(setCookieHeader.includes("Max-Age=3600"), true);
    assertEquals(setCookieHeader.includes("HttpOnly"), true);

    const cookieHeaders = { Cookie: "notemate_nsfw=1" };

    // 5. Unlocked: tree, note, search, tags, and attachment all accessible
    const treeUnlocked = await (await app.request("/api/tree", { headers: cookieHeaders })).json();
    assertEquals(treeUnlocked.nsfwUnlocked, true);
    assertEquals(treeUnlocked.hiddenCount, 0);

    const noteUnlockedRes = await app.request("/api/notes?path=Private%2FSpicy.md", {
      headers: cookieHeaders,
    });
    assertEquals(noteUnlockedRes.status, 200);

    const searchUnlocked = await (
      await app.request("/api/search?q=Geheimwort", { headers: cookieHeaders })
    ).json();
    assertEquals(searchUnlocked.results.length, 1);

    const attachUnlockedRes = await app.request(attach.url, { headers: cookieHeaders });
    assertEquals(attachUnlockedRes.status, 200);
    assertEquals(attachUnlockedRes.headers.get("cache-control"), "private, no-store");

    // 6. Lock clears cookie
    const lockRes = await app.request("/api/nsfw/lock", { method: "POST" });
    assertEquals(lockRes.status, 200);
    const clearCookieHeader = lockRes.headers.get("set-cookie") ?? "";
    assertEquals(clearCookieHeader.includes("notemate_nsfw="), true);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
