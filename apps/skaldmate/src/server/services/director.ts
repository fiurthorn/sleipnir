/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, Output } from "ai";
import { z } from "zod";
import { getAvailableModels, loadProviderConfig } from "./config.ts";
import { expandMacros } from "./macros.ts";
import { getGameMaster, getPersona, listCharacters, listLocations, saveSession } from "./storage.ts";
import type { Character, GameMaster, Location, Persona, SessionMessage, StorySession } from "./types.ts";

const directorExtraSchema = z.object({
  name: z.string().min(1).describe("Kurzer Name oder Bezeichnung (z. B. 'Gast am Nebentisch', 'Kellnerin')"),
  role: z.string().optional().describe("Optionale kurze Rolle"),
  dialogue: z.string().min(1).describe("Kurze Reaktion/Dialog des Statisten in der Szene"),
});

const directorPlanSchema = z.object({
  narrationBefore: z
    .string()
    .optional()
    .describe("Optionaler kurzer Erzähler-/Umgebungseinschub vor den Charakter-Antworten (nur wenn etwas passiert)"),
  speakers: z
    .array(z.string())
    .default([])
    .describe("Liste der exakten IDs der anwesenden Charaktere, die in diesem Zug wirklich reagieren sollten (0 bis 3 IDs)"),
  extras: z
    .array(directorExtraSchema)
    .max(2)
    .default([])
    .describe("Optionale spontane Statisten/Gäste (0 bis 2), die nur situativ am aktuellen Ort auftreten"),
  narrationAfter: z
    .string()
    .optional()
    .describe("Optionaler kurzer Abschluss-Hinweis des Spielleiters falls die Szene sich danach weiterentwickelt"),
  nextLocationId: z
    .string()
    .optional()
    .describe("Exakte ID eines anderen bekannten Ortes, falls die Reisegruppe in diesem Zug den Ort wechselt"),
  sceneStateUpdate: z
    .string()
    .optional()
    .describe("Optionaler aktualisierter kompakter Szenenzustand (1-2 Sätze), nur wenn sich etwas Wesentliches geändert hat"),
});

function resolveTextModel(requestedModelId?: string) {
  const providers = loadProviderConfig();
  const textModels = getAvailableModels().filter((m) => m.type === "text");
  if (textModels.length === 0) {
    throw new Error("Keine Text-Modelle mit gültigem API-Key konfiguriert.");
  }

  const chosen = requestedModelId ? textModels.find((m) => m.id === requestedModelId) : textModels[0];

  const target = chosen ?? textModels[0];
  const [providerId, ...rest] = target.id.split(":");
  const rawModelId = rest.join(":");
  const provider = providers.find((p) => p.id === providerId);
  if (!provider || !provider.apiKey) {
    throw new Error(`Provider '${providerId}' nicht bereit.`);
  }

  const client = createOpenAICompatible({
    name: provider.id,
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
    headers: {
      "HTTP-Referer": "https://sleipnir.local",
      "X-Title": "Sleipnir Skaldmate",
    },
  });

  return client.chatModel(rawModelId);
}

function formatHistoryForPrompt(messages: SessionMessage[], limit = 18): string {
  const slice = messages.slice(-limit);
  if (slice.length === 0) return "(Noch keine Nachrichten in dieser Szene.)";
  return slice
    .map((m) => {
      if (m.kind === "image") return `[Szene-Bild: ${m.imagePrompt ?? ""}]`;
      return `${m.speakerName}: ${m.content}`;
    })
    .join("\n");
}

