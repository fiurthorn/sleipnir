import { JSONPath, ResultType } from "../../lib/jsonpath.ts";
import { getSessionData, updateSessionData } from "../session.ts";
import { Sleipnir, SleipnirContext } from "../sleipnir.ts";

export function session(app: Sleipnir, path: string) {
  app.get(`${path}/get`, Get);
  app.get(`${path}/set`, Set);
}

function jp(data: Record<string, unknown>) {
  return new JSONPath(data, {
    customFunctions: {
      mask: (_) => "********",
      currency: (val) => `${val.toFixed(2)} €`,
    },
  });
}

/**
 * generic api call
 *
 * @param c
 * @returns
 */
async function Get(c: SleipnirContext) {
  const data = await getSessionData(c);

  const expr = c.req.query("expr") ?? "counter";
  const select = c.req.query("select") ?? "$..*";
  const joiner = c.req.query("joiner") ?? "coalesce";
  const resultType = (c.req.query("resultType") ?? "PATH") as ResultType;

  const result = jp(data).query(expr, select, joiner, resultType);
  return c.json(result);
}

async function Set(c: SleipnirContext) {
  const data = await getSessionData(c);

  const expr = c.req.query("expr") ?? "$";
  const select = c.req.query("select") ?? "coalesce";

  const key = c.req.query("key");
  if (!key) return c.text("no key sent", 400);

  const value = c.req.query("value");
  if (!value) return c.text("no value sent", 400);

  const result = expr == "$" ? data : jp(data).query(expr, select);
  if (result === false) c.html("created", 400);
  result[key] = JSON.parse(value);

  await updateSessionData(c, data);
  return c.html("created", 201);
}
