/**
 * @project Sleipnir Stack / Scanmate Mini-Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

function registerMiniScanClient() {
  if (!window.Alpine) return;

  window.Alpine.data("miniScanClient", () => ({
    pages: [],
    label: "",
    pendingItems: [],
    isSubmitting: false,
    isLoadingPending: false,
    statusMessage: "",
    errorMessage: "",

    init() {
      this.loadPending();
    },

    async loadPending() {
      this.isLoadingPending = true;
      try {
        const res = await fetch("./api/pending");
        const data = await res.json();
        if (data.ok) {
          this.pendingItems = data.items || [];
        }
      } catch (err) {
        console.error("Pending load error:", err);
      } finally {
        this.isLoadingPending = false;
      }
    },

    async handleFiles(event) {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) return;

      this.errorMessage = "";
      for (const file of files) {
        const dataUrl = await this.readFileAsDataUrl(file);
        if (dataUrl) {
          this.pages.push(dataUrl);
        }
      }
      event.target.value = "";
    },

    readFileAsDataUrl(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    },

    removePage(index) {
      this.pages.splice(index, 1);
    },

    async submitToInbox() {
      if (this.pages.length === 0 || this.isSubmitting) return;

      this.isSubmitting = true;
      this.errorMessage = "";
      this.statusMessage = "";

      try {
        const res = await fetch("./api/pending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: this.pages,
            label: this.label.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          this.errorMessage = data.error || "Speichern fehlgeschlagen";
          return;
        }

        this.pages = [];
        this.label = "";
        this.statusMessage = "Scan in Agent-Inbox abgelegt.";
        await this.loadPending();
      } catch (err) {
        this.errorMessage = err instanceof Error ? err.message : "Netzwerkfehler";
      } finally {
        this.isSubmitting = false;
      }
    },

    async deletePending(id) {
      try {
        const res = await fetch(`./api/pending/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (res.ok) {
          await this.loadPending();
        }
      } catch (err) {
        console.error("Delete pending error:", err);
      }
    },
  }));
}

if (window.Alpine) {
  registerMiniScanClient();
} else {
  document.addEventListener("alpine:init", registerMiniScanClient);
}
