/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export interface AgentModelItem {
  id: string;
  name: string;
}

export interface AgentProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: AgentModelItem[];
}

export interface McpServerConfig {
  id: string;
  name: string;
  url?: string;
  defaultUrl: string;
}

export interface AgentmateConfigFile {
  providers: AgentProviderConfig[];
  mcpServers: McpServerConfig[];
}

export interface ResolvedAgentProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: AgentModelItem[];
}

export interface ResolvedMcpServer {
  id: string;
  name: string;
  url: string;
}

export interface AgentConfig {
  providers: ResolvedAgentProvider[];
  mcpServers: ResolvedMcpServer[];
}

let envLoaded = false;

function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  // Load .env from agentmate, fallback to chatmate/.env and workspace root .env
  const candidates = [
    new URL("../../../.env", import.meta.url).pathname,
    new URL("../../../../chatmate/.env", import.meta.url).pathname,
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
 * Resolves {{ENV_VAR}} placeholders using Deno.env (with .env fallback).
 */
export function resolveEnvValue(value?: string): string {
  if (!value) return "";
  ensureEnvLoaded();
  return value.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, envVarName: string) => {
    return Deno.env.get(envVarName) ?? "";
  });
}

/**
 * Loads provider and MCP server configuration from providers.json.
 */
export function loadAgentConfig(configPath?: string): AgentConfig {
  const path = configPath ||
    Deno.env.get("AGENTMATE_CONFIG_PATH") ||
    new URL("../../../providers.json", import.meta.url).pathname;

  try {
    const raw = Deno.readTextFileSync(path);
    const parsed = JSON.parse(raw) as AgentmateConfigFile;

    const providers: ResolvedAgentProvider[] = Array.isArray(parsed.providers)
      ? parsed.providers.map((p) => ({
        id: p.id,
        name: p.name,
        baseUrl: resolveEnvValue(p.baseUrl),
        apiKey: resolveEnvValue(p.apiKey),
        models: Array.isArray(p.models) ? p.models : [],
      }))
      : [];

    const mcpServers: ResolvedMcpServer[] = Array.isArray(parsed.mcpServers)
      ? parsed.mcpServers.map((s) => {
        const resolvedUrl = resolveEnvValue(s.url);
        return {
          id: s.id,
          name: s.name,
          url: resolvedUrl || s.defaultUrl,
        };
      })
      : [];

    return { providers, mcpServers };
  } catch (err) {
    console.warn(`[Agentmate] Failed to load config at ${path}:`, err);
    return { providers: [], mcpServers: [] };
  }
}
