/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";
import type { ResolvedMcpServer } from "./config.ts";

export interface McpServerStatus {
  id: string;
  name: string;
  url: string;
  connected: boolean;
  toolCount: number;
  error?: string;
}

export interface ConnectedMcpPool {
  tools: ToolSet;
  statuses: McpServerStatus[];
  clients: Map<string, MCPClient>;
  closeAll: () => Promise<void>;
}

/**
 * Connects to all configured HTTP MCP servers and aggregates their AI SDK tools.
 * Unreachable servers are recorded in `statuses` without failing the whole pool.
 */
export async function connectMcpPool(servers: ResolvedMcpServer[]): Promise<ConnectedMcpPool> {
  const tools: ToolSet = {};
  const statuses: McpServerStatus[] = [];
  const clients = new Map<string, MCPClient>();

  await Promise.all(
    servers.map(async (server) => {
      try {
        const client = await createMCPClient({
          transport: {
            type: "http",
            url: server.url,
          },
        });
        const serverTools = await client.tools();
        const toolNames = Object.keys(serverTools);
        for (const name of toolNames) {
          tools[name] = serverTools[name];
        }
        clients.set(server.id, client);
        statuses.push({
          id: server.id,
          name: server.name,
          url: server.url,
          connected: true,
          toolCount: toolNames.length,
        });
      } catch (err) {
        statuses.push({
          id: server.id,
          name: server.name,
          url: server.url,
          connected: false,
          toolCount: 0,
          error: err instanceof Error ? err.message : "Connection failed",
        });
      }
    }),
  );

  const closeAll = async (): Promise<void> => {
    await Promise.all(
      Array.from(clients.values()).map(async (client) => {
        try {
          await client.close();
        } catch {
          // Ignore close errors
        }
      }),
    );
  };

  return { tools, statuses, clients, closeAll };
}

export interface McpContentPart {
  type?: string;
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpCallResult {
  content?: McpContentPart[];
  isError?: boolean;
}

/**
 * Executes a specific MCP tool directly on the toolset and returns its raw MCP content.
 */
export async function invokeMcpTool(
  tools: ToolSet,
  toolName: string,
  args: Record<string, unknown>,
): Promise<McpCallResult> {
  const tool = tools[toolName];
  if (!tool || typeof tool.execute !== "function") {
    throw new Error(`MCP tool '${toolName}' is not available`);
  }

  const result = await tool.execute(args, {
    toolCallId: crypto.randomUUID(),
    messages: [],
  });

  return result as McpCallResult;
}

/**
 * Parses the first JSON text block from an MCP tool result.
 */
export function parseMcpJsonText<T>(result: McpCallResult): T {
  if (result.isError) {
    const errText = result.content?.find((p) => p.type === "text")?.text ?? "MCP tool error";
    throw new Error(errText);
  }
  const textPart = result.content?.find((p) => p.type === "text" && typeof p.text === "string");
  if (!textPart?.text) {
    throw new Error("MCP tool returned no text payload");
  }
  return JSON.parse(textPart.text) as T;
}
