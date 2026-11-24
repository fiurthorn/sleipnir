# 🐎 Sleipnir Workspace — Agenten-Leitfaden & Gesetzbuch

Willkommen im **Sleipnir Monorepo** (Deno 2 + Hono + TSX + Alpine.js + HTMX +
DaisyUI).\
Dieses Dokument definiert die verbindlichen architektonischen Leitplanken,
Code-Standards und Verhaltensregeln für alle KI-Agenten und Entwickler, die an
diesem Workspace arbeiten.

---

## 🏛 1. Identität & Kodex der Zusammenarbeit (Joint Authorship)

Code und Dokumentation sind das Ergebnis eines **kollektiven
Pair-Programming-Prozesses** zwischen **Stefan** (Mensch / Senior-Architekt) und
**Sam** (KI-Peer).

### Mandatory Code Header (Einweb-Regel)

Jede neu erstellte oder maßgeblich refaktorierte TypeScript-/TSX-Datei **muss**
im Dateikopf folgenden Hinweis tragen:

```typescript
/**
 * @project Sleipnir Stack / [Modul oder App Name]
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */
```

---

## ⚖️ 2. Die 6 Eisernen Architektur-Gesetze

### ① Strikte Typisierung — Absolutes `any`-Verbot

- Es gibt **kein `any`** im gesamten Codebase.
- Nutze `unknown` für noch unbestimmte Typen und verifiziere sie über Type
  Guards (`typeof`, `instanceof`, Zod oder Valibot).
- Öffentliche APIs in Packages (`packages/sleipnir`) verlangen **vollständig
  explizite Typen und Rückgabetypen** (JSR `no-slow-types` Standard).
- Nutze `import type` für reine Typ-Imports (`verbatim-module-syntax`).

### ② Bouncer-Pattern (Boundary Validation)

- Jede Funktion, API-Route oder Server-Aktion, die externe Daten (Query-Params,
  Request-Body, FormData, KV-Werte) entgegennimmt, **validiert diese sofort an
  der Grenze**.
- Fehlerhafte Inputs führen zum sofortigen Abbruch mit passendem HTTP-Status (z.
  B. `400 Bad Request`).
- Ungültige Daten gelangen niemals tiefer in die Domänenlogik.

```typescript
// ✅ GUT (Bouncer-Pattern & Early Return)
async function Set(c: SleipnirContext) {
  const key = c.req.query("key");
  if (!key) {
    return c.text("no key sent", 400);
  }

  const value = c.req.query("value");
  if (!value) {
    return c.text("no value sent", 400);
  }
  // ... Weiterverarbeitung
}

// ❌ SCHLECHT (Verzögerte oder fehlende Validierung)
async function Set(c: SleipnirContext) {
  const key = c.req.query("key");
  const value = c.req.query("value");
  result[key] = JSON.parse(value); // BUMM bei invalidem JSON oder undefined
}
```

### ③ Flacher Kontrollfluss (Guard Clauses & Early Returns)

- **Vermeide `else`-Blöcke**, wo immer eine Umstrukturierung oder ein Early
  Return die Schachtelungstiefe reduziert.
- Halte die Einrückungstiefe flach (maximal 2–3 Ebenen).

```typescript
// ✅ GUT: Guard Clause
if (!user.isAuthenticated) {
  return c.redirect("/login");
}
return c.html(<Dashboard user={user} />);

// ❌ SCHLECHT: Unnötige Schachtelung
if (user.isAuthenticated) {
  return c.html(<Dashboard user={user} />);
} else {
  return c.redirect("/login");
}
```

### ④ Deno-First Toolchain — Kein Node-Bloat

- Wir verwenden **weder ESLint noch Prettier**.
- Formatter und Linter kommen nativ aus Deno:
  - Formattierung: `deno fmt`
  - Linting: `deno lint`
  - Type-Check: `deno check`
- Zusätzliche npm-DevDependencies für Tooling sind verboten, es sei denn, Stefan
  genehmigt sie ausdrücklich.

### ⑤ Secure by Design & Secret Hygiene

- **Niemals** Zugangsdaten, Passwörter, echte E-Mails oder API-Keys im Code oder
  in Testdateien ablegen.
