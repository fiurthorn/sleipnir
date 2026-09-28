/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { loadProviderConfig, resolveEnvValue } from "./config.ts";

Deno.test("resolveEnvValue - correctly resolves {{VAR}} and leaves raw text", () => {
  Deno.env.set("TEST_SECRET_KEY", "sk-12345");
  try {
    assertEquals(resolveEnvValue("{{TEST_SECRET_KEY}}"), "sk-12345");
    assertEquals(
      resolveEnvValue("Bearer {{TEST_SECRET_KEY}}"),
      "Bearer sk-12345",
    );
    assertEquals(resolveEnvValue("static-value"), "static-value");
    assertEquals(resolveEnvValue("{{NON_EXISTENT_VAR}}"), "");
    assertEquals(resolveEnvValue(undefined), "");
  } finally {
    Deno.env.delete("TEST_SECRET_KEY");
  }
});

Deno.test("loadProviderConfig - parses and resolves config file", async () => {
  const tempDir = await Deno.makeTempDir();
  const configPath = `${tempDir}/providers.json`;
  Deno.env.set("TEST_OPENROUTER_KEY", "sk-openrouter-secret");

  try {
    const fakeConfig = {
      providers: [
        {
          id: "custom-provider",
          name: "Custom AI Provider",
          baseUrl: "https://api.custom.ai/v1/",
          apiKey: "{{TEST_OPENROUTER_KEY}}",
          textModels: [
            { id: "custom-model-1", name: "Custom 1" },
          ],
          imageModels: [
            { id: "custom-img-1", name: "Custom Image 1" },
          ],
        },
      ],
    };

    await Deno.writeTextFile(configPath, JSON.stringify(fakeConfig, null, 2));

    const providers = loadProviderConfig(configPath);
    assertEquals(providers.length, 1);
    assertEquals(providers[0].id, "custom-provider");
    assertEquals(providers[0].name, "Custom AI Provider");
    assertEquals(providers[0].baseUrl, "https://api.custom.ai/v1"); // trailing slash removed
    assertEquals(providers[0].apiKey, "sk-openrouter-secret");
    assertEquals(providers[0].textModels.length, 1);
    assertEquals(providers[0].textModels[0].id, "custom-model-1");
    assertEquals(providers[0].imageModels.length, 1);
    assertEquals(providers[0].imageModels[0].id, "custom-img-1");
  } finally {
    Deno.env.delete("TEST_OPENROUTER_KEY");
    await Deno.remove(tempDir, { recursive: true });
  }
});
