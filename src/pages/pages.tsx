/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Sleipnir } from "../server/sleipnir.ts";

import { CounterPage } from "./Counter.tsx";
import { Index } from "./Index.tsx";

export function pages(app: Sleipnir) {
  app.get(
    "/counter",
    (c) => c.html(<Index content={<CounterPage context={c} />} />),
  );
}
