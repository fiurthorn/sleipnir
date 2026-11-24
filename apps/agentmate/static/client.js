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
    selectedModel: "",
    cronSchedule: "0 3 * * *",
    lastTriageRun: null,
    triageLoading: false,
    triageError: "",
    triageNotice: "",
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
        this.cronSchedule = data.cronSchedule || "0 3 * * *";
        this.lastTriageRun = data.lastTriageRun || null;
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
