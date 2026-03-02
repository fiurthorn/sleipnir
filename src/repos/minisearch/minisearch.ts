import MiniSearch from "minisearch";
import {
  IndexRequest,
  InitRequest,
  Message,
  Request,
  Search,
  SearchEntry,
  SearchRequest,
  SearchResponse,
} from "./interfaces.ts";

const miniSearch = new MiniSearch<SearchEntry>({
  idField: "id",
  fields: ["title", "text", "tags"],
  storeFields: ["title", "category"],
  autoVacuum: true,
});

function init(entries: SearchEntry[]) {
  return miniSearch.addAll(entries);
}

function indexData(entry: SearchEntry) {
  return miniSearch.add(entry);
}

function search(search: Search) {
  return miniSearch.search(search.query, search.options);
}

const UNDEFINED = { type: "UNDEFINED" };
const READY = { type: "READY" };

function isInit(obj: Message<unknown>): obj is InitRequest {
  return obj && typeof obj.type === "string" && obj.type === "INIT";
}

function isSearch(obj: Message<unknown>): obj is SearchRequest {
  return obj && typeof obj.type === "string" && obj.type === "SEARCH";
}

function isIndex(obj: Message<unknown>): obj is IndexRequest {
  return obj && typeof obj.type === "string" && obj.type === "INDEX";
}

self.onmessage = (message: MessageEvent<Request<string, unknown>>) => {
  const request = message.data;
  if (isInit(request)) {
    init(request.data);
    self.postMessage(READY);
  } else if (isSearch(request)) {
    const result = search(request.data);
    const requestId = request.data.requestId;
    self.postMessage({ type: "RESULT", requestId, result } as SearchResponse);
  } else if (isIndex(request)) {
    indexData(request.data);
    self.postMessage(READY);
  } else {
    self.postMessage(UNDEFINED);
  }
};
