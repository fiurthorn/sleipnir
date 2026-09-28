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

/**
 * Resolves placeholders like {{NAME}} from environment variables (Deno.env / process.env).
 * If no placeholder syntax is used, returns the value as is.
 */
export function resolveEnvValue(value?: string): string {
  if (!value) return "";
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
