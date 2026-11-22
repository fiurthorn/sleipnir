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
    return `<span class="badge badge-neutral">unknown</span>`;
  }

  const badges: string[] = [];
  if (ann.readOnlyHint) {
    badges.push(`<span class="badge badge-readonly">readOnly</span>`);
  } else if (ann.destructiveHint) {
    badges.push(`<span class="badge badge-destructive">destructive</span>`);
  } else {
    badges.push(`<span class="badge badge-write">write</span>`);
  }

  if (ann.idempotentHint) {
    badges.push(`<span class="badge badge-subtle">idempotent</span>`);
  }
  if (ann.openWorldHint) {
    badges.push(`<span class="badge badge-subtle">openWorld</span>`);
  }
  return badges.join("");
}

function renderToolParams(schema?: ListedTool["inputSchema"]): string {
  const props = schema?.properties;
  if (!props || Object.keys(props).length === 0) {
    return `<div class="params-empty">Keine Parameter erforderlich</div>`;
  }

  const required = new Set(schema.required ?? []);
  const rows = Object.entries(props).map(([name, meta]) => {
    const reqBadge = required.has(name) ? `<span class="req">required</span>` : `<span class="opt">optional</span>`;
    const typeText = escapeHtml(formatParamType(meta));
    const descText = meta.description ? escapeHtml(meta.description) : "";
    return `
      <div class="param-row">
        <div class="param-head">
          <code>${escapeHtml(name)}</code>
          <span class="param-type">${typeText}</span>
          ${reqBadge}
        </div>
        ${descText ? `<div class="param-desc">${descText}</div>` : ""}
      </div>
    `;
  });

  return `<div class="params">${rows.join("")}</div>`;
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
      <section class="card">
        <h2>Empfohlener Agent-Workflow</h2>
        <ol class="workflow">
          ${docs.workflowSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      </section>
    `
    : "";

  const toolsHtml = tools.map((tool) => `
    <article class="tool-card">
      <div class="tool-header">
        <code class="tool-name">${escapeHtml(tool.name)}</code>
        <div class="badges">${renderAnnotationBadges(tool.annotations)}</div>
      </div>
      ${tool.description ? `<p class="tool-desc">${escapeHtml(tool.description)}</p>` : ""}
      ${renderToolParams(tool.inputSchema)}
    </article>
  `).join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} · MCP Übersicht</title>
  <style>
    :root {
      --bg: #1e222a;
      --surface: #282c34;
      --surface-2: #21252b;
      --border: #3b4252;
      --text: #eceff4;
      --muted: #a3be8c;
      --sub: #9aa5b4;
      --accent: #88c0d0;
      --ro-bg: rgba(163, 190, 140, 0.16);
      --ro-fg: #a3be8c;
      --wr-bg: rgba(235, 203, 139, 0.16);
      --wr-fg: #ebcb8b;
      --del-bg: rgba(191, 97, 106, 0.18);
      --del-fg: #bf616a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container {
      max-width: 980px;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1rem;
    }
    h1 { margin: 0; font-size: 1.6rem; color: var(--accent); }
    h2 { margin: 0 0 0.75rem; font-size: 1.05rem; color: var(--text); }
    .subtitle { margin: 0.25rem 0 0; color: var(--sub); font-size: 0.95rem; }
    .meta-pills { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .pill {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.2rem 0.7rem;
      font-size: 0.78rem;
      color: var(--sub);
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.25rem;
    }
    pre {
      margin: 0.5rem 0 0;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.9rem;
      overflow-x: auto;
      font-size: 0.85rem;
      color: #d8dee9;
    }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .endpoint-box {
      display: inline-block;
      margin-top: 0.35rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.3rem 0.6rem;
      font-size: 0.88rem;
      color: var(--accent);
    }
    .workflow { margin: 0; padding-left: 1.25rem; color: #d8dee9; font-size: 0.92rem; }
    .workflow li { margin: 0.35rem 0; }
    .tools-grid { display: flex; flex-direction: column; gap: 0.85rem; }
    .tool-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.2rem;
    }
    .tool-header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .tool-name { font-size: 1rem; font-weight: 700; color: var(--accent); }
    .tool-desc { margin: 0.45rem 0 0.75rem; color: #d8dee9; font-size: 0.92rem; }
    .badges { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .badge {
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .badge-readonly { background: var(--ro-bg); color: var(--ro-fg); border: 1px solid rgba(163,190,140,0.35); }
    .badge-write { background: var(--wr-bg); color: var(--wr-fg); border: 1px solid rgba(235,203,139,0.35); }
    .badge-destructive { background: var(--del-bg); color: var(--del-fg); border: 1px solid rgba(191,97,106,0.4); }
    .badge-subtle, .badge-neutral { background: var(--surface-2); color: var(--sub); border: 1px solid var(--border); }
    .params {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      border-top: 1px solid var(--border);
      padding-top: 0.7rem;
    }
    .params-empty { font-size: 0.82rem; color: var(--sub); font-style: italic; }
    .param-row { font-size: 0.85rem; }
    .param-head { display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap; }
    .param-type { color: var(--sub); font-size: 0.78rem; }
    .req { color: #ebcb8b; font-size: 0.72rem; font-weight: 600; }
    .opt { color: var(--sub); font-size: 0.72rem; }
    .param-desc { color: var(--sub); margin-top: 0.1rem; padding-left: 0.25rem; }
    .legend { display: flex; gap: 0.75rem; flex-wrap: wrap; font-size: 0.82rem; color: var(--sub); align-items: center; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>${title}</h1>
        <p class="subtitle">${description}</p>
        <div class="endpoint-box"><code>${escapeHtml(endpointUrl)}</code></div>
      </div>
      <div class="meta-pills">
        <span class="pill">v${escapeHtml(serverVersion)}</span>
        <span class="pill">Streamable HTTP (Stateless)</span>
        <span class="pill">${tools.length} Tools</span>
      </div>
    </header>

    <section class="card">
      <h2>Client-Anbindung (Claude / Cursor / Antigravity / OpenCode)</h2>
      <p class="subtitle">Füge diesen Block in deine MCP-Client-Konfiguration ein (Transport: HTTP):</p>
      <pre><code>${escapeHtml(configSnippet)}</code></pre>
    </section>

    ${workflowHtml}

    <section class="legend">
      <span><strong>Legende:</strong></span>
      <span class="badge badge-readonly">readOnly</span><span>Liest nur Daten</span>
      <span class="badge badge-write">write</span><span>Legt an / verändert</span>
      <span class="badge badge-destructive">destructive</span><span>Löscht Daten</span>
      <span class="badge badge-subtle">idempotent</span><span>Mehrfachaufruf sicher</span>
    </section>

    <section class="tools-grid">
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
