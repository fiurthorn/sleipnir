// deno-lint-ignore-file no-explicit-any

/** JSONPath 0.8.0 - XPath for JSON
 *
 * Copyright (c) 2007 Stefan Goessner (goessner.net)
 * Copyright (c) 2025 Stefan Weinmann (fiurthorn.de)
 *
 * Licensed under the MIT (MIT-LICENSE.txt) licence.
 */

type CustomFunction = (val: any) => any;
type CollectorFunction = (result: any[], joiner?: string) => any[] | any;
type ResultType = "VALUE" | "PATH";

export const customFunctions: { [key: string]: CustomFunction } = {
  lowercase: (val: any) => (typeof val === "string" ? val.toLowerCase() : val),
  uppercase: (val: any) => (typeof val === "string" ? val.toUpperCase() : val),
};

export const collectorFunctions: { [key: string]: CollectorFunction } = {
  join: (result: any[], joiner?: string) => result.flat().join(joiner || ""),
  coalesce: (result: any[]) =>
    result.find((v) => v !== null && v !== undefined) || "",
  stringify: (result: any[], joiner?: string) =>
    JSON.stringify(result, null, joiner),
};

interface JSONPathArgs {
  select?: "" | "join" | "coalesce" | "stringify" | string;
  joiner?: string;
  customFunctions?: { [key: string]: CustomFunction };
  collectorFunctions?: { [key: string]: CollectorFunction };
}

// original: https://goessner.net/articles/JsonPath/
export class JSONPath {
  private _data: any;
  private select: "" | "join" | "coalesce" | "stringify" | string;
  private joiner: string;
  private customFunctions: { [key: string]: CustomFunction };
  private collectorFunctions: { [key: string]: CollectorFunction };
  private evaluators: { [expr: string]: Function } = {};

  /**
   * Initialisiert die JSONPath-Instanz mit dem Datenobjekt und den Konfigurationsargumenten.
   */
  constructor(data: any = {}, args: JSONPathArgs = {}) {
    this._data = data;

    // Argumente mit Standardwerten auslesen
    this.select = args.select || "";
    this.joiner = args.joiner || "";

    // Eigene Funktionen mit den Standardfunktionen zusammenführen
    this.customFunctions = { ...customFunctions, ...args.customFunctions };
    this.collectorFunctions = {
      ...collectorFunctions,
      ...args.collectorFunctions,
    };

    // Das Ergebnis-Array wird für jede Abfrage neu initialisiert.
    // this.result = [];
  }

  /**
   * Setzt oder aktualisiert das JSON-Objekt, das abgefragt werden soll.
   */
  data(obj: object) {
    if (typeof obj !== "object" || obj === null) {
      throw new Error("A valid object must be provided.");
    }
    this._data = obj;
    return this;
  }

  paths() {
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
  ): any {
    // Stelle sicher, dass wir ein gültiges Objekt und einen Ausdruck haben.
    if (!expr || !this._data) {
      return false;
    }

    // Starte die rekursive Suche (Trace).
    const result = this.trace(
      [],
      this.normalize(expr).replace(/^\$;/, ""),
      this._data,
      "$",
      resultType,
    );

    // Wenn keine Ergebnisse gefunden wurden
    if (result !== false && result.length === 0) {
      return false;
    }

    select ||= this.select;
    joiner ||= this.joiner;

    if (this.collectorFunctions.hasOwnProperty(select)) {
      // Verwende die spezifizierte Sammlerfunktion, wenn sie definiert ist.
      return this.collectorFunctions[select](this.trim(result), joiner);
    } else {
      return this.trim(result);
    }
  }

  private trim(result: any | any[]): any[] | any {
    if (Array.isArray(result)) {
      return result.map((v) => (typeof v === "string" ? v.trim() : v));
    }

    if (typeof result === "string") {
      return result.trim();
    }

    return result;
  }

