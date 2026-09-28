/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { kv } from "@sleipnir/core";
import app from "./src/server/router.tsx";

const rawPort = Deno.env.get("PORT") ?? "3002";
const parsedPort = Number(rawPort);
const port =
  Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535
    ? parsedPort
    : 3002;

Deno.serve({ port }, app(kv).fetch);
