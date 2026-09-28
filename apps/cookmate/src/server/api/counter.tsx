/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import {
  getSessionData,
  Sleipnir,
  SleipnirContext,
  updateSessionData,
} from "@sleipnir/core";
import { HtmxCounterFragment } from "../../components/HtmxCounter.tsx";

export function counter(app: Sleipnir, path: string) {
  app.get(`${path}/increment`, Increment);
  app.get(`${path}/decrement`, Decrement);
}

async function Increment(c: SleipnirContext) {
  const data = await getSessionData(c);
  data.counter = (data.counter ?? 0) + 1;
  await updateSessionData(c, data);
  return c.html(<HtmxCounterFragment initial={data.counter} />);
}

async function Decrement(c: SleipnirContext) {
  const data = await getSessionData(c);
  data.counter = (data.counter ?? 0) - 1;
  await updateSessionData(c, data);
  return c.html(<HtmxCounterFragment initial={data.counter} />);
}
