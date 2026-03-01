import { Sleipnir } from "../sleipnir.ts";
import { counter } from "./counter.tsx";
import { alertApi } from "./alert.tsx";
import { session } from "./session.tsx";

export function api(app: Sleipnir, path: string) {
  counter(app, `${path}/counter`);
  session(app, `${path}/session`);
  alertApi(app, `${path}/alert`);
}
