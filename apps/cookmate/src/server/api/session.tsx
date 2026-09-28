/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import {
  getSessionData,
  JSONPath,
  ResultType,
  Sleipnir,
  SleipnirContext,
  updateSessionData,
} from "@sleipnir/core";

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
  const key = c.req.query("key");
  if (!key) {
    return c.text("no key sent", 400);
  }

  const value = c.req.query("value");
  if (!value) {
    return c.text("no value sent", 400);
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(value);
  } catch {
    return c.text("invalid JSON value", 400);
  }

  const data = await getSessionData(c);
  const expr = c.req.query("expr") ?? "$";
  const select = c.req.query("select") ?? "coalesce";

  const target = expr === "$" ? data : jp(data).query(expr, select);
  if (typeof target !== "object" || target === null) {
    return c.text("target path not found or invalid", 400);
  }

  (target as Record<string, unknown>)[key] = parsedValue;

  await updateSessionData(c, data);
  return c.html("created", 201);
}
