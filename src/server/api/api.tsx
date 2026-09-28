/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Sleipnir } from "../sleipnir.ts";
import { counter } from "./counter.tsx";
import { alertApi } from "./alert.tsx";
import { session } from "./session.tsx";
import { Search } from "./search.ts";

export function api(app: Sleipnir, path: string) {
  counter(app, `${path}/counter`);
  session(app, `${path}/session`);
  alertApi(app, `${path}/alert`);
  app.get(`${path}/query`, Search());
}
