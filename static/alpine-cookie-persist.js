(() => {
  // 100 Tage in Sekunden
  const maxAge = 60 * 60 * 24 * 100;

  // Der Adapter, der sich wie localStorage verhält, aber Cookies nutzt
  const cookieStorage = {
    getItem: (key) => {
      const name = key + "=";
      const ca = document.cookie.split(";");
      for (let i = 0; i < ca.length; i++) {
        const c = ca[i].trim();
        if (c.indexOf(name) == 0)
          return JSON.parse(
            decodeURIComponent(c.substring(name.length, c.length)),
          );
      }
      return null;
    },
    setItem: (key, value) => {
      document.cookie = `${key}=${encodeURIComponent(JSON.stringify(value))};path=/;max-age=${maxAge};SameSite=Lax`;
    },
  };

  function d(t) {
    const a = () => {
      let r,
        n = cookieStorage;

      return t.interceptor(
        (i, e, l, s, _f) => {
          const o = r || `_x_${s}`,
            u = g(o, n) ? p(o, n) : i;
          return (
            l(u),
            t.effect(() => {
              const c = e();
              (m(o, c, n), l(c));
            }),
            u
          );
        },
        (i) => {
          ((i.as = (e) => ((r = e), i)), (i.using = (e) => ((n = e), i)));
        },
      );
    };

    Object.defineProperty(t, "$cookie", { get: () => a() });
    t.magic("cookie", a);
  }

  function g(t, a) {
    return a.getItem(t) !== null;
  }
  function p(t, a) {
    return a.getItem(t);
  }
  function m(t, a, r) {
    r.setItem(t, a);
  }

  document.addEventListener("alpine:init", () => {
    globalThis.Alpine.plugin(d);
  });
})();
