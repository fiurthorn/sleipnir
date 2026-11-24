/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import app from "./src/server/router.tsx";
import { getTriageCronSchedule, runTriageJob } from "./src/server/services/agent.ts";

const rawPort = Deno.env.get("PORT") ?? "3005";
const parsedPort = Number(rawPort);
const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535 ? parsedPort : 3005;

const basePath = Deno.env.get("BASE_PATH");
const developMode = Deno.env.get("APP_ENV") === "development";

const cronSchedule = getTriageCronSchedule();
if (typeof Deno.cron === "function") {
  Deno.cron("nightly-triage", cronSchedule, async () => {
    console.log(`[Agentmate] Starte geplante Beleg-Triage (${cronSchedule})...`);
    const result = await runTriageJob("cron");
    if (result.error) {
      console.error(`[Agentmate] Cron-Triage fehlgeschlagen: ${result.error}`);
    } else {
      console.log(`[Agentmate] Cron-Triage abgeschlossen: ${result.count} Beleg(e) verarbeitet.`);
    }
  });
} else {
  console.warn("[Agentmate] Deno.cron nicht verfügbar (starte mit --unstable-cron).");
}

Deno.serve({ port }, app(basePath, developMode).fetch);
