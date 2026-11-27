/**
 * @project Sleipnir Stack
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/** JSONPath 0.8.0 - XPath for JSON
 *
 * Copyright (c) 2007 Stefan Goessner (goessner.net)
 * Copyright (c) 2025 Stefan Weinmann (fiurthorn.de)
 *
 * Licensed under the MIT (MIT-LICENSE.txt) licence.
 */

export type CustomFunction = (val: unknown) => unknown;
export type CollectorFunction = (result: unknown[], joiner?: string) => unknown;
export type ResultType = "VALUE" | "PATH";

export const customFunctions: Record<string, CustomFunction> = {
  lowercase: (val: unknown) => (typeof val === "string" ? val.toLowerCase() : val),
  uppercase: (val: unknown) => (typeof val === "string" ? val.toUpperCase() : val),
};

export const collectorFunctions: Record<string, CollectorFunction> = {
  join: (result: unknown[], joiner?: string) => result.flat().join(joiner || ""),
  coalesce: (result: unknown[]) => result.find((v) => v !== null && v !== undefined) ?? "",
  stringify: (result: unknown[], joiner?: string) => JSON.stringify(result, null, joiner),
};

export interface JSONPathArgs {
  select?: "" | "join" | "coalesce" | "stringify" | string;
  joiner?: string;
  customFunctions?: Record<string, CustomFunction>;
  collectorFunctions?: Record<string, CollectorFunction>;
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "null" }
  | { type: "ident"; value: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "dot" }
  | { type: "bracket"; value: "[" | "]" };

function tokenizeExpr(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }

    if (ch === "[" || ch === "]") {
      tokens.push({ type: "bracket", value: ch });
      i++;
      continue;
    }

    if (ch === ".") {
      tokens.push({ type: "dot" });
      i++;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      i++;
      let str = "";
      while (i < expr.length && expr[i] !== quote) {
        if (expr[i] === "\\" && i + 1 < expr.length) {
          i++;
        }
        str += expr[i];
        i++;
      }
      if (i >= expr.length) {
        throw new SyntaxError(`Unterminated string literal in "${expr}"`);
      }
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }

    const three = expr.slice(i, i + 3);
    if (three === "===" || three === "!==") {
      tokens.push({ type: "op", value: three });
      i += 3;
      continue;
    }

    const two = expr.slice(i, i + 2);
    if (two === "==" || two === "!=" || two === "<=" || two === ">=" || two === "&&" || two === "||") {
      tokens.push({ type: "op", value: two });
      i += 2;
      continue;
    }

    if ("<>!+-*/%".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      let numStr = "";
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      const num = Number(numStr);
      if (Number.isNaN(num)) {
        throw new SyntaxError(`Invalid number "${numStr}"`);
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    if (/[a-zA-Z_$@]/.test(ch)) {
      let ident = "";
      while (i < expr.length && /[a-zA-Z0-9_$@]/.test(expr[i])) {
        ident += expr[i];
        i++;
      }
      if (ident === "true") {
        tokens.push({ type: "boolean", value: true });
      } else if (ident === "false") {
        tokens.push({ type: "boolean", value: false });
      } else if (ident === "null") {
        tokens.push({ type: "null" });
      } else {
        tokens.push({ type: "ident", value: ident });
      }
      continue;
    }

    throw new SyntaxError(`Unexpected character "${ch}" in expression "${expr}"`);
  }

  return tokens;
}

