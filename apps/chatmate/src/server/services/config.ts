/**
 * @project Sleipnir Stack / Chatmate
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

export interface ChatmateConfigFile {
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

let envLoaded = false;

function ensureEnvLoaded() {
  if (envLoaded) return;
  envLoaded = true;

  // Attempt to load .env from app directory, then from root workspace
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
      break;
    } catch {
      // Continue to next candidate
    }
  }
}

/**
 * Resolves placeholders like {{NAME}} from environment variables (Deno.env / process.env).
 * If no placeholder syntax is used, returns the value as is.
 */
export function resolveEnvValue(value?: string): string {
  if (!value) return "";
  ensureEnvLoaded();
  return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, envVarName) => {
    return Deno.env.get(envVarName) ?? "";
  });
}

/**
 * Loads and resolves providers from a JSON configuration file.
 */
export function loadProviderConfig(configPath?: string): ResolvedProvider[] {
  const path = configPath ||
    Deno.env.get("CHATMATE_CONFIG_PATH") ||
    new URL("../../../providers.json", import.meta.url).pathname;

  try {
    const raw = Deno.readTextFileSync(path);
    const parsed = JSON.parse(raw) as ChatmateConfigFile;

    if (!parsed || !Array.isArray(parsed.providers)) {
      return [];
    }

    return parsed.providers.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: resolveEnvValue(p.baseUrl).replace(/\/+$/, ""),
      apiKey: resolveEnvValue(p.apiKey),
      textModels: Array.isArray(p.textModels) ? p.textModels : [],
      imageModels: Array.isArray(p.imageModels) ? p.imageModels : [],
    }));
  } catch (error) {
    console.warn(`Could not load providers config from ${path}:`, error);
    return [];
  }
}