function resolveLocationChain(locationId: string, allLocations: Location[]): Location[] {
  const byId = new Map(allLocations.map((l) => [l.id, l]));
  const chain: Location[] = [];
  const visited = new Set<string>();
  let current = byId.get(locationId);

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

function buildContextHeader(
  locationChain: Location[],
  allLocations: Location[],
  persona: Persona | null,
  partyCharacters: Character[],
  residentCharacters: Character[],
  sceneState: string,
): string {
  const parts: string[] = [];
  const currentLocation = locationChain[locationChain.length - 1] ?? null;

  if (currentLocation) {
    const pathNames = locationChain.map((l) => l.name).join(" > ");
    const parentNotes = locationChain
      .slice(0, -1)
      .map((p) => `${p.name}: ${p.description}`)
      .filter(Boolean)
      .join(" | ");

    const otherLocs = allLocations
      .filter((l) => l.id !== currentLocation.id)
      .map((l) => `[${l.id}] ${l.name}`)
      .join(", ");

    parts.push(
      [
        `AKTUELLER ORT: ${currentLocation.name} (Pfad: ${pathNames})`,
        `Beschreibung: ${currentLocation.description}`,
        `Atmosphäre: ${currentLocation.atmosphere}`,
        currentLocation.details ? `Details: ${currentLocation.details}` : "",
        parentNotes ? `Übergeordneter Kontext: ${parentNotes}` : "",
        otherLocs ? `Weitere bekannte Orte (für Ortswechsel): ${otherLocs}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (persona) {
    parts.push(
      `SPIELER-PERSONA: ${persona.name}${persona.role ? ` (${persona.role})` : ""}${persona.traits ? ` | Eigenschaften: ${persona.traits}` : ""}${
        persona.appearance ? ` | Aussehen: ${persona.appearance}` : ""
      }`,
    );
  }

  if (partyCharacters.length > 0) {
    const partyLines = partyCharacters.map((c) =>
      `- [${c.id}] ${c.name}${c.role ? ` (${c.role})` : ""}: Persönlichkeit=${c.personality || "—"}; Ziele=${c.goals || "—"}; Stil=${
        c.speechStyle || "natürlich"
      }`
    );
    parts.push(`REISEGRUPPE (Begleiter, die mitreisen):\n${partyLines.join("\n")}`);
  }

  if (residentCharacters.length > 0) {
    const resLines = residentCharacters.map((c) =>
      `- [${c.id}] ${c.name}${c.role ? ` (${c.role})` : ""} [Orts-NPC]: Persönlichkeit=${c.personality || "—"}; Ziele=${c.goals || "—"}; Stil=${
        c.speechStyle || "natürlich"
      }`
    );
    parts.push(`ORTS-BEWOHNER (fest an '${currentLocation?.name ?? "diesem Ort"}' gebunden):\n${resLines.join("\n")}`);
  }

  if (sceneState) {
    parts.push(`AKTUELLER SZENENZUSTAND: ${sceneState}`);
  }

  return parts.join("\n\n");
}

function detectMentionedCharacters(text: string, characters: Character[]): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  return characters
    .filter((c) => {
      const nameLower = c.name.toLowerCase();
      return lower.includes(`@${nameLower}`) || lower.includes(nameLower);
    })
    .map((c) => c.id);
}

async function runGameMasterDirector(
  gm: GameMaster | null,
  session: StorySession,
  locationChain: Location[],
  allLocations: Location[],
  persona: Persona | null,
  partyCharacters: Character[],
  residentCharacters: Character[],
  userText: string,
): Promise<z.infer<typeof directorPlanSchema>> {
  const allPresent = [...partyCharacters, ...residentCharacters];
  if (allPresent.length === 0 && allLocations.length <= 1) {
    return { speakers: [], extras: [] };
  }

  const model = resolveTextModel(gm?.modelId || session.modelId);
  const contextBlock = buildContextHeader(
    locationChain,
    allLocations,
    persona,
    partyCharacters,
    residentCharacters,
    session.sceneState,
  );
  const historyBlock = formatHistoryForPrompt(session.messages);

  const systemPrompt = [
    gm?.systemPrompt ||
    "Du bist ein neutraler, aufmerksamer Spielleiter einer interaktiven Geschichte.",
    "Deine Aufgabe als Regisseur:",
    "1. Entscheide autark, welche anwesenden Charaktere (aus REISEGRUPPE oder ORTS-BEWOHNER) auf die aktuelle Situation wirklich reagieren (0, 1 oder 2 – NICHT stumpf alle der Reihe nach!).",
    "2. Wenn ein Charakter direkt angesprochen/erwähnt wird, gehört seine ID in `speakers`.",
    "3. Text in eckigen Klammern [...] sind direkte OOC-Regieanweisungen des Spielers an dich (z. B. Zeitsprung, Ereignis, Ortswechsel). Setze sie in `narrationBefore` / `nextLocationId` / `sceneStateUpdate` um.",
    "4. Wenn die Gruppe explizit an einen anderen bekannten Ort geht, setze `nextLocationId` auf dessen exakte ID.",
    "5. Falls situativ ein spontaner Statist/Gast (z. B. Kellnerin, Passant) etwas sagen sollte, nutze optional `extras` (max. 2).",
    "6. Füge `narrationBefore` oder `narrationAfter` nur hinzu, wenn die Umgebung, ein Ereignis oder eine Konsequenz beschrieben werden muss (knapp, 1-3 Sätze).",
    "7. Nutze in `speakers` ausschließlich exakte IDs aus REISEGRUPPE oder ORTS-BEWOHNER.",
  ].join("\n");

  const prompt = expandMacros(
    [
      contextBlock,
      `BISHERIGER VERLAUF:\n${historyBlock}`,
      userText ? `NEUE AKTION DES SPIELERS: ${userText}` : "Der Spieler lässt die Szene ohne eigene Aktion weiterlaufen.",
    ].join("\n\n"),
    { userName: persona?.name },
  );

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      output: Output.object({ schema: directorPlanSchema }),
      prompt,
    });

    const validCharIds = new Set(allPresent.map((c) => c.id));
    const validLocIds = new Set(allLocations.map((l) => l.id));
    const filteredSpeakers = (result.output.speakers ?? [])
      .filter((id) => validCharIds.has(id))
      .slice(0, 3);

    const nextLoc = result.output.nextLocationId && validLocIds.has(result.output.nextLocationId) ? result.output.nextLocationId : undefined;

    return {
      ...result.output,
      speakers: filteredSpeakers,
      extras: (result.output.extras ?? []).slice(0, 2),
      nextLocationId: nextLoc,
    };
  } catch {
    const mentioned = detectMentionedCharacters(userText, allPresent);
    return {
      speakers: mentioned.length > 0 ? mentioned.slice(0, 2) : (allPresent[0] ? [allPresent[0].id] : []),
      extras: [],
    };
  }
}

async function generateCharacterReply(
  char: Character,
  session: StorySession,
  locationChain: Location[],
  allLocations: Location[],
  persona: Persona | null,
  partyCharacters: Character[],
  residentCharacters: Character[],
): Promise<string> {
  const model = resolveTextModel(char.modelId || session.modelId);
  const contextBlock = buildContextHeader(
    locationChain,
    allLocations,
    persona,
    partyCharacters,
    residentCharacters,
    session.sceneState,
  );
  const historyBlock = formatHistoryForPrompt(session.messages);

  const systemPrompt = [
    `Du spielst ausschließlich die Rolle von "${char.name}".`,
    char.role ? `Rolle: ${char.role}` : "",
    char.appearance ? `Aussehen: ${char.appearance}` : "",
    char.personality ? `Charakterzüge & Persönlichkeit: ${char.personality}` : "",
    char.goals ? `Ziele & Motivation: ${char.goals}` : "",
    char.speechStyle ? `Sprechstil: ${char.speechStyle}` : "",
    char.exampleDialogue ? `Typische Beispielsätze:\n${char.exampleDialogue}` : "",
    char.relationships ? `Beziehungen zu anderen: ${char.relationships}` : "",
    "Regeln: Antworte auf Deutsch direkt aus der Perspektive von " + char.name +
    " (Dialog und kurze Handlungen/Gesten, z. B. *sieht sich um*). Sprich niemals für den Spieler oder andere Charaktere. Beginne deine Antwort nicht mit deinem eigenen Namen.",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = expandMacros(
    [
      contextBlock,
      `BISHERIGER VERLAUF:\n${historyBlock}`,
      `Wie reagiert ${char.name} jetzt?`,
    ].join("\n\n"),
    { userName: persona?.name, charName: char.name },
  );

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt,
  });

  return result.text.trim();
}

/**
 * Executes a full group-chat turn: optional user message, Game Master orchestration
 * (supporting location transitions, party + location residents, and spontaneous extras),
 * and replies from the selected characters.
 */
export async function runStoryTurn(options: {
  session: StorySession;
  userMessage?: string;
  forceCharacterId?: string;
}): Promise<{ session: StorySession; addedMessages: SessionMessage[] }> {
  const session: StorySession = {
    ...options.session,
    messages: [...options.session.messages],
  };

  const [allLocations, persona, gm, allCharacters] = await Promise.all([
    listLocations(),
    session.personaId ? getPersona(session.personaId) : Promise.resolve(null),
    getGameMaster(session.gameMasterId),
    listCharacters(),
  ]);

  let locationChain = resolveLocationChain(session.locationId, allLocations);
  let currentLocation = locationChain[locationChain.length - 1] ?? null;

  const partyCharacters = allCharacters.filter((c) => session.characterIds.includes(c.id));
  const getResidentsFor = (loc: Location | null): Character[] => {
    if (!loc || !Array.isArray(loc.residentIds)) return [];
    const partySet = new Set(session.characterIds);
    return allCharacters.filter((c) => loc.residentIds.includes(c.id) && !partySet.has(c.id));
  };

  let residentCharacters = getResidentsFor(currentLocation);
  let allPresent = [...partyCharacters, ...residentCharacters];

  const addedMessages: SessionMessage[] = [];
  const now = () => new Date().toISOString();

  const rawUserText = (options.userMessage ?? "").trim();
  const cleanUserText = rawUserText ? expandMacros(rawUserText, { userName: persona?.name }) : "";
  if (cleanUserText) {
    const userMsg: SessionMessage = {
      id: crypto.randomUUID(),
      kind: "user",
      speakerId: persona?.id,
      speakerName: persona?.name || "Du",
      portraitFile: persona?.portraitFile,
      content: cleanUserText,
      createdAt: now(),
    };
    session.messages.push(userMsg);
    addedMessages.push(userMsg);
  }

  // Direct nudge for a specific character (party or current location resident)
  if (options.forceCharacterId) {
    const target = allPresent.find((c) => c.id === options.forceCharacterId);
    if (!target) {
      throw new Error("Ausgewählter Charakter ist aktuell nicht anwesend.");
    }
    const reply = await generateCharacterReply(
      target,
      session,
      locationChain,
      allLocations,
      persona,
      partyCharacters,
      residentCharacters,
    );
    if (reply) {
      const msg: SessionMessage = {
        id: crypto.randomUUID(),
        kind: "character",
        speakerId: target.id,
        speakerName: target.name,
        portraitFile: target.portraitFile,
        content: reply,
        createdAt: now(),
      };
      session.messages.push(msg);
      addedMessages.push(msg);
    }
    const saved = await saveSession(session);
    return { session: saved, addedMessages };
  }

  // Autonomous Game Master orchestration
  const plan = await runGameMasterDirector(
    gm,
    session,
    locationChain,
    allLocations,
    persona,
    partyCharacters,
    residentCharacters,
    cleanUserText,
  );

  // Apply location transition if Game Master decided the party moved
  if (plan.nextLocationId && plan.nextLocationId !== session.locationId) {
    session.locationId = plan.nextLocationId;
    locationChain = resolveLocationChain(session.locationId, allLocations);
    currentLocation = locationChain[locationChain.length - 1] ?? null;
    residentCharacters = getResidentsFor(currentLocation);
    allPresent = [...partyCharacters, ...residentCharacters];
  }

  if (plan.narrationBefore?.trim()) {
    const narMsg: SessionMessage = {
      id: crypto.randomUUID(),
      kind: "narrator",
      speakerId: gm?.id,
      speakerName: gm?.name || "Spielleiter",
      content: plan.narrationBefore.trim(),
      createdAt: now(),
    };
    session.messages.push(narMsg);
    addedMessages.push(narMsg);
  }

  for (const speakerId of plan.speakers) {
    const char = allPresent.find((c) => c.id === speakerId);
    if (!char) continue;
    const reply = await generateCharacterReply(
      char,
      session,
      locationChain,
      allLocations,
      persona,
      partyCharacters,
      residentCharacters,
    );
    if (!reply) continue;
    const charMsg: SessionMessage = {
      id: crypto.randomUUID(),
      kind: "character",
      speakerId: char.id,
      speakerName: char.name,
      portraitFile: char.portraitFile,
      content: reply,
      createdAt: now(),
    };
    session.messages.push(charMsg);
    addedMessages.push(charMsg);
  }

  for (const extra of plan.extras) {
    const extraMsg: SessionMessage = {
      id: crypto.randomUUID(),
      kind: "character",
      speakerName: extra.role ? `${extra.name} (${extra.role})` : extra.name,
      content: extra.dialogue,
      createdAt: now(),
    };
    session.messages.push(extraMsg);
    addedMessages.push(extraMsg);
  }

  if (plan.narrationAfter?.trim()) {
    const narAfterMsg: SessionMessage = {
      id: crypto.randomUUID(),
      kind: "narrator",
      speakerId: gm?.id,
      speakerName: gm?.name || "Spielleiter",
      content: plan.narrationAfter.trim(),
      createdAt: now(),
    };
    session.messages.push(narAfterMsg);
    addedMessages.push(narAfterMsg);
  }

  if (plan.sceneStateUpdate?.trim()) {
    session.sceneState = plan.sceneStateUpdate.trim();
  }

  const saved = await saveSession(session);
  return { session: saved, addedMessages };
}
