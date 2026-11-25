/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { z } from "zod";

export const personaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().default(""),
  appearance: z.string().default(""),
  traits: z.string().default(""),
  background: z.string().default(""),
  portraitFile: z.string().optional(),
  updatedAt: z.string(),
});

export type Persona = z.infer<typeof personaSchema>;

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().default(""),
  appearance: z.string().default(""),
  personality: z.string().default(""),
  goals: z.string().default(""),
  speechStyle: z.string().default(""),
  modelId: z.string().optional(),
  portraitFile: z.string().optional(),
  updatedAt: z.string(),
});

export type Character = z.infer<typeof characterSchema>;

export const locationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  atmosphere: z.string().default(""),
  details: z.string().default(""),
  updatedAt: z.string(),
});

export type Location = z.infer<typeof locationSchema>;

export const gameMasterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  style: z.string().default("neutral"),
  systemPrompt: z.string().default(""),
  modelId: z.string().optional(),
  updatedAt: z.string(),
});

export type GameMaster = z.infer<typeof gameMasterSchema>;

export const sessionMessageSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["user", "character", "narrator", "image"]),
  speakerId: z.string().optional(),
  speakerName: z.string().min(1),
  portraitFile: z.string().optional(),
  content: z.string().default(""),
  imageFile: z.string().optional(),
  imagePrompt: z.string().optional(),
  createdAt: z.string(),
});

export type SessionMessage = z.infer<typeof sessionMessageSchema>;

export const sessionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  locationId: z.string().min(1),
  personaId: z.string().optional(),
  characterIds: z.array(z.string()).default([]),
  gameMasterId: z.string().min(1),
  modelId: z.string().optional(),
  imageModelId: z.string().optional(),
  sceneState: z.string().default(""),
  messages: z.array(sessionMessageSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StorySession = z.infer<typeof sessionSchema>;
