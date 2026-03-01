import { Sleipnir, SleipnirContext } from "../sleipnir.ts";
import { HtmxCounterFragment } from "../../components/HtmxCounter.tsx";
import { getSessionData, updateSessionData } from "../session.ts";

export function counter(app: Sleipnir, path: string) {
  app.get(`${path}/increment`, Increment);
  app.get(`${path}/decrement`, Decrement);
}

async function Increment(c: SleipnirContext) {
  const data = await getSessionData(c);
  data.counter++;
  return updateSessionData(c, data).then(() =>
    c.html(<HtmxCounterFragment initial={data.counter} />)
  );
}

async function Decrement(c: SleipnirContext) {
  const data = await getSessionData(c);
  data.counter--;
  return updateSessionData(c, data).then(() =>
    c.html(<HtmxCounterFragment initial={data.counter} />)
  );
}
