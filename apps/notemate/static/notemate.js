/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

// Configure marked with highlight.js for syntax highlighting
function configureMarkedHighlight() {
  if (typeof window.marked !== "undefined") {
    window.marked.use({
      renderer: {
        code({ text, lang }) {
          let highlighted = text;
          const hasHljs = typeof window.hljs !== "undefined";
          const validLang = lang && hasHljs && window.hljs.getLanguage(lang) ? lang : null;

          if (hasHljs) {
            try {
              if (validLang) {
                highlighted = window.hljs.highlight(text, { language: validLang, ignoreIllegals: true }).value;
              } else {
                highlighted = window.hljs.highlightAuto(text).value;
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
    viewMode: Alpine.$persist("split").as("notemate_view_mode_v1"),
    expandedFolders: Alpine.$persist([]).as("notemate_expanded_v1"),
    activePath: Alpine.$persist("Willkommen.md").as("notemate_active_path_v1"),

    tree: [],
    // Note State (Top-level properties to comply with Alpine CSP AST parser)
    notePath: "",
    noteTitle: "",
    noteContent: "",
    noteUpdatedAt: null,
    isDirty: false,

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
      window.addEventListener("keydown", (e) => {
        // Ctrl+S / Cmd+S: Save Note
        if ((e.ctrlKey || e.metaKey) && e.key === "s") {
          e.preventDefault();
          this.saveCurrentNote();
        }
      });
    },

    showToast(message, duration = 3000) {
      this.toastMessage = message;
      if (this.toastTimeout) clearTimeout(this.toastTimeout);
      this.toastTimeout = setTimeout(() => {
        this.toastMessage = null;
      }, duration);
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
      return Array.isArray(this.expandedFolders) &&
        this.expandedFolders.includes(folderPath);
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
        const res = await fetch(
          `./api/notes?path=${encodeURIComponent(path)}`,
        );
        if (res.ok) {
          const data = await res.json();
          this.notePath = data.note.path;
          this.noteTitle = data.note.title;
          this.noteContent = data.note.content;
          this.noteUpdatedAt = data.note.updatedAt;
          this.isDirty = false;
          this.activePath = data.note.path;

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
        this.noteUpdatedAt = data.note.updatedAt;
        this.isDirty = false;
        this.showToast("✓ Notiz gespeichert");
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

      const cleanName = name.trim().endsWith(".md")
        ? name.trim()
        : `${name.trim()}.md`;
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

      const fullPath = parentDir
        ? `${parentDir}/${name.trim()}`
        : name.trim();

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

      const cleanNew = isFile
        ? (newName.trim().endsWith(".md") ? newName.trim() : `${newName.trim()}.md`)
        : newName.trim();
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

      this.noteContent =
        current.substring(0, start) + text + current.substring(end);

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

    // Markdown rendering
    renderMarkdown(content) {
      if (!content) return "";
      // Normalize absolute /attachments/ paths to relative ./attachments/
      // so images load smoothly behind reverse proxies, Tailscale, and code-server
      const normalized = content.replace(
        /(\!\[.*?\]\()(?:\/|\.\/)?attachments\/([^)]+)(\))/g,
        "$1./attachments/$2$3",
      );
      if (typeof window.marked !== "undefined" && window.marked.parse) {
        return window.marked.parse(normalized);
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
