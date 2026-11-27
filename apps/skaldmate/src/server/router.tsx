/**
 * @project Sleipnir Stack / Skaldmate
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
import { SkaldPage } from "../pages/SkaldPage.tsx";
import { skaldApi } from "./api/skald.ts";
import { createSkaldmateMcpServer } from "./mcp.ts";

export default function App(basePath?: string, developMode: boolean = false) {
  console.log(
    `Starting Skaldmate with basePath: ${basePath ?? "none"} as ${developMode ? "development" : "production"} mode`,
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
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
      },
    }),
  );

  const rootHandler = (c: SleipnirContext) =>
    c.html(
      <Index
        basePath={basePath}
        content={<SkaldPage />}
      />,
    );

  app.get("/", rootHandler);
  app.get("", rootHandler);

  app.route("/api", skaldApi);

  // MCP Endpoint (Streamable HTTP)
  mountMcp(app, () => createSkaldmateMcpServer(), "/mcp", {
    title: "Skaldmate MCP",
    description: "Szenen, Charaktere, Spielleiter, Personas und Orte in Skaldmate auslesen, anlegen und aktualisieren.",
    workflowSteps: [
      "Vorhandene Entitäten mit skaldmate_list_characters, skaldmate_list_locations, skaldmate_list_gamemasters, skaldmate_list_personas und skaldmate_list_scenes erkunden.",
      "Einzelne Einträge oder aktive Sessions mit skaldmate_get_* gezielt auslesen.",
      "Neue oder aktualisierte Charaktere, Spielleiter, Personas, Orte und Szenen mit skaldmate_save_* anlegen.",
    ],
  });

  assets(app, basePath, VERSION, "./apps/skaldmate", developMode);

  return app;
}
