/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import prettier from "prettier";

/**
 * Formats markdown content including tables, lists, and spacing using Prettier.
 * Falls back to raw content if formatting fails (resilience).
 */
export async function formatMarkdown(rawMarkdown: string): Promise<string> {
  if (!rawMarkdown || !rawMarkdown.trim()) {
    return rawMarkdown;
  }

  try {
    const formatted = await prettier.format(rawMarkdown, {
      parser: "markdown",
      proseWrap: "preserve",
    });
    return formatted;
  } catch (error) {
    console.warn("Markdown formatting skipped due to parser warning:", error);
    return rawMarkdown;
  }
}
