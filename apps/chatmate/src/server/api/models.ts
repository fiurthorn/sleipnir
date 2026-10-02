/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Sleipnir, SleipnirContext } from "@sleipnir/core";
import { getAvailableModels, getProviderStatus } from "../services/provider.ts";

export function modelsApi(app: Sleipnir, basePath: string) {
  app.get(basePath, (c: SleipnirContext) => {
    return c.json({
      providers: getProviderStatus(),
      models: getAvailableModels(),
    });
  });
}
