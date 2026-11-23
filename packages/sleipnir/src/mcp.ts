/**
 * @project Sleipnir Stack / Core MCP
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Sleipnir, SleipnirContext } from "./sleipnir.ts";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { LOGO, LOGO_WORDMARK, LOGO_WORDMARK_LIGHT } from "./assets/icon.ts";
import { proxyRedirect, themeInit } from "./utils.ts";

export { McpServer, z };

/**
 * Standard MCP tool annotation presets for consistent client UX (approval prompts).
 */
export const MCP_ANNOTATIONS = {
  readOnly: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  write: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  writeIdempotent: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  destructive: {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
  },
} as const;

export interface McpTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * Formats arbitrary JSON-serializable data as an MCP text tool result.
 */
export function mcpJson(data: unknown): McpTextResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Formats an error message as an MCP error tool result.
 */
export function mcpError(message: string): McpTextResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

/**
 * Optional metadata for the human-readable HTML overview rendered on GET /mcp in browsers.
 */
export interface McpDocsOptions {
  title?: string;
  description?: string;
  workflowSteps?: string[];
  publicUrl?: string;
}

interface SchemaPropertyMeta {
  type?: string | string[];
  description?: string;
  default?: unknown;
  anyOf?: Array<{ type?: string }>;
  oneOf?: Array<{ type?: string }>;
}

