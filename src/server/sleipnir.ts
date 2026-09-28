/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { SessionEnv } from "@hono/session";
import { Context, Hono } from "hono";
import { SleipnirSessionData } from "./interfaces.ts";

export const Sleipnir = Hono<SessionEnv<SleipnirSessionData>>;
export type Sleipnir = InstanceType<
  typeof Hono<SessionEnv<SleipnirSessionData>>
>;

export type SleipnirContext = Context<SessionEnv<SleipnirSessionData>>;
