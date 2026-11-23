/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { SleipnirContext } from "@sleipnir/core";
import { assets, cors, hsts, Sleipnir, VERSION } from "@sleipnir/core";
import { mountMcp } from "@sleipnir/core/mcp";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { Index } from "../pages/Index.tsx";
import { MiniScanPage } from "../pages/MiniScan.tsx";
import { ScanPage } from "../pages/Scan.tsx";
import { SessionScanPage } from "../pages/SessionScan.tsx";
import { api as documentsApi } from "./api/documents.ts";
import { createScanmateMcpServer } from "./mcp.ts";

export default function App(basePath?: string, developMode: boolean = false) {
  console.log(
    `Starting Scanmate with basePath: ${basePath ?? "none"} as ${developMode ? "development" : "production"} mode`,
  );

  const app = new Sleipnir().basePath(basePath ?? "");

  app.use("*", hsts());
  app.use("*", compress());
  app.use("*", cors());
  app.use(
    "*",
    secureHeaders({
      xFrameOptions: false,
      crossOriginResourcePolicy: false,
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
        frameSrc: ["'self'", "blob:", "data:"],
        objectSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
      },
    }),
  );

  // Main UI
  const rootHandler = (c: SleipnirContext) =>
    c.html(
      <Index
        basePath={basePath}
        content={<ScanPage basePath={basePath ?? ""} />}
      />,
    );
  app.get("/", rootHandler);
  app.get("", rootHandler);

  // Mini-Scan-Client (Agent-Inbox ohne OpenAI-Anbindung)
  app.get("/mini", (c: SleipnirContext) =>
    c.html(
      <Index
        title="Scanmate Mini | Agent-Inbox"
        basePath={basePath}
        content={<MiniScanPage />}
      />,
    ));

  // Zeitlich begrenzte Scan-Session (10-Min-Link & QR-Code mit vollem Trimming-Scanner)
  app.get("/scan/:token", (c: SleipnirContext) => {
    const token = c.req.param("token") ?? "";
    const rootHref = basePath ? `${basePath.replace(/\/$/, "")}/` : "/";
    return c.html(
      <Index
        title="Scanmate | Agent Scan-Session"
        basePath={rootHref}
        content={<SessionScanPage token={token} />}
      />,
    );
  });

  // Documents API
  app.route("/api", documentsApi);

  // MCP Endpoint (Streamable HTTP) - nutzt die Request-Origin für Tailscale-kompatible QR-Links
  mountMcp(
    app,
    (c: SleipnirContext) => {
      const reqUrl = new URL(c.req.url);
      const configuredBase = Deno.env.get("SCANMATE_PUBLIC_URL");
      const prefix = basePath ? basePath.replace(/\/$/, "") : "";
      const publicBaseUrl = configuredBase || `${reqUrl.origin}${prefix}`;
      return createScanmateMcpServer(publicBaseUrl);
    },
    "/mcp",
    {
      title: "ScanMate MCP",
      description: "Dokumenten-Scanner, Agent-Inbox (10-Min-QR-Sessions) & PDF-Archiv über Model Context Protocol.",
      workflowSteps: [
        "Agent mit scanmate_create_scan_session aufrufen → erzeugt einen 10 Min. gültigen Scan-Link + QR-Code.",
        "Link am Desktop oder per QR-Code am Handy öffnen, Seiten scannen, zuschneiden (Trimming/Filter) und an die Agent-Inbox senden.",
        "Agent holt Bilder per scanmate_get_pending_images, analysiert/extrahiert Metadaten & OCR-Text und legt per scanmate_archive_pending im Archiv ab.",
      ],
    },
  );

  // Static Assets
  assets(app, basePath, VERSION, "./apps/scanmate", developMode);

  return app;
}
