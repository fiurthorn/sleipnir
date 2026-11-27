/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

document.addEventListener("alpine:init", () => {
  // Globaler Store für Scanmate
  Alpine.store("scanmate", {
    documents: [],
    folders: [""],
    models: [],
    selectedModel: "",
    isLoading: false,
    filterCategory: "",
    filterFolder: "",
    searchQuery: "",
    activeDoc: null, // Detailansicht
  });

  // Haupt-App Komponente
  Alpine.data("scanApp", () => ({
    activeTab: "archive", // "archive" | "new"
    mobileMenuOpen: false, // Mobile Drawer State

    // Multi-Page Session State
    pages: [], // Array von { id, dataUrl, rotation }
    isAnalyzing: false,
    isSaving: false,
    expandedFolders: [],
    selectedTag: "",
    onlyUnreviewed: false,
    previewError: false,
    deeplinkCopied: false,

    get activeDoc() {
      return Alpine.store("scanmate").activeDoc;
    },

    get isLoading() {
      return Alpine.store("scanmate").isLoading;
    },

    get searchQuery() {
      return Alpine.store("scanmate").searchQuery;
    },

    set searchQuery(val) {
      Alpine.store("scanmate").searchQuery = val;
    },

    formatAmount(val) {
      return typeof val === "number" ? `${val.toFixed(2)} €` : "—";
    },

    formatDocDate(doc) {
      if (!doc) return "";
      return doc.date || (doc.createdAt ? doc.createdAt.split("T")[0] : "");
    },

    formatShortPath(path, maxLen = 44) {
      const str = String(path || "");
      if (str.length <= maxLen) return str;
      const keepEnd = Math.min(17, Math.floor(maxLen * 0.4));
      const keepStart = maxLen - keepEnd - 1;
      return `${str.slice(0, keepStart)}…${str.slice(-keepEnd)}`;
    },

    getPdfUrl(doc) {
      return doc && doc.fileNamePdf ? `./api/pdf/${doc.fileNamePdf}` : "";
    },

    getPreviewUrl(doc) {
      return doc && doc.fileNamePdf ? `./api/preview/${doc.fileNamePdf}` : "";
    },

    renderPdfIframe(doc) {
      const url = this.getPdfUrl(doc);
      if (!url) return "";
      const safeUrl = url
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<iframe src="${safeUrl}" class="w-full h-full flex-1 border-0 bg-base-100"></iframe>`;
    },

    getHeaderTitle() {
      if (this.activeTab === "new") return "Neues Dokument erfassen";
      return this.activeDoc ? this.activeDoc.title : "Archiv Übersicht";
    },

    // Extrahierte / editierbare Metadaten für den neuen Scan
    metadata: {
      title: "",
      category: "Brief",
      date: new Date().toISOString().split("T")[0],
      sender: "",
      recipient: "",
      totalAmount: null,
      dueDate: "",
      tags: [
        "Estate",
        "Insurance",
        "Private",
        "Behörden",
        "Finanzen",
        "Gesundheit",
        "Sonstiges",
        "Rechnung",
        "Vertrag",
        "Bescheid",
        "Quittung",
        "Mahnung",
        "Steuer",
        "Strom",
      ],
      tagInput: "",
      summary: "",
      ocrText: "",
      targetPath: "", // Zielordner
    },
    queueLabel: "",
    pendingScans: [],
    editModalOpen: false,
    editSaving: false,
    editForm: {
      id: "",
      title: "",
      category: "",
      date: "",
      sender: "",
      recipient: "",
      totalAmount: "",
      dueDate: "",
      tagsText: "",
      summary: "",
      ocrText: "",
    },

    async init() {
      await this.loadModels();
      await this.loadFolders();
      await this.loadDocuments();
      await this.loadPendingScans();
    },

    async loadFolders() {
      try {
        const res = await fetch("./api/folders");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.folders)) {
            Alpine.store("scanmate").folders = data.folders;
          }
        }
      } catch (err) {
        console.error("Fehler beim Laden der Ordner:", err);
      }
    },

    async loadModels() {
      try {
        const res = await fetch(`./api/models`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.models)) {
            Alpine.store("scanmate").models = data.models;
            if (
              data.models.length > 0 &&
              !Alpine.store("scanmate").selectedModel
            ) {
              Alpine.store("scanmate").selectedModel = data.models[0].id;
            }
          }
        }
      } catch (err) {
        console.error("Fehler beim Laden der Modelle:", err);
      }
    },

    async loadDocuments() {
      Alpine.store("scanmate").isLoading = true;
      try {
        const res = await fetch(`./api/documents`);
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.documents)) {
            Alpine.store("scanmate").documents = data.documents;
            const deepDocId = new URLSearchParams(globalThis.location.search).get("doc");
            if (deepDocId) {
              const deepDoc = data.documents.find((d) => d.id === deepDocId);
              if (deepDoc) {
                this.activeTab = "archive";
                this.previewError = false;
                Alpine.store("scanmate").activeDoc = deepDoc;
                this.expandPathParents(deepDoc.targetPath);
                return;
              }
            }
            const currentActive = Alpine.store("scanmate").activeDoc;
            if (currentActive) {
              Alpine.store("scanmate").activeDoc =
                data.documents.find((d) => d.id === currentActive.id) || null;
            }
          }
        }
      } catch (err) {
        console.error("Fehler beim Laden der Dokumente:", err);
      } finally {
        Alpine.store("scanmate").isLoading = false;
      }
    },

    filteredDocuments() {
      const store = Alpine.store("scanmate");
      let list = store.documents;

      if (this.onlyUnreviewed) {
        list = list.filter((d) => d.reviewed === false);
      }

      if (this.selectedTag) {
        const target = this.selectedTag.toLowerCase();
        list = list.filter(
          (d) =>
            Array.isArray(d.tags) &&
            d.tags.some((t) => String(t).toLowerCase() === target),
        );
      }

      if (store.searchQuery && store.searchQuery.trim().length > 0) {
        const q = store.searchQuery.toLowerCase().trim();
        list = list.filter((d) => {
          return (
            (d.title && d.title.toLowerCase().includes(q)) ||
            (d.sender && d.sender.toLowerCase().includes(q)) ||
            (d.category && d.category.toLowerCase().includes(q)) ||
            (d.targetPath && d.targetPath.toLowerCase().includes(q)) ||
            (d.summary && d.summary.toLowerCase().includes(q)) ||
            (d.ocrText && d.ocrText.toLowerCase().includes(q)) ||
            (d.tags && d.tags.some((t) => t.toLowerCase().includes(q)))
          );
        });
      }

      return list;
    },

    get unreviewedCount() {
      const store = Alpine.store("scanmate");
      return (store.documents || []).filter((d) => d.reviewed === false).length;
    },

    toggleUnreviewedFilter() {
      this.onlyUnreviewed = !this.onlyUnreviewed;
    },

    async markDocumentReviewed(doc) {
      if (!doc?.id) return;
      try {
        const res = await fetch(
          `./api/documents/${encodeURIComponent(doc.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reviewed: true }),
          },
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(
            `Fehler: ${data.error || "Status konnte nicht aktualisiert werden"}`,
          );
          return;
        }
        const store = Alpine.store("scanmate");
        store.documents = store.documents.map((d) => d.id === doc.id ? data.document : d);
        if (store.activeDoc?.id === doc.id) {
          store.activeDoc = data.document;
        }
      } catch (err) {
        alert(`Verbindungsfehler: ${err.message}`);
      }
    },

    get availableTags() {
      const store = Alpine.store("scanmate");
      const counts = new Map();
      for (const doc of store.documents || []) {
        for (const raw of doc.tags || []) {
          const tag = String(raw).trim();
          if (!tag) continue;
          const key = tag.toLowerCase();
          const existing = counts.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            counts.set(key, { tag, count: 1 });
          }
        }
      }
      return [...counts.values()].sort(
        (a, b) =>
          b.count - a.count ||
          a.tag.localeCompare(b.tag, "de", { sensitivity: "base" }),
      );
    },

    toggleTagFilter(tag) {
      if (!tag) return;
      this.selectedTag = this.selectedTag.toLowerCase() === tag.toLowerCase() ? "" : tag;
    },

    clearTagFilter() {
      this.selectedTag = "";
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

    collapseAllFolders() {
      this.expandedFolders = [];
    },

    expandPathParents(folderPath) {
      if (!folderPath) return;
      const parts = String(folderPath).split("/").filter(Boolean);
      const next = new Set(this.expandedFolders || []);
      let acc = "";
      for (const part of parts) {
        acc = acc ? `${acc}/${part}` : part;
        next.add(acc);
      }
      this.expandedFolders = [...next];
    },

    get hasTreeFilter() {
      const store = Alpine.store("scanmate");
      return Boolean(
        (store.searchQuery && store.searchQuery.trim()) ||
          this.selectedTag ||
          this.onlyUnreviewed,
      );
    },

    isTreeDirExpanded(folderPath) {
      return this.hasTreeFilter || this.isFolderExpanded(folderPath);
    },

    getDocDeeplinkUrl(doc) {
      const url = new URL(globalThis.location.href);
      if (doc?.id) {
        url.searchParams.set("doc", doc.id);
      } else {
        url.searchParams.delete("doc");
      }
      return url.toString();
    },

    syncDocUrl(doc) {
      if (!globalThis.history?.replaceState) return;
      globalThis.history.replaceState(null, "", this.getDocDeeplinkUrl(doc));
    },

    async copyDocDeeplink(doc) {
      if (!doc?.id) return;
      try {
        await navigator.clipboard.writeText(this.getDocDeeplinkUrl(doc));
        this.deeplinkCopied = true;
        setTimeout(() => {
          this.deeplinkCopied = false;
        }, 2000);
      } catch (err) {
        console.error("Deeplink konnte nicht kopiert werden:", err);
      }
    },

    selectTreeItem(item) {
      if (!item) return;
      if (item.type === "directory") {
        this.toggleFolder(item.path);
        return;
      }
      const store = Alpine.store("scanmate");
      const doc = (store.documents || []).find((d) => d.id === item.id) || item.doc;
      if (doc) {
        this.activeTab = "archive";
        this.previewError = false;
        store.activeDoc = doc;
        this.syncDocUrl(doc);
        this.mobileMenuOpen = false;
      }
    },

    isTreeItemActive(item) {
      if (!item || item.type !== "doc") return false;
      return (
        this.activeTab === "archive" &&
        Alpine.store("scanmate").activeDoc?.id === item.id
      );
    },

    getTreeItemStyle(item) {
      const depth = item?.depth || 0;
      return `padding-left: ${depth * 14 + 8}px`;
    },

    isTagSelected(tag) {
      if (!this.selectedTag || !tag) return false;
      return this.selectedTag.toLowerCase() === String(tag).toLowerCase();
    },

    get visibleTreeItems() {
      const store = Alpine.store("scanmate");
      const docs = this.filteredDocuments();
      const hasFilter = this.hasTreeFilter;

      const root = { children: new Map(), docs: [] };
      const ensureDir = (folderPath) => {
        const parts = String(folderPath || "")
          .split("/")
          .filter(Boolean);
        let curr = root;
        let acc = "";
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          if (!curr.children.has(part)) {
            curr.children.set(part, {
              name: part,
              path: acc,
              children: new Map(),
              docs: [],
            });
          }
          curr = curr.children.get(part);
        }
        return curr;
      };

      if (!hasFilter) {
        for (const folder of store.folders || []) {
          if (folder) ensureDir(folder);
        }
      }

      for (const doc of docs) {
        const dir = doc.targetPath ? ensureDir(doc.targetPath) : root;
        dir.docs.push(doc);
      }

      const list = [];
      const traverse = (node, depth = 0) => {
        const dirs = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));
        for (const dir of dirs) {
          list.push({
            treeKey: `dir:${dir.path}`,
            type: "directory",
            name: dir.name,
            path: dir.path,
            depth,
          });
          if (hasFilter || this.isFolderExpanded(dir.path)) {
            traverse(dir, depth + 1);
          }
        }
        const sortedDocs = [...node.docs].sort((a, b) =>
          (b.date || b.createdAt || "").localeCompare(
            a.date || a.createdAt || "",
          )
        );
        for (const doc of sortedDocs) {
          list.push({
            treeKey: `doc:${doc.id}`,
            type: "doc",
            id: doc.id,
            doc,
            depth,
          });
        }
      };

      traverse(root, 0);
      return list;
    },

    openNewScan() {
      this.pages = [];
      this.resetMetadata();
      this.activeTab = "new";
      // Öffne direkt den Scanner für Seite 1
      this.openScannerForPage(-1);
    },

    resetMetadata() {
      this.metadata = {
        title: "",
        category: "Brief",
        date: new Date().toISOString().split("T")[0],
        sender: "",
        recipient: "",
        totalAmount: null,
        dueDate: "",
        tags: [],
        tagInput: "",
        summary: "",
        ocrText: "",
      };
    },

    openScannerForPage(pageIndex = -1) {
      globalThis.dispatchEvent(
        new CustomEvent("open-scan-editor", {
          detail: {
            pageIndex,
            existingImage: pageIndex >= 0 ? this.pages[pageIndex]?.dataUrl : null,
          },
        }),
      );
    },

    onPageCaptured(detail) {
      const { pageIndex, dataUrl } = detail;
      if (!dataUrl) return;

      if (pageIndex >= 0 && pageIndex < this.pages.length) {
        this.pages[pageIndex].dataUrl = dataUrl;
      } else {
        this.pages.push({
          id: crypto.randomUUID(),
          dataUrl,
          rotation: 0,
        });
      }
      this.activeTab = "new";
    },

    removePage(idx) {
      this.pages.splice(idx, 1);
    },

    movePageUp(idx) {
      if (idx > 0) {
        const temp = this.pages[idx];
        this.pages[idx] = this.pages[idx - 1];
        this.pages[idx - 1] = temp;
      }
    },

    movePageDown(idx) {
      if (idx < this.pages.length - 1) {
        const temp = this.pages[idx];
        this.pages[idx] = this.pages[idx + 1];
        this.pages[idx + 1] = temp;
      }
    },

    addTag() {
      const tag = this.metadata.tagInput?.trim();
      if (tag && !this.metadata.tags.includes(tag)) {
        this.metadata.tags.push(tag);
      }
      this.metadata.tagInput = "";
    },

    removeTag(idx) {
      this.metadata.tags.splice(idx, 1);
    },

    async runAiExtraction() {
      if (this.pages.length === 0) return;
      this.isAnalyzing = true;

      try {
        const images = this.pages.map((p) => p.dataUrl);
        const res = await fetch("./api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: images,
            model: Alpine.store("scanmate").selectedModel,
          }),
        });

        const data = await res.json();
        if (data.ok && data.data) {
          const ext = data.data;
          if (ext.title) this.metadata.title = ext.title;
          if (ext.category) this.metadata.category = ext.category;
          if (ext.date) this.metadata.date = ext.date;
          if (ext.sender) this.metadata.sender = ext.sender;
          if (ext.recipient) this.metadata.recipient = ext.recipient;
          if (ext.totalAmount !== undefined && ext.totalAmount !== null) {
            this.metadata.totalAmount = ext.totalAmount;
          }
          if (ext.dueDate) this.metadata.dueDate = ext.dueDate;
          if (Array.isArray(ext.tags)) {
            const merged = new Set([...this.metadata.tags, ...ext.tags]);
            this.metadata.tags = Array.from(merged);
          }
          if (ext.summary) this.metadata.summary = ext.summary;
          if (ext.ocrText) this.metadata.ocrText = ext.ocrText;
        } else {
          alert(`KI-Analyse Fehler: ${data.error || "Unbekannter Fehler"}`);
        }
      } catch (err) {
        console.error("Fehler bei KI Analyse:", err);
        alert(`Verbindungsfehler: ${err.message}`);
      } finally {
        this.isAnalyzing = false;
      }
    },

    async saveCurrentDocument() {
      if (this.pages.length === 0) {
        alert("Bitte scanne mindestens eine Seite.");
        return;
      }
      this.isSaving = true;

      try {
        const payload = {
          title: this.metadata.title || "Dokument",
          category: this.metadata.category || "Sonstiges",
          date: this.metadata.date,
          sender: this.metadata.sender,
          recipient: this.metadata.recipient,
          totalAmount: this.metadata.totalAmount ? Number(this.metadata.totalAmount) : undefined,
          dueDate: this.metadata.dueDate || undefined,
          tags: this.metadata.tags,
          summary: this.metadata.summary,
          ocrText: this.metadata.ocrText,
          targetPath: this.metadata.targetPath || undefined,
          pages: this.pages.map((p) => p.dataUrl),
        };

        const res = await fetch("./api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.ok && data.document) {
          await this.loadDocuments();
          this.activeTab = "archive";
          Alpine.store("scanmate").activeDoc = data.document;
          this.pages = [];
          this.resetMetadata();
        } else {
          alert(`Fehler beim Speichern: ${data.error || "Unbekannt"}`);
        }
      } catch (err) {
        console.error("Fehler beim Speichern:", err);
        alert(`Verbindungsfehler: ${err.message}`);
      } finally {
        this.isSaving = false;
      }
    },

    async loadPendingScans() {
      try {
        const res = await fetch("./api/pending");
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.items)) {
            this.pendingScans = data.items;
          }
        }
      } catch (err) {
        console.error("Fehler beim Laden der Pending-Queue:", err);
      }
    },

    async queueCurrentScan() {
      if (this.pages.length === 0) {
        alert("Bitte scanne mindestens eine Seite.");
        return;
      }
      this.isSaving = true;
      try {
        const res = await fetch("./api/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: this.pages.map((p) => p.dataUrl),
            label: this.queueLabel.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.ok) {
          this.pages = [];
          this.queueLabel = "";
          await this.loadPendingScans();
        } else {
          alert(`Fehler beim Einreihen: ${data.error || "Unbekannt"}`);
        }
      } catch (err) {
        console.error("Fehler beim Einreihen:", err);
        alert(`Verbindungsfehler: ${err.message}`);
      } finally {
        this.isSaving = false;
      }
    },

    async deletePendingScanItem(id) {
      if (!id) return;
      try {
        const res = await fetch(`./api/pending/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          await this.loadPendingScans();
        }
      } catch (err) {
        console.error("Fehler beim Löschen aus Queue:", err);
      }
    },

    openEditModal(doc) {
      if (!doc?.id) return;
      this.editForm = {
        id: doc.id,
        title: doc.title ?? "",
        category: doc.category ?? "",
        date: doc.date ?? "",
        sender: doc.sender ?? "",
        recipient: doc.recipient ?? "",
        totalAmount: doc.totalAmount !== undefined && doc.totalAmount !== null ? String(doc.totalAmount) : "",
        dueDate: doc.dueDate ?? "",
        tagsText: Array.isArray(doc.tags) ? doc.tags.join(", ") : "",
        summary: doc.summary ?? "",
        ocrText: doc.ocrText ?? "",
      };
      this.editModalOpen = true;
    },

    closeEditModal() {
      this.editModalOpen = false;
    },

    getEditTagsList() {
      return String(this.editForm.tagsText || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    },

    isEditTagActive(tag) {
      const needle = String(tag || "")
        .trim()
        .toLowerCase();
      return this.getEditTagsList().some((t) => t.toLowerCase() === needle);
    },

    toggleEditTag(tag) {
      const clean = String(tag || "").trim();
      if (!clean) return;
      const needle = clean.toLowerCase();
      const current = this.getEditTagsList();
      const next = current.some((t) => t.toLowerCase() === needle) ? current.filter((t) => t.toLowerCase() !== needle) : [...current, clean];
      this.editForm.tagsText = next.join(", ");
    },

    async saveEditedDoc() {
      if (!this.editForm.id || this.editSaving) return;
      const title = this.editForm.title.trim();
      if (!title) {
        alert("Bitte einen Dokumenttitel angeben.");
        return;
      }

      const rawAmount = String(this.editForm.totalAmount || "")
        .trim()
        .replace(",", ".");
      let parsedAmount;
      if (rawAmount !== "") {
        const num = Number(rawAmount);
        if (!Number.isFinite(num)) {
          alert("Bitte einen gültigen Betrag eingeben.");
          return;
        }
        parsedAmount = num;
      }

      const tags = String(this.editForm.tagsText || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const payload = {
        title,
        category: this.editForm.category.trim() || "Sonstiges",
        date: this.editForm.date.trim() || undefined,
        sender: this.editForm.sender.trim() || undefined,
        recipient: this.editForm.recipient.trim() || undefined,
        totalAmount: parsedAmount,
        dueDate: this.editForm.dueDate.trim() || undefined,
        tags,
        summary: this.editForm.summary.trim() || undefined,
        ocrText: this.editForm.ocrText.trim() || undefined,
      };

      this.editSaving = true;
      try {
        const res = await fetch(
          `./api/documents/${encodeURIComponent(this.editForm.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const data = await res.json();
        if (!res.ok || !data.ok) {
          alert(
            `Fehler: ${data.error || "Dokument konnte nicht gespeichert werden"}`,
          );
          return;
        }
        const store = Alpine.store("scanmate");
        store.documents = store.documents.map((d) => d.id === data.document.id ? data.document : d);
        if (store.activeDoc?.id === data.document.id) {
          store.activeDoc = data.document;
        }
        this.editModalOpen = false;
      } catch (err) {
        alert(`Verbindungsfehler: ${err.message}`);
      } finally {
        this.editSaving = false;
      }
    },

    async deleteDoc(doc) {
      if (!confirm(`Dokument "${doc.title}" wirklich löschen?`)) return;

      try {
        const res = await fetch(`./api/documents/${doc.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          if (Alpine.store("scanmate").activeDoc?.id === doc.id) {
            Alpine.store("scanmate").activeDoc = null;
            this.syncDocUrl(null);
          }
          await this.loadDocuments();
        }
      } catch (err) {
        console.error("Fehler beim Löschen:", err);
      }
    },
  }));

  // Beleg-/Dokument-Scanner Komponente (Kamera, Crop, Perspektive, Filter)
  Alpine.data("documentScanner", (basePath = "") => ({
    basePath,
    open: false,
    pageIndex: -1,
    mode: "camera", // "camera" | "crop"
    cropSubMode: "crop", // "crop" | "preview"
    filterMode: "grayscale", // "bw" | "grayscale" | "color"
    videoStream: null,
    facingMode: "environment",
    hasCamera: true,
    capturedImageSrc: null,
    sourceCanvas: null,
    scanner: null,
    corners: null,
    activeCorner: null,
    _rafId: null,

    init() {
      globalThis.addEventListener("open-scan-editor", (e) => {
        this.pageIndex = e.detail.pageIndex;
        this.open = true;
        this.cropSubMode = "crop";
        this.filterMode = "grayscale";

        if (e.detail.existingImage) {
          this.stopCamera();
          this.capturedImageSrc = e.detail.existingImage;
          this.mode = "crop";
          this.$nextTick(() => {
            const img = new Image();
            img.onload = () => {
              this.sourceCanvas = this.createClampedCanvas(img, 1920);
              this.setupCropCanvas();
              this.detectCorners(this.sourceCanvas);
            };
            img.src = this.capturedImageSrc;
          });
        } else {
          this.capturedImageSrc = null;
          this.sourceCanvas = null;
          this.mode = "camera";
          this.$nextTick(() => this.startCamera());
        }
      });

      if (typeof jscanify !== "undefined") {
        this.scanner = new jscanify();
      }

      if (typeof cv !== "undefined" && !cv.Mat) {
        const prevOnRuntime = cv.onRuntimeInitialized;
        cv.onRuntimeInitialized = () => {
          if (typeof prevOnRuntime === "function") prevOnRuntime();
          if (this.mode === "crop" && this.sourceCanvas) {
            this.setupCropCanvas();
            this.detectCorners(this.sourceCanvas);
          }
        };
      }
    },

    isOpenCvReady() {
      return typeof cv !== "undefined" && typeof cv.Mat === "function";
    },

    getScanner() {
      if (!this.scanner && typeof jscanify !== "undefined") {
        this.scanner = new jscanify();
      }
      return this.scanner;
    },

    setCropSubMode(mode) {
      this.cropSubMode = mode;
      if (mode === "preview") {
        this.$nextTick(() => this.updatePreview());
      } else {
        this.$nextTick(() => this.redrawCropCanvas());
      }
    },

    setFilterMode(mode) {
      this.filterMode = mode;
      this.redrawCropCanvas();
      if (this.cropSubMode === "preview" || this.$refs.previewCanvas) {
        this.updatePreview();
      }
    },

    async startCamera() {
      this.stopCamera();
      try {
        const constraints = {
          video: {
            facingMode: { ideal: this.facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };
        this.videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        const videoEl = this.$refs.videoEl;
        if (videoEl) {
          videoEl.srcObject = this.videoStream;
          videoEl.play();
        }
        this.hasCamera = true;
      } catch (err) {
        console.warn("Kamera konnte nicht gestartet werden:", err);
        this.hasCamera = false;
      }
    },

    switchCamera() {
      this.facingMode = this.facingMode === "environment" ? "user" : "environment";
      this.startCamera();
    },

    stopCamera() {
      if (this.videoStream) {
        this.videoStream.getTracks().forEach((track) => track.stop());
        this.videoStream = null;
      }
    },

    close() {
      this.stopCamera();
      this.open = false;
      this.capturedImageSrc = null;
      this.sourceCanvas = null;
    },

    createClampedCanvas(source, maxDim = 1920) {
      const w = source.videoWidth || source.naturalWidth || source.width;
      const h = source.videoHeight || source.naturalHeight || source.height;
      if (!w || !h) {
        const dummy = document.createElement("canvas");
        dummy.width = 640;
        dummy.height = 480;
        return dummy;
      }
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const targetW = Math.round(w * scale);
      const targetH = Math.round(h * scale);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(source, 0, 0, targetW, targetH);
      return canvas;
    },

    capturePhoto() {
      const videoEl = this.$refs.videoEl;
      if (!videoEl) return;

      const canvas = this.createClampedCanvas(videoEl, 1920);
      this.sourceCanvas = canvas;
      this.capturedImageSrc = canvas.toDataURL("image/jpeg", 0.92);
      this.stopCamera();
      this.mode = "crop";
      this.cropSubMode = "crop";
      this.$nextTick(() => {
        this.setupCropCanvas();
        this.detectCorners(canvas);
      });
    },

    handleFileUpload(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        this.stopCamera();
        this.mode = "crop";
        this.cropSubMode = "crop";
        const img = new Image();
        img.onload = () => {
          const canvas = this.createClampedCanvas(img, 1920);
          this.sourceCanvas = canvas;
          this.capturedImageSrc = canvas.toDataURL("image/jpeg", 0.92);
          this.$nextTick(() => {
            this.setupCropCanvas();
            this.detectCorners(canvas);
          });
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    setupCropCanvas() {
      const canvas = this.$refs.cropCanvas;
      if (!canvas || !this.sourceCanvas) return;

      const maxDim = 1280;
      const srcW = this.sourceCanvas.width;
      const srcH = this.sourceCanvas.height;
      const displayScale = Math.min(1, maxDim / Math.max(srcW, srcH));

      canvas.width = Math.round(srcW * displayScale);
      canvas.height = Math.round(srcH * displayScale);
      this.redrawCropCanvas();
    },

    sortCornerPoints(pts) {
      if (!pts || pts.length !== 4) return null;
      const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
      const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;

      const withAngles = pts.map((p) => ({
        x: p.x,
        y: p.y,
        angle: Math.atan2(p.y - cy, p.x - cx),
      }));
      withAngles.sort((a, b) => a.angle - b.angle);

      let bestIdx = 0;
      let minSum = Infinity;
      withAngles.forEach((p, idx) => {
        const sum = p.x + p.y;
        if (sum < minSum) {
          minSum = sum;
          bestIdx = idx;
        }
      });

      const ordered = [
        withAngles[bestIdx],
        withAngles[(bestIdx + 1) % 4],
        withAngles[(bestIdx + 2) % 4],
        withAngles[(bestIdx + 3) % 4],
      ];

      return {
        topLeft: { x: Math.round(ordered[0].x), y: Math.round(ordered[0].y) },
        topRight: { x: Math.round(ordered[1].x), y: Math.round(ordered[1].y) },
        bottomRight: {
          x: Math.round(ordered[2].x),
          y: Math.round(ordered[2].y),
        },
        bottomLeft: {
          x: Math.round(ordered[3].x),
          y: Math.round(ordered[3].y),
        },
      };
    },

    detectCorners(sourceCanvas) {
      if (!sourceCanvas) return;
      const w = sourceCanvas.width;
      const h = sourceCanvas.height;

      const maxDim = 480;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const workCanvas = document.createElement("canvas");
      workCanvas.width = Math.max(1, Math.round(w * scale));
      workCanvas.height = Math.max(1, Math.round(h * scale));
      const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
      workCtx.drawImage(
        sourceCanvas,
        0,
        0,
        workCanvas.width,
        workCanvas.height,
      );

      let corners = null;
      if (typeof cv !== "undefined" && cv.Mat) {
        corners = this.detectCornersWithOpenCV(workCanvas, scale, w, h);
      }
      if (!corners) {
        corners = this.detectCornersFallback(workCanvas, scale, w, h);
      }

      // Sicherstellen, dass alle 4 Griff-Dots erreichbar im sichtbaren Bereich liegen
      // und nicht übereinander oder am äußersten Bildrand kleben
      if (corners) {
        corners = this.sanitizeAutoCorners(corners, w, h);
      }

      // Fallback auf 5% Rand, falls kein gültiges Dokument erkannt wurde
      if (!corners) {
        corners = {
          topLeft: { x: Math.round(w * 0.05), y: Math.round(h * 0.05) },
          topRight: { x: Math.round(w * 0.95), y: Math.round(h * 0.05) },
          bottomRight: { x: Math.round(w * 0.95), y: Math.round(h * 0.95) },
          bottomLeft: { x: Math.round(w * 0.05), y: Math.round(h * 0.95) },
        };
      }

      this.corners = corners;
      this.redrawCropCanvas();
      if (this.cropSubMode === "preview") {
        this.updatePreview();
      }
    },

    sanitizeAutoCorners(corners, w, h) {
      const padX = Math.max(16, Math.round(w * 0.025));
      const padY = Math.max(16, Math.round(h * 0.025));
      const clamp = (pt) => ({
        x: Math.max(padX, Math.min(w - padX, Math.round(pt.x))),
        y: Math.max(padY, Math.min(h - padY, Math.round(pt.y))),
      });

      const sanitized = {
        topLeft: clamp(corners.topLeft),
        topRight: clamp(corners.topRight),
        bottomRight: clamp(corners.bottomRight),
        bottomLeft: clamp(corners.bottomLeft),
      };

      const pts = [
        sanitized.topLeft,
        sanitized.topRight,
        sanitized.bottomRight,
        sanitized.bottomLeft,
      ];
      const minCornerDist = Math.min(w, h) * 0.12;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (
            Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < minCornerDist
          ) {
            return null;
          }
        }
      }

      return sanitized;
    },

    findQuadInBinaryMat(binaryMat, scale, origW, origH) {
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      try {
        cv.findContours(
          binaryMat,
          contours,
          hierarchy,
          cv.RETR_EXTERNAL,
          cv.CHAIN_APPROX_SIMPLE,
        );
        const totalArea = binaryMat.rows * binaryMat.cols;
        const minArea = totalArea * 0.15;
        const maxArea = totalArea * 0.98;

        const candidates = [];
        for (let i = 0; i < contours.size(); i++) {
          const cnt = contours.get(i);
          const area = cv.contourArea(cnt, false);
          if (area >= minArea && area <= maxArea) {
            candidates.push({ cnt, area });
          } else {
            cnt.delete();
          }
        }
        candidates.sort((a, b) => b.area - a.area);

        const clampPts = (pts) =>
          pts.map((p) => ({
            x: Math.max(0, Math.min(origW, Math.round(p.x / scale))),
            y: Math.max(0, Math.min(origH, Math.round(p.y / scale))),
          }));

        let bestQuad = null;
        for (let i = 0; i < Math.min(candidates.length, 6) && !bestQuad; i++) {
          const cnt = candidates[i].cnt;
          const peri = cv.arcLength(cnt, true);
          for (const epsFactor of [0.02, 0.03, 0.04, 0.05]) {
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, epsFactor * peri, true);
            if (approx.rows === 4 && cv.isContourConvex(approx)) {
              const pts = [];
              for (let j = 0; j < 4; j++) {
                pts.push({
                  x: approx.data32S[j * 2],
                  y: approx.data32S[j * 2 + 1],
                });
              }
              approx.delete();
              bestQuad = this.sortCornerPoints(clampPts(pts));
              break;
            }
            approx.delete();
          }
        }

        // Wenn keine exakte 4-Eck-Approximation klappt, umschließendes Rechteck der größten Kontur nutzen
        if (!bestQuad && candidates.length > 0 && cv.RotatedRect?.points) {
          const rect = cv.minAreaRect(candidates[0].cnt);
          const vertices = cv.RotatedRect.points(rect);
          if (vertices && vertices.length === 4) {
            bestQuad = this.sortCornerPoints(clampPts(vertices));
          }
        }

        candidates.forEach((c) => c.cnt.delete());
        return bestQuad;
      } finally {
        contours.delete();
        hierarchy.delete();
      }
    },

    detectCornersWithOpenCV(workCanvas, scale, origW, origH) {
      let src = null,
        gray = null,
        blurred = null,
        thresh = null,
        edges = null,
        closeKernel = null,
        dilateKernel = null;
      try {
        src = cv.imread(workCanvas);
        gray = new cv.Mat();
        blurred = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Pass 1: Otsu-Threshold (ideal für helles Dokument auf dunklem Hintergrund)
        thresh = new cv.Mat();
        cv.threshold(
          blurred,
          thresh,
          0,
          255,
          cv.THRESH_BINARY + cv.THRESH_OTSU,
        );
        closeKernel = cv.Mat.ones(5, 5, cv.CV_8U);
        cv.morphologyEx(thresh, thresh, cv.MORPH_CLOSE, closeKernel);

        const fromOtsu = this.findQuadInBinaryMat(thresh, scale, origW, origH);
        if (fromOtsu) return fromOtsu;

        // Pass 2: Canny-Kantenerkennung (für gemusterten oder helleren Hintergrund)
        edges = new cv.Mat();
        cv.Canny(blurred, edges, 50, 150);
        dilateKernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, edges, dilateKernel);

        return this.findQuadInBinaryMat(edges, scale, origW, origH);
      } catch (err) {
        console.warn("OpenCV corner detection failed:", err);
        return null;
      } finally {
        if (src) src.delete();
        if (gray) gray.delete();
        if (blurred) blurred.delete();
        if (thresh) thresh.delete();
        if (edges) edges.delete();
        if (closeKernel) closeKernel.delete();
        if (dilateKernel) dilateKernel.delete();
      }
    },

    detectCornersFallback(workCanvas, scale, origW, origH) {
      const w = workCanvas.width;
      const h = workCanvas.height;
      const ctx = workCanvas.getContext("2d", { willReadFrequently: true });
      const { data } = ctx.getImageData(0, 0, w, h);

      const lumaAt = (x, y) => {
        const idx = (y * w + x) * 4;
        return (
          0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
        );
      };

      // Rand-Helligkeit vs. Zentrum prüfen (funktioniert besonders gut auf dunklem Hintergrund)
      let borderSum = 0,
        borderCount = 0;
      const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
      for (let x = 0; x < w; x += step) {
        borderSum += lumaAt(x, 2) + lumaAt(x, Math.max(0, h - 3));
        borderCount += 2;
      }
      for (let y = 0; y < h; y += step) {
        borderSum += lumaAt(2, y) + lumaAt(Math.max(0, w - 3), y);
        borderCount += 2;
      }
      const bgLuma = borderSum / Math.max(1, borderCount);

      let centerSum = 0,
        centerCount = 0;
      const x0 = Math.floor(w * 0.3),
        x1 = Math.ceil(w * 0.7);
      const y0 = Math.floor(h * 0.3),
        y1 = Math.ceil(h * 0.7);
      for (let y = y0; y < y1; y += step) {
        for (let x = x0; x < x1; x += step) {
          centerSum += lumaAt(x, y);
          centerCount++;
        }
      }
      const centerLuma = centerSum / Math.max(1, centerCount);
      if (centerLuma - bgLuma < 22) return null;

      const threshold = bgLuma + (centerLuma - bgLuma) * 0.45;
      let tl = null,
        tr = null,
        br = null,
        bl = null;
      let minSum = Infinity,
        maxSum = -Infinity,
        minDiff = Infinity,
        maxDiff = -Infinity;
      let fgCount = 0;

      for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
          if (lumaAt(x, y) < threshold) continue;
          fgCount++;
          const sum = x + y;
          const diff = x - y;
          if (sum < minSum) {
            minSum = sum;
            tl = { x, y };
          }
          if (sum > maxSum) {
            maxSum = sum;
            br = { x, y };
          }
          if (diff > maxDiff) {
            maxDiff = diff;
            tr = { x, y };
          }
          if (diff < minDiff) {
            minDiff = diff;
            bl = { x, y };
          }
        }
      }

      const sampledTotal = Math.ceil(w / 2) * Math.ceil(h / 2);
      const ratio = fgCount / Math.max(1, sampledTotal);
      if (!tl || !tr || !br || !bl || ratio < 0.12 || ratio > 0.97) return null;

      return this.sortCornerPoints(
        [tl, tr, br, bl].map((p) => ({
          x: Math.max(0, Math.min(origW, Math.round(p.x / scale))),
          y: Math.max(0, Math.min(origH, Math.round(p.y / scale))),
        })),
      );
    },

    autoCrop() {
      if (!this.sourceCanvas) return;
      this.detectCorners(this.sourceCanvas);
    },

    redrawCropCanvas() {
      const canvas = this.$refs.cropCanvas;
      if (!canvas || !this.sourceCanvas || !this.corners) return;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const scaleX = canvas.width / this.sourceCanvas.width;
      const scaleY = canvas.height / this.sourceCanvas.height;

      if (this.filterMode === "bw") {
        ctx.filter = "grayscale(100%) contrast(165%) brightness(105%)";
      } else if (this.filterMode === "grayscale") {
        ctx.filter = "grayscale(100%) contrast(120%)";
      } else {
        ctx.filter = "none";
      }

      ctx.drawImage(this.sourceCanvas, 0, 0, canvas.width, canvas.height);
      ctx.filter = "none";

      const { topLeft, topRight, bottomRight, bottomLeft } = this.corners;
      const tl = { x: topLeft.x * scaleX, y: topLeft.y * scaleY };
      const tr = { x: topRight.x * scaleX, y: topRight.y * scaleY };
      const br = { x: bottomRight.x * scaleX, y: bottomRight.y * scaleY };
      const bl = { x: bottomLeft.x * scaleX, y: bottomLeft.y * scaleY };

      // Dunkle Überlagerung außen
      ctx.fillStyle = "rgba(0, 0, 0, 0.50)";
      ctx.beginPath();
      ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fill("evenodd");

      // Dokumenten-Polygon Rahmen
      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.fillStyle = "rgba(59, 130, 246, 0.20)";
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3b82f6";
      ctx.stroke();

      // Griffe
      const handleRadius = 14;
      const pointKeys = [
        { key: "topLeft", point: tl },
        { key: "topRight", point: tr },
        { key: "bottomRight", point: br },
        { key: "bottomLeft", point: bl },
      ];

      pointKeys.forEach(({ key, point }) => {
        const isActive = this.activeCorner === key;
        ctx.beginPath();
        ctx.arc(point.x, point.y, handleRadius, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? "#2563eb" : "#ffffff";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#3b82f6";
        ctx.stroke();
      });

      if (this.activeCorner && this.corners[this.activeCorner]) {
        this.drawCornerLoupe(
          ctx,
          canvas,
          this.corners[this.activeCorner],
          scaleX,
          scaleY,
        );
      }
    },

    drawCornerLoupe(ctx, canvas, srcPoint, scaleX, scaleY) {
      const activeScreenPt = {
        x: srcPoint.x * scaleX,
        y: srcPoint.y * scaleY,
      };
      const loupeRadius = Math.round(
        Math.min(canvas.width, canvas.height) * 0.16,
      );
      const zoom = 2.4;
      const margin = 16;

      // Diagonal gegenüberliegende Quadranten-Positionierung
      const lx = activeScreenPt.x < canvas.width * 0.5 ? canvas.width - loupeRadius - margin : loupeRadius + margin;
      const ly = activeScreenPt.y < canvas.height * 0.5 ? canvas.height - loupeRadius - margin : loupeRadius + margin;

      const sampleRadius = loupeRadius / scaleX / zoom;
      const sx = srcPoint.x - sampleRadius;
      const sy = srcPoint.y - sampleRadius;
      const sSize = sampleRadius * 2;

      // Schatten für klaren Kontrast zum Beleg
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(lx, ly, loupeRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();
      ctx.restore();

      // Scharfes Sampling direkt aus this.sourceCanvas in runden Clip-Bereich
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, loupeRadius, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = "#000000";
      ctx.fillRect(
        lx - loupeRadius,
        ly - loupeRadius,
        loupeRadius * 2,
        loupeRadius * 2,
      );
      ctx.drawImage(
        this.sourceCanvas,
        sx,
        sy,
        sSize,
        sSize,
        lx - loupeRadius,
        ly - loupeRadius,
        loupeRadius * 2,
        loupeRadius * 2,
      );

      // Fadenkreuz (skaliert mit loupeRadius + Kontrast-Halo für gute Sichtbarkeit)
      const crossArm = Math.max(24, Math.round(loupeRadius * 0.45));
      const crossWidth = Math.max(3, Math.round(loupeRadius * 0.045));
      const centerGap = Math.max(6, Math.round(crossWidth * 1.5));

      const drawCrosshairPath = () => {
        ctx.beginPath();
        ctx.moveTo(lx - crossArm, ly);
        ctx.lineTo(lx - centerGap, ly);
        ctx.moveTo(lx + centerGap, ly);
        ctx.lineTo(lx + crossArm, ly);
        ctx.moveTo(lx, ly - crossArm);
        ctx.lineTo(lx, ly - centerGap);
        ctx.moveTo(lx, ly + centerGap);
        ctx.lineTo(lx, ly + crossArm);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lx, ly, centerGap, 0, Math.PI * 2);
        ctx.stroke();
      };

      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
      ctx.lineWidth = crossWidth + 3;
      drawCrosshairPath();

      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = crossWidth;
      drawCrosshairPath();
      ctx.restore();

      // 3px-Fokusring
      ctx.save();
      ctx.beginPath();
      ctx.arc(lx, ly, loupeRadius, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#3b82f6";
      ctx.stroke();
      ctx.restore();
    },

    updatePreview() {
      if (!this.sourceCanvas || !this.corners) return;
      const canvas = this.$refs.previewCanvas;
      if (!canvas) return;

      const { topLeft, topRight, bottomLeft, bottomRight } = this.corners;
      const topWidth = Math.hypot(
        topRight.x - topLeft.x,
        topRight.y - topLeft.y,
      );
      const bottomWidth = Math.hypot(
        bottomRight.x - bottomLeft.x,
        bottomRight.y - bottomLeft.y,
      );
      const leftHeight = Math.hypot(
        bottomLeft.x - topLeft.x,
        bottomLeft.y - topLeft.y,
      );
      const rightHeight = Math.hypot(
        bottomRight.x - topRight.x,
        bottomRight.y - topRight.y,
      );

      let targetWidth = Math.round(Math.max(topWidth, bottomWidth));
      let targetHeight = Math.round(Math.max(leftHeight, rightHeight));

      const maxDim = 1200;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        const scale = maxDim / Math.max(targetWidth, targetHeight);
        targetWidth = Math.round(targetWidth * scale);
        targetHeight = Math.round(targetHeight * scale);
      }

      const extracted = this.extractPaperPerspective(
        this.sourceCanvas,
        targetWidth,
        targetHeight,
        this.corners,
      );

      const filtered = this.applyReceiptFilter(
        extracted || this.sourceCanvas,
        this.filterMode,
      );
      canvas.width = filtered.width;
      canvas.height = filtered.height;
      const pCtx = canvas.getContext("2d");
      pCtx.drawImage(filtered, 0, 0);
    },

    onPointerDown(e) {
      if (!this.corners || !this.$refs.cropCanvas || !this.sourceCanvas) return;
      const canvas = this.$refs.cropCanvas;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const scaleX = canvas.width / this.sourceCanvas.width;
      const scaleY = canvas.height / this.sourceCanvas.height;
      const canvasToCssX = rect.width / canvas.width;
      const canvasToCssY = rect.height / canvas.height;

      let closest = null;
      let minDist = 48;

      Object.entries(this.corners).forEach(([key, pt]) => {
        const cornerCssX = rect.left + pt.x * scaleX * canvasToCssX;
        const cornerCssY = rect.top + pt.y * scaleY * canvasToCssY;
        const dist = Math.hypot(cornerCssX - clientX, cornerCssY - clientY);
        if (dist < minDist) {
          minDist = dist;
          closest = key;
        }
      });

      if (closest) {
        this.activeCorner = closest;
        this.redrawCropCanvas();
      }
    },

    onPointerMove(e) {
      if (!this.activeCorner || !this.$refs.cropCanvas || !this.sourceCanvas) {
        return;
      }
      if (e.cancelable) e.preventDefault();

      const canvas = this.$refs.cropCanvas;
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX;
      const clientY = e.clientY;

      const scaleX = canvas.width / this.sourceCanvas.width;
      const scaleY = canvas.height / this.sourceCanvas.height;
      const canvasToCssX = rect.width / canvas.width;
      const canvasToCssY = rect.height / canvas.height;

      const srcX = (clientX - rect.left) / (scaleX * canvasToCssX);
      const srcY = (clientY - rect.top) / (scaleY * canvasToCssY);

      const w = this.sourceCanvas.width;
      const h = this.sourceCanvas.height;

      this.corners[this.activeCorner] = {
        x: Math.max(0, Math.min(w, Math.round(srcX))),
        y: Math.max(0, Math.min(h, Math.round(srcY))),
      };

      if (!this._rafId) {
        this._rafId = requestAnimationFrame(() => {
          this._rafId = null;
          this.redrawCropCanvas();
        });
      }
    },

    onPointerUp() {
      if (this._rafId) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      if (this.activeCorner) {
        this.activeCorner = null;
        this.redrawCropCanvas();
        if (this.$refs.previewCanvas) {
          this.updatePreview();
        }
      }
    },

    rotate(degree) {
      if (!this.sourceCanvas) return;
      const oldCanvas = this.sourceCanvas;
      const w = oldCanvas.width;
      const h = oldCanvas.height;

      const newCanvas = document.createElement("canvas");
      newCanvas.width = oldCanvas.height;
      newCanvas.height = oldCanvas.width;
      const ctx = newCanvas.getContext("2d");

      ctx.translate(newCanvas.width / 2, newCanvas.height / 2);
      ctx.rotate((degree * Math.PI) / 180);
      ctx.drawImage(oldCanvas, -oldCanvas.width / 2, -oldCanvas.height / 2);

      this.sourceCanvas = newCanvas;
      this.capturedImageSrc = newCanvas.toDataURL("image/jpeg", 0.95);

      if (this.corners) {
        const rotatePoint = (pt) => {
          if (degree === 90) return { x: h - pt.y, y: pt.x };
          if (degree === -90) return { x: pt.y, y: w - pt.x };
          return pt;
        };
        const newPts = [
          rotatePoint(this.corners.topLeft),
          rotatePoint(this.corners.topRight),
          rotatePoint(this.corners.bottomRight),
          rotatePoint(this.corners.bottomLeft),
        ];
        this.corners = this.sortCornerPoints(newPts);
      }

      if (this.cropSubMode === "preview") {
        this.updatePreview();
      } else {
        this.setupCropCanvas();
      }
    },

    resetCrop() {
      if (!this.sourceCanvas) return;
      const w = this.sourceCanvas.width;
      const h = this.sourceCanvas.height;
      this.corners = {
        topLeft: { x: 0, y: 0 },
        topRight: { x: w, y: 0 },
        bottomRight: { x: w, y: h },
        bottomLeft: { x: 0, y: h },
      };
      this.redrawCropCanvas();
      if (this.cropSubMode === "preview") {
        this.updatePreview();
      }
    },

    extractPaperPerspective(sourceCanvas, targetWidth, targetHeight, corners) {
      if (typeof cv !== "undefined" && cv.Mat && corners) {
        let srcMat = null,
          dstMat = null,
          M = null,
          srcPts = null,
          dstPts = null;
        try {
          srcMat = cv.imread(sourceCanvas);
          dstMat = new cv.Mat();
          const { topLeft, topRight, bottomRight, bottomLeft } = corners;
          srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            topLeft.x,
            topLeft.y,
            topRight.x,
            topRight.y,
            bottomRight.x,
            bottomRight.y,
            bottomLeft.x,
            bottomLeft.y,
          ]);
          dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0,
            0,
            targetWidth,
            0,
            targetWidth,
            targetHeight,
            0,
            targetHeight,
          ]);
          M = cv.getPerspectiveTransform(srcPts, dstPts);
          const dsize = new cv.Size(targetWidth, targetHeight);
          cv.warpPerspective(
            srcMat,
            dstMat,
            M,
            dsize,
            cv.INTER_LINEAR,
            cv.BORDER_CONSTANT,
            new cv.Scalar(255, 255, 255, 255),
          );
          const outCanvas = document.createElement("canvas");
          outCanvas.width = targetWidth;
          outCanvas.height = targetHeight;
          cv.imshow(outCanvas, dstMat);
          return outCanvas;
        } catch (err) {
          console.warn("Perspective warp failed:", err);
        } finally {
          if (srcMat) srcMat.delete();
          if (dstMat) dstMat.delete();
          if (M) M.delete();
          if (srcPts) srcPts.delete();
          if (dstPts) dstPts.delete();
        }
      }

      // Fallback: Einfaches Bounding-Box Cropping
      const { topLeft, topRight, bottomLeft, bottomRight } = corners;
      const minX = Math.min(topLeft.x, bottomLeft.x);
      const maxX = Math.max(topRight.x, bottomRight.x);
      const minY = Math.min(topLeft.y, topRight.y);
      const maxY = Math.max(bottomLeft.y, bottomRight.y);
      const cropW = Math.max(10, maxX - minX);
      const cropH = Math.max(10, maxY - minY);

      const out = document.createElement("canvas");
      out.width = targetWidth;
      out.height = targetHeight;
      const ctx = out.getContext("2d");
      ctx.drawImage(
        sourceCanvas,
        minX,
        minY,
        cropW,
        cropH,
        0,
        0,
        targetWidth,
        targetHeight,
      );
      return out;
    },

    applyReceiptFilter(canvas, mode = "bw") {
      if (mode === "color") return canvas;

      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext("2d");
      ctx.drawImage(canvas, 0, 0);

      const imgData = ctx.getImageData(0, 0, out.width, out.height);
      const d = imgData.data;

      // 1. Graustufen-Werte berechnen & Histogramm aufbauen
      const grays = new Uint8Array(d.length / 4);
      const hist = new Int32Array(256);
      for (let i = 0, j = 0; i < d.length; i += 4, j++) {
        const g = Math.round(
          0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2],
        );
        grays[j] = g;
        hist[g]++;
      }

      if (mode === "bw") {
        // Otsu's Thresholding für scharfe Dokumenten-Texte ohne verwaschene Flecken
        const total = grays.length;
        let sum = 0;
        for (let t = 0; t < 256; t++) sum += t * hist[t];

        let sumB = 0;
        let wB = 0;
        let varMax = 0;
        let threshold = 135;

        for (let t = 0; t < 256; t++) {
          wB += hist[t];
          if (wB === 0) continue;
          const wF = total - wB;
          if (wF === 0) break;

          sumB += t * hist[t];
          const mB = sumB / wB;
          const mF = (sum - sumB) / wF;
          const varBetween = wB * wF * (mB - mF) * (mB - mF);

          if (varBetween > varMax) {
            varMax = varBetween;
            threshold = t;
          }
        }

        // Leichtes Offset zugunsten lesbarer Schrift (-5)
        const activeThresh = Math.max(80, Math.min(200, threshold - 5));

        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const val = grays[j] > activeThresh ? 255 : 0;
          d[i] = d[i + 1] = d[i + 2] = val;
        }
      } else {
        // Graustufen mit Kontrastanhebung
        for (let i = 0, j = 0; i < d.length; i += 4, j++) {
          const g = grays[j];
          // Leichte S-Kurve für Textklarheit auf Papier
          const contrastG = Math.max(
            0,
            Math.min(255, Math.round((g - 128) * 1.25 + 128)),
          );
          d[i] = d[i + 1] = d[i + 2] = contrastG;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      return out;
    },

    commitCurrentPage() {
      if (!this.sourceCanvas || !this.corners) return false;

      const { topLeft, topRight, bottomLeft, bottomRight } = this.corners;
      const topWidth = Math.hypot(
        topRight.x - topLeft.x,
        topRight.y - topLeft.y,
      );
      const bottomWidth = Math.hypot(
        bottomRight.x - bottomLeft.x,
        bottomRight.y - bottomLeft.y,
      );
      const leftHeight = Math.hypot(
        bottomLeft.x - topLeft.x,
        bottomLeft.y - topLeft.y,
      );
      const rightHeight = Math.hypot(
        bottomRight.x - topRight.x,
        bottomRight.y - topRight.y,
      );

      let targetWidth = Math.round(Math.max(topWidth, bottomWidth));
      let targetHeight = Math.round(Math.max(leftHeight, rightHeight));

      const maxDim = 1920;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        const scale = maxDim / Math.max(targetWidth, targetHeight);
        targetWidth = Math.round(targetWidth * scale);
        targetHeight = Math.round(targetHeight * scale);
      }

      const extracted = this.extractPaperPerspective(
        this.sourceCanvas,
        targetWidth,
        targetHeight,
        this.corners,
      );
      const processed = this.applyReceiptFilter(
        extracted || this.sourceCanvas,
        this.filterMode,
      );
      const finalDataUrl = processed.toDataURL("image/jpeg", 0.9);

      // Event zurück an Hauptapplikation
      const appEl = document.querySelector("[x-data*='scanApp']");
      if (appEl && Alpine.$data(appEl)) {
        Alpine.$data(appEl).onPageCaptured({
          pageIndex: this.pageIndex,
          dataUrl: finalDataUrl,
        });
      }

      return true;
    },

    acceptAndNextPage() {
      if (!this.commitCurrentPage()) return;
      this.pageIndex = -1;
      this.cropSubMode = "crop";
      this.capturedImageSrc = null;
      this.sourceCanvas = null;
      this.corners = null;
      this.activeCorner = null;
      this.mode = "camera";
      this.$nextTick(() => this.startCamera());
    },

    acceptReceipt() {
      if (!this.commitCurrentPage()) return;
      this.close();
    },
  }));
});
