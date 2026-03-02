import { kv } from "./src/repos/key_value/key_value.ts";
import app from "./src/server/router.ts";

const port = Deno.env.get("PORT") ?? "3001";
Deno.serve({ port: Number(port) }, app(kv).fetch);
