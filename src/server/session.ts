import { useSession, useSessionStorage } from "@hono/session";
import { randomId } from "../lib/utils.ts";
import { SleipnirSessionData } from "./session_data.d.ts";
import { SleipnirContext } from "./sleipnir.ts";

export const DefaultSessionData: SleipnirSessionData = {
  counter: 0,
};

export function session() {
  const _100_DAYS_IN_SECONDS = 365 * 24 * 60 * 60;
  const defaultSecret =
    "development-secret-key-should-be-changed-in-production";

  return useSession({
    secret: Deno.env.get("SESSION_SECRET") ?? defaultSecret,
    duration: {
      absolute: _100_DAYS_IN_SECONDS,
      inactivity: _100_DAYS_IN_SECONDS,
    },
    generateId: () => randomId(32),
  });
}

export function sessionStore(kv: Deno.Kv) {
  return useSessionStorage({
    async delete(sid) {
      await kv.delete(["sessions", sid]);
    },
    async get(sid) {
      const res = await kv.get<SleipnirSessionData>(["sessions", sid]);
      return res.value ?? DefaultSessionData;
    },
    async set(sid, value) {
      await kv.set(["sessions", sid], value);
    },
  });
}

export async function getSessionData(
  c: SleipnirContext,
): Promise<SleipnirSessionData> {
  const data = await c.var.session.get((data) => Promise.resolve(data));
  if (!data) return DefaultSessionData;
  return data;
}

export async function updateSessionData(
  c: SleipnirContext,
  data: SleipnirSessionData,
): Promise<void> {
  await c.var.session.update(data);
}
