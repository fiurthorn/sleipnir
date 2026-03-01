# Sleipnir Stack Template 🐎

Ein präziser, moderner Web-Stack basierend auf **Hono**, **HTMX** und **Alpine.js**, konzipiert als leistungsstarkes Starter-Template für die **Deno** Runtime.

Sleipnir schließt die Lücke zwischen Server-Side Sessions und Client-Side UI durch eine hochperformante, modernisierte **TypeScript-Architektur**. 
Es verzichtet bewusst auf Heavy-Duty SPA-Frameworks und setzt stattdessen auf Server-Side Rendering mit punktueller, dynamischer Interaktivität am Client (HTML-over-the-Wire).

Dieses Template bildet das Fundament für moderne Web-Applikationen (wie z.B. *Cookmate*).

## 🛠 Kern-Features

- **Minimaler Footprint:** Nutzt das Deno-Ökosystem für schnelle Kaltstarts, native TypeScript-Unterstützung und effizientes Dependency Management ohne `node_modules` (sofern reines Deno genutzt wird).
- **Hono + HTMX:** Performantes Edge-Routing mit Hono. Dynamische UI-Updates werden deklarativ über HTMX abgewickelt.
- **Zero-Inertia State:** Alpine.js kümmert sich um isolierte UI-Zustände im Frontend (inklusive dem `$persist` Plugin für lokalen State), während kritische Geschäftsdaten sicher im Server-Side Session-Store bleiben.
- **Deep-Key Resolution:** Direkter, typsicherer Zugriff auf verschachtelte Session-Datenstrukturen im Backend via JSONPath, der komplexe State-Abfragen vereinfacht. (Details: [JSONPath API Referenz](doc/jsonpath.md))
- **Tailwind CSS Integration:** Styling ist direkt über Utility-Classes möglich.

## 🚀 Entwicklung & Start

Um ein Projekt auf Basis dieses Templates lokal auszuführen, wird **Deno** benötigt.

```bash
# Entwicklungsserver starten (Watch-Mode)
deno task dev
```

Die Anwendung ist standardmäßig unter `http://localhost:3001` (oder dem durch die `PORT` Umgebungsvariable definierten Port) erreichbar.

## 🗄 Session Management (Sleipnir API)

Das Session Management ist das Herzstück der Datenhaltung im Backend. Es bietet einfachen, typisierten Zugriff auf den Anwenderstatus.

```typescript
import { getSessionData, updateSessionData } from "./src/server/session.ts";

// Abfrage der aktuellen Session-Daten (inklusive JSONPath Support)
const data = await getSessionData(c);

// ... Modifikation der Daten ...

// Speichern der Änderungen in den Deno KV Store
await updateSessionData(c, data);
```

---
*Architektur & Review: Stefan | Implementation & Synthese: Sam (AI Peer)*
*Erarbeitet im gemeinschaftlichen Dialog.*