import { kv } from "../../repos/key_value/key_value.ts";
import {
  IndexRequest,
  InitRequest,
  SearchEntry,
  SearchRequest,
  SearchResponse,
} from "../../repos/minisearch/interfaces.ts";
import { SleipnirContext } from "../sleipnir.ts";

// In deiner api.tsx oder einer neuen search.ts
export function Search() {
  const module = new URL(
    "../../repos/minisearch/minisearch.ts",
    import.meta.url,
  ).href;

  const searchWorker = new Worker(module, {
    type: "module",
    name: "minisearch",
  });

  searchWorker.postMessage({ type: "INIT", data: [] } as InitRequest);
  const data = kv.list<SearchEntry>({ prefix: ["recipe"] });
  (async () => {
    for await (const entry of data) {
      searchWorker.postMessage({
        type: "INDEX",
        data: entry.value,
      } as IndexRequest);
    }
  })().then(() => console.log("all data indexed"));

  return async (c: SleipnirContext) => {
    const query = c.req.query("q");
    if (!query) return c.json([]);

    const results = await new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).slice(2);

      // deno-lint-ignore prefer-const
      let timeoutId: number;
      const handler = (message: MessageEvent<SearchResponse>) => {
        const response = message.data;
        if (response.type === "RESULT" && response.requestId === requestId) {
          clearTimeout(timeoutId);
          searchWorker.removeEventListener("message", handler);
          resolve(response.result);
        }
      };
      searchWorker.addEventListener("message", handler);
      searchWorker.postMessage({
        type: "SEARCH",
        data: { query, requestId },
      } as SearchRequest);

      timeoutId = setTimeout(() => {
        searchWorker.removeEventListener("message", handler);
        reject(new Error("Search worker timeout"));
      }, 5000);
    }).catch((err) => {
      console.error(err);
      return [];
    });

    return c.json(results);
  };
}
