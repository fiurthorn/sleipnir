/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { SleipnirContext } from "@sleipnir/core";
import { assets, cors, hsts, Sleipnir, VERSION } from "@sleipnir/core";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { Index } from "../pages/Index.tsx";
import { ScanPage } from "../pages/Scan.tsx";
import { api as documentsApi } from "./api/documents.ts";

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
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "*"],
        frameSrc: ["'self'", "blob:"],
        workerSrc: ["'self'", "blob:"],
        upgradeInsecureRequests: [],
      },
    }),
  );

  // Main UI
  const rootHandler = (c: SleipnirContext) => c.html(<Index content={<ScanPage basePath={basePath ?? ""} />} />);
  app.get("/", rootHandler);
  if (basePath) app.get("", rootHandler);

  // Documents API
  app.route("/api", documentsApi);

  // Static Assets
  assets(app, basePath, VERSION, "./apps/scanmate", developMode);

  return app;
}
