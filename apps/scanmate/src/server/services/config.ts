/**
 * @project Sleipnir Stack / Scanmate
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
  visionModels?: ConfigModelItem[];
}

export interface ScanmateConfigFile {
  providers: ProviderConfig[];
}

export interface ResolvedProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  visionModels: ConfigModelItem[];
}

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

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

export function resolveEnvValue(value?: string): string {
  if (!value) return "";
  ensureEnvLoaded();
  return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, envVarName) => {
    return Deno.env.get(envVarName) ?? "";
  });
}

export function loadProviderConfig(configPath?: string): ResolvedProvider[] {
  const path = configPath ||
    Deno.env.get("SCANMATE_CONFIG_PATH") ||
    new URL("../../../providers.json", import.meta.url).pathname;

  try {
    const raw = Deno.readTextFileSync(path);
    const parsed = JSON.parse(raw) as ScanmateConfigFile;

    if (!parsed || !Array.isArray(parsed.providers)) {
      return [];
    }

    return parsed.providers.map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: p.baseUrl.replace(/\/+$/, ""),
      apiKey: resolveEnvValue(p.apiKey),
      visionModels: p.visionModels || [],
    }));
  } catch (err) {
    console.error("Fehler beim Laden von providers.json:", err);
    return [];
  }
}
