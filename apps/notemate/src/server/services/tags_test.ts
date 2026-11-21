/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals, assertThrows } from "@std/assert";
import { addTagsToMarkdown, extractTagsFromMarkdown, resolveAllowedTags, setTagsInMarkdown } from "./tags.ts";

Deno.test("extractTagsFromMarkdown - parses inline and multiline YAML frontmatter tags", () => {
  const inline = "---\ntitle: Pasta\ntags: [Pasta, Schnell]\n---\n\n# Pasta";
  assertEquals(extractTagsFromMarkdown(inline), ["Pasta", "Schnell"]);

  const multi = "---\ntags:\n  - Vegetarisch\n  - Italienisch\n---\n\nText";
  assertEquals(extractTagsFromMarkdown(multi), ["Vegetarisch", "Italienisch"]);

  assertEquals(extractTagsFromMarkdown("# Ohne Frontmatter"), []);
});

Deno.test("addTagsToMarkdown - creates frontmatter when missing", () => {
  const res = addTagsToMarkdown("# Tomatensuppe\n\nZutaten...", ["Suppe", "Vegan", "suppe"]);
  assertEquals(res.tags, ["Suppe", "Vegan"]);
  assertEquals(extractTagsFromMarkdown(res.content), ["Suppe", "Vegan"]);
  assertEquals(res.content.includes("# Tomatensuppe"), true);
});

Deno.test("addTagsToMarkdown - preserves existing frontmatter fields and merges tags", () => {
  const md = "---\ntitle: Curry\nauthor: Stefan\ntags:\n  - Scharf\n---\n\n# Curry";
  const res = addTagsToMarkdown(md, ["Asiatisch", "scharf"]);
  assertEquals(res.tags, ["Scharf", "Asiatisch"]);
  assertEquals(res.content.includes("title: Curry"), true);
  assertEquals(res.content.includes("author: Stefan"), true);
  assertEquals(extractTagsFromMarkdown(res.content), ["Scharf", "Asiatisch"]);
});

Deno.test("resolveAllowedTags - normalizes allowed tags and rejects unknown tags", () => {
  assertEquals(resolveAllowedTags(["vorspeise", "howto", "NSFW", "Vorspeise"]), [
    "Vorspeise",
    "HowTo",
    "nsfw",
  ]);
  assertThrows(() => resolveAllowedTags(["Vorspeise", "WilderEigenbauTag"]));
});

Deno.test("setTagsInMarkdown - replaces and clears frontmatter tags", () => {
  const md = "---\ntitle: Notiz\ntags:\n  - Idee\n  - nsfw\n---\n\n# Inhalt";
  const updated = setTagsInMarkdown(md, ["Projekt"]);
  assertEquals(updated.tags, ["Projekt"]);
  assertEquals(extractTagsFromMarkdown(updated.content), ["Projekt"]);
  assertEquals(updated.content.includes("title: Notiz"), true);

  const cleared = setTagsInMarkdown(updated.content, []);
  assertEquals(cleared.tags, []);
  assertEquals(extractTagsFromMarkdown(cleared.content), []);
});
