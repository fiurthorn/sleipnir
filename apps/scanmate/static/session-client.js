/**
 * @project Sleipnir Stack / Scanmate Session-Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

function registerSessionScanClient() {
  if (!window.Alpine) return;

  window.Alpine.data("sessionScanApp", (token) => ({
    token,
    session: null,
    pages: [],
    label: "",
    isLoading: true,
    isSubmitting: false,
    submitted: false,
    errorMessage: "",

    async init() {
      globalThis.addEventListener("scan-page-captured", (e) => {
        this.onPageCaptured(e.detail);
      });
      await this.loadSession();
    },

    async loadSession() {
      this.isLoading = true;
      this.errorMessage = "";
      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.token)}`);
        const data = await res.json();
        if (!res.ok || !data.ok) {
          this.errorMessage = data.error || "Scan-Link abgelaufen oder ungültig.";
          return;
        }
        this.session = data.session;
        this.label = data.session.label || "";
        if (data.session.status === "submitted") {
          this.submitted = true;
        }
      } catch {
        this.errorMessage = "Verbindung zum Server fehlgeschlagen.";
      } finally {
        this.isLoading = false;
      }
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
      const { pageIndex, dataUrl } = detail || {};
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

    async submitSession() {
      if (this.pages.length === 0 || this.isSubmitting) return;
      this.isSubmitting = true;
      this.errorMessage = "";

      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.token)}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pages: this.pages.map((p) => p.dataUrl),
            label: this.label.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          this.errorMessage = data.error || "Übermittlung fehlgeschlagen.";
          return;
        }
        this.submitted = true;
        this.pages = [];
      } catch {
        this.errorMessage = "Netzwerkfehler beim Senden.";
      } finally {
        this.isSubmitting = false;
      }
    },
  }));
}

if (window.Alpine) {
  registerSessionScanClient();
} else {
  document.addEventListener("alpine:init", registerSessionScanClient);
}
