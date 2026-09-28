/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import {
  assets,
  session,
  sessionStore,
  Sleipnir,
  type SleipnirContext,
} from "@sleipnir/core";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { Index } from "../pages/Index.tsx";
import { NotesPage } from "../pages/Notes.tsx";
import { NoteStorage } from "./services/storage.ts";
import { notesApi } from "./api/notes.ts";

export default function App(kv: Deno.Kv, basePath?: string) {
  const app = new Sleipnir().basePath(basePath ?? "");
  const storage = new NoteStorage();

  app.use("*", compress());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    }),
  );
  app.use(sessionStore(kv), session());

  // Main UI
  const rootHandler = (c: SleipnirContext) =>
    c.html(<Index content={<NotesPage />} />);
  app.get("/", rootHandler);
  if (basePath) app.get("", rootHandler);

  // Notes and Attachments API
  notesApi(app, storage);

  // Static Assets
  assets(app, basePath, "0.1.0", "./apps/notemate");

  return app;
}
