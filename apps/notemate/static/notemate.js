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
            ? `<span class="text-[10px] uppercase font-mono opacity-60 px-1.5 py-0.5 rounded bg-base-300/80 select-none">${lang}</span>`
            : "";
          const copyBtn =
            `<button type="button" data-copy-code class="btn btn-ghost btn-xs h-6 min-h-0 px-2 text-[10px] font-mono bg-base-300/90 hover:bg-base-300 border border-base-content/15 opacity-80 md:opacity-0 md:group-hover:opacity-100 transition" title="Code kopieren">📋 Kopieren</button>`;
          const langClass = validLang ? ` language-${validLang}` : "";

          return `<div class="relative group my-3"><pre class="hljs rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed"><code class="${langClass}">${highlighted}</code></pre><div class="absolute top-2 right-2 flex items-center gap-1.5">${langBadge}${copyBtn}</div></div>`;
        },
      },
    });
  }
}
configureMarkedHighlight();

document.addEventListener("alpine:init", () => {
  Alpine.data("notemate", () => ({
    // Persistent view settings
    appMode: Alpine.$persist("notes").as("notemate_app_mode_v1"),
    viewMode: Alpine.$persist(
      globalThis.innerWidth < 1024 ? "preview" : "split",
    ).as("notemate_view_mode_v1"),
    expandedFolders: Alpine.$persist([]).as("notemate_expanded_v1"),
    activePath: Alpine.$persist("Willkommen.md").as("notemate_active_path_v1"),
    activeKanbanBoardId: Alpine.$persist("projekte").as(
      "notemate_kanban_board_v1",
    ),

    tree: [],
    // Note State (Top-level properties to comply with Alpine CSP AST parser)
    notePath: "",
    noteTitle: "",
    noteContent: "",
    noteUpdatedAt: null,
    noteTags: [],
    isDirty: false,

    // Tags & Filter
    allTags: [],
    selectedTag: "",
    showTagPicker: false,

    // NSFW Gate
    nsfwUnlocked: false,
    nsfwHiddenCount: 0,
    nsfwModalOpen: false,
    pendingNsfwPath: "",

    // Move Modal
    moveModalOpen: false,
    moveSourcePath: "",
    moveTargetFolder: "",

    // Kanban State
    kanbanBoards: [],
    kanbanBoardTitle: "",
    kanbanColumns: [
      "Eingang",
      "Zurückgestellt",
      "In Bearbeitung",
      "Fertiggestellt",
    ],
    kanbanCards: [],
    kanbanHiddenCount: 0,
    kanbanQuery: "",
    kanbanTagFilter: "",
    activeKanbanColumn: "Eingang",
    draggedCardId: "",
    dragOverColumn: "",
    kanbanCardModalOpen: false,
    kanbanEditingCardId: "",
    kanbanCardFormTitle: "",
    kanbanCardFormColumn: "Eingang",
    kanbanCardFormDueDate: "",
    kanbanCardFormRecurrence: "",
    kanbanCardRecurrencePickerOpen: false,
    kanbanCardFormTags: "",
    kanbanCardFormDescription: "",
    kanbanCardInitialSnapshot: "",

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
      await Promise.all([this.refreshTree(), this.refreshTags()]);

      // Check ?note=... query parameter for direct note links
      const params = new URLSearchParams(globalThis.location.search || "");
      const linkedNote = params.get("note");
      if (linkedNote) {
        this.appMode = "notes";
        this.activePath = linkedNote;
      }

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

      if (this.appMode === "kanban") {
        await this.refreshKanban();
      }

      // Keyboard shortcuts
      globalThis.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          if (this.moveModalOpen) {
            this.closeMoveModal();
            return;
          }
          if (this.kanbanCardModalOpen) {
            if (this.isKanbanCardDirty()) {
              this.showToast("Ungespeicherte Änderungen – bitte speichern oder Abbrechen klicken.");
              return;
            }
            this.closeKanbanCardModal();
            return;
          }
          if (this.nsfwModalOpen) {
            this.closeNsfwModal();
            return;
          }
          if (this.showTagPicker) {
            this.showTagPicker = false;
            return;
          }
          if (
            this.appMode === "notes" &&
            (this.viewMode === "edit" || this.viewMode === "split")
          ) {
            if (this.isDirty) {
              this.showToast(
                "Ungespeicherte Änderungen – bitte erst speichern (Strg+S).",
              );
              return;
            }
            this.viewMode = "preview";
            return;
          }
        }
        // Ctrl+S / Cmd+S: Save Note
        if (
          (e.ctrlKey || e.metaKey) &&
          e.key === "s" &&
          this.appMode === "notes"
        ) {
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
          this.nsfwUnlocked = Boolean(data.nsfwUnlocked);
          this.nsfwHiddenCount = Number(data.hiddenCount || 0);
        }
      } catch (err) {
        console.error("Failed to load file tree:", err);
      }
    },

    openNsfwUnlockModal(targetPath = "") {
      this.pendingNsfwPath = targetPath || "";
      this.nsfwModalOpen = true;
    },

    closeNsfwModal() {
      this.nsfwModalOpen = false;
      this.pendingNsfwPath = "";
    },

    async confirmUnlockNsfw() {
      try {
        const res = await fetch("./api/nsfw/unlock", { method: "POST" });
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        const targetPath = this.pendingNsfwPath;
        this.closeNsfwModal();
        await Promise.all([this.refreshTree(), this.refreshTags()]);
        if (this.searchQuery.trim()) {
          await this.performSearch();
        }
        if (this.appMode === "kanban") {
          await this.refreshKanban();
        }
        if (targetPath) {
          await this.loadNote(targetPath, false);
        }
        this.showToast("✓ NSFW-Inhalte für 1 Stunde freigeschaltet");
      } catch (err) {
        this.showToast("Fehler beim Freischalten: " + err.message);
      }
    },

    async lockNsfw() {
      try {
        const res = await fetch("./api/nsfw/lock", { method: "POST" });
        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }
        if (this.isNsfwTag(this.selectedTag)) {
          this.selectedTag = "";
        }
        const wasViewingNsfw = this.hasNsfwTag(this.noteTags);
        await Promise.all([this.refreshTree(), this.refreshTags()]);
        if (this.searchQuery.trim()) {
          await this.performSearch();
        }
        if (this.appMode === "kanban") {
          if (this.isNsfwTag(this.kanbanTagFilter)) {
            this.kanbanTagFilter = "";
          }
          await this.refreshKanban();
        }
        if (wasViewingNsfw) {
          const first = this.findFirstFile(this.tree);
          if (first) {
            await this.loadNote(first.path, false);
          } else {
            this.notePath = "";
            this.noteTitle = "";
            this.noteContent = "";
            this.noteUpdatedAt = null;
            this.noteTags = [];
            this.isDirty = false;
          }
        }
        this.showToast("🔒 NSFW-Inhalte gesperrt");
      } catch (err) {
        this.showToast("Fehler beim Sperren: " + err.message);
      }
    },

    async refreshTags() {
      try {
        const res = await fetch("./api/tags");
        if (res.ok) {
          const data = await res.json();
          this.allTags = data.tags || [];
        }
      } catch (err) {
        console.error("Failed to load tags:", err);
      }
    },

    get activeFilterTags() {
      const selectedLower = this.selectedTag.toLowerCase();
      return (this.allTags || []).filter(
        (t) =>
          t.count > 0 ||
          (selectedLower && t.tag.toLowerCase() === selectedLower),
      );
    },

    get availableTagsToAdd() {
      const current = new Set(
        (this.noteTags || []).map((t) => t.toLowerCase()),
      );
      return (this.allTags || []).filter(
        (t) => !current.has(t.tag.toLowerCase()),
      );
    },

    isNsfwTag(tag) {
      return String(tag || "").toLowerCase() === "nsfw";
    },

    hasNsfwTag(tags) {
      return Array.isArray(tags) && tags.some((t) => this.isNsfwTag(t));
    },

    toggleTagFilter(tag) {
      if (!tag) return;
      this.selectedTag = this.selectedTag.toLowerCase() === tag.toLowerCase() ? "" : tag;
    },

    clearTagFilter() {
      this.selectedTag = "";
    },

    async addNoteTag(tag) {
      if (!this.notePath || !tag) return;
      const nextTags = [...(this.noteTags || []), tag];
      await this.updateNoteTags(nextTags);
      this.showTagPicker = false;
      if (this.isNsfwTag(tag) && !this.nsfwUnlocked) {
        const first = this.findFirstFile(this.tree);
        if (first) {
          await this.loadNote(first.path, false);
        } else {
          this.notePath = "";
          this.noteTitle = "";
          this.noteContent = "";
          this.noteUpdatedAt = null;
          this.noteTags = [];
          this.isDirty = false;
        }
        this.showToast("🔒 Notiz als NSFW markiert und ausgeblendet");
      }
    },

    async removeNoteTag(tag) {
      if (!this.notePath || !tag) return;
      const target = tag.toLowerCase();
      const nextTags = (this.noteTags || []).filter(
        (t) => t.toLowerCase() !== target,
      );
      await this.updateNoteTags(nextTags);
    },

    async updateNoteTags(nextTags) {
      if (!this.notePath) return;
      if (this.isDirty) {
        await this.saveCurrentNote();
      }

      this.isSaving = true;
      try {
        const res = await fetch("./api/notes/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: this.notePath,
            tags: nextTags,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "HTTP " + res.status);
        }
        if (data.note) {
          this.noteContent = data.note.content;
          this.noteTags = data.note.tags || [];
          this.noteUpdatedAt = data.note.updatedAt;
          this.isDirty = false;
          this.detectRecipe(this.noteContent);
        }
        await Promise.all([this.refreshTree(), this.refreshTags()]);
        this.showToast("✓ Tags aktualisiert");
      } catch (err) {
        this.showToast("Fehler beim Aktualisieren der Tags: " + err.message);
      } finally {
        this.isSaving = false;
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
      const activeTag = (this.selectedTag || "").trim().toLowerCase();

      const matchesTag = (node) => {
        if (!activeTag) return true;
        if (node.type === "file") {
          return (
            Array.isArray(node.tags) &&
            node.tags.some((t) => String(t).toLowerCase() === activeTag)
          );
        }
        return Array.isArray(node.children) && node.children.some(matchesTag);
      };

      const traverse = (nodes, depth = 0) => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (activeTag && !matchesTag(node)) continue;
          list.push({ ...node, depth });
          const expanded = activeTag ? true : this.isFolderExpanded(node.path);
          if (node.type === "directory" && node.children && expanded) {
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
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          if (errData.error === "NSFW_LOCKED" && checkDirty) {
            this.openNsfwUnlockModal(path);
          }
          return false;
        }
        if (res.ok) {
          const data = await res.json();
          this.notePath = data.note.path;
          this.noteTitle = data.note.title;
          this.noteContent = data.note.content;
          this.noteUpdatedAt = data.note.updatedAt;
          this.noteTags = data.note.tags || [];
          this.showTagPicker = false;
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

    async copyNoteLink() {
      if (!this.notePath) return;
      const label = this.noteTitle ||
        this.notePath.split("/").pop()?.replace(/\.md$/i, "") ||
        "Notiz";
      const encodedPath = this.notePath
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/");
      const markdownLink = `[${label}](?note=${encodedPath})`;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(markdownLink);
          this.showToast("✓ Link kopiert: " + markdownLink);
          return;
        }
      } catch {
        // Fallback below
      }
      prompt("Markdown-Link kopieren:", markdownLink);
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
          this.noteTags = data.note.tags || [];
          this.detectRecipe(this.noteContent);
        }
        this.noteUpdatedAt = data.note.updatedAt;
        this.isDirty = false;
        this.showToast("✓ Notiz formatiert & gespeichert");
        await Promise.all([this.refreshTree(), this.refreshTags()]);
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
          if (this.viewMode === "preview") {
            this.viewMode = "edit";
          }
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
          await Promise.all([this.refreshTree(), this.refreshTags()]);
          if (this.notePath === path) {
            const first = this.findFirstFile(this.tree);
            if (first) {
              await this.loadNote(first.path);
            } else {
              this.notePath = "";
              this.noteTitle = "";
              this.noteContent = "";
              this.noteUpdatedAt = null;
              this.noteTags = [];
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

    get availableMoveFolders() {
      const folders = [];
      const src = this.moveSourcePath;
      const collect = (nodes) => {
        if (!Array.isArray(nodes)) return;
        for (const node of nodes) {
          if (node.type !== "directory") continue;
          if (!src || (node.path !== src && !node.path.startsWith(`${src}/`))) {
            folders.push(node.path);
          }
          if (node.children) collect(node.children);
        }
      };
      collect(this.tree);
      return folders.sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
    },

    openMoveModal(path, event = null) {
      if (event && event.stopPropagation) event.stopPropagation();
      if (!path || !path.endsWith(".md")) return;
      this.moveSourcePath = path;
      const parts = path.split("/");
      parts.pop();
      this.moveTargetFolder = parts.join("/");
      this.moveModalOpen = true;
    },

    closeMoveModal() {
      this.moveModalOpen = false;
      this.moveSourcePath = "";
      this.moveTargetFolder = "";
    },

    async confirmMoveItem() {
      const oldPath = this.moveSourcePath;
      if (!oldPath) return;

      const fileName = oldPath.split("/").pop() || "";
      const newPath = this.moveTargetFolder ? `${this.moveTargetFolder}/${fileName}` : fileName;
      if (newPath === oldPath) {
        this.closeMoveModal();
        return;
      }

      try {
        const res = await fetch("./api/rename", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ oldPath, newPath }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "HTTP " + res.status);

        const wasOpen = this.notePath === oldPath;
        this.closeMoveModal();
        await this.refreshTree();
        if (wasOpen) {
          await this.loadNote(newPath, false);
        }
        this.showToast("✓ Verschoben");
      } catch (err) {
        this.showToast("Fehler beim Verschieben: " + err.message);
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
        if (this.searchQuery) {
          event.stopPropagation();
        }
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

    enableTaskCheckboxes(html) {
      if (!html) return "";
      let idx = 0;
      return html.replace(
        /<input\b([^>]*type=["']checkbox["'][^>]*)>/gi,
        (_m, attrs) => {
          const cleaned = String(attrs)
            .replace(/\s+disabled(?:=["'][^"']*["'])?/gi, "")
            .trim();
          const taskIdx = idx++;
          return `<input ${cleaned} data-task-index="${taskIdx}" class="checkbox checkbox-xs align-middle mr-1.5 cursor-pointer" />`;
        },
      );
    },

    toggleMarkdownTask(markdown, targetIndex) {
      if (!markdown || targetIndex < 0) return markdown;
      const lines = markdown.split("\n");
      let currentIdx = 0;
      let inFence = false;
      let inFrontmatter = lines[0]?.trim() === "---";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (i > 0 && inFrontmatter) {
          if (trimmed === "---") inFrontmatter = false;
          continue;
        }
        if (inFrontmatter) continue;

        if (/^(?:```|~~~)/.test(trimmed)) {
          inFence = !inFence;
          continue;
        }
        if (inFence) continue;

        const match = line.match(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\].*)$/);
        if (!match) continue;

        if (currentIdx === targetIndex) {
          const nextMark = match[2].toLowerCase() === "x" ? " " : "x";
          lines[i] = `${match[1]}${nextMark}${match[3]}`;
          return lines.join("\n");
        }
        currentIdx += 1;
      }

      return markdown;
    },

    async handlePreviewClick(event) {
      const checkbox = event.target?.closest?.("[data-task-index]");
      if (checkbox) {
        const idx = parseInt(
          checkbox.getAttribute("data-task-index") || "",
          10,
        );
        if (!isNaN(idx) && this.notePath) {
          const nextContent = this.toggleMarkdownTask(this.noteContent, idx);
          if (nextContent !== this.noteContent) {
            this.noteContent = nextContent;
            await this.saveCurrentNote();
          }
        }
        return;
      }

      const btn = event.target?.closest?.("[data-copy-code]");
      if (!btn) return;
      const codeEl = btn.closest(".relative")?.querySelector("pre code");
      const rawText = codeEl?.textContent ?? "";
      if (!rawText) return;

      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(rawText);
          const prev = btn.textContent;
          btn.textContent = "✓ Kopiert";
          setTimeout(() => {
            btn.textContent = prev || "📋 Kopieren";
          }, 1500);
          return;
        }
      } catch {
        // Fallback below
      }
      prompt("Code kopieren:", rawText);
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
        return this.enableTaskCheckboxes(globalThis.marked.parse(normalized));
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

    // Kanban Methods
    async switchAppMode(mode) {
      if (mode !== "notes" && mode !== "kanban") return;
      this.appMode = mode;
      this.mobileMenuOpen = false;
      if (mode === "kanban") {
        await this.refreshKanban();
      }
    },

    async refreshKanban() {
      await this.loadKanbanBoards();
      const targetId = this.activeKanbanBoardId || this.kanbanBoards[0]?.id;
      if (targetId) {
        await this.loadKanbanBoard(targetId);
      }
    },

    async loadKanbanBoards() {
      try {
        const res = await fetch("./api/kanban/boards");
        if (res.ok) {
          const data = await res.json();
          this.kanbanBoards = data.boards || [];
          if (
            this.kanbanBoards.length > 0 &&
            !this.kanbanBoards.some((b) => b.id === this.activeKanbanBoardId)
          ) {
            this.activeKanbanBoardId = this.kanbanBoards[0].id;
          }
        }
      } catch (err) {
        console.error("Failed to load kanban boards:", err);
      }
    },

    async loadKanbanBoard(boardId) {
      if (!boardId) return;
      try {
        const params = new URLSearchParams();
        if (this.kanbanQuery.trim()) params.set("q", this.kanbanQuery.trim());
        if (this.kanbanTagFilter.trim()) {
          params.set("tag", this.kanbanTagFilter.trim());
        }
        const qs = params.toString();
        const url = `./api/kanban/boards/${encodeURIComponent(boardId)}${qs ? `?${qs}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          this.activeKanbanBoardId = data.board.id;
          this.kanbanBoardTitle = data.board.title;
          this.kanbanColumns = data.board.columns || [];
          this.kanbanCards = data.board.cards || [];
          this.kanbanHiddenCount = Number(data.hiddenCount || 0);
          this.nsfwUnlocked = Boolean(data.nsfwUnlocked);
          if (
            this.kanbanColumns.length > 0 &&
            !this.kanbanColumns.includes(this.activeKanbanColumn)
          ) {
            this.activeKanbanColumn = this.kanbanColumns[0];
          }
        }
      } catch (err) {
        console.error("Failed to load kanban board:", err);
      }
    },

    get kanbanBoardTags() {
      const seen = new Map();
      for (const card of this.kanbanCards || []) {
        for (const tag of card.tags || []) {
          const key = String(tag).toLowerCase();
          if (!seen.has(key)) seen.set(key, tag);
        }
      }
      return [...seen.values()].sort((a, b) => a.localeCompare(b, "de", { sensitivity: "base" }));
    },

    getKanbanColumnCards(column) {
      return (this.kanbanCards || [])
        .filter((c) => c.column === column)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    },

    toggleKanbanTagFilter(tag) {
      if (!tag) return;
      this.kanbanTagFilter = this.kanbanTagFilter.toLowerCase() === tag.toLowerCase() ? "" : tag;
      this.loadKanbanBoard(this.activeKanbanBoardId);
    },

    async createKanbanBoard() {
      const title = prompt("Name des neuen Kanban-Boards:");
      if (!title || !title.trim()) return;
      try {
        const res = await fetch("./api/kanban/boards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
        this.activeKanbanBoardId = data.board.id;
        await this.refreshKanban();
        this.showToast("✓ Kanban-Board angelegt");
      } catch (err) {
        this.showToast("Fehler beim Erstellen des Boards: " + err.message);
      }
    },

    getKanbanCardSnapshot() {
      return JSON.stringify([
        this.kanbanCardFormTitle,
        this.kanbanCardFormColumn,
        this.kanbanCardFormDueDate,
        this.kanbanCardFormRecurrence,
        this.kanbanCardFormTags,
        this.kanbanCardFormDescription,
      ]);
    },

    kanbanRecurrenceLabel(recurrence) {
      const labels = {
        weekly: "Wiederholt sich wöchentlich",
        monthly: "Wiederholt sich monatlich",
        quarterly: "Wiederholt sich quartalsweise",
        yearly: "Wiederholt sich jährlich",
      };
      return labels[recurrence] || "";
    },

    isKanbanCardDirty() {
      return this.kanbanCardModalOpen && this.getKanbanCardSnapshot() !== this.kanbanCardInitialSnapshot;
    },

    openKanbanCardModal(card = null, defaultColumn = "") {
      if (card) {
        this.kanbanEditingCardId = card.id;
        this.kanbanCardFormTitle = card.title || "";
        this.kanbanCardFormColumn = card.column || this.kanbanColumns[0] || "Eingang";
        this.kanbanCardFormDueDate = card.dueDate || "";
        this.kanbanCardFormRecurrence = card.recurrence || "";
        this.kanbanCardRecurrencePickerOpen = Boolean(card.recurrence);
        this.kanbanCardFormTags = (card.tags || []).join(", ");
        this.kanbanCardFormDescription = card.description || "";
      } else {
        this.kanbanEditingCardId = "";
        this.kanbanCardFormTitle = "";
        this.kanbanCardFormColumn = defaultColumn ||
          this.activeKanbanColumn ||
          this.kanbanColumns[0] ||
          "Eingang";
        this.kanbanCardFormDueDate = "";
        this.kanbanCardFormRecurrence = "";
        this.kanbanCardRecurrencePickerOpen = false;
        this.kanbanCardFormTags = "";
        this.kanbanCardFormDescription = "";
      }
      this.kanbanCardInitialSnapshot = this.getKanbanCardSnapshot();
      this.kanbanCardModalOpen = true;
    },

    closeKanbanCardModal() {
      this.kanbanCardModalOpen = false;
      this.kanbanEditingCardId = "";
      this.kanbanCardInitialSnapshot = "";
    },

    async saveKanbanCard() {
      const title = this.kanbanCardFormTitle.trim();
      if (!title) {
        this.showToast("Fehler: Kartentitel darf nicht leer sein.");
        return;
      }
      const tags = this.kanbanCardFormTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        title,
        column: this.kanbanCardFormColumn,
        dueDate: this.kanbanCardFormDueDate ? this.kanbanCardFormDueDate : null,
        recurrence: this.kanbanCardFormDueDate && this.kanbanCardFormRecurrence ? this.kanbanCardFormRecurrence : null,
        tags,
        description: this.kanbanCardFormDescription || "",
      };

      try {
        const isEdit = Boolean(this.kanbanEditingCardId);
        const url = isEdit
          ? `./api/kanban/boards/${encodeURIComponent(this.activeKanbanBoardId)}/cards/${encodeURIComponent(this.kanbanEditingCardId)}`
          : `./api/kanban/boards/${encodeURIComponent(this.activeKanbanBoardId)}/cards`;
        const res = await fetch(url, {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
        this.closeKanbanCardModal();
        await this.refreshKanban();
        this.showToast(isEdit ? "✓ Karte aktualisiert" : "✓ Karte angelegt");
      } catch (err) {
        this.showToast("Fehler beim Speichern der Karte: " + err.message);
      }
    },

    async moveKanbanCard(cardId, targetColumn) {
      if (!cardId || !targetColumn) return;
      try {
        const url = `./api/kanban/boards/${encodeURIComponent(this.activeKanbanBoardId)}/cards/${encodeURIComponent(cardId)}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ column: targetColumn }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "HTTP " + res.status);
        await this.refreshKanban();
      } catch (err) {
        this.showToast("Fehler beim Verschieben: " + err.message);
      }
    },

    async deleteKanbanCard(cardId) {
      if (!cardId || !confirm("Karte wirklich löschen?")) return;
      try {
        const url = `./api/kanban/boards/${encodeURIComponent(this.activeKanbanBoardId)}/cards/${encodeURIComponent(cardId)}`;
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "HTTP " + res.status);
        }
        await this.refreshKanban();
        this.showToast("✓ Karte gelöscht");
      } catch (err) {
        this.showToast("Fehler beim Löschen: " + err.message);
      }
    },

    handleKanbanDragStart(card, event) {
      this.draggedCardId = card.id;
      if (event?.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", card.id);
      }
    },

    handleKanbanDragEnd() {
      this.draggedCardId = "";
      this.dragOverColumn = "";
    },

    handleKanbanDragOver(col, event) {
      if (event?.preventDefault) event.preventDefault();
      if (event?.dataTransfer) event.dataTransfer.dropEffect = "move";
      this.dragOverColumn = col;
    },

    handleKanbanDragLeave(col) {
      if (this.dragOverColumn === col) {
        this.dragOverColumn = "";
      }
    },

    async handleKanbanDrop(targetColumn, event) {
      if (event?.preventDefault) event.preventDefault();
      const cardId = this.draggedCardId || event?.dataTransfer?.getData("text/plain") || "";
      this.dragOverColumn = "";
      this.draggedCardId = "";
      if (!cardId || !targetColumn) return;
      const existing = (this.kanbanCards || []).find((c) => c.id === cardId);
      if (existing && existing.column === targetColumn) return;
      await this.moveKanbanCard(cardId, targetColumn);
    },

    isKanbanCardOverdue(card) {
      if (!card || !card.dueDate) return false;
      if (
        String(card.column || "")
          .trim()
          .toLowerCase() === "fertiggestellt"
      ) {
        return false;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${
        String(
          now.getDate(),
        ).padStart(2, "0")
      }`;
      return card.dueDate < today;
    },

    renderKanbanMarkdown(text) {
      if (!text) return "";
      if (typeof globalThis.marked !== "undefined" && globalThis.marked.parse) {
        return this.enableTaskCheckboxes(globalThis.marked.parse(text));
      }
      return String(text).replace(/\n/g, "<br>");
    },

    async handleKanbanBodyClick(event, card = null) {
      const checkbox = event.target?.closest?.("[data-task-index]");
      if (checkbox && card) {
        const idx = parseInt(
          checkbox.getAttribute("data-task-index") || "",
          10,
        );
        if (!isNaN(idx)) {
          const nextDesc = this.toggleMarkdownTask(card.description || "", idx);
          if (nextDesc !== card.description) {
            card.description = nextDesc;
            try {
              const url = `./api/kanban/boards/${encodeURIComponent(this.activeKanbanBoardId)}/cards/${
                encodeURIComponent(
                  card.id,
                )
              }`;
              const res = await fetch(url, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ description: nextDesc }),
              });
              if (!res.ok) throw new Error("HTTP " + res.status);
            } catch (err) {
              this.showToast(
                "Fehler beim Speichern der Checkbox: " + err.message,
              );
            }
          }
        }
        return;
      }

      const anchor = event.target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (href.includes("?note=")) {
        event.preventDefault();
        const queryPart = href.split("?")[1] || "";
        const noteParam = new URLSearchParams(queryPart).get("note");
        if (noteParam) {
          this.appMode = "notes";
          this.loadNote(noteParam);
        }
      }
    },
  }));
});
