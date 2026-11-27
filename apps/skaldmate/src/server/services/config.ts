/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export interface ConfigModelItem {
  id: string;
  name: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  textModels?: ConfigModelItem[];
  imageModels?: ConfigModelItem[];
}

export interface SkaldConfigFile {
  providers: ProviderConfig[];
}

export interface ResolvedProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  textModels: ConfigModelItem[];
  imageModels: ConfigModelItem[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerName: string;
  type: "text" | "image";
}

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  // Load .env from skaldmate, fallback to workspace root .env (entkoppelt von anderen Apps)
  const candidates = [
    new URL("../../../.env", import.meta.url).pathname,
    new URL("../../../../../.env", import.meta.url).pathname,
  ];

  for (const envPath of candidates) {
    try {
      const content = Deno.readTextFileSync(envPath);
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!Deno.env.get(key)) {
          Deno.env.set(key, val);
        }
      }
    } catch {
      // Continue to next candidate
    }
  }
}

/**
 * Resolves {{ENV_VAR}} placeholders from Deno.env (with .env fallback).
 */
export function resolveEnvValue(value?: string): string {
  if (!value) return "";
  ensureEnvLoaded();
  return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, envVarName: string) => {
    return Deno.env.get(envVarName) ?? "";
  });
}

/**
 * Loads provider configuration from providers.json.
 */
export function loadProviderConfig(configPath?: string): ResolvedProvider[] {
  const path = configPath ||
    Deno.env.get("SKALDMATE_CONFIG_PATH") ||
    new URL("../../../providers.json", import.meta.url).pathname;

  try {
    const raw = Deno.readTextFileSync(path);
    const parsed = JSON.parse(raw) as SkaldConfigFile;
    if (!parsed || !Array.isArray(parsed.providers)) return [];

    return parsed.providers.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: resolveEnvValue(p.baseUrl),
      apiKey: resolveEnvValue(p.apiKey),
      textModels: Array.isArray(p.textModels) ? p.textModels : [],
      imageModels: Array.isArray(p.imageModels) ? p.imageModels : [],
    }));
  } catch (err) {
    console.warn(`[Skaldmate] Failed to load config at ${path}:`, err);
    return [];
  }
}

/**
 * Returns flattened list of configured text and image models for ready providers.
 */
export function getAvailableModels(): ModelInfo[] {
  const providers = loadProviderConfig();
  const models: ModelInfo[] = [];

  for (const p of providers) {
    if (!p.apiKey) continue;
    for (const m of p.textModels) {
      models.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        provider: p.id,
        providerName: p.name,
        type: "text",
      });
    }
    for (const m of p.imageModels) {
      models.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        provider: p.id,
        providerName: p.name,
        type: "image",
      });
    }
  }

  return models;
}
