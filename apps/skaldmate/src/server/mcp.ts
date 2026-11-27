/**
 * @project Sleipnir Stack / Skaldmate MCP
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { MCP_ANNOTATIONS, mcpError, mcpJson, McpServer, z } from "@sleipnir/core/mcp";
import { tool, type ToolSet } from "ai";
import { VERSION } from "../../../../packages/sleipnir/src/version.g.ts";
import {
  deleteCharacter,
  deleteGameMaster,
  deleteLocation,
  deletePersona,
  deleteScene,
  deleteSession,
  getCharacter,
  getGameMaster,
  getLocation,
  getPersona,
  getScene,
  getSession,
  initSkaldStorage,
  listCharacters,
  listGameMasters,
  listLocations,
  listPersonas,
  listScenes,
  listSessions,
  saveCharacter,
  saveGameMaster,
  saveLocation,
  savePersona,
  saveScene,
} from "./services/storage.ts";

type SkaldAnnotations = (typeof MCP_ANNOTATIONS)[keyof typeof MCP_ANNOTATIONS];

interface SkaldToolDef<TShape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  description: string;
  shape: TShape;
  annotations: SkaldAnnotations;
  mutatesData?: boolean;
  execute: (args: z.infer<z.ZodObject<TShape>>) => Promise<unknown>;
}

function defineSkaldTool<TShape extends z.ZodRawShape>(def: SkaldToolDef<TShape>): SkaldToolDef<TShape> {
  return def;
}

const SKALD_TOOLS = [
  // --- SCENES ---
  defineSkaldTool({
    name: "skaldmate_list_scenes",
    description: "Listet alle gespeicherten Szenen-Vorlagen in Skaldmate auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listScenes();
      return {
        count: items.length,
        items: items.map((s) => ({
          id: s.id,
          title: s.title,
          locationId: s.locationId,
          personaId: s.personaId,
          characterIds: s.characterIds,
          gameMasterId: s.gameMasterId,
          modelId: s.modelId,
          updatedAt: s.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_scene",
    description: "Liest eine Szenen-Vorlage anhand ihrer ID vollständig aus.",
    shape: {
      id: z.string().min(1).describe("ID der Szene (z. B. 'tf')"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const item = await getScene(id);
      if (!item) throw new Error(`Szene '${id}' nicht gefunden`);
      return { item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_save_scene",
    description: "Legt eine neue Szenen-Vorlage an oder aktualisiert eine bestehende Szene.",
    shape: {
      id: z.string().optional().describe("Optionale ID; wenn leer, wird ein Slug aus dem Titel erzeugt"),
      title: z.string().min(1).describe("Titel der Szene"),
      locationId: z.string().min(1).describe("ID des Start-Ortes (aus skaldmate_list_locations)"),
      personaId: z.string().optional().describe("Optionale ID der Spieler-Persona"),
      characterIds: z.array(z.string()).default([]).describe("Liste der beteiligten Charakter-IDs"),
      gameMasterId: z.string().default("chronist").describe("ID des Spielleiters (Standard: 'chronist')"),
      modelId: z.string().optional().describe("Optionales Text-Modell (z. B. 'venice:google-gemma-4-31b-it')"),
      imageModelId: z.string().optional().describe("Optionales Bild-Modell"),
      sceneState: z.string().optional().describe("Initialer Szenenzustand"),
      gmNotes: z.string().optional().describe("Geheime Spielleiter-Notizen"),
      openingMessage: z.string().optional().describe("Optionale Eröffnungsnachricht der Szene"),
    },
    annotations: MCP_ANNOTATIONS.writeIdempotent,
    mutatesData: true,
    execute: async (args) => {
      await initSkaldStorage();
      const existing = args.id ? await getScene(args.id) : null;
      const item = await saveScene({
        id: args.id ?? "",
        title: args.title,
        locationId: args.locationId,
        personaId: args.personaId ?? existing?.personaId,
        characterIds: args.characterIds.length > 0 ? args.characterIds : (existing?.characterIds ?? []),
        gameMasterId: args.gameMasterId,
        modelId: args.modelId ?? existing?.modelId,
        imageModelId: args.imageModelId ?? existing?.imageModelId,
        sceneState: args.sceneState ?? existing?.sceneState ?? "",
        gmNotes: args.gmNotes ?? existing?.gmNotes ?? "",
        openingMessage: args.openingMessage ?? existing?.openingMessage ?? "",
      });
      return { saved: true, item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_scene",
    description: "Löscht eine Szenen-Vorlage anhand ihrer ID.",
    shape: {
      id: z.string().min(1).describe("ID der zu löschenden Szene"),
    },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deleteScene(id);
      if (!deleted) throw new Error(`Szene '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),

  // --- CHARACTERS ---
  defineSkaldTool({
    name: "skaldmate_list_characters",
    description: "Listet alle Charaktere (Begleiter/NSCs) in Skaldmate auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listCharacters();
      return {
        count: items.length,
        items: items.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          modelId: c.modelId,
          updatedAt: c.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_character",
    description:
      "Liest einen Charakter anhand seiner ID oder seines exakten Namens vollständig aus (inkl. Aussehen, Persönlichkeit, Ziele, Sprechstil, Makros).",
    shape: {
      id: z.string().min(1).describe("ID oder exakter Name des Charakters (z. B. 'sandra' oder 'Elena Nightshade')"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const item = await getCharacter(id);
      if (!item) throw new Error(`Charakter '${id}' nicht gefunden`);
      return { item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_save_character",
    description: "Legt einen neuen Charakter an oder aktualisiert einen bestehenden Charakter in Skaldmate.",
    shape: {
      id: z.string().optional().describe("Optionale ID; wenn leer, wird ein Slug aus dem Namen erzeugt"),
      name: z.string().min(1).describe("Name des Charakters"),
      role: z.string().optional().describe("Rolle / Archetyp (z. B. 'Geschäftsfrau, Rivalin')"),
      appearance: z.string().optional().describe("Aussehen & Kleidung (unterstützt Makros wie {{random:...}}, {{rand:...}})"),
      personality: z.string().optional().describe("Persönlichkeit & Wesenszüge"),
      goals: z.string().optional().describe("Aktuelle Ziele & Motivation"),
      speechStyle: z.string().optional().describe("Sprechstil & Tonfall"),
      greeting: z.string().optional().describe("Optionale Begrüßung bei Szenenstart"),
      exampleDialogue: z.string().optional().describe("Optionale Beispielsätze"),
      relationships: z.string().optional().describe("Beziehungen zu anderen Figuren/Orten"),
      portraitPrompt: z.string().optional().describe("Englischer Bild-Prompt für das Charakter-Portrait"),
      voiceGender: z.enum(["", "female", "male"]).optional().describe("Stimm-Geschlecht für Browser-TTS ('female', 'male' oder '')"),
      modelId: z.string().optional().describe("Optionales Text-Modell speziell für diesen Charakter"),
    },
    annotations: MCP_ANNOTATIONS.writeIdempotent,
    mutatesData: true,
    execute: async (args) => {
      await initSkaldStorage();
      const existing = args.id ? await getCharacter(args.id) : null;
      const item = await saveCharacter({
        id: args.id ?? "",
        name: args.name,
        role: args.role ?? existing?.role ?? "",
        appearance: args.appearance ?? existing?.appearance ?? "",
        personality: args.personality ?? existing?.personality ?? "",
        goals: args.goals ?? existing?.goals ?? "",
        speechStyle: args.speechStyle ?? existing?.speechStyle ?? "",
        greeting: args.greeting ?? existing?.greeting ?? "",
        exampleDialogue: args.exampleDialogue ?? existing?.exampleDialogue ?? "",
        relationships: args.relationships ?? existing?.relationships ?? "",
        portraitPrompt: args.portraitPrompt ?? existing?.portraitPrompt ?? "",
        voiceGender: args.voiceGender ?? existing?.voiceGender ?? "",
        modelId: args.modelId ?? existing?.modelId,
        portraitFile: existing?.portraitFile,
      });
      return { saved: true, item };
    },
  }),

  // --- GAME MASTERS ---
  defineSkaldTool({
    name: "skaldmate_list_gamemasters",
    description: "Listet alle Spielleiter (Erzähler/Regie) in Skaldmate auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listGameMasters();
      return {
        count: items.length,
        items: items.map((g) => ({
          id: g.id,
          name: g.name,
          style: g.style,
          narrationFrequency: g.narrationFrequency,
          modelId: g.modelId,
          updatedAt: g.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_gamemaster",
    description: "Liest einen Spielleiter anhand seiner ID vollständig aus (inkl. System-Prompt).",
    shape: {
      id: z.string().min(1).describe("ID des Spielleiters (z. B. 'chronist', 'sikra')"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const item = await getGameMaster(id);
      if (!item) throw new Error(`Spielleiter '${id}' nicht gefunden`);
      return { item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_save_gamemaster",
    description: "Legt einen neuen Spielleiter an oder aktualisiert einen bestehenden Spielleiter.",
    shape: {
      id: z.string().optional().describe("Optionale ID; wenn leer, wird ein Slug aus dem Namen erzeugt"),
      name: z.string().min(1).describe("Name des Spielleiters"),
      style: z.string().optional().describe("Erzählstil (z. B. 'noir, spannend, atmosphärisch')"),
      narrationFrequency: z.enum(["immer", "dann_und_wann", "nur_bei_aenderungen"]).optional()
        .describe("Wie häufig der Spielleiter eingreift"),
      systemPrompt: z.string().optional().describe("Regie-Anweisung / System-Prompt für den Spielleiter"),
      voiceGender: z.enum(["", "female", "male"]).optional().describe("Stimm-Geschlecht für Browser-TTS ('female', 'male' oder '')"),
      modelId: z.string().optional().describe("Optionales Text-Modell für diesen Spielleiter"),
    },
    annotations: MCP_ANNOTATIONS.writeIdempotent,
    mutatesData: true,
    execute: async (args) => {
      await initSkaldStorage();
      const existing = args.id ? await getGameMaster(args.id) : null;
      const item = await saveGameMaster({
        id: args.id ?? "",
        name: args.name,
        style: args.style ?? existing?.style ?? "neutral",
        narrationFrequency: args.narrationFrequency ?? existing?.narrationFrequency ?? "dann_und_wann",
        systemPrompt: args.systemPrompt ?? existing?.systemPrompt ?? "",
        voiceGender: args.voiceGender ?? existing?.voiceGender ?? "",
        modelId: args.modelId ?? existing?.modelId,
      });
      return { saved: true, item };
    },
  }),

  // --- PERSONAS ---
  defineSkaldTool({
    name: "skaldmate_list_personas",
    description: "Listet alle Spieler-Persönlichkeiten (Personas) in Skaldmate auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listPersonas();
      return {
        count: items.length,
        items: items.map((p) => ({
          id: p.id,
          name: p.name,
          role: p.role,
          isDefault: p.isDefault,
          updatedAt: p.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_persona",
    description: "Liest eine Spieler-Persona anhand ihrer ID vollständig aus.",
    shape: {
      id: z.string().min(1).describe("ID der Persona"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const item = await getPersona(id);
      if (!item) throw new Error(`Persona '${id}' nicht gefunden`);
      return { item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_save_persona",
    description: "Legt eine neue Spieler-Persönlichkeit (Persona) an oder aktualisiert eine bestehende.",
    shape: {
      id: z.string().optional().describe("Optionale ID; wenn leer, wird ein Slug aus dem Namen erzeugt"),
      name: z.string().min(1).describe("Name der Persona"),
      role: z.string().optional().describe("Rolle / Beruf / Titel"),
      appearance: z.string().optional().describe("Aussehen der Spielerfigur"),
      traits: z.string().optional().describe("Eigenschaften / Wesenszüge"),
      background: z.string().optional().describe("Hintergrundgeschichte"),
      voiceGender: z.enum(["", "female", "male"]).optional().describe("Stimm-Geschlecht für Browser-TTS ('female', 'male' oder '')"),
      isDefault: z.boolean().optional().describe("Als Standard-Persona markieren"),
    },
    annotations: MCP_ANNOTATIONS.writeIdempotent,
    mutatesData: true,
    execute: async (args) => {
      await initSkaldStorage();
      const existing = args.id ? await getPersona(args.id) : null;
      const item = await savePersona({
        id: args.id ?? "",
        name: args.name,
        role: args.role ?? existing?.role ?? "",
        appearance: args.appearance ?? existing?.appearance ?? "",
        traits: args.traits ?? existing?.traits ?? "",
        background: args.background ?? existing?.background ?? "",
        voiceGender: args.voiceGender ?? existing?.voiceGender ?? "",
        portraitFile: existing?.portraitFile,
        isDefault: args.isDefault ?? existing?.isDefault ?? false,
      });
      return { saved: true, item };
    },
  }),

  // --- LOCATIONS ---
  defineSkaldTool({
    name: "skaldmate_list_locations",
    description: "Listet alle Orte / Locations in Skaldmate inkl. Hierarchie (parentId) und Bewohnern auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listLocations();
      return {
        count: items.length,
        items: items.map((l) => ({
          id: l.id,
          name: l.name,
          parentId: l.parentId,
          residentIds: l.residentIds,
          updatedAt: l.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_location",
    description: "Liest einen Ort anhand seiner ID vollständig aus (Beschreibung, Atmosphäre, Details, Karte).",
    shape: {
      id: z.string().min(1).describe("ID des Ortes (z. B. 'stadt')"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const item = await getLocation(id);
      if (!item) throw new Error(`Ort '${id}' nicht gefunden`);
      return { item };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_save_location",
    description: "Legt einen neuen Ort an oder aktualisiert einen bestehenden Ort in Skaldmate.",
    shape: {
      id: z.string().optional().describe("Optionale ID; wenn leer, wird ein Slug aus dem Namen erzeugt"),
      name: z.string().min(1).describe("Name des Ortes"),
      parentId: z.string().optional().describe("Optionale ID eines übergeordneten Ortes"),
      residentIds: z.array(z.string()).optional().describe("Optionale IDs von Charakteren, die hier wohnen/anwesend sind"),
      description: z.string().optional().describe("Ortsbeschreibung"),
      atmosphere: z.string().optional().describe("Atmosphäre & Stimmung"),
      details: z.string().optional().describe("Konkrete Details / Requisiten vor Ort"),
      openingMessage: z.string().optional().describe("Optionale Eröffnungsnachricht bei Chat-Start an diesem Ort"),
      defaultSceneState: z.string().optional().describe("Standard-Szenenzustand für diesen Ort"),
      imagePrompt: z.string().optional().describe("Englischer Bild-Prompt für das Ortsbild"),
      mapPrompt: z.string().optional().describe("Englischer Grundriss-/Karten-Prompt"),
    },
    annotations: MCP_ANNOTATIONS.writeIdempotent,
    mutatesData: true,
    execute: async (args) => {
      await initSkaldStorage();
      const existing = args.id ? await getLocation(args.id) : null;
      const item = await saveLocation({
        id: args.id ?? "",
        name: args.name,
        parentId: args.parentId ?? existing?.parentId,
        residentIds: args.residentIds ?? existing?.residentIds ?? [],
        description: args.description ?? existing?.description ?? "",
        atmosphere: args.atmosphere ?? existing?.atmosphere ?? "",
        details: args.details ?? existing?.details ?? "",
        openingMessage: args.openingMessage ?? existing?.openingMessage ?? "",
        defaultSceneState: args.defaultSceneState ?? existing?.defaultSceneState ?? "",
        imagePrompt: args.imagePrompt ?? existing?.imagePrompt ?? "",
        imageFile: existing?.imageFile,
        mapPrompt: args.mapPrompt ?? existing?.mapPrompt ?? "",
        mapFile: existing?.mapFile,
      });
      return { saved: true, item };
    },
  }),

  // --- SESSIONS (READ-ONLY CONTEXT) ---
  defineSkaldTool({
    name: "skaldmate_list_sessions",
    description: "Listet alle aktuellen Story-Chats / Sessions in Skaldmate auf.",
    shape: {},
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async () => {
      await initSkaldStorage();
      const items = await listSessions();
      return {
        count: items.length,
        items: items.map((s) => ({
          id: s.id,
          title: s.title,
          locationId: s.locationId,
          characterIds: s.characterIds,
          gameMasterId: s.gameMasterId,
          personaId: s.personaId,
          messageCount: s.messages.length,
          updatedAt: s.updatedAt,
        })),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_get_session",
    description: "Liest Zustand, Besetzung und die letzten Nachrichten einer aktiven Story-Session aus.",
    shape: {
      id: z.string().min(1).describe("ID der Session"),
      tailMessages: z.number().int().min(1).max(40).default(10).describe("Anzahl der letzten Nachrichten"),
    },
    annotations: MCP_ANNOTATIONS.readOnly,
    execute: async ({ id, tailMessages }) => {
      await initSkaldStorage();
      const session = await getSession(id);
      if (!session) throw new Error(`Session '${id}' nicht gefunden`);
      return {
        id: session.id,
        title: session.title,
        locationId: session.locationId,
        personaId: session.personaId,
        characterIds: session.characterIds,
        gameMasterId: session.gameMasterId,
        sceneState: session.sceneState,
        inventory: session.inventory,
        variables: session.variables,
        compressedSummary: session.compressedSummary,
        recentMessages: session.messages.slice(-tailMessages),
      };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_persona",
    description: "Löscht eine Spieler-Persona dauerhaft.",
    shape: { id: z.string().min(1).describe("ID der Persona") },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deletePersona(id);
      if (!deleted) throw new Error(`Persona '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_character",
    description: "Löscht einen Charakter dauerhaft.",
    shape: { id: z.string().min(1).describe("ID des Charakters") },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deleteCharacter(id);
      if (!deleted) throw new Error(`Charakter '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_location",
    description: "Löscht einen Ort dauerhaft.",
    shape: { id: z.string().min(1).describe("ID des Orts") },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deleteLocation(id);
      if (!deleted) throw new Error(`Ort '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_gamemaster",
    description: "Löscht eine Spielleiter-Stimme dauerhaft.",
    shape: { id: z.string().min(1).describe("ID des GameMasters") },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deleteGameMaster(id);
      if (!deleted) throw new Error(`GameMaster '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),

  defineSkaldTool({
    name: "skaldmate_delete_session",
    description: "Löscht eine Story-Session dauerhaft.",
    shape: { id: z.string().min(1).describe("ID der Session") },
    annotations: MCP_ANNOTATIONS.destructive,
    mutatesData: true,
    execute: async ({ id }) => {
      await initSkaldStorage();
      const deleted = await deleteSession(id);
      if (!deleted) throw new Error(`Session '${id}' nicht gefunden`);
      return { deleted: true, id };
    },
  }),
];

export const SKALD_MUTATING_TOOL_NAMES = new Set(
  SKALD_TOOLS.filter((t) => t.mutatesData).map((t) => t.name),
);

/**
 * Creates a configured Skaldmate MCP server exposing read/write tools for
 * scenes, characters, game masters, personas, locations, and session context.
 */
export function createSkaldmateMcpServer(): McpServer {
  const server = new McpServer({
    name: "skaldmate",
    version: VERSION,
  });

  for (const def of SKALD_TOOLS) {
    server.tool(
      def.name,
      def.description,
      def.shape,
      def.annotations,
      async (args: Record<string, unknown>) => {
        try {
          const result = await def.execute(args as never);
          return mcpJson(result);
        } catch (err) {
          return mcpError(err instanceof Error ? err.message : "Skaldmate-Tool-Fehler");
        }
      },
    );
  }

  return server;
}

/**
 * Creates AI SDK tool bindings backed by the exact same Skaldmate MCP tool
 * definitions so the internal Workshop chat is context-aware and can read/create entities.
 */
export function createSkaldmateWorkshopTools(): ToolSet {
  const tools: ToolSet = {};
  for (const def of SKALD_TOOLS) {
    tools[def.name] = tool({
      description: def.description,
      inputSchema: z.object(def.shape),
      execute: async (args) => {
        try {
          return await def.execute(args as never);
        } catch (err) {
          return { error: err instanceof Error ? err.message : "Skaldmate-Tool-Fehler" };
        }
      },
    });
  }
  return tools;
}
