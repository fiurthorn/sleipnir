import { Sleipnir } from "../server/sleipnir.ts";

import { CounterPage } from "./Counter.tsx";
import { Index } from "./Index.tsx";

export function pages(app: Sleipnir) {
  app.get(
    "/counter",
    (c) => c.html(<Index content={<CounterPage context={c} />} />),
  );
}
