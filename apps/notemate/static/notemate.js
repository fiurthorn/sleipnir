/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

// Configure marked with highlight.js for syntax highlighting
function configureMarkedHighlight() {
  if (typeof globalThis.marked !== "undefined") {
    globalThis.marked.use({
      renderer: {
        code({ text, lang }) {
          let highlighted = text;
          const hasHljs = typeof globalThis.hljs !== "undefined";
          const validLang = lang && hasHljs && globalThis.hljs.getLanguage(lang) ? lang : null;

          if (hasHljs) {
            try {
              if (validLang) {
                highlighted = globalThis.hljs.highlight(text, {
                  language: validLang,
                  ignoreIllegals: true,
                }).value;
              } else {
                highlighted = globalThis.hljs.highlightAuto(text).value;
              }
            } catch {
              highlighted = text;
            }
          }

          const langBadge = lang
            ? `<span class="absolute top-2 right-2 text-[10px] uppercase font-mono opacity-50 px-1.5 py-0.5 rounded bg-base-300/80 select-none">${lang}</span>`
            : "";
          const langClass = validLang ? ` language-${validLang}` : "";

          return `<div class="relative group my-3"><pre class="hljs rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed"><code class="${langClass}">${highlighted}</code></pre>${langBadge}</div>`;
        },
      },
    });
  }
}
configureMarkedHighlight();

