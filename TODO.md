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
- [x] **Token-Schutz für multimodale Verläufe:**
  - Ältere Bilder im Verlauf belasten das Token-Budget und Payload-Größen.
  - _Umgesetzt:_ Nur das Bild des aktuellsten Turns wird als volles
    Base64-Payload übertragen. Ältere Bilder im Verlauf werden durch schlanke
    Referenzmarker ersetzt, bleiben aber im UI/LocalStorage voll erhalten.

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

---

## 3. Drittes Modul: `scanmate` (Mobile Document & Receipt Scanner)

> **Vision:** Mobile-First Web-Anwendung zur schnellen Erfassung von Dokumenten,
> Belegen, Quittungen und Rezepten direkt vom Smartphone im Tailscale-Netzwerk.
> Digitalisieren, zuschneiden, bündeln, per KI analysieren und als PDF mit
> JSON-Sidecar ablegen.

### Workflow & Kernfunktionen:

- [x] **Kamera & Bild-Erfassung (Mobile-First):**
  - Direkter Kamera-Zugriff über HTML5 Capture / MediaStream API.
  - Multi-Page-Modus: Mehrere Seiten nacheinander fotografieren.
- [x] **Perspektiv-Korrektur & Cropping:**
  - Manuelles und/oder automatisches Kantenerkennen und Entzerren (z. B. via
    Canvas / `jscanify` / `OpenCV`).
  - Drehen, Kontrastanpassung (Schwarz/Weiß-, Graustufen- oder Farb-Filter).
- [x] **PDF-Bündelung:**
  - Zusammenschluss der zugeschnittenen Seiten zu einer kompakten PDF-Datei (via
    `pdf-lib`).
- [x] **KI-Metadaten-Synthese (Vision LLM):**
  - Übergabe der Scans an ein multimodales Vision-Modell (OpenRouter / Venice /
    lokal).
  - Automatisches Extrahieren strukturierter Metadaten als JSON:
    - **Kategorie:** (z. B. _Rechnung_, _Quittung_, _Vertrag_, _Rezept_,
      _Brief_)
    - **Datum & Aussteller / Absender**
    - **Beträge / Posten** (bei Quittungen & Rechnungen)
    - **Tags / Stichwörter**
    - **Extrahierter OCR-Volltext & Kurz-Zusammenfassung**
- [x] **Sidecar-Ablage (Filesystem als Single Source of Truth):**
  - Ablage des Dokuments als `[YYYY-MM-DD]_[Titel].pdf`.
  - Sidecar-Datei `[YYYY-MM-DD]_[Titel].json` direkt daneben im Verzeichnis (`./data/documents`).
- [x] **Indizierung & Suche:**
  - Schnelle Suche und Filterung über die JSON-Metadaten, Absender, Tags und Volltexte im UI.
