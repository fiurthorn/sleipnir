/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("chatmate", () => ({
    // Persistent state (Browser LocalStorage)
    chats: Alpine.$persist([]).as("chatmate_chats_v1"),
    currentChatId: Alpine.$persist(null).as("chatmate_active_chat_id_v1"),
    activeModel: Alpine.$persist("openrouter:anthropic/claude-3.5-sonnet").as(
      "chatmate_model_v1",
    ),

    // Transient state (not saved in localStorage)
    inputPrompt: "",
    attachedImage: null,
    isLoading: false,
    models: [],
    providerStatus: { openrouter: false, venice: false },

    async init() {
      // 1. Fetch available models and server provider keys status
      try {
        const res = await fetch("./api/models");
        if (res.ok) {
          const data = await res.json();
          this.models = data.models || [];
          this.providerStatus = data.providers || {
            openrouter: false,
            venice: false,
          };

          // If current model not in list or key missing, select first suitable
          const exists = this.models.some((m) => m.id === this.activeModel);
          if (!exists && this.models.length > 0) {
            this.activeModel = this.models[0].id;
          }
        }
      } catch (e) {
        console.warn("Could not load models from server:", e);
      }

      // 2. Ensure at least one chat exists
      if (!Array.isArray(this.chats) || this.chats.length === 0) {
        this.createWelcomeChat();
      } else if (!this.currentChatId || !this.currentChat) {
        this.currentChatId = this.chats[0].id;
      }

      this.$nextTick(() => this.scrollToBottom());
    },

    get currentChat() {
      return this.chats.find((c) => c.id === this.currentChatId) ||
        this.chats[0];
    },

    createWelcomeChat() {
      const welcomeChat = {
        id: "chat_" + Date.now(),
        title: "Willkommen",
        model: this.activeModel,
        createdAt: Date.now(),
        messages: [
          {
            id: "msg_welcome",
            role: "assistant",
            content:
              "Willkommen bei **Chatmate**!\n\n- 🔒 **Zero-Logging & Login-frei:** Alle Daten bleiben ausschließlich in deinem Browser-Speicher (`localStorage`).\n- 💬 **Text, Code & Vision:** Bilder einfach per `Strg+V` in das Eingabefeld einfügen oder anhängen.\n- 🎨 **Bildgenerierung:** Tippe `/image <Beschreibung>` (z.B. `/image Ein Espresso auf einer italienischen Marmorplatte`), um direkt Bilder zu erzeugen.",
            type: "text",
            timestamp: Date.now(),
          },
        ],
      };
      this.chats = [welcomeChat];
      this.currentChatId = welcomeChat.id;
    },

    newChat() {
      const newId = "chat_" + Date.now();
      const freshChat = {
        id: newId,
        title: "Neuer Dialog",
        model: this.activeModel,
        createdAt: Date.now(),
        messages: [],
      };
      this.chats.unshift(freshChat);
      this.currentChatId = newId;
      this.$nextTick(() => this.scrollToBottom());
    },

    selectChat(id) {
      this.currentChatId = id;
      this.$nextTick(() => this.scrollToBottom());
    },

    deleteChat(id) {
      if (this.chats.length <= 1) {
        this.createWelcomeChat();
        return;
      }
      this.chats = this.chats.filter((c) => c.id !== id);
      if (this.currentChatId === id) {
        this.currentChatId = this.chats[0].id;
      }
    },

    clearCurrentChat() {
      if (this.currentChat) {
        this.currentChat.messages = [];
      }
    },

    renderMarkdown(text) {
      if (!text) return "";
      if (typeof window.marked !== "undefined" && window.marked.parse) {
        return window.marked.parse(text);
      }
      // Simple fallback escaping
      return text.replace(/\n/g, "<br>");
    },

    processImageFile(file) {
      if (!file || !file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Scale down image if dimensions exceed 1600px to conserve localStorage & token bandwidth
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);

          // Convert to JPEG data URL for compact size
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          this.attachedImage = dataUrl;
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    },

    removeAttachedImage() {
      this.attachedImage = null;
    },

    handlePaste(event) {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            this.processImageFile(file);
            return;
          }
        }
      }
    },

    handleDrop(event) {
      event.preventDefault();
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;

      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          this.processImageFile(files[i]);
          break;
        }
      }
    },

    handleFileSelect(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      this.processImageFile(file);
      event.target.value = "";
    },

    async submitMessage() {
      const prompt = this.inputPrompt.trim();
      const image = this.attachedImage;
      if ((!prompt && !image) || this.isLoading) return;

      this.inputPrompt = "";
      this.attachedImage = null;
      const chat = this.currentChat;
      if (!chat) return;

      // Update chat title if it's the first user message
      if (
        chat.messages.filter((m) => m.role === "user").length === 0 &&
        chat.title === "Neuer Dialog"
      ) {
        const titleSource = prompt || "Bildanalyse";
        chat.title = titleSource.length > 25
          ? titleSource.slice(0, 25) + "..."
          : titleSource;
      }

      // Check for image generation command (only when no image is attached)
      if (!image && (prompt.startsWith("/image ") || this.isImageModelSelected())) {
        await this.handleImageGeneration(prompt);
        return;
      }

      // Auto-switch to vision-capable model if user attached an image while an image-generation model was selected
      if (image && this.isImageModelSelected()) {
        const visionModel = this.models.find((m) =>
          m.id === "openrouter:anthropic/claude-3.5-sonnet"
        ) || this.models.find((m) => m.type === "text");
        if (visionModel) {
          this.activeModel = visionModel.id;
        }
      }

      // Standard Chat completion (Streaming) with optional attached image
      await this.handleChatStream(prompt, image);
    },

    isImageModelSelected() {
      const m = this.models.find((model) => model.id === this.activeModel);
      return m && m.type === "image";
    },

    async handleImageGeneration(rawPrompt) {
      const chat = this.currentChat;
      const cleanPrompt = rawPrompt.replace(/^\/image\s*/, "").trim();

      // 1. Add user message
      chat.messages.push({
        id: "msg_" + Date.now(),
        role: "user",
        content: rawPrompt,
        type: "text",
        timestamp: Date.now(),
      });

      // 2. Add pending assistant image message
      const assistantMsg = {
        id: "msg_" + (Date.now() + 1),
        role: "assistant",
        content: cleanPrompt,
        type: "image",
        imageUrl: null,
        loading: true,
        timestamp: Date.now(),
      };
      chat.messages.push(assistantMsg);
      this.isLoading = true;
      this.$nextTick(() => this.scrollToBottom());

      try {
        const res = await fetch("./api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: cleanPrompt,
            model: this.activeModel,
            aspectRatio: "1:1",
          }),
        });

        if (!res.ok) {
          throw new Error("HTTP " + res.status);
        }

        const data = await res.json();
        assistantMsg.imageUrl = data.imageUrl;
      } catch (err) {
        assistantMsg.error = "Bildgenerierung fehlgeschlagen: " + err.message;
      } finally {
        assistantMsg.loading = false;
        this.isLoading = false;
        this.$nextTick(() => this.scrollToBottom());
      }
    },

    async handleChatStream(prompt, image = null) {
      const chat = this.currentChat;

      // 1. Append user message (multimodal if image present)
      chat.messages.push({
        id: "msg_" + Date.now(),
        role: "user",
        content: prompt,
        imageUrl: image,
        type: image ? "multimodal" : "text",
        timestamp: Date.now(),
      });

      // 2. Prepare assistant placeholder
      const assistantMsg = {
        id: "msg_" + (Date.now() + 1),
        role: "assistant",
        content: "",
        type: "text",
        timestamp: Date.now(),
      };
      chat.messages.push(assistantMsg);

      this.isLoading = true;
      this.$nextTick(() => this.scrollToBottom());

      // Prepare context: last 10 messages for context window
      const messagesPayload = chat.messages
        .filter((m) =>
          (m.type === "text" || m.type === "multimodal" || m.imageUrl) &&
          (m.content || m.imageUrl)
        )
        .slice(-10)
        .map((m) => {
          if (m.imageUrl) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content || "Beschreibe dieses Bild." },
                { type: "image_url", image_url: { url: m.imageUrl } },
              ],
            };
          }
          return { role: m.role, content: m.content };
        });

      try {
        const response = await fetch("./api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: this.activeModel,
            messages: messagesPayload,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error("HTTP " + response.status);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;

            const dataStr = trimmed.replace(/^data:\s*/, "");
            if (dataStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(dataStr);
              const deltaContent = parsed.choices?.[0]?.delta?.content;
              if (deltaContent) {
                assistantMsg.content += deltaContent;
                this.scrollToBottomThrottled();
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        }
      } catch (err) {
        assistantMsg.content += "\n\n❌ **Verbindungsfehler:** " + err.message;
      } finally {
        this.isLoading = false;
        this.$nextTick(() => this.scrollToBottom());
      }
    },

    scrollToBottom() {
      const container = document.getElementById("chat-thread");
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    },

    _scrollTimeout: null,
    scrollToBottomThrottled() {
      if (this._scrollTimeout) return;
      this._scrollTimeout = setTimeout(() => {
        this.scrollToBottom();
        this._scrollTimeout = null;
      }, 50);
    },

    exportData() {
      const json = JSON.stringify(this.chats, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chatmate-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importData(event) {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          if (Array.isArray(parsed)) {
            this.chats = parsed;
            this.currentChatId = parsed[0]?.id || null;
            alert("Backup erfolgreich importiert! (" + parsed.length + " Chats)");
          }
        } catch (err) {
          alert("Fehler beim Lesen der Datei: " + err.message);
        }
      };
      reader.readAsText(file);
    },
  }));
});