document.addEventListener("alpine:init", () => {
  Alpine.data("notemate", () => ({
    // Persistent view settings
    viewMode: Alpine.$persist(
      globalThis.innerWidth < 1024 ? "preview" : "split",
    ).as("notemate_view_mode_v1"),
    expandedFolders: Alpine.$persist([]).as("notemate_expanded_v1"),
    activePath: Alpine.$persist("Willkommen.md").as("notemate_active_path_v1"),

    tree: [],
    // Note State (Top-level properties to comply with Alpine CSP AST parser)
    notePath: "",
    noteTitle: "",
    noteContent: "",
    noteUpdatedAt: null,
    isDirty: false,

    // Recipe Servings Scaling Module
    recipeBaseServings: null,
    recipeCurrentServings: null,

    get currentNote() {
      return {
        path: this.notePath,
        title: this.noteTitle,
        content: this.noteContent,
        updatedAt: this.noteUpdatedAt,
        dirty: this.isDirty,
      };
    },
    mobileMenuOpen: false,
    isLoading: false,
    isSaving: false,
    toastMessage: null,
    toastTimeout: null,

    // Search
    searchQuery: "",
    searchResults: [],
    isSearching: false,

    async init() {
      await this.refreshTree();

      // Open active note or first available note
      let loaded = false;
      if (this.activePath) {
        loaded = await this.loadNote(this.activePath, false);
      }
      if (!loaded) {
        const firstFile = this.findFirstFile(this.tree);
        if (firstFile) {
          await this.loadNote(firstFile.path, false);
        }
      }

      // Keyboard shortcuts
      globalThis.addEventListener("keydown", (e) => {
        // Ctrl+S / Cmd+S: Save Note
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          this.saveCurrentNote();
        }
      });
    },

    showToast(message, duration = 3000) {
      if (typeof globalThis.showAlert === "function") {
        const lower = String(message).toLowerCase();
        const isError = lower.includes("fehler") || lower.includes("error");
        const isSuccess = String(message).startsWith("✓");
        const level = isError ? "error" : isSuccess ? "success" : "info";
        globalThis.showAlert(message, level, duration);
      }
    },

    async refreshTree() {
      try {
        const res = await fetch("./api/tree");
        if (res.ok) {
          const data = await res.json();
          this.tree = data.tree || [];
        }
      } catch (err) {
        console.error("Failed to load file tree:", err);
      }
    },

    findFirstFile(nodes) {
      for (const node of nodes) {
        if (node.type === "file") return node;
        if (node.type === "directory" && node.children) {
          const found = this.findFirstFile(node.children);
          if (found) return found;
        }
      }
      return null;
    },

    isFolderExpanded(folderPath) {
      return (
        Array.isArray(this.expandedFolders) &&
        this.expandedFolders.includes(folderPath)
      );
    },

    toggleFolder(folderPath) {
      if (this.isFolderExpanded(folderPath)) {
        this.expandedFolders = this.expandedFolders.filter(
          (p) => p !== folderPath,
        );
      } else {
        this.expandedFolders = [...(this.expandedFolders || []), folderPath];
      }
    },

    selectTreeItem(item) {
      if (!item) return;
      if (item.type === "directory") {
        this.toggleFolder(item.path);
      } else {
        this.loadNote(item.path);
        this.mobileMenuOpen = false;
      }
    },

    selectSearchResult(path) {
      if (!path) return;
      this.loadNote(path);
      this.clearSearch();
      this.mobileMenuOpen = false;
    },

    get visibleTreeItems() {
      const list = [];
      const traverse = (nodes, depth = 0) => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          list.push({ ...node, depth });
          if (
            node.type === "directory" &&
            node.children &&
            this.isFolderExpanded(node.path)
          ) {
            traverse(node.children, depth + 1);
          }
        }
      };
      traverse(this.tree, 0);
      return list;
    },

    async loadNote(path, checkDirty = true) {
      if (!path) return false;
      if (checkDirty && this.isDirty) {
        const confirmSwitch = confirm(
          "Du hast ungespeicherte Änderungen. Möchtest du trotzdem wechseln?",
        );
        if (!confirmSwitch) return false;
      }

      this.isLoading = true;
      try {
        const res = await fetch(`./api/notes?path=${encodeURIComponent(path)}`);
        if (res.ok) {
          const data = await res.json();
          this.notePath = data.note.path;
          this.noteTitle = data.note.title;
          this.noteContent = data.note.content;
          this.noteUpdatedAt = data.note.updatedAt;
          this.isDirty = false;
          this.activePath = data.note.path;

          // Detect recipe frontmatter
          this.recipeBaseServings = null;
          this.recipeCurrentServings = null;
          this.detectRecipe(data.note.content);

          // Auto-expand parent folders
          const parts = path.split("/");
          parts.pop(); // remove filename
          let currentAcc = "";
          for (const part of parts) {
            currentAcc = currentAcc ? `${currentAcc}/${part}` : part;
            if (!this.expandedFolders.includes(currentAcc)) {
              this.expandedFolders = [...this.expandedFolders, currentAcc];
            }
          }
          return true;
        }
        return false;
      } catch (err) {
        this.showToast("Fehler beim Laden der Notiz: " + err.message);
        return false;
      } finally {
        this.isLoading = false;
      }
    },

    markDirty() {
      this.isDirty = true;
      this.detectRecipe(this.noteContent);
    },

    async saveCurrentNote() {
      if (!this.notePath) return;

      this.isSaving = true;
      try {
        const res = await fetch("./api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: this.notePath,
            content: this.noteContent,
          }),
        });

        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }

        const data = await res.json();
        if (data.note?.content) {
          this.noteContent = data.note.content;
          this.detectRecipe(this.noteContent);
        }
        this.noteUpdatedAt = data.note.updatedAt;
        this.isDirty = false;
        this.showToast("✓ Notiz formatiert & gespeichert");
        await this.refreshTree();
      } catch (err) {
        this.showToast("Fehler beim Speichern: " + err.message);
      } finally {
        this.isSaving = false;
      }
    },

    async createNewNote(parentDir = "", event = null) {
      if (event && event.stopPropagation) event.stopPropagation();
      const defaultName = "Neue Notiz";
      const name = prompt("Name der neuen Notiz:", defaultName);
      if (!name || !name.trim()) return;

      const cleanName = name.trim().endsWith(".md") ? name.trim() : `${name.trim()}.md`;
      const fullPath = parentDir ? `${parentDir}/${cleanName}` : cleanName;

      this.isSaving = true;
      try {
        const res = await fetch("./api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: fullPath,
            content: `# ${name.trim().replace(/\.md$/, "")}\n\n`,
          }),
        });

        if (res.ok) {
          await this.refreshTree();
          await this.loadNote(fullPath);
          this.showToast("✓ Notiz angelegt");
        }
      } catch (err) {
        this.showToast("Fehler beim Erstellen: " + err.message);
      } finally {
        this.isSaving = false;
      }
    },

    async createNewFolder(parentDir = "") {
      const name = prompt("Name des neuen Ordners:");
      if (!name || !name.trim()) return;

      const fullPath = parentDir ? `${parentDir}/${name.trim()}` : name.trim();

      try {
        const res = await fetch("./api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: fullPath }),
        });

        if (res.ok) {
          if (!this.expandedFolders.includes(fullPath)) {
            this.expandedFolders.push(fullPath);
          }
          await this.refreshTree();
          this.showToast("✓ Ordner erstellt");
        }
      } catch (err) {
        this.showToast("Fehler beim Erstellen des Ordners: " + err.message);
      }
    },

    async deleteItem(path, isDirectory = false, event = null) {
      if (event && event.stopPropagation) event.stopPropagation();
      const label = isDirectory ? "diesen Ordner inklusive Inhalt" : "diese Notiz";
      if (!confirm(`Möchtest du ${label} wirklich löschen?`)) return;

      try {
        const res = await fetch(
          `./api/notes?path=${encodeURIComponent(path)}`,
          { method: "DELETE" },
        );

        if (res.ok) {
          this.showToast("✓ Gelöscht");
          await this.refreshTree();
          if (this.notePath === path) {
            const first = this.findFirstFile(this.tree);
            if (first) {
              await this.loadNote(first.path);
            } else {
              this.notePath = "";
              this.noteTitle = "";
              this.noteContent = "";
              this.noteUpdatedAt = null;
              this.isDirty = false;
            }
          }
        }
      } catch (err) {
        this.showToast("Fehler beim Löschen: " + err.message);
      }
    },

    async renameItem(oldPath, event = null) {
      if (event && event.stopPropagation) event.stopPropagation();
      const currentName = oldPath.split("/").pop() || "";
      const isFile = oldPath.endsWith(".md");
      const defaultName = isFile ? currentName.replace(/\.md$/, "") : currentName;

      const newName = prompt("Neuer Name:", defaultName);
      if (!newName || !newName.trim() || newName.trim() === defaultName) return;

      const parts = oldPath.split("/");
      parts.pop();
      const parentDir = parts.join("/");

      const cleanNew = isFile ? newName.trim().endsWith(".md") ? newName.trim() : `${newName.trim()}.md` : newName.trim();
      const newPath = parentDir ? `${parentDir}/${cleanNew}` : cleanNew;

      try {
        const res = await fetch("./api/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath, newPath }),
        });

        if (res.ok) {
          this.showToast("✓ Umbenannt");
          await this.refreshTree();
          if (this.notePath === oldPath) {
            await this.loadNote(newPath);
          }
        }
      } catch (err) {
        this.showToast("Fehler beim Umbenennen: " + err.message);
      }
    },

    // Clipboard & Drag-and-Drop Image Paste
    async handlePaste(event) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            await this.uploadAndInsertImage(file, event.target);
            return;
          }
        }
      }
    },

    async handleDrop(event) {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          event.preventDefault();
          await this.uploadAndInsertImage(files[i], event.target);
          return;
        }
      }
    },

    async uploadAndInsertImage(file, textarea) {
      this.showToast("🖼️ Lade Bild hoch...");

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const dataUrl = e.target.result;
          const res = await fetch("./api/attachments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filename: file.name || "pasted_image.png",
              dataUrl,
              notePath: this.notePath,
            }),
          });

          if (!res.ok) {
            throw new Error("HTTP " + res.status);
          }

          const data = await res.json();
          this.insertTextAtCursor(textarea, `\n${data.markdown}\n`);
          this.markDirty();
          this.showToast("✓ Bild eingefügt");
        } catch (err) {
          this.showToast("Fehler beim Einfügen des Bildes: " + err.message);
        }
      };
      reader.readAsDataURL(file);
    },

    insertTextAtCursor(textarea, text) {
      if (!textarea) {
        this.noteContent += text;
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = this.noteContent;

      this.noteContent = current.substring(0, start) + text + current.substring(end);

      this.$nextTick(() => {
        textarea.focus();
        textarea.setSelectionRange(start + text.length, start + text.length);
      });
    },

    // Search
    async performSearch() {
      const q = this.searchQuery.trim();
      if (!q) {
        this.searchResults = [];
        this.isSearching = false;
        return;
      }

      this.isSearching = true;
      try {
        const res = await fetch(`./api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          this.searchResults = data.results || [];
        }
      } catch (err) {
        console.error("Search error:", err);
      }
    },

    clearSearch() {
      this.searchQuery = "";
      this.searchResults = [];
      this.isSearching = false;
    },

    onSearchKeydown(event) {
      if (event && event.key === "Escape") {
        this.clearSearch();
      }
    },

    // Recipe Scaling Module Methods
    detectRecipe(content) {
      if (!content) {
        this.recipeBaseServings = null;
        this.recipeCurrentServings = null;
        return;
      }
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!fmMatch) {
        this.recipeBaseServings = null;
        this.recipeCurrentServings = null;
        return;
      }
      const servingsMatch = fmMatch[1].match(
        /(?:servings|portionen|portions|menge|yield):\s*(\d+(?:[.,]\d+)?)/i,
      );
      if (servingsMatch) {
        const base = parseFloat(servingsMatch[1].replace(",", "."));
        if (!isNaN(base) && base > 0) {
          if (this.recipeBaseServings !== base) {
            this.recipeBaseServings = base;
            this.recipeCurrentServings = base;
          }
          return;
        }
      }
      this.recipeBaseServings = null;
      this.recipeCurrentServings = null;
    },

    incrementServings() {
      const current = typeof this.recipeCurrentServings === "number" ? this.recipeCurrentServings : parseFloat(this.recipeCurrentServings) ||
        this.recipeBaseServings ||
        1;
      this.recipeCurrentServings = Math.round((current + 1) * 10) / 10;
    },

    decrementServings() {
      const current = typeof this.recipeCurrentServings === "number" ? this.recipeCurrentServings : parseFloat(this.recipeCurrentServings) ||
        this.recipeBaseServings ||
        1;
      if (current > 1) {
        this.recipeCurrentServings = Math.round((current - 1) * 10) / 10;
      }
    },

    resetServings() {
      this.recipeCurrentServings = this.recipeBaseServings;
    },

    formatNumber(val) {
      if (Math.abs(val - Math.round(val)) < 0.005) {
        return Math.round(val).toString();
      }
      const rounded = (Math.round(val * 100) / 100)
        .toFixed(2)
        .replace(/\.?0+$/, "");
      return rounded.replace(".", ",");
    },

    scaleQuantityString(str, multiplier) {
      if (!str) return str;
      const clean = str.replace(/\*/g, "").trim();

      // Fraction e.g. 1/2
      const fracMatch = clean.match(/^(\d+)\/(\d+)$/);
      if (fracMatch) {
        const val = parseInt(fracMatch[1], 10) / parseInt(fracMatch[2], 10);
        return this.formatNumber(val * multiplier);
      }

      // Mixed fraction e.g. 1 1/2
      const mixedFracMatch = clean.match(/^(\d+)\s+(\d+)\/(\d+)$/);
      if (mixedFracMatch) {
        const val = parseInt(mixedFracMatch[1], 10) +
          parseInt(mixedFracMatch[2], 10) / parseInt(mixedFracMatch[3], 10);
        return this.formatNumber(val * multiplier);
      }

      // Range e.g. 2-3 or 2 - 3
      const rangeMatch = clean.match(
        /^(\d+(?:[.,]\d+)?)\s*[-–]\s*(\d+(?:[.,]\d+)?)$/,
      );
      if (rangeMatch) {
        const v1 = parseFloat(rangeMatch[1].replace(",", "."));
        const v2 = parseFloat(rangeMatch[2].replace(",", "."));
        return `${this.formatNumber(v1 * multiplier)} - ${
          this.formatNumber(
            v2 * multiplier,
          )
        }`;
      }

      const hasDigits = /\d/.test(clean);
      if (!hasDigits) return str;

      return clean.replace(/(\d+(?:[.,]\d+)?)/g, (match) => {
        const num = parseFloat(match.replace(",", "."));
        if (isNaN(num)) return match;
        return this.formatNumber(num * multiplier);
      });
    },

    scaleIngredientsTable(content, multiplier) {
      if (!multiplier || multiplier === 1) return content;

      const lines = content.split("\n");
      let tableStart = -1;
      let delimiterIdx = -1;
      let tableEnd = -1;

      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        const nextLine = lines[i + 1].trim();

        if (
          line.includes("|") &&
          /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(nextLine)
        ) {
          tableStart = i;
          delimiterIdx = i + 1;
          break;
        }
      }

      if (tableStart === -1 || delimiterIdx === -1) {
        return content;
      }

      for (let i = delimiterIdx + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || !line.includes("|")) {
          tableEnd = i;
          break;
        }
      }
      if (tableEnd === -1) {
        tableEnd = lines.length;
      }

      const headerLine = lines[tableStart];
      const hasOuterPipes = headerLine.trim().startsWith("|") && headerLine.trim().endsWith("|");
      const rawHeaders = hasOuterPipes ? headerLine.trim().slice(1, -1).split("|") : headerLine.split("|");
      const headers = rawHeaders.map((h) => h.trim().toLowerCase());

      let qtyCol = headers.findIndex((h) => /^(?:menge|amount|qty|anzahl|portionen?)$/i.test(h));

      if (qtyCol === -1) {
        qtyCol = headers.findIndex((h) => /(?:menge|amount|qty|anzahl)/i.test(h));
      }

      if (qtyCol === -1 && delimiterIdx + 1 < tableEnd) {
        const firstRow = lines[delimiterIdx + 1].trim();
        const firstCells = hasOuterPipes ? firstRow.slice(1, -1).split("|") : firstRow.split("|");
        for (let c = 0; c < firstCells.length; c++) {
          if (/^\s*\d+(?:[.,]\d+)?\s*$/.test(firstCells[c])) {
            qtyCol = c;
            break;
          }
        }
      }

      if (qtyCol === -1) return content;

      for (let i = delimiterIdx + 1; i < tableEnd; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const rowHasOuterPipes = trimmed.startsWith("|") && trimmed.endsWith("|");
        const rawCells = rowHasOuterPipes ? trimmed.slice(1, -1).split("|") : line.split("|");

        if (qtyCol < rawCells.length) {
          const orig = rawCells[qtyCol].trim();
          const scaled = this.scaleQuantityString(orig, multiplier);
          if (scaled !== orig) {
            rawCells[qtyCol] = ` **${scaled}** `;
            lines[i] = rowHasOuterPipes ? `|${rawCells.join("|")}|` : rawCells.join("|");
          }
        }
      }

      return lines.join("\n");
    },

    get renderedMarkdown() {
      return this.renderMarkdown(this.noteContent, this.recipeCurrentServings);
    },

    // Markdown rendering
    renderMarkdown(content, servings) {
      if (!content) return "";
      let processed = content;

      // 1. Strip YAML frontmatter for rendering
      processed = processed.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");

      // 2. Recipe table scaling
      const rawServings = typeof servings !== "undefined" ? servings : this.recipeCurrentServings;
      const currentServings = typeof rawServings === "number" ? rawServings : parseFloat(rawServings);

      if (
        this.recipeBaseServings &&
        !isNaN(currentServings) &&
        currentServings > 0 &&
        currentServings !== this.recipeBaseServings
      ) {
        const multiplier = currentServings / this.recipeBaseServings;
        processed = this.scaleIngredientsTable(processed, multiplier);
      }

      // 3. Normalize absolute /attachments/ paths to relative ./attachments/
      // so images load smoothly behind reverse proxies, Tailscale, and code-server
      const normalized = processed
        .replace(
          /(\!\[.*?\]\()(?:\/|\.\/)?attachments\/([^)]+)(\))/g,
          "$1./attachments/$2$3",
        )
        .replace(
          /(<img\s+[^>]*src=["'])(?:\/|\.\/)?attachments\/([^"']+)(["'])/gi,
          "$1./attachments/$2$3",
        );

      if (typeof globalThis.marked !== "undefined" && globalThis.marked.parse) {
        return globalThis.marked.parse(normalized);
      }
      return normalized.replace(/\n/g, "<br>");
    },

    get charCount() {
      return this.noteContent ? this.noteContent.length : 0;
    },

    get wordCount() {
      if (!this.noteContent) return 0;
      return this.noteContent.trim().split(/\s+/).filter(Boolean).length;
    },

    formatDate(timestamp) {
      if (!timestamp) return "";
      return new Date(timestamp).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  }));
});
