/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Sleipnir, SleipnirContext } from "../sleipnir.ts";
import { HtmxCounterFragment } from "../../components/HtmxCounter.tsx";
import { getSessionData, updateSessionData } from "../session.ts";

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
