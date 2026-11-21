/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

export interface TagDefinition {
  tag: string;
  category: "Rezepte · Gang" | "Rezepte · Stil & Ernährung" | "Texte & Wissen";
}

/**
 * Controlled vocabulary of allowed tags for NoteMate (recipes & knowledge notes).
 */
export const ALLOWED_TAG_DEFINITIONS: readonly TagDefinition[] = [
  // Rezepte · Gang
  { tag: "Vorspeise", category: "Rezepte · Gang" },
  { tag: "Hauptgericht", category: "Rezepte · Gang" },
  { tag: "Beilage", category: "Rezepte · Gang" },
  { tag: "Dessert", category: "Rezepte · Gang" },
  { tag: "Suppe", category: "Rezepte · Gang" },
  { tag: "Salat", category: "Rezepte · Gang" },
  { tag: "Snack", category: "Rezepte · Gang" },
  { tag: "Frühstück", category: "Rezepte · Gang" },
  { tag: "Backen", category: "Rezepte · Gang" },
  { tag: "Getränk", category: "Rezepte · Gang" },
  // Rezepte · Stil & Ernährung
  { tag: "Vegetarisch", category: "Rezepte · Stil & Ernährung" },
  { tag: "Vegan", category: "Rezepte · Stil & Ernährung" },
  { tag: "Fleisch", category: "Rezepte · Stil & Ernährung" },
  { tag: "Fisch", category: "Rezepte · Stil & Ernährung" },
  { tag: "Pasta", category: "Rezepte · Stil & Ernährung" },
  { tag: "Asiatisch", category: "Rezepte · Stil & Ernährung" },
  { tag: "Mediterran", category: "Rezepte · Stil & Ernährung" },
  { tag: "Hausmannskost", category: "Rezepte · Stil & Ernährung" },
  { tag: "Schnell", category: "Rezepte · Stil & Ernährung" },
  { tag: "Mealprep", category: "Rezepte · Stil & Ernährung" },
  // Texte & Wissen
  { tag: "Rezept", category: "Texte & Wissen" },
  { tag: "HowTo", category: "Texte & Wissen" },
  { tag: "Geschichte", category: "Texte & Wissen" },
  { tag: "Notiz", category: "Texte & Wissen" },
  { tag: "Idee", category: "Texte & Wissen" },
  { tag: "Architektur", category: "Texte & Wissen" },
  { tag: "Referenz", category: "Texte & Wissen" },
  { tag: "Checkliste", category: "Texte & Wissen" },
  { tag: "Zusammenfassung", category: "Texte & Wissen" },
  { tag: "Projekt", category: "Texte & Wissen" },
  { tag: "nsfw", category: "Texte & Wissen" },
];

const CANONICAL_TAG_MAP = new Map<string, string>(
  ALLOWED_TAG_DEFINITIONS.map((def) => [def.tag.toLowerCase(), def.tag]),
);

/**
 * Validates and normalizes input tags against ALLOWED_TAG_DEFINITIONS (case-insensitive).
 * Throws an error if any unknown tag is provided.
 */
export function resolveAllowedTags(inputTags: string[]): string[] {
  const unknown: string[] = [];
  const resolved: string[] = [];

  for (const raw of inputTags) {
    const cleaned = cleanTagValue(raw);
    if (!cleaned) continue;
    const canonical = CANONICAL_TAG_MAP.get(cleaned.toLowerCase());
    if (!canonical) {
      unknown.push(cleaned);
      continue;
    }
    resolved.push(canonical);
  }

  if (unknown.length > 0) {
    throw new Error(
      `Unbekannte(r) Tag(s): ${unknown.join(", ")}. Bitte zuerst notemate_list_tags aufrufen und nur erlaubte Tags verwenden.`,
    );
  }

  return deduplicateTags(resolved);
}

function cleanTagValue(raw: string): string {
  return raw.trim().replace(/^['"]|['"]$/g, "").trim();
}

function deduplicateTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const cleaned = cleanTagValue(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

/**
 * Extracts tags from YAML frontmatter (`tags: [a, b]` or multi-line `- a`).
 */
export function extractTagsFromMarkdown(markdown: string): string[] {
  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) return [];

  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);
  const found: string[] = [];
  let inTagsBlock = false;

  for (const line of lines) {
    if (!inTagsBlock) {
      const inlineMatch = line.match(/^tags:\s*\[([^\]]*)\]\s*$/i);
      if (inlineMatch) {
        const items = inlineMatch[1].split(",").map(cleanTagValue).filter(Boolean);
        found.push(...items);
        continue;
      }

      if (/^tags:\s*$/i.test(line)) {
        inTagsBlock = true;
        continue;
      }

      const singleMatch = line.match(/^tags:\s+(.+)$/i);
      if (singleMatch) {
        found.push(cleanTagValue(singleMatch[1]));
      }
      continue;
    }

    const itemMatch = line.match(/^\s*-\s+(.+)$/);
    if (itemMatch) {
      found.push(cleanTagValue(itemMatch[1]));
      continue;
    }

    if (line.trim() === "") continue;
    break;
  }

  return deduplicateTags(found);
}

/**
 * Adds tags to the YAML frontmatter of a markdown document without clobbering existing fields or body.
 */
export function addTagsToMarkdown(
  markdown: string,
  newTags: string[],
): { content: string; tags: string[] } {
  const existingTags = extractTagsFromMarkdown(markdown);
  const mergedTags = deduplicateTags([...existingTags, ...newTags]);
  return writeTagsToMarkdown(markdown, mergedTags);
}

/**
 * Replaces the tags in the YAML frontmatter of a markdown document.
 */
export function setTagsInMarkdown(
  markdown: string,
  nextTags: string[],
): { content: string; tags: string[] } {
  const cleanTags = deduplicateTags(nextTags);
  return writeTagsToMarkdown(markdown, cleanTags);
}

function writeTagsToMarkdown(
  markdown: string,
  tags: string[],
): { content: string; tags: string[] } {
  const yamlTagsBlock = tags.length > 0 ? `tags:\n${tags.map((t) => `  - ${t}`).join("\n")}` : "tags: []";

  const match = markdown.match(FRONTMATTER_REGEX);
  if (!match) {
    const body = markdown.replace(/^\r?\n+/, "");
    return {
      content: `---\n${yamlTagsBlock}\n---\n\n${body}`,
      tags,
    };
  }

  const rawYaml = match[1];
  const body = markdown.slice(match[0].length);
  const lines = rawYaml.split(/\r?\n/);
  const filteredLines: string[] = [];
  let skippingTags = false;

  for (const line of lines) {
    if (!skippingTags) {
      if (/^tags:/i.test(line)) {
        skippingTags = true;
        continue;
      }
      filteredLines.push(line);
      continue;
    }

    if (/^\s*-\s+/.test(line) || line.trim() === "") {
      continue;
    }
    skippingTags = false;
    filteredLines.push(line);
  }

  const keptYaml = filteredLines.join("\n").trim();
  const nextYaml = keptYaml ? `${keptYaml}\n${yamlTagsBlock}` : yamlTagsBlock;

  return {
    content: `---\n${nextYaml}\n---\n${body}`,
    tags,
  };
}
