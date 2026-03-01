import { kv } from "./src/server/key_value.ts";
import app from "./src/server/router.ts";

const port = Deno.env.get("PORT") ?? "3001";
Deno.serve({ port: Number(port) }, app(kv).fetch);
