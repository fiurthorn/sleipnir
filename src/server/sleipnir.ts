import { SessionEnv } from "@hono/session";
import { Context, Hono } from "hono";
import { SleipnirSessionData } from "./session_data.d.ts";

export const Sleipnir = Hono<SessionEnv<SleipnirSessionData>>;
export type Sleipnir = InstanceType<
  typeof Hono<SessionEnv<SleipnirSessionData>>
>;

export type SleipnirContext = Context<SessionEnv<SleipnirSessionData>>;
