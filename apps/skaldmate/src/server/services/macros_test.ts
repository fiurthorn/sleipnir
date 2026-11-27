/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { expandMacros } from "./macros.ts";

Deno.test("expandMacros - expands time, date, timestamp", () => {
  const fixed = new Date(2026, 10, 25, 17, 5, 0); // 2026-11-25 17:05
  assertEquals(expandMacros("Uhrzeit: {{time}}", { now: fixed }), "Uhrzeit: 17:05");
  assertEquals(expandMacros("Datum: {{date}}", { now: fixed }), "Datum: 2026-11-25");
  assertEquals(expandMacros("Zeit: {{timestamp}}", { now: fixed }), "Zeit: 2026-11-25 17:05");
});

Deno.test("expandMacros - expands random, random_of, roll, rand", () => {
  const picked = expandMacros("Getränk: {{random:Kaffee, Tee, Wasser}}");
  assertEquals(
    ["Getränk: Kaffee", "Getränk: Tee", "Getränk: Wasser"].includes(picked),
    true,
  );

  const piped = expandMacros("{{random_of:Nord|Süd}}");
  assertEquals(["Nord", "Süd"].includes(piped), true);

  const rolled = Number(expandMacros("{{roll:2d6+3}}"));
  assertEquals(rolled >= 5 && rolled <= 15, true);

  const ranged = Number(expandMacros("{{rand:10-20}}"));
  assertEquals(ranged >= 10 && ranged <= 20, true);
});

Deno.test("expandMacros - supports session variables with :=, silent -:=", () => {
  const vars: Record<string, string> = {};
  const first = expandMacros("Wetter: {{wetter:=random:Regen,Nebel}}", { vars });
  assertEquals(["Wetter: Regen", "Wetter: Nebel"].includes(first), true);
  assertEquals(["Regen", "Nebel"].includes(vars.wetter), true);
  assertEquals(expandMacros("Immer noch {{$wetter}}.", { vars }), `Immer noch ${vars.wetter}.`);

  const silent = expandMacros("{{-taeter:=random:Butler,Gärtner}}Start", { vars });
  assertEquals(silent, "Start");
  assertEquals(["Butler", "Gärtner"].includes(vars.taeter), true);
  assertEquals(expandMacros("Täter ist {{$taeter}}", { vars }), `Täter ist ${vars.taeter}`);
});
