/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import {
  assets,
  cors,
  hsts,
  Sleipnir,
  type SleipnirContext,
  VERSION,
} from "@sleipnir/core";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { ChatPage } from "../pages/Chat.tsx";
import { Index } from "../pages/Index.tsx";
import { chatApi } from "./api/chat.ts";
import { imageApi } from "./api/image.ts";
import { modelsApi } from "./api/models.ts";

export default function App(basePath?: string, developMode: boolean = false) {
  console.log(
    `Starting Notemate with basePath: ${basePath ?? "none"} as ${
      developMode ? "development" : "production"
    } mode`,
  );

  const app = new Sleipnir().basePath(basePath ?? "");
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
        imgSrc: [
          "'self'",
          "data:",
          "https://image.pollinations.ai",
          "https://*.pollinations.ai",
          "https://*.venice.ai",
        ],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
        frameSrc: ["'self'"],
        upgradeInsecureRequests: [],
      },
    }),
  );

  const rootHandler = (c: SleipnirContext) =>
    c.html(<Index content={<ChatPage />} />);
  app.get("/", rootHandler);
  if (basePath) app.get("", rootHandler);

  modelsApi(app, "/api/models");
  chatApi(app, "/api/chat");
  imageApi(app, "/api/image");

  assets(app, basePath, VERSION, "./apps/chatmate", developMode);

  return app;
}
