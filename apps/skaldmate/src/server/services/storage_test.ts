/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { buildLocationMapPrompt } from "./image.ts";
import {
  deleteCharacter,
  deleteGameMaster,
  deleteLocation,
  deleteScene,
  deleteSession,
  EntityInUseError,
  getCharacter,
  getLocation,
  getScene,
  getSession,
  listGameMasters,
  listLocations,
  listScenes,
  saveCharacter,
  saveLocation,
  saveScene,
  saveSession,
  slugifyName,
} from "./storage.ts";

Deno.test("slugifyName - normalizes umlauts and special characters", () => {
  assertEquals(slugifyName("Alte Bäckerei & Café"), "alte-baeckerei-cafe");
});

Deno.test("storage - seeds default chronist and locations and saves character", async () => {
  const previousDataDir = Deno.env.get("SKALDMATE_DATA_DIR");
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

    // 1:1 Name-Match auch wenn ID abweicht
    await saveCharacter({
      id: "hotel_succubus",
      name: "Elena Nightshade",
      role: "Hotelbesitzerin",
      appearance: "",
      personality: "",
      goals: "",
      speechStyle: "",
      voiceGender: "female",
    });
    const byName = await getCharacter("Elena Nightshade");
    assertEquals(byName?.id, "hotel_succubus");

    const now = new Date().toISOString();
    await saveSession({
      id: "szene-1",
      title: "Testszene",
      locationId: "wohnung",
      characterIds: ["lena"],
      gameMasterId: "chronist",
      sceneState: "Ruhiger Abend",
      messages: [
        {
          id: "m1",
          kind: "user",
          speakerId: undefined,
          speakerName: "Du",
          portraitFile: undefined,
          content: "Hallo!",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    });
    const loadedSession = await getSession("szene-1");
    assertEquals(loadedSession?.title, "Testszene");
    assertEquals(loadedSession?.compressedUntilIndex, 0);

    // Referentielle Integrität (RESTRICT): Verknüpfte Entitäten dürfen nicht gelöscht werden
    await assertRejects(() => deleteCharacter("lena"), EntityInUseError);
    await assertRejects(() => deleteLocation("wohnung"), EntityInUseError);
    await assertRejects(() => deleteGameMaster("chronist"), EntityInUseError);

    // Nach Löschen der Session ist das Entfernen des Charakters erlaubt
    assertEquals(await deleteSession("szene-1"), true);
    assertEquals(await deleteCharacter("lena"), true);

    // Location mit Landkarte (mapPrompt + mapFile) und Unter-Orten
    const hafen = await saveLocation({
      id: "hafenstadt",
      name: "Hafenstadt",
      description: "Küstenstadt mit alten Mauern",
      atmosphere: "Salzige Brise",
      details: "Pier, Leuchtturm",
      mapPrompt: "Norden: Altstadt, Süden: Pier und Leuchtturm",
      mapFile: "locmap_hafenstadt_1234.png",
    });
    const taverne = await saveLocation({
      id: "hafen-taverne",
      name: "Zum Rostigen Anker",
      parentId: hafen.id,
      description: "Kleine Hafenkneipe am Pier",
      atmosphere: "Rauchig und laut",
      details: "Holztresen",
    });
    const loadedHafen = await getLocation("hafenstadt");
    assertEquals(loadedHafen?.mapFile, "locmap_hafenstadt_1234.png");
    assertEquals(loadedHafen?.mapPrompt, "Norden: Altstadt, Süden: Pier und Leuchtturm");

    const mapPrompt = buildLocationMapPrompt(hafen, [taverne]);
    assertStringIncludes(mapPrompt, "Norden: Altstadt, Süden: Pier und Leuchtturm");
    assertStringIncludes(mapPrompt, "Zum Rostigen Anker");

    // Szenen-Vorlage speichern, laden, auflisten und löschen
    const savedScene = await saveScene({
      id: "hafenkrimi",
      title: "Hafenkrimi",
      locationId: hafen.id,
      characterIds: [],
      gameMasterId: "chronist",
      openingMessage: "Nebel liegt über dem Pier.",
      sceneState: "Später Abend",
      gmNotes: "Der Kapitän schweigt.",
    });
    assertEquals(savedScene.id, "hafenkrimi");
    assertEquals((await getScene("hafenkrimi"))?.title, "Hafenkrimi");
    assertEquals((await listScenes()).some((s) => s.id === "hafenkrimi"), true);
    assertEquals(await deleteScene("hafenkrimi"), true);
  } finally {
    if (previousDataDir === undefined) {
      Deno.env.delete("SKALDMATE_DATA_DIR");
    } else {
      Deno.env.set("SKALDMATE_DATA_DIR", previousDataDir);
    }
    await Deno.remove(tempDir, { recursive: true }).catch(() => {});
  }
});