class SafeExprEvaluator {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly current: unknown,
    private readonly root: unknown,
    private readonly name: string,
  ) {}

  evaluate(): unknown {
    const val = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new SyntaxError("Unexpected trailing tokens in expression");
    }
    return val;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private peekOp(...ops: string[]): string | null {
    const t = this.tokens[this.pos];
    if (t?.type === "op" && ops.includes(t.value)) {
      return t.value;
    }
    return null;
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    this.pos++;
    return t;
  }

  private parseOr(): unknown {
    let left = this.parseAnd();
    while (this.peekOp("||")) {
      this.consume();
      const right = this.parseAnd();
      left = left || right;
    }
    return left;
  }

  private parseAnd(): unknown {
    let left = this.parseEquality();
    while (this.peekOp("&&")) {
      this.consume();
      const right = this.parseEquality();
      left = left && right;
    }
    return left;
  }

  private parseEquality(): unknown {
    let left = this.parseComparison();
    let op: string | null;
    while ((op = this.peekOp("==", "===", "!=", "!==")) !== null) {
      this.consume();
      const right = this.parseComparison();
      if (op === "==" || op === "===") left = left === right;
      else left = left !== right;
    }
    return left;
  }

  private parseComparison(): unknown {
    let left = this.parseAdditive();
    let op: string | null;
    while ((op = this.peekOp("<", "<=", ">", ">=")) !== null) {
      this.consume();
      const right = this.parseAdditive();
      if (typeof left === "number" && typeof right === "number") {
        if (op === "<") left = left < right;
        else if (op === "<=") left = left <= right;
        else if (op === ">") left = left > right;
        else left = left >= right;
      } else if (typeof left === "string" && typeof right === "string") {
        if (op === "<") left = left < right;
        else if (op === "<=") left = left <= right;
        else if (op === ">") left = left > right;
        else left = left >= right;
      } else {
        left = false;
      }
    }
    return left;
  }

  private parseAdditive(): unknown {
    let left = this.parseMultiplicative();
    let op: string | null;
    while ((op = this.peekOp("+", "-")) !== null) {
      this.consume();
      const right = this.parseMultiplicative();
      if (op === "+") {
        if (typeof left === "string" || typeof right === "string") {
          left = String(left ?? "") + String(right ?? "");
        } else {
          left = Number(left) + Number(right);
        }
      } else {
        left = Number(left) - Number(right);
      }
    }
    return left;
  }

  private parseMultiplicative(): unknown {
    let left = this.parseUnary();
    let op: string | null;
    while ((op = this.peekOp("*", "/", "%")) !== null) {
      this.consume();
      const right = this.parseUnary();
      if (op === "*") left = Number(left) * Number(right);
      else if (op === "/") left = Number(left) / Number(right);
      else left = Number(left) % Number(right);
    }
    return left;
  }

  private parseUnary(): unknown {
    const t = this.peek();
    if (t?.type === "op" && (t.value === "!" || t.value === "-")) {
      this.consume();
      const operand = this.parseUnary();
      return t.value === "!" ? !operand : -Number(operand);
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const t = this.peek();
    if (!t) {
      throw new SyntaxError("Unexpected end of expression");
    }

    if (t.type === "number" || t.type === "string" || t.type === "boolean") {
      this.consume();
      return t.value;
    }

    if (t.type === "null") {
      this.consume();
      return null;
    }

    if (t.type === "paren" && t.value === "(") {
      this.consume();
      const inner = this.parseOr();
      const closing = this.peek();
      if (closing?.type !== "paren" || closing.value !== ")") {
        throw new SyntaxError("Missing closing parenthesis");
      }
      this.consume();
      return this.parseMemberChain(inner);
    }

    if (t.type === "ident") {
      this.consume();
      if (t.value === "@") return this.parseMemberChain(this.current);
      if (t.value === "$") return this.parseMemberChain(this.root);
      if (t.value === "$name") return this.name;
      throw new SyntaxError(`Forbidden or unknown identifier "${t.value}"`);
    }

    throw new SyntaxError(`Unexpected token "${t.type}"`);
  }

  private parseMemberChain(base: unknown): unknown {
    let target = base;
    while (true) {
      const next = this.peek();
      if (next?.type === "dot") {
        this.consume();
        const prop = this.peek();
        if (prop?.type !== "ident") {
          throw new SyntaxError("Expected property name after '.'");
        }
        this.consume();
        target = this.readProp(target, prop.value);
        continue;
      }

      if (next?.type === "bracket" && next.value === "[") {
        this.consume();
        const key = this.parseOr();
        const closing = this.peek();
        if (closing?.type !== "bracket" || closing.value !== "]") {
          throw new SyntaxError("Missing closing ']'");
        }
        this.consume();
        target = this.readProp(target, String(key));
        continue;
      }

      break;
    }
    return target;
  }

  private readProp(target: unknown, key: string): unknown {
    if (FORBIDDEN_KEYS.has(key)) return undefined;
    if (Array.isArray(target)) {
      if (key === "length") return target.length;
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < target.length) {
        return target[idx];
      }
      return undefined;
    }
    if (typeof target === "string") {
      if (key === "length") return target.length;
      return undefined;
    }
    if (isRecord(target) && Object.hasOwn(target, key)) {
      return target[key];
    }
    return undefined;
  }
}

