/**
 * @project Sleipnir Stack / Cookmate
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
  sleipnirCors,
} from "@sleipnir/core";

import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";

import { pages } from "../pages/pages.tsx";
import { api } from "./api/api.tsx";

export default function App(kv: Deno.Kv, basePath?: string) {
  const app = new Sleipnir().basePath(basePath ?? "");
  app.use("*", compress());
  app.use("*", sleipnirCors());
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
  app.use(sessionStore(kv), session());
  const rootHandler = (c: SleipnirContext) => c.redirect("./counter");
  app.get("/", rootHandler);
  if (basePath) app.get("", rootHandler);
  pages(app);
  assets(app, basePath, "0.1.0", "./apps/cookmate");
  api(app, "/api");
  return app;
}
