/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { SessionEnv } from "@hono/session";
import { type Context, Hono } from "hono";
import type { SleipnirSessionData } from "./interfaces.ts";

export class Sleipnir extends Hono<SessionEnv<SleipnirSessionData>> {}

export type SleipnirContext = Context<SessionEnv<SleipnirSessionData>>;
