import { Sleipnir } from "./sleipnir.ts";
import { session, sessionStore } from "./session.ts";
import { assets } from "./assets.ts";

import { api } from "./api/api.tsx";
import { pages } from "../pages/pages.tsx";

export default function App(kv: Deno.Kv, basePath?: string) {
  const app = new Sleipnir();
  app.use(sessionStore(kv), session());
  app.get("/", (c) => c.redirect("./counter"));
  pages(app);
  assets(app, basePath);
  api(app, "/api");
  return app;
}
