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
import { getGameMaster, getLocation, getPersona, listCharacters, saveSession } from "./storage.ts";
import type { Character, GameMaster, Location, Persona, SessionMessage, StorySession } from "./types.ts";

const directorPlanSchema = z.object({
  narrationBefore: z
    .string()
    .optional()
    .describe("Optionaler kurzer Erzähler-/Umgebungseinschub vor den Charakter-Antworten (nur wenn etwas passiert)"),
  speakers: z
    .array(z.string())
    .default([])
    .describe("Liste der exakten IDs der Charaktere, die in diesem Zug wirklich reagieren sollten (0 bis 3 IDs)"),
  narrationAfter: z
    .string()
    .optional()
    .describe("Optionaler kurzer Abschluss-Hinweis des Spielleiters falls die Szene sich danach weiterentwickelt"),
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

function buildContextHeader(
  location: Location | null,
  persona: Persona | null,
  characters: Character[],
  sceneState: string,
): string {
  const parts: string[] = [];
  if (location) {
    parts.push(
      `ORT: ${location.name}\nBeschreibung: ${location.description}\nAtmosphäre: ${location.atmosphere}${
        location.details ? `\nDetails: ${location.details}` : ""
      }`,
    );
  }
  if (persona) {
    parts.push(
      `SPIELER-PERSONA: ${persona.name}${persona.role ? ` (${persona.role})` : ""}${persona.traits ? ` | Eigenschaften: ${persona.traits}` : ""}${
        persona.appearance ? ` | Aussehen: ${persona.appearance}` : ""
      }`,
    );
  }
  if (characters.length > 0) {
    const charLines = characters.map((c) =>
      `- [${c.id}] ${c.name}${c.role ? ` (${c.role})` : ""}: Persönlichkeit=${c.personality || "—"}; Ziele=${c.goals || "—"}; Stil=${
        c.speechStyle || "natürlich"
      }`
    );
    parts.push(`ANWESENDE CHARAKTERE:\n${charLines.join("\n")}`);
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
  location: Location | null,
  persona: Persona | null,
  characters: Character[],
  userText: string,
): Promise<z.infer<typeof directorPlanSchema>> {
  if (characters.length === 0) {
    return { speakers: [] };
  }

  const model = resolveTextModel(gm?.modelId || session.modelId);
  const contextBlock = buildContextHeader(location, persona, characters, session.sceneState);
  const historyBlock = formatHistoryForPrompt(session.messages);

  const systemPrompt = [
    gm?.systemPrompt ||
    "Du bist ein neutraler, aufmerksamer Spielleiter einer interaktiven Geschichte.",
    "Deine Aufgabe als Regisseur:",
    "1. Entscheide autark, welche anwesenden Charaktere auf die aktuelle Situation wirklich reagieren (0, 1 oder 2 – NICHT stumpf alle der Reihe nach!).",
    "2. Wenn ein Charakter direkt angesprochen/erwähnt wird, gehört seine ID in `speakers`.",
    "3. Füge `narrationBefore` oder `narrationAfter` nur hinzu, wenn die Umgebung, ein Ereignis oder eine Konsequenz beschrieben werden muss (knapp, 1-3 Sätze).",
    "4. Nutze in `speakers` ausschließlich exakte IDs aus `ANWESENDE CHARAKTERE`.",
  ].join("\n");

  const prompt = [
    contextBlock,
    `BISHERIGER VERLAUF:\n${historyBlock}`,
    userText ? `NEUE AKTION DES SPIELERS: ${userText}` : "Der Spieler lässt die Szene ohne eigene Aktion weiterlaufen.",
  ].join("\n\n");

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      output: Output.object({ schema: directorPlanSchema }),
      prompt,
    });

    const validIds = new Set(characters.map((c) => c.id));
    const filteredSpeakers = (result.output.speakers ?? [])
      .filter((id) => validIds.has(id))
      .slice(0, 3);

    return {
      ...result.output,
      speakers: filteredSpeakers,
    };
  } catch {
    // Fallback: reply with mentioned characters or the first character in the scene
    const mentioned = detectMentionedCharacters(userText, characters);
    return {
      speakers: mentioned.length > 0 ? mentioned.slice(0, 2) : [characters[0].id],
    };
  }
}

async function generateCharacterReply(
  char: Character,
  session: StorySession,
  location: Location | null,
  persona: Persona | null,
  allCharacters: Character[],
): Promise<string> {
  const model = resolveTextModel(char.modelId || session.modelId);
  const contextBlock = buildContextHeader(location, persona, allCharacters, session.sceneState);
  const historyBlock = formatHistoryForPrompt(session.messages);

  const systemPrompt = [
    `Du spielst ausschließlich die Rolle von "${char.name}".`,
    char.role ? `Rolle: ${char.role}` : "",
    char.appearance ? `Aussehen: ${char.appearance}` : "",
    char.personality ? `Charakterzüge & Persönlichkeit: ${char.personality}` : "",
    char.goals ? `Ziele & Motivation: ${char.goals}` : "",
    char.speechStyle ? `Sprechstil: ${char.speechStyle}` : "",
    "Regeln: Antworte auf Deutsch direkt aus der Perspektive von " + char.name +
    " (Dialog und kurze Handlungen/Gesten, z. B. *sieht sich um*). Sprich niemals für den Spieler oder andere Charaktere. Beginne deine Antwort nicht mit deinem eigenen Namen.",
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = [
    contextBlock,
    `BISHERIGER VERLAUF:\n${historyBlock}`,
    `Wie reagiert ${char.name} jetzt?`,
  ].join("\n\n");

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt,
  });

  return result.text.trim();
}

/**
 * Executes a full group-chat turn: optional user message, Game Master orchestration,
 * and replies from the selected characters (or a single forced speaker).
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

  const [location, persona, gm, allCharacters] = await Promise.all([
    getLocation(session.locationId),
    session.personaId ? getPersona(session.personaId) : Promise.resolve(null),
    getGameMaster(session.gameMasterId),
    listCharacters(),
  ]);

  const activeCharacters = allCharacters.filter((c) => session.characterIds.includes(c.id));
  const addedMessages: SessionMessage[] = [];
  const now = () => new Date().toISOString();

  const cleanUserText = (options.userMessage ?? "").trim();
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

  // Direct nudge for a specific character
  if (options.forceCharacterId) {
    const target = activeCharacters.find((c) => c.id === options.forceCharacterId);
    if (!target) {
      throw new Error("Ausgewählter Charakter ist nicht in dieser Szene.");
    }
    const reply = await generateCharacterReply(target, session, location, persona, activeCharacters);
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
    location,
    persona,
    activeCharacters,
    cleanUserText,
  );

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
    const char = activeCharacters.find((c) => c.id === speakerId);
    if (!char) continue;
    const reply = await generateCharacterReply(char, session, location, persona, activeCharacters);
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
