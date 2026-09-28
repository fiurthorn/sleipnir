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
