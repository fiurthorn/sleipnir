/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("agentmate", () => ({
    tab: "triage",
    models: [],
    mcpServers: [],
    pendingQueue: { available: true, count: 0, items: [], error: "" },
    selectedModel: "",
    cronSchedule: "0 3 * * *",
    lastTriageRun: null,
    triageLoading: false,
    triageError: "",
    triageNotice: "",
    googleClientId: "",
    gmailLabel: localStorage.getItem("agentmate_gmail_label_v1") || "ScanMate",
    gmailAccessToken: "",
    gmailLoading: false,
    chatMessages: [],
    chatInput: "",
    chatLoading: false,

    init() {
      this.refreshConfig();
    },

    setTabTriage() {
      this.tab = "triage";
    },

    setTabChat() {
      this.tab = "chat";
    },

    async refreshConfig() {
      try {
        const res = await fetch("./api/config");
        if (!res.ok) return;
        const data = await res.json();
        this.models = data.models || [];
        this.mcpServers = data.mcpServers || [];
        this.pendingQueue = data.pendingQueue || { available: false, count: 0, items: [] };
        this.cronSchedule = data.cronSchedule || "0 3 * * *";
        this.lastTriageRun = data.lastTriageRun || null;
        this.googleClientId = data.googleClientId || "";
        if (!localStorage.getItem("agentmate_gmail_label_v1") && data.defaultGmailLabel) {
          this.gmailLabel = data.defaultGmailLabel;
        }
        if (!this.selectedModel && this.models.length > 0) {
          this.selectedModel = this.models[0].id;
        }
      } catch (err) {
        console.error("Failed to load agentmate config:", err);
      }
    },

    async runTriageNow() {
      this.triageLoading = true;
      this.triageError = "";
      this.triageNotice = "";

      try {
        const res = await fetch("./api/triage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.selectedModel || undefined,
          }),
        });
        const data = await res.json();
        if (data.pendingQueue) {
          this.pendingQueue = data.pendingQueue;
        }
        if (!res.ok) {
          this.triageError = data.error || "Triage fehlgeschlagen";
          return;
        }
        this.lastTriageRun = data.report || null;
        if (this.lastTriageRun && this.lastTriageRun.count === 0) {
          this.triageNotice = "Keine offenen Scans in der ScanMate-Inbox.";
        }
      } catch (err) {
        this.triageError = err instanceof Error ? err.message : "Netzwerkfehler";
      } finally {
        this.triageLoading = false;
      }
    },

    requestGoogleAccessToken() {
      return new Promise((resolve, reject) => {
        const oauth2 = globalThis.google?.accounts?.oauth2;
        if (!oauth2) {
          reject(new Error("Google Identity Services nicht geladen (Adblocker oder offline?)."));
          return;
        }
        const client = oauth2.initTokenClient({
          client_id: this.googleClientId,
          scope: "https://www.googleapis.com/auth/gmail.modify",
          callback: (resp) => {
            if (resp.error || !resp.access_token) {
              reject(new Error(resp.error_description || resp.error || "Kein Access-Token erhalten."));
              return;
            }
            this.gmailAccessToken = resp.access_token;
            resolve(resp.access_token);
          },
          error_callback: (err) => {
            reject(new Error(err?.message || "Google-Anmeldung abgebrochen."));
          },
        });
        client.requestAccessToken({ prompt: "" });
      });
    },

    async importFromGmail() {
      const labelName = (this.gmailLabel || "").trim();
      if (!labelName) {
        this.triageError = "Bitte ein Gmail-Label angeben.";
        return;
      }
      localStorage.setItem("agentmate_gmail_label_v1", labelName);
      this.gmailLoading = true;
      this.triageError = "";
      this.triageNotice = "";

      try {
        const token = this.gmailAccessToken || (await this.requestGoogleAccessToken());
        let res = await fetch("./api/gmail/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: token,
            labelName,
            model: this.selectedModel || undefined,
            runTriage: true,
          }),
        });

        // Falls Token abgelaufen, einmalig neu anfordern
        if (res.status === 400) {
          const errData = await res.clone().json().catch(() => ({}));
          if (typeof errData.error === "string" && errData.error.includes("Access-Token")) {
            this.gmailAccessToken = "";
            const freshToken = await this.requestGoogleAccessToken();
            res = await fetch("./api/gmail/import", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: freshToken,
                labelName,
                model: this.selectedModel || undefined,
                runTriage: true,
              }),
            });
          }
        }

        const data = await res.json();
        if (data.pendingQueue) {
          this.pendingQueue = data.pendingQueue;
        }
        if (!res.ok) {
          this.triageError = data.error || "Gmail-Import fehlgeschlagen";
          return;
        }
        if (data.triageReport) {
          this.lastTriageRun = data.triageReport;
        }
        this.triageNotice =
          `Gmail '${data.labelName}': ${data.scannedMessages} E-Mail(s) geprüft, ${data.enqueuedAttachments} Anhang/Anhänge importiert, ${data.unlabeledMessages} Label entfernt.`;
      } catch (err) {
        this.triageError = err instanceof Error ? err.message : "Gmail-Import fehlgeschlagen";
      } finally {
        this.gmailLoading = false;
      }
    },

    async sendChat(event) {
      if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
      }
      const text = this.chatInput.trim();
      if (!text || this.chatLoading) return;

      this.chatMessages.push({ role: "user", content: text });
      this.chatInput = "";
      this.chatLoading = true;

      try {
        const payloadMessages = this.chatMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await fetch("./api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.selectedModel || undefined,
            messages: payloadMessages,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.chatMessages.push({
            role: "assistant",
            content: "Fehler: " + (data.error || "Unbekannter Fehler"),
          });
          return;
        }
        this.chatMessages.push({
          role: "assistant",
          content: data.reply,
          toolsUsed: data.toolsUsed || [],
        });
      } catch (err) {
        this.chatMessages.push({
          role: "assistant",
          content: "Netzwerkfehler: " + (err instanceof Error ? err.message : "Unbekannt"),
        });
      } finally {
        this.chatLoading = false;
      }
    },
  }));
});