interface ListedTool {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, SchemaPropertyMeta>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatParamType(meta: SchemaPropertyMeta): string {
  if (Array.isArray(meta.type)) {
    return meta.type.join(" | ");
  }
  if (typeof meta.type === "string" && meta.type) {
    return meta.type;
  }
  const union = meta.anyOf ?? meta.oneOf;
  if (Array.isArray(union) && union.length > 0) {
    const types = union.map((entry) => entry.type).filter((t): t is string => Boolean(t));
    if (types.length > 0) return types.join(" | ");
  }
  return "any";
}

function renderAnnotationBadges(ann?: ListedTool["annotations"]): string {
  if (!ann) {
    return `<span class="badge badge-xs badge-ghost uppercase font-mono">unknown</span>`;
  }

  const badges: string[] = [];
  if (ann.readOnlyHint) {
    badges.push(`<span class="badge badge-xs badge-success uppercase font-mono">readOnly</span>`);
  } else if (ann.destructiveHint) {
    badges.push(`<span class="badge badge-xs badge-error uppercase font-mono">destructive</span>`);
  } else {
    badges.push(`<span class="badge badge-xs badge-warning uppercase font-mono">write</span>`);
  }

  if (ann.idempotentHint) {
    badges.push(`<span class="badge badge-xs badge-outline uppercase font-mono opacity-75">idempotent</span>`);
  }
  if (ann.openWorldHint) {
    badges.push(`<span class="badge badge-xs badge-outline uppercase font-mono opacity-75">openWorld</span>`);
  }
  return badges.join("");
}

function renderToolParams(schema?: ListedTool["inputSchema"]): string {
  const props = schema?.properties;
  if (!props || Object.keys(props).length === 0) {
    return `<div class="text-xs opacity-60 italic border-t border-base-content/10 pt-3">Keine Parameter erforderlich</div>`;
  }

  const required = new Set(schema.required ?? []);
  const rows = Object.entries(props).map(([name, meta]) => {
    const reqBadge = required.has(name)
      ? `<span class="badge badge-xs badge-warning badge-outline font-mono">required</span>`
      : `<span class="badge badge-xs badge-ghost font-mono opacity-70">optional</span>`;
    const typeText = escapeHtml(formatParamType(meta));
    const descText = meta.description ? escapeHtml(meta.description) : "";
    return `
      <div class="text-xs flex flex-col gap-0.5">
        <div class="flex items-center gap-2 flex-wrap">
          <code class="font-mono font-semibold text-primary">${escapeHtml(name)}</code>
          <span class="opacity-60 font-mono text-[11px]">${typeText}</span>
          ${reqBadge}
        </div>
        ${descText ? `<div class="opacity-75 pl-0.5">${descText}</div>` : ""}
      </div>
    `;
  });

  return `<div class="flex flex-col gap-2.5 border-t border-base-content/10 pt-3">${rows.join("")}</div>`;
}

function renderMcpOverviewHtml(
  endpointUrl: string,
  serverName: string,
  serverVersion: string,
  tools: ListedTool[],
  docs?: McpDocsOptions,
): string {
  const title = escapeHtml(docs?.title || `${serverName} MCP`);
  const description = escapeHtml(
    docs?.description || "Streamable-HTTP Model Context Protocol Endpoint für Agent-Integrationen.",
  );
  const clientKey = serverName.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "mcp-server";
  const configSnippet = JSON.stringify(
    {
      mcpServers: {
        [clientKey]: {
          url: endpointUrl,
        },
      },
    },
    null,
    2,
  );

  const workflowHtml = docs?.workflowSteps && docs.workflowSteps.length > 0
    ? `
      <section class="card bg-base-100 border border-base-content/10 shadow-sm">
        <div class="card-body p-5 gap-2">
          <h2 class="card-title text-base">Empfohlener Agent-Workflow</h2>
          <ol class="list-decimal pl-5 space-y-1.5 text-sm opacity-90">
            ${docs.workflowSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
          </ol>
        </div>
      </section>
    `
    : "";

  const toolsHtml = tools.map((tool) => `
    <article class="card bg-base-100 border border-base-content/10 shadow-sm">
      <div class="card-body p-5 gap-3">
        <div class="flex flex-wrap justify-between items-center gap-2">
          <code class="text-base font-bold font-mono text-primary">${escapeHtml(tool.name)}</code>
          <div class="flex gap-1.5 flex-wrap">${renderAnnotationBadges(tool.annotations)}</div>
        </div>
        ${tool.description ? `<p class="text-sm opacity-85">${escapeHtml(tool.description)}</p>` : ""}
        ${renderToolParams(tool.inputSchema)}
      </div>
    </article>
  `).join("");

  return `<!DOCTYPE html>
<html data-theme="corvus" lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/svg+xml" href="${LOGO}" />
  <link href="./static/styles.css" rel="stylesheet" />
  <script defer src="./static/sleipnir-client.min.js"></script>
  <script defer src="./static/vendor/alpine.min.js"></script>
  <script>(${proxyRedirect})();(${themeInit})();</script>
  <title>${title} · MCP Übersicht</title>
</head>
<body class="bg-base-200 text-base-content min-h-screen antialiased">
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
    <header class="flex flex-wrap justify-between items-start gap-4 border-b border-base-content/15 pb-5">
      <div class="flex flex-col gap-1.5">
        <img
          src="${LOGO_WORDMARK}"
          alt="fiurthorn"
          class="h-9 w-auto self-start mb-1"
          x-data
          x-show="$store.theme.mode === 'dark'"
          style="display: none;"
        />
        <img
          src="${LOGO_WORDMARK_LIGHT}"
          alt="fiurthorn"
          class="h-9 w-auto self-start mb-1"
          x-data
          x-show="$store.theme.mode !== 'dark'"
        />
        <h1 class="text-2xl font-black text-primary tracking-tight">${title}</h1>
        <p class="text-sm opacity-75">${description}</p>
        <div class="mt-1">
          <code class="inline-block bg-base-100 border border-base-content/15 rounded-md px-2.5 py-1 text-xs font-mono text-primary">${
    escapeHtml(endpointUrl)
  }</code>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="badge badge-outline font-mono text-xs">v${escapeHtml(serverVersion)}</span>
        <span class="badge badge-outline font-mono text-xs">Streamable HTTP</span>
        <span class="badge badge-primary font-mono text-xs">${tools.length} Tools</span>
        <button
          type="button"
          x-data
          x-on:click="$store.theme.toggle()"
          class="btn btn-ghost btn-sm btn-circle opacity-80 hover:opacity-100"
          title="Theme wechseln (Hell / Dunkel)"
          aria-label="Theme wechseln"
        >
          <span x-show="$store.theme.mode === 'dark'" style="display: none;">☀️</span>
          <span x-show="$store.theme.mode !== 'dark'">🌙</span>
        </button>
      </div>
    </header>

    <section class="card bg-base-100 border border-base-content/10 shadow-sm">
      <div class="card-body p-5 gap-2">
        <h2 class="card-title text-base">Client-Anbindung (Claude / Cursor / Antigravity / OpenCode)</h2>
        <p class="text-xs opacity-70">Füge diesen Block in deine MCP-Client-Konfiguration ein (Transport: HTTP):</p>
        <pre class="bg-base-300/70 border border-base-content/10 rounded-lg p-3.5 overflow-x-auto text-xs font-mono"><code>${
    escapeHtml(configSnippet)
  }</code></pre>
      </div>
    </section>

    ${workflowHtml}

    <section class="flex gap-3 flex-wrap text-xs opacity-80 items-center px-1">
      <span class="font-bold">Legende:</span>
      <span class="badge badge-xs badge-success uppercase font-mono">readOnly</span><span>Liest nur Daten</span>
      <span class="badge badge-xs badge-warning uppercase font-mono">write</span><span>Legt an / verändert</span>
      <span class="badge badge-xs badge-error uppercase font-mono">destructive</span><span>Löscht Daten</span>
      <span class="badge badge-xs badge-outline uppercase font-mono">idempotent</span><span>Mehrfachaufruf sicher</span>
    </section>

    <section class="flex flex-col gap-3.5">
      ${toolsHtml}
    </section>
  </div>
</body>
</html>`;
}

/**
 * Mounts a stateless Streamable-HTTP MCP endpoint on the given Sleipnir/Hono app.
 * On browser GET requests (Accept: text/html), renders an auto-generated HTML overview
 * with setup instructions and all registered tools + their annotations.
 */
async function queryMcpOnce<T>(
  createServer: (c: SleipnirContext) => McpServer,
  c: SleipnirContext,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServer(c);
  await server.connect(transport);
  const res = await transport.handleRequest(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
  );
  return (await res.json()) as T;
}

/**
 * Mounts a stateless Streamable-HTTP MCP endpoint on the given Sleipnir/Hono app.
 * On browser GET requests (Accept: text/html), renders an auto-generated HTML overview
 * with setup instructions and all registered tools + their annotations.
 */
export function mountMcp(
  app: Sleipnir,
  createServer: (c: SleipnirContext) => McpServer,
  path?: string,
  docs?: McpDocsOptions,
): void {
  const routePath = path ?? "/mcp";

  app.all(routePath, async (c: SleipnirContext) => {
    try {
      const isBrowserGet = c.req.method === "GET" &&
        (c.req.header("accept") || "").includes("text/html") &&
        !c.req.header("mcp-session-id");

      if (isBrowserGet) {
        const [listJson, initJson] = await Promise.all([
          queryMcpOnce<{ result?: { tools?: ListedTool[] } }>(createServer, c, "tools/list", {}),
          queryMcpOnce<{ result?: { serverInfo?: { name?: string; version?: string } } }>(
            createServer,
            c,
            "initialize",
            {
              protocolVersion: "2025-03-26",
              capabilities: {},
              clientInfo: { name: "mcp-browser-docs", version: "1.0.0" },
            },
          ),
        ]);

        const reqUrl = new URL(c.req.url);
        const endpointUrl = docs?.publicUrl || `${reqUrl.origin}${reqUrl.pathname}`;
        const serverName = initJson.result?.serverInfo?.name || "mcp";
        const serverVersion = initJson.result?.serverInfo?.version || "1.0.0";
        const tools = listJson.result?.tools ?? [];

        return c.html(renderMcpOverviewHtml(endpointUrl, serverName, serverVersion, tools, docs));
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      const server = createServer(c);
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "MCP transport error";
      console.error(`[MCP] Error on ${routePath}:`, err);
      return c.json(
        {
          jsonrpc: "2.0",
          error: { code: -32603, message: msg },
          id: null,
        },
        500,
      );
    }
  });
}
