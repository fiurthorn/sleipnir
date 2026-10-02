/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

const maxAge = 60 * 60 * 24 * 100; // 100 days

export const cookieStorage = {
  getItem: (key: string): unknown => {
    if (typeof document === "undefined") return null;
    const name = key + "=";
    const ca = document.cookie.split(";");
    for (let i = 0; i < ca.length; i++) {
      const c = ca[i].trim();
      if (c.indexOf(name) === 0) {
        try {
          return JSON.parse(
            decodeURIComponent(c.substring(name.length, c.length)),
          );
        } catch (_) {
          return null;
        }
      }
    }
    return null;
  },
  setItem: (key: string, value: unknown): void => {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=${encodeURIComponent(JSON.stringify(value))};path=/;max-age=${maxAge};SameSite=Lax`;
  },
};

export function cookiePersistPlugin(alpine: unknown): void {
  const t = alpine as {
    interceptor: (
      fn: (
        initialValue: unknown,
        getter: () => unknown,
        setter: (v: unknown) => void,
        path: string,
        key: string,
      ) => unknown,
      config: (
        interceptor: {
          as: (s: string) => unknown;
          using: (s: unknown) => unknown;
        },
      ) => void,
    ) => unknown;
    effect: (fn: () => void) => void;
    magic: (name: string, cb: () => unknown) => void;
  };

  const a = () => {
    let r: string | undefined;
    const n = cookieStorage;

    return t.interceptor(
      (i, e, l, s, _f) => {
        const o = r || `_x_${s}`;
        const u = n.getItem(o) !== null ? n.getItem(o) : i;
        l(u);
        t.effect(() => {
          const c = e();
          n.setItem(o, c);
          l(c);
        });
        return u;
      },
      (i) => {
        i.as = (e: string) => {
          r = e;
          return i;
        };
        i.using = (_e: unknown) => i;
      },
    );
  };

  Object.defineProperty(t, "$cookie", { get: () => a() });
  t.magic("cookie", a);
}
