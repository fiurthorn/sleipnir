/**
 * @project Sleipnir Stack / Core Search
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { join } from "node:path";
import { PersistentSearchIndex } from "./search.ts";

interface DemoDoc {
  id: string;
  title: string;
  tags: string;
  content: string;
}

Deno.test("PersistentSearchIndex - boosts title and tags above body content", async () => {
  const index = new PersistentSearchIndex<DemoDoc>({
    fields: ["title", "tags", "content"],
    storeFields: ["title", "tags"],
    boost: { title: 4, tags: 3, content: 1 },
  });

  await index.syncFromEntries([
    {
      id: "body-only.md",
      mtimeMs: 100,
      load: () =>
        Promise.resolve({
          id: "body-only.md",
          title: "Notiz",
          tags: "Architektur",
          content: "Hier wird Pasta nur am Rande erwähnt.",
        }),
    },
    {
      id: "tagged.md",
      mtimeMs: 100,
      load: () =>
        Promise.resolve({
          id: "tagged.md",
          title: "Abendessen",
          tags: "Pasta Schnell",
          content: "Leckeres Rezept.",
        }),
    },
    {
      id: "titled.md",
      mtimeMs: 100,
      load: () =>
        Promise.resolve({
          id: "titled.md",
          title: "Pasta Carbonara",
          tags: "Hauptgericht",
          content: "Klassiker.",
        }),
    },
  ]);

  const hits = index.search("pasta");
  assertEquals(hits.length, 3);
  assertEquals(hits[0].id, "titled.md");
  assertEquals(hits[1].id, "tagged.md");
  assertEquals(hits[2].id, "body-only.md");
});

Deno.test("PersistentSearchIndex - persists index and syncs only changed mtimes", async () => {
  const tmpDir = await Deno.makeTempDir();
  const persistPath = join(tmpDir, ".search-index.json");

  try {
    const idx1 = new PersistentSearchIndex<DemoDoc>({
      fields: ["title", "tags", "content"],
      storeFields: ["title"],
      persistPath,
    });

    await idx1.syncFromEntries([
      {
        id: "a.md",
        mtimeMs: 1000,
        load: () => Promise.resolve({ id: "a.md", title: "Tomatensuppe", tags: "Suppe", content: "Warm" }),
      },
    ]);
    await idx1.flush();

    let loadedUnchanged = false;
    const idx2 = new PersistentSearchIndex<DemoDoc>({
      fields: ["title", "tags", "content"],
      storeFields: ["title"],
      persistPath,
    });

    await idx2.syncFromEntries([
      {
        id: "a.md",
        mtimeMs: 1000,
        load: () => {
          loadedUnchanged = true;
          return Promise.resolve({ id: "a.md", title: "Tomatensuppe", tags: "Suppe", content: "Warm" });
        },
      },
      {
        id: "b.md",
        mtimeMs: 2000,
        load: () => Promise.resolve({ id: "b.md", title: "Zwiebelsuppe", tags: "Suppe", content: "Herzhaft" }),
      },
    ]);
    await idx2.flush();

    assertEquals(loadedUnchanged, false);
    assertEquals(idx2.search("suppe").length, 2);
  } finally {
    await Deno.remove(tmpDir, { recursive: true });
  }
});