// original: https://goessner.net/articles/JsonPath/
export class JSONPath {
  private _data: unknown;
  private select: "" | "join" | "coalesce" | "stringify" | string;
  private joiner: string;
  private customFunctions: Record<string, CustomFunction>;
  private collectorFunctions: Record<string, CollectorFunction>;
  private evaluators: Record<string, Token[]> = {};

  /**
   * Initialisiert die JSONPath-Instanz mit dem Datenobjekt und den Konfigurationsargumenten.
   */
  constructor(data: unknown = {}, args: JSONPathArgs = {}) {
    this._data = data;
    this.select = args.select || "";
    this.joiner = args.joiner || "";
    this.customFunctions = { ...customFunctions, ...args.customFunctions };
    this.collectorFunctions = {
      ...collectorFunctions,
      ...args.collectorFunctions,
    };
  }

  /**
   * Setzt oder aktualisiert das JSON-Objekt, das abgefragt werden soll.
   */
  data(obj: object): this {
    if (typeof obj !== "object" || obj === null) {
      throw new Error("A valid object must be provided.");
    }
    this._data = obj;
    return this;
  }

  paths(): unknown {
    return this.query("$..*", undefined, undefined, "PATH");
  }

  /**
   * Führt eine JSONPath-Abfrage auf dem initialisierten Datenobjekt aus.
   */
  query(
    expr: string,
    select: "" | "join" | "coalesce" | "stringify" | string | undefined = "",
    joiner: string | undefined = "",
    resultType: ResultType = "VALUE",
  ): unknown {
    if (!expr || !this._data) {
      return false;
    }

    const result = this.trace(
      [],
      this.normalize(expr).replace(/^\$;/, ""),
      this._data,
      "$",
      resultType,
    );

    if (result !== false && result.length === 0) {
      return false;
    }

    const activeSelect = select || this.select;
    const activeJoiner = joiner || this.joiner;

    if (Object.hasOwn(this.collectorFunctions, activeSelect)) {
      const trimmed = this.trim(result);
      return this.collectorFunctions[activeSelect](
        Array.isArray(trimmed) ? trimmed : [trimmed],
        activeJoiner,
      );
    }
    return this.trim(result);
  }

  private trim(result: unknown): unknown {
    if (Array.isArray(result)) {
      return result.map((v) => (typeof v === "string" ? v.trim() : v));
    }
    if (typeof result === "string") {
      return result.trim();
    }
    return result;
  }

