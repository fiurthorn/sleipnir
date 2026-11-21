/**
 * @project Sleipnir Stack / Notemate
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
import { NotesPage } from "../pages/Notes.tsx";
import { notesApi } from "./api/notes.ts";
import { createNotemateMcpServer } from "./mcp.ts";
import { NoteStorage } from "./services/storage.ts";

export default function App(basePath?: string, developMode: boolean = false) {
  console.log(
    `Starting Notemate with basePath: ${basePath ?? "none"} as ${developMode ? "development" : "production"} mode`,
  );

  const app = new Sleipnir().basePath(basePath ?? "");
  const storage = new NoteStorage();

  app.use("*", hsts());
  app.use("*", compress());
  app.use("*", cors());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    }),
  );

  // Main UI
  const rootHandler = (c: SleipnirContext) => c.html(<Index basePath={basePath} content={<NotesPage />} />);
  app.get("/", rootHandler);
  app.get("", rootHandler);

  // Notes and Attachments API
  notesApi(app, storage);

  // MCP Endpoint (Streamable HTTP)
  mountMcp(app, () => createNotemateMcpServer(storage), "/mcp", {
    title: "NoteMate MCP",
    description: "Hierarchisches Markdown-Notizbuch lesen, durchsuchen und verwalten über Model Context Protocol.",
    workflowSteps: [
      "Struktur mit notemate_get_tree erkunden oder relevante Notizen per notemate_search finden.",
      "Einzelne Markdown-Notizen mit notemate_read_note auslesen und analysieren.",
      "Neue Notizen, Zusammenfassungen oder Ordner mit notemate_write_note und notemate_create_folder anlegen.",
    ],
  });

  // Static Assets
  assets(app, basePath, VERSION, "./apps/notemate", developMode);

  return app;
}
