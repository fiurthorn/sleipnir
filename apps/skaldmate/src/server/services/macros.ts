/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

export interface MacroContext {
  now?: Date;
  userName?: string;
  charName?: string;
}

function randomInt(min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function rollDice(expr: string): string | null {
  const match = expr.trim().match(/^(\d+)[dDwW](\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (!match) return null;

  const count = Math.min(100, Math.max(1, Number(match[1])));
  const sides = Math.min(10000, Math.max(2, Number(match[2])));
  const sign = match[3] === "-" ? -1 : 1;
  const modifier = match[4] ? Number(match[4]) * sign : 0;

  let sum = modifier;
  for (let i = 0; i < count; i++) {
    sum += randomInt(1, sides);
  }
  return String(sum);
}

/**
 * Expands storytelling macros like {{random:...}}, {{random_of:...}},
 * {{roll:2d20}}, {{rand:1-10}}, {{time}}, {{date}}, and {{timestamp}}.
 */
export function expandMacros(input: string, ctx: MacroContext = {}): string {
  if (!input || !input.includes("{{")) return input;

  const now = ctx.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const timestampStr = `${dateStr} ${timeStr}`;

  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (fullMatch, rawBody: string) => {
    const body = rawBody.trim();
    const lower = body.toLowerCase();

    if (lower === "time") return timeStr;
    if (lower === "date") return dateStr;
    if (lower === "timestamp") return timestampStr;
    if (lower === "user" && ctx.userName) return ctx.userName;
    if (lower === "char" && ctx.charName) return ctx.charName;

    const colonIdx = body.indexOf(":");
    if (colonIdx === -1) return fullMatch;

    const key = body.slice(0, colonIdx).trim().toLowerCase();
    const arg = body.slice(colonIdx + 1).trim();

    if (key === "random" || key === "random_of") {
      const separator = arg.includes("|") ? "|" : ",";
      const options = arg.split(separator).map((s) => s.trim()).filter(Boolean);
      if (options.length === 0) return fullMatch;
      return options[randomInt(0, options.length - 1)];
    }

    if (key === "roll") {
      return rollDice(arg) ?? fullMatch;
    }

    if (key === "rand") {
      const rangeMatch = arg.match(/^(-?\d+)\s*(?:-|to|\.\.)\s*(-?\d+)$/i);
      if (!rangeMatch) return fullMatch;
      return String(randomInt(Number(rangeMatch[1]), Number(rangeMatch[2])));
    }

    return fullMatch;
  });
}
