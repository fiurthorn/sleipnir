import { randomBytes } from "node:crypto";

export const proxyRedirect = function () {
  const path = globalThis.location.pathname;
  if (path.match(/.*\/proxy\/\d+$/) && !path.endsWith("/")) {
    globalThis.location.replace(path + "/");
  }
  globalThis.HTMX_BASE_PATH = path.endsWith("/") ? path : path + "/";
}.toString();

export function parseInteger(input: string | undefined = "0") {
  const parsed = parseInt(input);
  return isNaN(parsed) ? 0 : parsed;
}

export function randomId(n: number = 9) {
  const buffer = randomBytes(Math.ceil(n / 2));
  return buffer.toString("hex").slice(0, n);
}
