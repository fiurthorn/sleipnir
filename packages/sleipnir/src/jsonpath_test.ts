/**
 * @project Sleipnir Stack / Cookmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals } from "@std/assert";
import { JSONPath } from "./jsonpath.ts";

const sampleData = {
  store: {
    book: [
      {
        category: "reference",
        author: "Nigel Rees",
        title: "Sayings of the Century",
        price: 8.95,
      },
      {
        category: "fiction",
        author: "Evelyn Waugh",
        title: "Sword of Honour",
        price: 12.99,
      },
      {
        category: "fiction",
        author: "Herman Melville",
        title: "Moby Dick",
        isbn: "0-553-21311-3",
        price: 8.99,
      },
      {
        category: "fiction",
        author: "J. R. R. Tolkien",
        title: "The Lord of the Rings",
        isbn: "0-395-19395-8",
        price: 22.99,
      },
    ],
    bicycle: {
      color: "red",
      price: 19.95,
    },
  },
  user: {
    firstName: "Stefan",
    lastName: "Weinmann",
  },
};

Deno.test("JSONPath - basic path resolution", () => {
  const jp = new JSONPath(sampleData);
  const authors = jp.query("$..author");
  assertEquals(authors, [
    "Nigel Rees",
    "Evelyn Waugh",
    "Herman Melville",
    "J. R. R. Tolkien",
  ]);
});

Deno.test("JSONPath - filter expression", () => {
  const jp = new JSONPath(sampleData);
  const cheapBooks = jp.query("$.store.book[?(@.price < 10)]");
  assertEquals(Array.isArray(cheapBooks), true);
  assertEquals(cheapBooks.length, 2);
});

Deno.test("JSONPath - custom function transformation", () => {
  const jp = new JSONPath(sampleData, {
    customFunctions: {
      reverse: (val: unknown) =>
        typeof val === "string" ? val.split("").reverse().join("") : val,
    },
  });

  const upper = jp.query("$.user.firstName.uppercase()");
  assertEquals(upper, ["STEFAN"]);

  const reversed = jp.query("$.user.firstName.reverse()");
  assertEquals(reversed, ["nafetS"]);
});

Deno.test("JSONPath - collector functions (coalesce & join)", () => {
  const jp = new JSONPath(sampleData);
  const coalesced = jp.query("$..bicycle.color", "coalesce");
  assertEquals(coalesced, "red");

  const joined = jp.query("$..author", "join", ", ");
  assertEquals(
    joined,
    "Nigel Rees, Evelyn Waugh, Herman Melville, J. R. R. Tolkien",
  );
});