- `.env`-Dateien und temporäre Daten-Dumps (wie `test.ts`) bleiben in
  [`.gitignore`](file:///.gitignore).
- Sensible Secrets im Server immer über `Deno.env.get("...")` laden.

### ⑥ API- & MCP-Parität (Dual-Interface-Prinzip)

- Jeder neue Domänen-Endpunkt (REST-API) in einer App mit MCP-Server
  (`mountMcp`) wird **standardmäßig auch als MCP-Tool** bereitgestellt (sofern
  keine reine Browser-/UI-Mechanik wie Cookie-Gates oder Datei-Uploads).
- Beide Schnittstellen (HTTP-API und MCP) delegieren an denselben
  Domain-/Storage-Service – **keine duplizierte Business-Logik**.
- MCP-Tools nutzen konsequent `MCP_ANNOTATIONS` (`readOnly`, `write`,
  `writeIdempotent`, `destructive`) und Zod-Schemas mit klaren Beschreibungen.

---

## 🗂 3. Workspace-Topologie

```text
sleipnir/
├── deno.json                       # Workspace-Root ("workspace": ["./packages/*", "./apps/*"])
├── Justfile                        # Zentrale Lifecycle-Orchestrierung (Module: chatmate, notemate, scanmate, theme)
├── packages/
│   ├── sleipnir/                   # @sleipnir/core
│   │   ├── mod.ts                  # Öffentliche Schnittstelle des Core-Frameworks
│   │   └── src/                    # Sleipnir (Hono-Wrapper), Sessions, KV, JSONPath, Assets
│   └── sleipnir-theme/             # Corvus & Fiurthorn Theme-Paket
└── apps/
    ├── chatmate/                   # Chat- & Bildgenerator-App (Port 3002)
    │   ├── Justfile                # App-Justfile (serve, check, build-css, watch-css)
    │   ├── main.ts                 # App-Einstieg
    │   ├── src/                    # Chat-UI, SSE / Prompt-Handling, Image-Gen
    │   └── static/                 # Styles, Vendor-Scripts
    │
    ├── notemate/                   # Hierarchische Markdown-Notizen, Rezepte & Kanban (Port 3003)
    │   ├── Justfile                # App-Justfile (serve, check, build-css, watch-css)
    │   ├── main.ts                 # App-Einstieg
    │   ├── src/                    # Notes-UI, Kanban, Storage-Service, Attachments
    │   └── static/                 # Styles, Client-Script
    │
    └── scanmate/                   # Dokumenten-Scanner & Archiv-App (Port 3004)
        ├── Justfile                # App-Justfile (serve, check, build-css, watch-css)
        ├── main.ts                 # App-Einstieg
        ├── src/                    # Scan-UI, PDF- & KI-Triage-Services
        └── static/                 # Styles, Vendor-Scripts
```

### Abhängigkeits-Richtung (Clean Architecture):

- `apps/*` dürfen `@sleipnir/core` importieren.
- `packages/*` dürfen **niemals** Code aus `apps/*` importieren (Abhängigkeiten
  zeigen nach innen).
- Apps untereinander sind vollständig entkoppelt.

---

## 🛠 4. Lifecycle & Entwickler-Befehle

Alle Operationen werden über das [`Justfile`](file:///Justfile) gesteuert. Durch Just-Submodule können Apps entweder direkt aus dem Root oder im App-Ordner gesteuert werden:

| Task                     | Befehl (Root)         | Befehl (App-Verzeichnis) | Zweck                                                     |
| ------------------------ | --------------------- | ------------------------ | --------------------------------------------------------- |
| **Chatmate starten**     | `just chatmate serve` | `just serve`             | Startet Chatmate auf `http://localhost:3002` (Watch-Mode) |
| **Notemate starten**     | `just notemate serve` | `just serve`             | Startet Notemate auf `http://localhost:3003` (Watch-Mode) |
| **Scanmate starten**     | `just scanmate serve` | `just serve`             | Startet Scanmate auf `http://localhost:3004` (Watch-Mode) |
| **CSS kompilieren**      | `just build-css`      | `just build-css`         | Baut Tailwind v4 + DaisyUI für alle Apps                  |
| **Type Check**           | `just check`          | `just check`             | Führt `deno check` über das gesamte Monorepo aus          |
| **Tests ausführen**      | `just test`           | -                        | Führt die Unit-Testsuite aus (`deno test`)                |
| **Linting**              | `just lint`           | -                        | Prüft alle Workspace-Dateien auf Code-Smells              |
| **Formatierung**         | `just fmt`            | -                        | Formatiert das Monorepo nach Deno-Standard                |
| **Git-Hooks einrichten** | `just install-hooks`  | -                        | Aktiviert den Pre-Commit Hook via Symlink                 |

---

## 🚦 5. Checkliste vor jedem Commit / Task-Abschluss

Das Repository schützt sich selbst über einen automatisierten **Git Pre-Commit
Hook** ([`utils/hooks/pre-commit`](file:///utils/hooks/pre-commit)).

Bevor ein Agent seine Arbeit für beendet erklärt, müssen **alle Stufen**
fehlerfrei sein:

1. `just check` $\rightarrow$ 0 TypeScript-Fehler.
2. `just test` $\rightarrow$ Alle Tests grün.
3. `just lint` $\rightarrow$ 0 Linter-Warnungen.
4. `just fmt` $\rightarrow$ Sauber formatiert.
5. Header-Check $\rightarrow$ Neuer/refaktorierter Code enthält den _Stefan &
   Sam_-Kodex-Header.
6. API/MCP-Parität $\rightarrow$ Neue Fach-Endpunkte auch als MCP-Tool
   prüfen/ergänzen.
7. Git-Hook $\rightarrow$ Ein `git commit` läuft automatisch durch alle
   Validierungen.
