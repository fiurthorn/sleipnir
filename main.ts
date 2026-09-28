/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { kv } from "./src/repos/key_value/key_value.ts";
import app from "./src/server/router.ts";

const rawPort = Deno.env.get("PORT") ?? "3001";
const parsedPort = Number(rawPort);
const port =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 3001;

Deno.serve({ port }, app(kv).fetch);
