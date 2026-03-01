<!-- 
 * Architektur & Review: Stefan | Implementation & Synthese: Sam (AI Peer)
 * Erarbeitet im gemeinschaftlichen Dialog.
-->

# JSONPath API Referenz

Sleipnir nutzt eine erweiterte Implementierung des ursprünglichen `jsonpath.js` (Stefan Goessner), optimiert für moderne Runtimes (Deno, Bun, Node).

## Initialisierung

Die `JSONPath`-Klasse ist das Herzstück der Datenauflösung.

```typescript
import { JSONPath } from "../src/lib/jsonpath.ts";

const jp = new JSONPath(data, {
  // Standard-Sammler
  select: "coalesce",
  customFunctions: {
    reverse: (v) => v.split("").reverse().join(""),
  },
});
```

## Abfrage-Syntax

Sleipnir unterstützt den vollen JSONPath-Standard sowie funktionale Erweiterungen:

| Ausdruck             | Beschreibung                                               |
| -------------------- | ---------------------------------------------------------- |
| `$.store.book[*]`    | Alle Bücher im Store.                                      |
| `$..author`          | Alle Autoren (Tiefensuche).                                |
| `$.users[?(@.active)]` | Filter-Expression (kompiliert via eval).                   |
| `$.name.uppercase()` | Aufruf einer injizierten customFunction.                   |
|                      | select: "join" nutzt eine collectorFunction für das Gesamtergebnis. |

| Operator / Syntax          | Beschreibung                                          | Beispiel                                |
| -------------------------- | ----------------------------------------------------- | --------------------------------------- |
| `$`                        | Das Wurzel-Objekt (Session/Data).                     | `$`                                     |
| `.` oder `[]`              | Kind-Element (Dot-Notation oder Bracket).             | `$.user.name` oder `$['user']['name']`  |
| `..`                       | Tiefensuche (Recursive Descent).                      | `$..id` (findet alle id Keys im Objekt) |
| `*`                        | Wildcard: Alle Elemente oder Eigenschaften.           | `$.items[*]`                            |
| `[n]`                      | Array-Index (0-basiert).                              | `$.users[0]`                            |
| `[start:end:step]`         | Array-Slicing (ähnlich wie in Python).                | `$.items[0:5:2]`                        |
| `(@.prop)`                 | Skript-Ausdruck (Nutzt den internen eval).            | `$.user[(@.role + "_settings")]`        |
| `?(@.prop > 0)`            | Filter-Ausdruck (Gibt alle passenden Objekte zurück). | `$.orders[?(@.price > 100)]`            |
| `,`                        | Selektions-Liste (Mehrere Keys/Indizes).              | `$.user['firstName','lastName']`        |
| `func()`                   | Custom Modifier Injection (Sleipnir-Spezial).         | `$.user.name.uppercase()`               |

## Beispiel: Custom Modifier Injection

Du kannst eigene Funktionen definieren, die innerhalb des Pfad-Ausdrucks zur Verfügung stehen:

```typescript
import { JSONPath } from "../src/lib/jsonpath.ts";

// Abfrage via HTMX/Alpine:
// path: "$.user.balance.currency()" -> "125,50 €"

const jp = new JSONPath(sessionData, {
  customFunctions: {
    mask: (_) => "********",
    currency: (val) => `${val.toFixed(2)} €`,
  },
});
```