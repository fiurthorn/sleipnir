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

    // Extrahierte / editierbare Metadaten für den neuen Scan
    metadata: {
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
      targetPath: "", // Zielordner
    },

    async init() {
      await this.loadModels();
      await this.loadFolders();
      await this.loadDocuments();
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

      if (store.filterCategory) {
        list = list.filter((d) => d.category === store.filterCategory);
      }

      if (store.filterFolder) {
        list = list.filter((d) => (d.targetPath || "") === store.filterFolder);
      }

      if (store.searchQuery && store.searchQuery.trim().length > 0) {
        const q = store.searchQuery.toLowerCase().trim();
        list = list.filter((d) => {
          return (
            (d.title && d.title.toLowerCase().includes(q)) ||
            (d.sender && d.sender.toLowerCase().includes(q)) ||
            (d.summary && d.summary.toLowerCase().includes(q)) ||
            (d.ocrText && d.ocrText.toLowerCase().includes(q)) ||
            (d.tags && d.tags.some((t) => t.toLowerCase().includes(q)))
          );
        });
      }

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

    async deleteDoc(doc) {
      if (!confirm(`Dokument "${doc.title}" wirklich löschen?`)) return;

      try {
        const res = await fetch(`./api/documents/${doc.id}`, {
          method: "DELETE",
        });
        if (res.ok) {
          if (Alpine.store("scanmate").activeDoc?.id === doc.id) {
            Alpine.store("scanmate").activeDoc = null;
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
    filterMode: "bw", // "bw" | "grayscale" | "color"
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
        this.filterMode = "bw";

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

      let corners = null;

      // Fallback auf 5% Rand
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

    autoCrop() {
      if (!this.sourceCanvas) return;
      const w = this.sourceCanvas.width;
      const h = this.sourceCanvas.height;
      this.corners = {
        topLeft: { x: Math.round(w * 0.03), y: Math.round(h * 0.03) },
        topRight: { x: Math.round(w * 0.97), y: Math.round(h * 0.03) },
        bottomRight: { x: Math.round(w * 0.97), y: Math.round(h * 0.97) },
        bottomLeft: { x: Math.round(w * 0.03), y: Math.round(h * 0.97) },
      };
      this.redrawCropCanvas();
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

    acceptReceipt() {
      if (!this.sourceCanvas || !this.corners) return;

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

      this.close();
    },
  }));
});
