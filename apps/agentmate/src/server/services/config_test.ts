/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { loadAgentConfig, resolveEnvValue } from "./config.ts";

Deno.test("resolveEnvValue - resolves {{VAR}} from Deno.env", () => {
  Deno.env.set("AGENTMATE_TEST_VAR", "secret-123");
  try {
    assertEquals(resolveEnvValue("{{AGENTMATE_TEST_VAR}}"), "secret-123");
    assertEquals(resolveEnvValue("https://openrouter.ai/api/v1"), "https://openrouter.ai/api/v1");
  } finally {
    Deno.env.delete("AGENTMATE_TEST_VAR");
  }
});

Deno.test("loadAgentConfig - loads default openrouter and mcpServers", () => {
  const config = loadAgentConfig();
  assertEquals(config.providers.length >= 1, true);
  assertEquals(config.providers[0].id, "openrouter");
  assertEquals(config.providers[0].models[0].id, "google/gemma-4-31b-it");
  assertEquals(config.mcpServers.some((s) => s.id === "scanmate"), true);
  assertEquals(config.mcpServers.some((s) => s.id === "notemate"), true);
});
