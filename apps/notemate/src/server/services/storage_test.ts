/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals, assertRejects } from "@std/assert";
import { NoteStorage } from "./storage.ts";

Deno.test("NoteStorage - getAttachmentSubdir maps note paths correctly", () => {
  const storage = new NoteStorage({ dataDir: "./data/notes" });

  assertEquals(storage.getAttachmentSubdir("Hallo Welt.md"), "Hallo_Welt");
  assertEquals(storage.getAttachmentSubdir("/Hallo Welt.md"), "Hallo_Welt");
  assertEquals(
    storage.getAttachmentSubdir("Rezepte/Pasta/Carbonara.md"),
    "Rezepte/Pasta/Carbonara",
  );
  assertEquals(
    storage.getAttachmentSubdir("/Rezept/Pasta/Carbonara.md"),
    "Rezept/Pasta/Carbonara",
  );
  assertEquals(storage.getAttachmentSubdir(""), "default");
});

Deno.test("NoteStorage - save and retrieve attachments hierarchically", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const storage = new NoteStorage({ dataDir: tempDir });

    const fakeBytes = new TextEncoder().encode("image-binary-data");
    const result = await storage.saveAttachment(
      "carbonara.png",
      fakeBytes,
      "Rezepte/Pasta/Carbonara.md",
    );

    assertEquals(
      result.url.startsWith("./attachments/Rezepte/Pasta/Carbonara/"),
      true,
    );

    const fetched = await storage.getAttachment(result.relPath);
    assertEquals(fetched !== null, true);
    assertEquals(fetched?.contentType, "image/png");
    assertEquals(new TextDecoder().decode(fetched?.data), "image-binary-data");
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("NoteStorage - path traversal protection", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const storage = new NoteStorage({ dataDir: tempDir });

    await assertRejects(async () => {
      await storage.saveNote("../../../etc/passwd", "evil");
    });

    const escapeAttachment = await storage.getAttachment(
      "../../../../etc/passwd",
    );
    assertEquals(escapeAttachment, null);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("NoteStorage - formats markdown and tables on save", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const storage = new NoteStorage({ dataDir: tempDir });
    const unformatted = `# Test\n\n|A|B|\n|---|---|\n|1|2|\n`;
    const note = await storage.saveNote("table.md", unformatted);

    assertEquals(
      note.content,
      `# Test\n\n| A   | B   |\n| --- | --- |\n| 1   | 2   |\n`,
    );
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("NoteStorage - filters NSFW notes, directories, search, tags, and attachments", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const storage = new NoteStorage({ dataDir: tempDir });
    await storage.saveNote("Safe.md", "---\ntags:\n  - Notiz\n---\n\nHallo Welt");
    await storage.saveNote("Secret Folder/Hidden Note.md", "---\ntags:\n  - nsfw\n  - Idee\n---\n\nGeheimer Text");
    await storage.createFolder("Empty Folder");

    const attach = await storage.saveAttachment(
      "secret.png",
      new Uint8Array([1, 2, 3]),
      "Secret Folder/Hidden Note.md",
    );

    // Tree filtering
    const lockedTree = await storage.getTreeFiltered(false);
    assertEquals(lockedTree.hiddenCount, 1);
    const topNames = lockedTree.tree.map((n) => n.name);
    assertEquals(topNames.includes("Secret Folder"), false);
    assertEquals(topNames.includes("Empty Folder"), true);
    assertEquals(topNames.includes("Safe"), true);

    const unlockedTree = await storage.getTreeFiltered(true);
    assertEquals(unlockedTree.hiddenCount, 0);
    assertEquals(unlockedTree.tree.some((n) => n.name === "Secret Folder"), true);

    // Search filtering
    const lockedSearch = await storage.searchNotes("Geheimer", 25, { includeNsfw: false });
    assertEquals(lockedSearch.length, 0);
    const unlockedSearch = await storage.searchNotes("Geheimer", 25, { includeNsfw: true });
    assertEquals(unlockedSearch.length, 1);

    // Tag filtering
    const lockedTags = await storage.listAllTags(undefined, { includeNsfw: false });
    assertEquals(lockedTags.some((t) => t.tag.toLowerCase() === "nsfw"), false);
    const ideeLocked = lockedTags.find((t) => t.tag === "Idee");
    assertEquals(ideeLocked?.count, 0);

    // Attachment NSFW ownership
    assertEquals(await storage.isAttachmentNsfw(attach.relPath), true);
    assertEquals(await storage.isAttachmentNsfw("Safe/other.png"), false);
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});
