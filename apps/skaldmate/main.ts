/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import app from "./src/server/router.tsx";

const rawPort = Deno.env.get("PORT") ?? "3006";
const parsedPort = Number(rawPort);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3006;

const basePath = Deno.env.get("BASE_PATH");
const developMode = Deno.env.get("APP_ENV") === "development";

Deno.serve({ port }, app(basePath, developMode).fetch);
