import { Query, SearchOptions, SearchResult } from "minisearch";

export type Message<T> = {
  type: T;
};

export type Request<T, D> = {
  type: T;
  data: D;
};

export type Response<T, R> = {
  type: T;

  requestId: string | number;
  result: R;
};

export interface InitRequest extends Request<"INIT", SearchEntry[]> {}
export interface IndexRequest extends Request<"INDEX", SearchEntry> {}
export interface SearchRequest extends Request<"SEARCH", Search> {}

export interface SearchResponse extends Response<"RESULT", Result> {}
export interface ReadyResponse extends Message<"READY"> {}

export interface SearchEntry {
  id: string | number;

  title: string;
  text: string;
  tags: string[];

  category: string;
}

export interface Search {
  requestId: string | number;

  query: Query;

  options?: SearchOptions;
}

export type Result = SearchResult[];
