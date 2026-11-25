/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { ensureDir } from "@std/fs";
import { basename, join, resolve } from "@std/path";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import {
  type Character,
  characterSchema,
  type GameMaster,
  gameMasterSchema,
  type Location,
  locationSchema,
  type Persona,
  personaSchema,
  sessionSchema,
  type StorySession,
} from "./types.ts";

function resolveDataDir(): string {
  const configured = Deno.env.get("SKALDMATE_DATA_DIR");
  if (configured) return resolve(configured);
  return resolve(new URL("../../../../../data/skaldmate", import.meta.url).pathname);
}

const DATA_DIR = resolveDataDir();
const PERSONAS_DIR = join(DATA_DIR, "personas");
const CHARACTERS_DIR = join(DATA_DIR, "characters");
const LOCATIONS_DIR = join(DATA_DIR, "locations");
const GAMEMASTERS_DIR = join(DATA_DIR, "gamemasters");
const SESSIONS_DIR = join(DATA_DIR, "sessions");
const ASSETS_DIR = join(DATA_DIR, "assets");

let initialized = false;

function sanitizeId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function slugifyName(name: string, fallbackPrefix = "item"): string {
  const slug = sanitizeId(
    name
      .replace(/ä/gi, "ae")
      .replace(/ö/gi, "oe")
      .replace(/ü/gi, "ue")
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""),
  );
  return slug || `${fallbackPrefix}-${crypto.randomUUID().slice(0, 6)}`;
}

async function seedDefaultsIfEmpty(): Promise<void> {
  const now = new Date().toISOString();

  // Default neutral Game Master
  const existingGms = await listYamlEntities(GAMEMASTERS_DIR, gameMasterSchema);
  if (existingGms.length === 0) {
    await saveGameMaster({
      id: "chronist",
      name: "Der Chronist",
      style: "neutral",
      systemPrompt:
        "Du bist ein neutraler, aufmerksamer Spielleiter. Halte die Welt konsistent, beschreibe Konsequenzen und Umgebungsdetails knapp und stimmungsvoll und entscheide fair, welche anwesenden Charaktere reagieren.",
      updatedAt: now,
    });
  }

  // Default simple Locations
  const existingLocations = await listYamlEntities(LOCATIONS_DIR, locationSchema);
  if (existingLocations.length === 0) {
    const defaults: Location[] = [
      {
        id: "wohnung",
        name: "Die Wohnung",
        description: "Eine gemütliche Altbauwohnung mit warmem Lampenlicht, Bücherregalen und Blick auf die Straße.",
        atmosphere: "Vertraut, ruhig, leicht gedämpfte Geräusche von draußen.",
        details: "Wohnzimmer mit Sofa, Küchentresen, Flurtür, halb offenes Fenster.",
        updatedAt: now,
      },
      {
        id: "stadt",
        name: "Die Stadt",
        description: "Belebte Straßen bei Einbruch der Dämmerung, kleine Cafés, Neonlichter und nasse Gehwege.",
        atmosphere: "Lebendig, urban, Stimmengewirr und entfernter Verkehr.",
        details: "Eckcafé, U-Bahn-Eingang, beleuchtete Schaufenster, schmale Seitenstraße.",
        updatedAt: now,
      },
      {
        id: "wald",
        name: "Der Wald",
        description: "Ein alter Mischwald mit moosbewachsenen Steinen, schmalen Trampelpfaden und hohem Blätterdach.",
        atmosphere: "Still, geheimnisvoll, Rascheln im Unterholz, kühle Waldluft.",
        details: "Kleine Lichtung, knorrige Eiche, schmaler Bachlauf.",
        updatedAt: now,
      },
    ];
    for (const loc of defaults) {
      await saveLocation(loc);
    }
  }
}

