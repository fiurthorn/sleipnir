import { JSONPath } from "../../lib/jsonpath.ts";
import { getSessionData } from "../session.ts";
import { Sleipnir, SleipnirContext } from "../sleipnir.ts";

export function session(app: Sleipnir, path: string) {
  app.get(`${path}/get`, Get);
  app.get(`${path}/set`, Set);
}

/**
 * generic api call
 *
 * @param c
 * @returns
 */
async function Get(c: SleipnirContext) {
  const data = await getSessionData(c);
  const expr = c.req.query("expr") ?? "$";
  const select = c.req.query("select") ?? "coalesce";
  const result = new JSONPath(data).query(expr, select);
  return c.json(result);
}

function Set(c: SleipnirContext) {
  return c.text("not implemented yet!", 404);
}
