/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assets, session, sessionStore, Sleipnir } from "@sleipnir/core";

import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import { pages } from "../pages/pages.tsx";
import { api } from "./api/api.tsx";

export default function App(kv: Deno.Kv, basePath?: string) {
  const app = new Sleipnir();
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
  app.use(
    "/api/*",
    cors({
      origin: "*", //! TODO e.g. https://dein-frontend.de
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Length"],
      maxAge: 600,
      credentials: true,
    }),
  );
  app.use(sessionStore(kv), session());
  app.get("/", (c) => c.redirect("./counter"));
  pages(app);
  assets(app, basePath);
  api(app, "/api");
  return app;
}
