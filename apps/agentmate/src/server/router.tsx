/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { SleipnirContext } from "@sleipnir/core";
import { assets, cors, hsts, Sleipnir, VERSION } from "@sleipnir/core";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { AgentPage } from "../pages/AgentPage.tsx";
import { Index } from "../pages/Index.tsx";
import { agentApi } from "./api/agent.ts";

export default function App(basePath?: string, developMode: boolean = false) {
  console.log(
    `Starting Agentmate with basePath: ${basePath ?? "none"} as ${developMode ? "development" : "production"} mode`,
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
        content={<AgentPage />}
      />,
    );

  app.get("/", rootHandler);
  app.get("", rootHandler);

  app.route("/api", agentApi);

  assets(app, basePath, VERSION, "./apps/agentmate", developMode);

  app.get("*", (c: SleipnirContext) => c.text("Not found", 404));

  return app;
}
