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
  vars?: Record<string, string>;
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

function expandMacroBody(
  body: string,
  fullMatch: string,
  ctx: {
    timeStr: string;
    dateStr: string;
    timestampStr: string;
    userName?: string;
    charName?: string;
    vars?: Record<string, string>;
  },
): string {
  const lower = body.toLowerCase();

  if (lower === "time") return ctx.timeStr;
  if (lower === "date") return ctx.dateStr;
  if (lower === "timestamp") return ctx.timestampStr;
  if (lower === "user" && ctx.userName) return ctx.userName;
  if (lower === "char" && ctx.charName) return ctx.charName;

  if (body.startsWith("$")) {
    const varName = body.slice(1).trim().toLowerCase();
    if (ctx.vars && Object.prototype.hasOwnProperty.call(ctx.vars, varName)) {
      return ctx.vars[varName];
    }
    return fullMatch;
  }

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
}

/**
 * Expands storytelling macros like {{random:...}}, {{random_of:...}},
 * {{roll:2d20}}, {{rand:1-10}}, {{time}}, {{date}}, {{timestamp}},
 * and session variables ({{name:=random:a,b}} / {{-name:=...}} / {{$name}}).
 */
export function expandMacros(input: string, ctx: MacroContext = {}): string {
  if (!input || !input.includes("{{")) return input;

  const now = ctx.now ?? new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const timestampStr = `${dateStr} ${timeStr}`;
  const evalCtx = {
    timeStr,
    dateStr,
    timestampStr,
    userName: ctx.userName,
    charName: ctx.charName,
    vars: ctx.vars,
  };

  return input.replace(/\{\{([^{}]+?)\}\}/g, (fullMatch, rawBody: string) => {
    const body = rawBody.trim();
    const assignIdx = body.indexOf(":=");
    if (assignIdx > 0) {
      const silent = body.startsWith("-");
      const rawVarName = (silent ? body.slice(1, assignIdx) : body.slice(0, assignIdx)).trim().toLowerCase();
      const rhs = body.slice(assignIdx + 2).trim();
      const evaluated = expandMacroBody(rhs, rhs, evalCtx);
      const isSafeKey = /^[a-z0-9_-]+$/.test(rawVarName) &&
        rawVarName !== "__proto__" &&
        rawVarName !== "constructor" &&
        rawVarName !== "prototype";
      if (ctx.vars && isSafeKey) {
        ctx.vars[rawVarName] = evaluated;
      }
      return silent ? "" : evaluated;
    }

    return expandMacroBody(body, fullMatch, evalCtx);
  });
}
