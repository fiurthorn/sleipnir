<!--
  @project Sleipnir Stack / Monorepo
  @authors Stefan & Sam (AI Peer)
  @collaboration Erarbeitet im gemeinschaftlichen Dialog.
  Architektur & Review: Stefan | Implementation & Synthese: Sam
-->

# Roadmap & Offene Punkte (TODO)

## 1. Chatmate: Kontext- & Historie-Architektur

- [ ] **Kontextfenster-Konfiguration:**
  - _Status quo:_ Feste Begrenzung auf die letzten 10 Nachrichten
    (`.slice(-10)`).
  - _Optionen:_
    - Standard auf 30–50 Nachrichten anheben (für Claude 3.5 Sonnet & GPT-4o
      kein Problem).
    - In den Einstellungen wählbar machen: _Kompakt (10)_, _Arbeitsmodus (30)_,
      _Vollständig (Alle Nachrichten des Chats)_.
- [ ] **System Prompt / Persona einstellbar:**
  - Konfigurierbarer System-Prompt (z. B. _„Senior Software Architect für
    Deno/TypeScript“_), der jedem Request als `role: "system"` vorangestellt
    wird.
  - Vordefinierte Presets (z. B. _Architekt_, _Code Reviewer_,
    _Kreativschreiber_, _Rezept-Berater_).
- [ ] **Token-Schutz für multimodale Verläufe:**
  - Ältere Bilder im Verlauf belasten das Token-Budget und Payload-Größen.
  - _Strategie:_ Nur das Bild des aktuellen bzw. der letzten 1–2 User-Turns als
    volles Vision-Base64 mitsenden; ältere Bilder im Prompt-Verlauf durch einen
    Textmarker `[Vorheriges Bild analysiert]` ersetzen.

---

## 2. Intermezzo: Neues Projekt `notemate` (Flatnotes-Alternative)

> **Vision:** Ein leichtgewichtiger, lokaler Notiz-Dienst nach dem Vorbild von
> _flatnotes_, aber mit **echter hierarchischer Dateiablage** (Verzeichnisbaum)
> und erstklassigem **Image-Paste** via Zwischenablage.

### Kernanforderungen:

- [x] **Hierarchische Ablage:**
  - Markdown-Dateien (`.md`) in echten verschachtelten Verzeichnissen auf dem
    Dateisystem (`./data/notes`).
  - Dateibaum-Navigation (Tree-View) in der Sidebar mit Ordner-Erstellung,
    Verschieben und Umbenennen.
- [x] **Image Paste (`Strg+V` / Drag-and-Drop):**
  - Bilder direkt aus der Zwischenablage in das Editor-Feld pasten.
  - Automatisches Speichern des Bildes im lokalen Asset-Ordner (`.attachments/`)
    und Einfügen der Markdown-Syntax: `![Bild](/attachments/...)`.
- [x] **Editor & Vorschau:**
  - Schneller Markdown-Editor mit Split-Screen, Edit- und Preview-Modus.
  - Tastaturbedienbar (`Strg+S` zum Speichern).
- [x] **Volltextsuche & Quick-Switcher:**
  - Schnelle Suche über Titel, Pfade und Notizinhalte mit Snippets.
- [x] **Technologie-Stack:**
  - Sleipnir App (`apps/notemate`) basierend auf `@sleipnir/core`, Deno 2, Hono,
    Alpine.js und DaisyUI (Port 3003, Befehl: `just dev-notemate`).
  - Keine relationale Monster-Datenbank nötig – die Filesystem-Struktur ist die
    Single Source of Truth.