export async function initSkaldStorage(): Promise<void> {
  if (initialized) return;
  await ensureDir(PERSONAS_DIR);
  await ensureDir(CHARACTERS_DIR);
  await ensureDir(LOCATIONS_DIR);
  await ensureDir(GAMEMASTERS_DIR);
  await ensureDir(SESSIONS_DIR);
  await ensureDir(ASSETS_DIR);
  initialized = true;
  await seedDefaultsIfEmpty();
}

interface SchemaParser<T> {
  safeParse: (data: unknown) => { success: true; data: T } | { success: false };
}

async function listYamlEntities<T>(dir: string, schema: SchemaParser<T>): Promise<T[]> {
  const items: T[] = [];
  try {
    for await (const entry of Deno.readDir(dir)) {
      if (!entry.isFile || !entry.name.endsWith(".yaml")) continue;
      try {
        const raw = await Deno.readTextFile(join(dir, entry.name));
        const parsed = parseYaml(raw);
        const validated = schema.safeParse(parsed);
        if (validated.success) {
          items.push(validated.data);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return items;
}

async function readYamlEntity<T>(dir: string, id: string, schema: SchemaParser<T>): Promise<T | null> {
  const safe = sanitizeId(id);
  if (!safe) return null;
  try {
    const raw = await Deno.readTextFile(join(dir, `${safe}.yaml`));
    const parsed = parseYaml(raw);
    const validated = schema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

async function writeYamlEntity<T extends { id: string }>(dir: string, entity: T): Promise<T> {
  const safe = sanitizeId(entity.id);
  if (!safe) throw new Error("Ungültige ID");
  const clean = Object.fromEntries(
    Object.entries(entity).filter(([, v]) => v !== undefined),
  );
  await Deno.writeTextFile(join(dir, `${safe}.yaml`), stringifyYaml(clean));
  return entity;
}

async function deleteFileIfExists(path: string): Promise<boolean> {
  try {
    await Deno.remove(path);
    return true;
  } catch {
    return false;
  }
}

// Personas
export async function listPersonas(): Promise<Persona[]> {
  await initSkaldStorage();
  const list = await listYamlEntities(PERSONAS_DIR, personaSchema);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPersona(id: string): Promise<Persona | null> {
  await initSkaldStorage();
  return readYamlEntity(PERSONAS_DIR, id, personaSchema);
}

export async function savePersona(input: Omit<Persona, "updatedAt"> & { updatedAt?: string }): Promise<Persona> {
  await initSkaldStorage();
  const data = personaSchema.parse({
    ...input,
    id: sanitizeId(input.id) || slugifyName(input.name, "persona"),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
  return writeYamlEntity(PERSONAS_DIR, data);
}

export async function deletePersona(id: string): Promise<boolean> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  return safe ? deleteFileIfExists(join(PERSONAS_DIR, `${safe}.yaml`)) : false;
}

// Characters (NPCs)
export async function listCharacters(): Promise<Character[]> {
  await initSkaldStorage();
  const list = await listYamlEntities(CHARACTERS_DIR, characterSchema);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCharacter(id: string): Promise<Character | null> {
  await initSkaldStorage();
  return readYamlEntity(CHARACTERS_DIR, id, characterSchema);
}

export async function saveCharacter(input: Omit<Character, "updatedAt"> & { updatedAt?: string }): Promise<Character> {
  await initSkaldStorage();
  const data = characterSchema.parse({
    ...input,
    id: sanitizeId(input.id) || slugifyName(input.name, "char"),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
  return writeYamlEntity(CHARACTERS_DIR, data);
}

export async function deleteCharacter(id: string): Promise<boolean> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  return safe ? deleteFileIfExists(join(CHARACTERS_DIR, `${safe}.yaml`)) : false;
}

// Locations
export async function listLocations(): Promise<Location[]> {
  await initSkaldStorage();
  const list = await listYamlEntities(LOCATIONS_DIR, locationSchema);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLocation(id: string): Promise<Location | null> {
  await initSkaldStorage();
  return readYamlEntity(LOCATIONS_DIR, id, locationSchema);
}

export async function saveLocation(input: Omit<Location, "updatedAt"> & { updatedAt?: string }): Promise<Location> {
  await initSkaldStorage();
  const data = locationSchema.parse({
    ...input,
    id: sanitizeId(input.id) || slugifyName(input.name, "loc"),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
  return writeYamlEntity(LOCATIONS_DIR, data);
}

export async function deleteLocation(id: string): Promise<boolean> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  return safe ? deleteFileIfExists(join(LOCATIONS_DIR, `${safe}.yaml`)) : false;
}

// GameMasters
export async function listGameMasters(): Promise<GameMaster[]> {
  await initSkaldStorage();
  const list = await listYamlEntities(GAMEMASTERS_DIR, gameMasterSchema);
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getGameMaster(id: string): Promise<GameMaster | null> {
  await initSkaldStorage();
  return readYamlEntity(GAMEMASTERS_DIR, id, gameMasterSchema);
}

export async function saveGameMaster(input: Omit<GameMaster, "updatedAt"> & { updatedAt?: string }): Promise<GameMaster> {
  await initSkaldStorage();
  const data = gameMasterSchema.parse({
    ...input,
    id: sanitizeId(input.id) || slugifyName(input.name, "gm"),
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  });
  return writeYamlEntity(GAMEMASTERS_DIR, data);
}

export async function deleteGameMaster(id: string): Promise<boolean> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  return safe ? deleteFileIfExists(join(GAMEMASTERS_DIR, `${safe}.yaml`)) : false;
}

// Sessions
export async function listSessions(): Promise<StorySession[]> {
  await initSkaldStorage();
  const items: StorySession[] = [];
  try {
    for await (const entry of Deno.readDir(SESSIONS_DIR)) {
      if (!entry.isFile || !entry.name.endsWith(".json")) continue;
      try {
        const raw = await Deno.readTextFile(join(SESSIONS_DIR, entry.name));
        const parsed = sessionSchema.safeParse(JSON.parse(raw));
        if (parsed.success) items.push(parsed.data);
      } catch {
        // Ignore broken session file
      }
    }
  } catch {
    // Ignore
  }
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getSession(id: string): Promise<StorySession | null> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  if (!safe) return null;
  try {
    const raw = await Deno.readTextFile(join(SESSIONS_DIR, `${safe}.json`));
    const parsed = sessionSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function saveSession(session: StorySession): Promise<StorySession> {
  await initSkaldStorage();
  const safe = sanitizeId(session.id) || crypto.randomUUID();
  const validated = sessionSchema.parse({
    ...session,
    id: safe,
    updatedAt: new Date().toISOString(),
  });
  await Deno.writeTextFile(join(SESSIONS_DIR, `${safe}.json`), JSON.stringify(validated, null, 2));
  return validated;
}

export async function deleteSession(id: string): Promise<boolean> {
  await initSkaldStorage();
  const safe = sanitizeId(id);
  return safe ? deleteFileIfExists(join(SESSIONS_DIR, `${safe}.json`)) : false;
}

// Assets (generated portraits & scene images)
export async function saveAssetBytes(fileName: string, bytes: Uint8Array): Promise<string> {
  await initSkaldStorage();
  const safeName = basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  await Deno.writeFile(join(ASSETS_DIR, safeName), bytes);
  return safeName;
}

export async function readAssetBytes(fileName: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  await initSkaldStorage();
  const safeName = basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!safeName) return null;
  try {
    const bytes = await Deno.readFile(join(ASSETS_DIR, safeName));
    const lower = safeName.toLowerCase();
    const contentType = lower.endsWith(".jpg") || lower.endsWith(".jpeg") ? "image/jpeg" : lower.endsWith(".webp") ? "image/webp" : "image/png";
    return { bytes, contentType };
  } catch {
    return null;
  }
}
