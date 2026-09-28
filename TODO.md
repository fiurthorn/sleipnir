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

- [ ] **Hierarchische Ablage:**
  - Markdown-Dateien (`.md`) in echten verschachtelten Verzeichnissen auf dem
    Dateisystem (oder lokalem Workspace-Ordner).
  - Dateibaum-Navigation (Tree-View) in der Sidebar mit Ordner-Erstellung,
    Verschieben und Umbenennen.
- [ ] **Image Paste (`Strg+V` / Drag-and-Drop):**
  - Bilder direkt aus der Zwischenablage in das Editor-Feld pasten.
  - Automatisches Speichern des Bildes in einem lokalen Asset-Ordner (z. B.
    `assets/` oder `.attachments/`) und Einfügen der Markdown-Syntax:
    `![Bildbeschreibung](assets/image_20260928_1345.png)`.
- [ ] **Editor & Vorschau:**
  - Schneller Markdown-Editor mit Live-Preview oder umschaltbarem Modus (View /
    Edit).
  - Clean & tastaturbedienbar (Shortcuts für Speichern, Suchen, Formatieren).
- [ ] **Volltextsuche & Quick-Switcher:**
  - Schnelle Suche über Titel, Pfade und Notizinhalte.
- [ ] **Technologie-Stack:**
  - Sleipnir App (`apps/notemate`) basierend auf `@sleipnir/core`, Deno 2, Hono,
    Alpine.js und DaisyUI.
  - Keine relationale Monster-Datenbank nötig – die Filesystem-Struktur ist die
    Single Source of Truth.