  private normalize(expr: string): string {
    const subx: string[] = [];
    return expr
      .replace(
        /[\['](\??\(.*?\))[\]']/g,
        (_$0, $1) => "[#" + (subx.push($1) - 1) + "]",
      )
      .replace(/'?\.'?|\['?/g, ";")
      .replace(/;;;|;;/g, ";..;")
      .replace(/;$|'?\]|'$/g, "")
      .replace(/#([0-9]+)/g, (_$0, $1) => subx[parseInt($1, 10)]);
  }

  private asPath(path: string): string {
    const x = path.split(";");
    let p = "$";
    for (let i = 1, n = x.length; i < n; i++) {
      p += /^[0-9*]+$/.test(x[i]) ? `[${x[i]}]` : `['${x[i]}']`;
    }
    return p;
  }

  private store(result: unknown[], p: string, v: unknown, resultType: ResultType): void {
    if (p) {
      result.push(resultType === "PATH" ? this.asPath(p) : v);
    }
  }

  private walk(
    loc: string,
    expr: string,
    val: unknown,
    path: string,
    f: (m: string | number, loc: string, expr: string, val: unknown, path: string) => void,
  ): void {
    if (Array.isArray(val)) {
      for (let i = 0, n = val.length; i < n; i++) {
        if (i in val) f(i, loc, expr, val, path);
      }
      return;
    }
    if (isRecord(val)) {
      for (const m in val) {
        if (Object.prototype.hasOwnProperty.call(val, m)) {
          f(m, loc, expr, val, path);
        }
      }
    }
  }

  private slice(
    result: unknown[],
    loc: string,
    expr: string,
    val: unknown,
    path: string,
    resultType: ResultType,
  ): void {
    if (!Array.isArray(val)) return;
    const len = val.length;
    let start = 0;
    let end = len;
    let step = 1;
    loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, (_, s, e, st) => {
      start = parseInt(s || String(start), 10);
      end = parseInt(e || String(end), 10);
      step = parseInt(st || String(step), 10);
      return "";
    });
    if (step <= 0) return;
    start = start < 0 ? Math.max(0, start + len) : Math.min(len, start);
    end = end < 0 ? Math.max(0, end + len) : Math.min(len, end);
    for (let i = start; i < end; i += step) {
      this.trace(result, i + ";" + expr, val, path, resultType);
    }
  }

  private readChild(val: unknown, loc: string): { found: boolean; value: unknown } {
    if (FORBIDDEN_KEYS.has(loc)) return { found: false, value: undefined };
    if (Array.isArray(val)) {
      const idx = Number(loc);
      if (Number.isInteger(idx) && idx >= 0 && idx < val.length) {
        return { found: true, value: val[idx] };
      }
      return { found: false, value: undefined };
    }
    if (isRecord(val) && Object.prototype.hasOwnProperty.call(val, loc)) {
      return { found: true, value: val[loc] };
    }
    return { found: false, value: undefined };
  }

  private trace(
    result: unknown[],
    expr: string,
    val: unknown,
    path: string,
    resultType: ResultType,
  ): unknown[] | false {
    if (!expr) {
      this.store(result, path, val, resultType);
      return result;
    }

    const teile = expr.split(";");
    const [loc, ...rest] = teile;
    const x = rest.join(";");

    const direct = this.readChild(val, loc);
    if (direct.found) {
      this.trace(result, x, direct.value, path + ";" + loc, resultType);
      return result;
    }

    if (loc === "*") {
      this.walk(loc, x, val, path, (m, _l, xWalk, vWalk, pWalk) => {
        this.trace(result, m + ";" + xWalk, vWalk, pWalk, resultType);
      });
      return result;
    }

    if (loc === "..") {
      this.trace(result, x, val, path, resultType);
      this.walk(loc, x, val, path, (m, _l, xWalk, vWalk, pWalk) => {
        const child = this.readChild(vWalk, String(m));
        if (child.found && typeof child.value === "object" && child.value !== null) {
          this.trace(result, "..;" + xWalk, child.value, pWalk + ";" + m, resultType);
        }
      });
      return result;
    }

    if (/^(\w+)\(\)$/.test(loc)) {
      const functionName = loc.substring(0, loc.length - 2);
      if (Object.prototype.hasOwnProperty.call(this.customFunctions, functionName)) {
        const transformedValue = this.customFunctions[functionName](val);
        this.trace(result, x, transformedValue, path, resultType);
      }
      return result;
    }

    if (/,/.test(loc)) {
      for (const s of loc.split(/'?,'?/).map((key) => key.trim())) {
        this.trace(result, s + ";" + x, val, path, resultType);
      }
      return result;
    }

    if (/^\(.*?\)$/.test(loc)) {
      const evaluated = this.eval(loc, val, path.substring(path.lastIndexOf(";") + 1));
      this.trace(result, String(evaluated) + ";" + x, val, path, resultType);
      return result;
    }

    if (/^\?\(.*?\)$/.test(loc)) {
      this.walk(loc, x, val, path, (m, l, xWalk, vWalk, pWalk) => {
        const child = this.readChild(vWalk, String(m));
        if (this.eval(l.replace(/^\?\((.*?)\)$/, "$1"), child.value, String(m))) {
          this.trace(result, m + ";" + xWalk, vWalk, pWalk, resultType);
        }
      });
      return result;
    }

    if (/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/.test(loc)) {
      this.slice(result, loc, x, val, path, resultType);
    }

    return result;
  }

  private eval(expression: string, val: unknown, name: string): unknown {
    try {
      if (!Object.hasOwn(this.evaluators, expression)) {
        const expr = expression.replace(/^\(?(.*?)\)?$/, "$1");
        this.evaluators[expression] = tokenizeExpr(expr);
      }
      const tokens = this.evaluators[expression];
      return new SafeExprEvaluator(tokens, val, this._data, name).evaluate();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new SyntaxError(`jsonPath: ${message}: in expression "${expression}"`);
    }
  }
}