  private normalize(expr: string) {
    const subx: string[] = [];
    return expr
      .replace(
        /[\['](\??\(.*?\))[\]']/g,
        ($0, $1) => "[#" + (subx.push($1) - 1) + "]",
      )
      .replace(/'?\.'?|\['?/g, ";")
      .replace(/;;;|;;/g, ";..;")
      .replace(/;$|'?\]|'$/g, "")
      .replace(/#([0-9]+)/g, ($0, $1) => subx[parseInt($1, 10)]);
  }

  private asPath(path: string) {
    const x = path.split(";");
    let p = "$";
    for (let i = 1, n = x.length; i < n; i++) {
      p += /^[0-9*]+$/.test(x[i]) ? `[${x[i]}]` : `['${x[i]}']`;
    }
    return p;
  }

  private store(result: any[], p: string, v: any, resultType: ResultType) {
    if (p) {
      result.push(resultType === "PATH" ? this.asPath(p) : v);
    }
  }

  private walk(
    loc: string,
    expr: string,
    val: any,
    path: string,
    f: (...args: any[]) => void,
  ) {
    if (Array.isArray(val)) {
      for (let i = 0, n = val.length; i < n; i++) {
        if (i in val) f(i, loc, expr, val, path);
      }
    } else if (typeof val === "object" && val !== null) {
      for (const m in val) {
        if (Object.prototype.hasOwnProperty.call(val, m)) {
          f(m, loc, expr, val, path);
        }
      }
    }
  }

  private slice(
    result: any[],
    loc: string,
    expr: string,
    val: any,
    path: string,
    resultType: ResultType,
  ) {
    if (Array.isArray(val)) {
      const len = val.length;
      let start = 0,
        end = len,
        step = 1;
      loc.replace(/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/g, (_, s, e, st) => {
        start = parseInt(s || start, 10);
        end = parseInt(e || end, 10);
        step = parseInt(st || step, 10);
        return "";
      });
      start = start < 0 ? Math.max(0, start + len) : Math.min(len, start);
      end = end < 0 ? Math.max(0, end + len) : Math.min(len, end);
      for (let i = start; i < end; i += step) {
        this.trace(result, i + ";" + expr, val, path, resultType);
      }
    }
  }

  private trace(
    result: any[],
    expr: string,
    val: any,
    path: string,
    resultType: ResultType,
  ): any[] | false {
    if (!expr) {
      this.store(result, path, val, resultType);
      return result;
    }

    const teile = expr.split(";");
    const [loc, ...rest] = teile;
    const x = rest.join(";");

    if (
      val &&
      typeof val === "object" &&
      Object.prototype.hasOwnProperty.call(val, loc)
    ) {
      this.trace(result, x, val[loc], path + ";" + loc, resultType);
    } else if (loc === "*") {
      this.walk(loc, x, val, path, (m, l, x_walk, v_walk, p_walk) => {
        this.trace(result, m + ";" + x_walk, v_walk, p_walk, resultType);
      });
    } else if (loc === "..") {
      this.trace(result, x, val, path, resultType);
      this.walk(loc, x, val, path, (m, l, x_walk, v_walk, p_walk) => {
        if (typeof v_walk[m] === "object" && v_walk[m] !== null) {
          this.trace(
            result,
            "..;" + x_walk,
            v_walk[m],
            p_walk + ";" + m,
            resultType,
          );
        }
      });
    } else if (/^(\w+)\(\)$/.test(loc)) {
      const functionName = loc.substring(0, loc.length - 2);
      if (
        Object.prototype.hasOwnProperty.call(this.customFunctions, functionName)
      ) {
        const transformedValue = this.customFunctions[functionName](val);
        this.trace(result, x, transformedValue, path, resultType);
      }
    } else if (/,/.test(loc)) {
      for (const s of loc.split(/'?,'?/).map((key) => key.trim())) {
        this.trace(result, s + ";" + x, val, path, resultType);
      }
    } else if (/^\(.*?\)$/.test(loc)) {
      this.trace(
        result,
        this.eval(loc, val, path.substr(path.lastIndexOf(";") + 1)) + ";" + x,
        val,
        path,
        resultType,
      );
    } else if (/^\?\(.*?\)$/.test(loc)) {
      this.walk(loc, x, val, path, (m, l, x_walk, v_walk, p_walk) => {
        if (this.eval(l.replace(/^\?\((.*?)\)$/, "$1"), v_walk[m], m)) {
          this.trace(result, m + ";" + x_walk, v_walk, p_walk, resultType);
        }
      });
    } else if (/^(-?[0-9]*):(-?[0-9]*):?(-?[0-9]*)$/.test(loc)) {
      this.slice(result, loc, x, val, path, resultType);
    }

    return result;
  }

  private eval(expression: string, val: any[], name: string) {
    try {
      if (!this.evaluators.hasOwnProperty(expression)) {
        let expr = expression
          .replace(/^\(?(.*?)\)?$/, "$1")
          .replace(/@/g, "$current");
        this.evaluators[expression] = new Function(
          "$name",
          "$current",
          "$",
          `return (${expr});`,
        );
      }

      const evaluator = this.evaluators[expression];
      return evaluator(name, val, this._data);
    } catch (err: any) {
      console.error("Error evaluating expression:", expression, err);
      throw new SyntaxError(
        `jsonPath: ${
          "message" in err ? err?.message : ""
        }: in expression "${expression}"`,
      );
    }
  }
}
