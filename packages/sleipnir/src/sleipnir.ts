/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { Context } from "hono";

import { Hono } from "hono";

export class Sleipnir extends Hono {}

export type SleipnirContext = Context;
