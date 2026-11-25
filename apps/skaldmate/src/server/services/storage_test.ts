/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { getCharacter, listGameMasters, listLocations, saveCharacter, slugifyName } from "./storage.ts";

Deno.test("slugifyName - normalizes umlauts and special characters", () => {
  assertEquals(slugifyName("Alte Bäckerei & Café"), "alte-baeckerei-cafe");
});

Deno.test("storage - seeds default chronist and locations and saves character", async () => {
  const tempDir = await Deno.makeTempDir();
  Deno.env.set("SKALDMATE_DATA_DIR", tempDir);
  try {
    const gms = await listGameMasters();
    const locs = await listLocations();
    assertEquals(gms.some((g) => g.id === "chronist"), true);
    assertEquals(locs.some((l) => l.id === "wohnung"), true);

    const saved = await saveCharacter({
      id: "lena",
      name: "Lena",
      role: "Nachbarin",
      appearance: "Kurze dunkle Haare",
      personality: "Neugierig, schlagfertig",
      goals: "Herausfinden, was im Hof passiert",
      speechStyle: "locker",
    });
    assertEquals(saved.id, "lena");

    const loaded = await getCharacter("lena");
    assertEquals(loaded?.name, "Lena");
  } finally {
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
