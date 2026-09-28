/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("notemate", () => ({
    // Persistent view settings
    viewMode: Alpine.$persist("split").as("notemate_view_mode_v1"),
    expandedFolders: Alpine.$persist([]).as("notemate_expanded_v1"),
    activePath: Alpine.$persist("Willkommen.md").as("notemate_active_path_v1"),

    // State
    tree: [],
    currentNote: {
      path: "",
      title: "",
      content: "",
      updatedAt: null,
      dirty: false,
    },
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
      if (this.activePath) {
        await this.loadNote(this.activePath);
      } else {
        const firstFile = this.findFirstFile(this.tree);
        if (firstFile) {
          await this.loadNote(firstFile.path);
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
      return this.expandedFolders.includes(folderPath);
    },

    toggleFolder(folderPath) {
      if (this.isFolderExpanded(folderPath)) {
        this.expandedFolders = this.expandedFolders.filter(
          (p) => p !== folderPath,
        );
      } else {
        this.expandedFolders.push(folderPath);
      }
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

    async loadNote(path) {
      if (!path) return;
      if (this.currentNote.dirty) {
        const confirmSwitch = confirm(
          "Du hast ungespeicherte Änderungen. Möchtest du trotzdem wechseln?",
        );
        if (!confirmSwitch) return;
      }

      this.isLoading = true;
      try {
        const res = await fetch(
          `./api/notes?path=${encodeURIComponent(path)}`,
        );
        if (res.ok) {
          const data = await res.json();
          this.currentNote = {
            path: data.note.path,
            title: data.note.title,
            content: data.note.content,
            updatedAt: data.note.updatedAt,
            dirty: false,
          };
          this.activePath = data.note.path;

          // Auto-expand parent folders
          const parts = path.split("/");
          parts.pop(); // remove filename
          let currentAcc = "";
          for (const part of parts) {
            currentAcc = currentAcc ? `${currentAcc}/${part}` : part;
            if (!this.expandedFolders.includes(currentAcc)) {
              this.expandedFolders.push(currentAcc);
            }
          }
        }
      } catch (err) {
        this.showToast("Fehler beim Laden der Notiz: " + err.message);
      } finally {
        this.isLoading = false;
      }
    },

    markDirty() {
      this.currentNote.dirty = true;
    },

    async saveCurrentNote() {
      if (!this.currentNote.path) return;

      this.isSaving = true;
      try {
        const res = await fetch("./api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: this.currentNote.path,
            content: this.currentNote.content,
          }),
        });

        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }

        const data = await res.json();
        this.currentNote.updatedAt = data.note.updatedAt;
        this.currentNote.dirty = false;
        this.showToast("✓ Notiz gespeichert");
        await this.refreshTree();
      } catch (err) {
        this.showToast("Fehler beim Speichern: " + err.message);
      } finally {
        this.isSaving = false;
      }
    },

    async createNewNote(parentDir = "") {
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

    async deleteItem(path, isDirectory = false) {
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
          if (this.currentNote.path === path) {
            const first = this.findFirstFile(this.tree);
            if (first) {
              await this.loadNote(first.path);
            } else {
              this.currentNote = {
                path: "",
                title: "",
                content: "",
                updatedAt: null,
                dirty: false,
              };
            }
          }
        }
      } catch (err) {
        this.showToast("Fehler beim Löschen: " + err.message);
      }
    },

    async renameItem(oldPath) {
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
          if (this.currentNote.path === oldPath) {
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
        this.currentNote.content += text;
        return;
      }

      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const current = this.currentNote.content;

      this.currentNote.content =
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

    // Markdown rendering
    renderMarkdown(content) {
      if (!content) return "";
      if (typeof window.marked !== "undefined" && window.marked.parse) {
        return window.marked.parse(content);
      }
      return content.replace(/\n/g, "<br>");
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
