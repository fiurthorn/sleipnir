/**
 * @project Sleipnir Stack / Chatmate
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
import { ChatPage } from "../pages/Chat.tsx";
import { chatApi } from "./api/chat.ts";
import { imageApi } from "./api/image.ts";
import { modelsApi } from "./api/models.ts";

export default function App(kv: Deno.Kv, basePath?: string) {
  const app = new Sleipnir().basePath(basePath ?? "");
  app.use("*", compress());
  app.use(
    "*",
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://image.pollinations.ai",
          "https://*.pollinations.ai",
          "https://*.venice.ai",
        ],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    }),
  );
  app.use(sessionStore(kv), session());

  const rootHandler = (c: SleipnirContext) =>
    c.html(<Index content={<ChatPage />} />);
  app.get("/", rootHandler);
  if (basePath) app.get("", rootHandler);
  modelsApi(app, "/api/models");
  chatApi(app, "/api/chat");
  imageApi(app, "/api/image");
  assets(app, basePath);

  return app;
}
