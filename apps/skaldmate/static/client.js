/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

document.addEventListener("alpine:init", () => {
  Alpine.data("skaldmate", () => ({
    mobileMenuOpen: false,
    sidebarTab: "sessions", // "sessions" | "characters" | "personas" | "locations" | "gamemasters"
    viewMode: "new-session", // "new-session" | "chat" | "editor"
    editorType: "",

    textModels: [],
    imageModels: [],
    personas: [],
    characters: [],
    locations: [],
    gameMasters: [],
    scenes: [],
    sessions: [],
    activeSession: null,

    showNotesPanel: false,
    showHelpModal: false,
    showCloneModal: false,
    cloneLoading: false,
    cloneForm: { title: "", includeHistory: true },
    showWorkshop: false,
    workshopMessages: [],
    workshopInput: "",
    workshopLoading: false,
    workshopModelId: localStorage.getItem("skaldmate_workshop_model_v1") || "",
    sessionTitleDraft: "",
    sessionModelIdDraft: "",
    sessionImageModelIdDraft: "",
    sessionPromptPreview: "",
    sessionPromptLoading: false,
    editingMessageId: "",
    editingMessageContent: "",
    speakingMessageId: "",
    speechNextTimer: null,
    sceneStateDraft: "",
    gmNotesDraft: "",
    newInventoryItem: "",
    compressedSummaryDraft: "",
    creatingSession: false,
    chatInput: "",
    turnLoading: false,
    imageLoading: false,
    freshMessageDelays: {},
    freshMessageTimer: null,
    portraitLoading: false,
    personaPortraitLoading: false,
    locationImageLoading: false,
    locationMapLoading: false,
    locationElaborateLoading: false,
    showLocationMediaModal: false,
    locationMediaTab: "map",

    newSessionForm: {
      title: "",
      locationId: "",
      personaId: "",
      characterIds: [],
      gameMasterId: "chronist",
      modelId: "",
      imageModelId: "",
      openingMessage: "",
    },

    charForm: {
      id: "",
      name: "",
      role: "",
      appearance: "",
      personality: "",
      goals: "",
      speechStyle: "",
      greeting: "",
      exampleDialogue: "",
      relationships: "",
      portraitPrompt: "",
      voiceGender: "",
      modelId: "",
      portraitFile: "",
    },
    personaForm: { id: "", name: "", role: "", appearance: "", traits: "", background: "", voiceGender: "", portraitFile: "", isDefault: false },
    locationForm: {
      id: "",
      name: "",
      parentId: "",
      residentIds: [],
      description: "",
      atmosphere: "",
      details: "",
      openingMessage: "",
      defaultSceneState: "",
      imagePrompt: "",
      imageFile: "",
      mapPrompt: "",
      mapFile: "",
    },
    gmForm: { id: "", name: "", style: "neutral", narrationFrequency: "dann_und_wann", systemPrompt: "", voiceGender: "", modelId: "" },
    sceneForm: {
      id: "",
      title: "",
      locationId: "",
      personaId: "",
      characterIds: [],
      gameMasterId: "chronist",
      modelId: "",
      imageModelId: "",
      openingMessage: "",
      sceneState: "",
      gmNotes: "",
    },
    sceneStartLoading: false,

    async init() {
      this.setupSidebarTabDrag();
      await this.loadAll();
      if (this.sessions.length > 0) {
        this.activeSession = this.sessions[0];
        this.sessionTitleDraft = this.activeSession.title || "";
        this.sessionModelIdDraft = this.activeSession.modelId || "";
        this.sessionImageModelIdDraft = this.activeSession.imageModelId || "";
        this.sceneStateDraft = this.activeSession.sceneState || "";
        this.gmNotesDraft = this.activeSession.gmNotes || "";
        this.compressedSummaryDraft = this.activeSession.compressedSummary || "";
        this.viewMode = "chat";
        this.scrollToBottom();
      }
    },

    async loadAll() {
      const [cfgRes, pRes, cRes, lRes, gRes, scRes, sRes] = await Promise.all([
        fetch("./api/config"),
        fetch("./api/personas"),
        fetch("./api/characters"),
        fetch("./api/locations"),
        fetch("./api/gamemasters"),
        fetch("./api/scenes"),
        fetch("./api/sessions"),
      ]);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        const models = cfg.models || [];
        this.textModels = models.filter((m) => m.type === "text");
        this.imageModels = models.filter((m) => m.type === "image");
        if (!this.newSessionForm.modelId && this.textModels.length > 0) {
          this.newSessionForm.modelId = this.textModels[0].id;
        }
        if (!this.workshopModelId && this.textModels.length > 0) {
          this.workshopModelId = this.textModels[0].id;
        }
        if (!this.newSessionForm.imageModelId && this.imageModels.length > 0) {
          this.newSessionForm.imageModelId = this.imageModels[0].id;
        }
      }
      if (pRes.ok) {
        this.personas = (await pRes.json()).items || [];
        if (!this.newSessionForm.personaId) {
          const def = this.personas.find((p) => p.isDefault);
          if (def) this.newSessionForm.personaId = def.id;
        }
      }
      if (cRes.ok) this.characters = (await cRes.json()).items || [];
      if (lRes.ok) {
        this.locations = (await lRes.json()).items || [];
        if (!this.newSessionForm.locationId && this.locations.length > 0) {
          this.newSessionForm.locationId = this.locations[0].id;
        }
      }
      if (gRes.ok) {
        this.gameMasters = (await gRes.json()).items || [];
        if (this.gameMasters.length > 0 && !this.gameMasters.some((g) => g.id === this.newSessionForm.gameMasterId)) {
          this.newSessionForm.gameMasterId = this.gameMasters[0].id;
        }
      }
      if (scRes.ok) this.scenes = (await scRes.json()).items || [];
      if (sRes.ok) this.sessions = (await sRes.json()).items || [];
    },

    openMobileMenu() { this.mobileMenuOpen = true; },
    closeMobileMenu() { this.mobileMenuOpen = false; },
    setTabSessions() { this.sidebarTab = "sessions"; },
    setTabScenes() { this.sidebarTab = "scenes"; },
    setTabCharacters() { this.sidebarTab = "characters"; },
    setTabPersonas() { this.sidebarTab = "personas"; },
    setTabLocations() { this.sidebarTab = "locations"; },
    setTabGameMasters() { this.sidebarTab = "gamemasters"; },
    scrollSidebarTabs(direction) {
      const el = document.getElementById("skald-sidebar-tabs");
      if (el) el.scrollBy({ left: direction * 140, behavior: "smooth" });
    },
    scrollSidebarTabsWheel(event) {
      const el = document.getElementById("skald-sidebar-tabs");
      if (!el) return;
      const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      if (delta === 0) return;
      event.preventDefault();
      el.scrollLeft += delta;
    },
    setupSidebarTabDrag() {
      this.$nextTick(() => {
        const el = document.getElementById("skald-sidebar-tabs");
        if (!el || el.dataset.dragBound) return;
        el.dataset.dragBound = "1";
        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;
        let dragged = false;

        el.addEventListener("mousedown", (e) => {
          if (e.button !== 0) return;
          isDown = true;
          dragged = false;
          startX = e.pageX;
          startScrollLeft = el.scrollLeft;
        });

        globalThis.addEventListener("mousemove", (e) => {
          if (!isDown) return;
          const dx = e.pageX - startX;
          if (Math.abs(dx) > 4) dragged = true;
          if (dragged) el.scrollLeft = startScrollLeft - dx;
        });

        globalThis.addEventListener("mouseup", () => {
          isDown = false;
        });

        el.addEventListener("click", (e) => {
          if (dragged) {
            e.preventDefault();
            e.stopPropagation();
            dragged = false;
          }
        }, true);
      });
    },

    get activeLocationName() {
      if (!this.activeSession) return "";
      const loc = this.locations.find((l) => l.id === this.activeSession.locationId);
      return loc ? loc.name : this.activeSession.locationId;
    },

    get activeLocation() {
      if (!this.activeSession) return null;
      return this.locations.find((l) => l.id === this.activeSession.locationId) || null;
    },

    get activePersonaName() {
      if (!this.activeSession?.personaId) return "Keine / Du";
      const p = this.personas.find((x) => x.id === this.activeSession.personaId);
      return p ? p.name : this.activeSession.personaId;
    },

    get activeGameMasterName() {
      if (!this.activeSession?.gameMasterId) return "Standard";
      const g = this.gameMasters.find((x) => x.id === this.activeSession.gameMasterId);
      return g ? g.name : this.activeSession.gameMasterId;
    },

    openLocationMediaModal(preferredTab) {
      const loc = this.activeLocation;
      if (!loc || (!loc.mapFile && !loc.imageFile)) return;
      if (preferredTab === "map" && loc.mapFile) {
        this.locationMediaTab = "map";
      } else if (preferredTab === "image" && loc.imageFile) {
        this.locationMediaTab = "image";
      } else {
        this.locationMediaTab = loc.mapFile ? "map" : "image";
      }
      this.showLocationMediaModal = true;
    },

    closeLocationMediaModal() {
      this.showLocationMediaModal = false;
    },

    get activeCast() {
      if (!this.activeSession) return [];
      const ids = this.activeSession.characterIds || [];
      return this.characters.filter((c) => ids.includes(c.id));
    },

    get activeResidents() {
      if (!this.activeSession) return [];
      const loc = this.locations.find((l) => l.id === this.activeSession.locationId);
      if (!loc || !Array.isArray(loc.residentIds)) return [];
      const partyIds = new Set(this.activeSession.characterIds || []);
      return this.characters.filter((c) => loc.residentIds.includes(c.id) && !partyIds.has(c.id));
    },

    get locationTree() {
      const byParent = new Map();
      const ids = new Set(this.locations.map((l) => l.id));
      for (const l of this.locations) {
        const key = l.parentId && ids.has(l.parentId) ? l.parentId : "";
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key).push(l);
      }
      const result = [];
      const visited = new Set();
      const walk = (parentId, depth) => {
        for (const item of byParent.get(parentId) || []) {
          if (visited.has(item.id)) continue;
          visited.add(item.id);
          result.push({ ...item, depth });
          walk(item.id, depth + 1);
        }
      };
      walk("", 0);
      return result;
    },

    openNewSession() {
      this.viewMode = "new-session";
      this.mobileMenuOpen = false;
    },

    isCharSelectedForNew(id) {
      return this.newSessionForm.characterIds.includes(id);
    },

    toggleNewSessionChar(event) {
      const id = event?.currentTarget?.dataset?.id;
      if (!id) return;
      if (this.newSessionForm.characterIds.includes(id)) {
        this.newSessionForm.characterIds = this.newSessionForm.characterIds.filter((x) => x !== id);
      } else {
        this.newSessionForm.characterIds = [...this.newSessionForm.characterIds, id];
      }
    },

    async createSession(event) {
      event?.preventDefault?.();
      if (this.creatingSession) return;
      this.creatingSession = true;
      try {
        const res = await fetch("./api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.newSessionForm),
        });
        if (!res.ok) return;
        const data = await res.json();
        this.sessions = [data.item, ...this.sessions];
        this.activeSession = data.item;
        this.sessionTitleDraft = data.item.title || "";
        this.sessionModelIdDraft = data.item.modelId || "";
        this.sessionImageModelIdDraft = data.item.imageModelId || "";
        this.sceneStateDraft = data.item.sceneState || "";
        this.gmNotesDraft = data.item.gmNotes || "";
        this.compressedSummaryDraft = data.item.compressedSummary || "";
        this.newSessionForm.title = "";
        this.newSessionForm.openingMessage = "";
        this.viewMode = "chat";
        this.scrollToBottom();
      } finally {
        this.creatingSession = false;
      }
    },

    selectSession(event) {
      const id = event?.currentTarget?.dataset?.id;
      const found = this.sessions.find((s) => s.id === id);
      if (!found) return;
      this.activeSession = found;
      this.sessionTitleDraft = found.title || "";
      this.sessionModelIdDraft = found.modelId || "";
      this.sessionImageModelIdDraft = found.imageModelId || "";
      this.sessionPromptPreview = "";
      this.sceneStateDraft = found.sceneState || "";
      this.gmNotesDraft = found.gmNotes || "";
      this.compressedSummaryDraft = found.compressedSummary || "";
      this.viewMode = "chat";
      this.mobileMenuOpen = false;
      this.scrollToBottom();
    },

    openCloneModal() {
      if (!this.activeSession?.id) return;
      this.cloneForm = {
        title: `${this.activeSession.title} (Kopie)`,
        includeHistory: true,
      };
      this.showCloneModal = true;
    },

    closeCloneModal() {
      this.showCloneModal = false;
    },

    async submitCloneSession(event) {
      event?.preventDefault?.();
      if (!this.activeSession?.id || this.cloneLoading) return;
      this.cloneLoading = true;
      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}/clone`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: this.cloneForm.title.trim() || `${this.activeSession.title} (Kopie)`,
            includeHistory: Boolean(this.cloneForm.includeHistory),
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        this.sessions = [data.item, ...this.sessions];
        this.activeSession = data.item;
        this.sessionTitleDraft = data.item.title || "";
        this.sessionModelIdDraft = data.item.modelId || "";
        this.sessionImageModelIdDraft = data.item.imageModelId || "";
        this.sceneStateDraft = data.item.sceneState || "";
        this.gmNotesDraft = data.item.gmNotes || "";
        this.compressedSummaryDraft = data.item.compressedSummary || "";
        this.showCloneModal = false;
        this.showNotesPanel = false;
        this.notify(`Szene als "${data.item.title}" geklont.`);
        this.scrollToBottom();
      } finally {
        this.cloneLoading = false;
      }
    },

    async deleteActiveSession() {
      if (!this.activeSession?.id) return;
      const id = this.activeSession.id;
      if (!confirm(`Szene "${this.activeSession.title || id}" wirklich endgültig löschen?`)) return;
      await fetch(`./api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      this.sessions = this.sessions.filter((s) => s.id !== id);
      this.activeSession = this.sessions[0] || null;
      this.showNotesPanel = false;
      this.viewMode = this.activeSession ? "chat" : "new-session";
    },

    scrollToBottom() {
      this.$nextTick(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById("skald-thread");
          if (el) el.scrollTop = el.scrollHeight;
        });
      });
    },

    scrollToMessageStart(messageId) {
      this.$nextTick(() => {
        const container = document.getElementById("skald-thread");
        if (!container) return;
        const target = messageId
          ? container.querySelector(`[data-msg-id="${CSS.escape(messageId)}"]`)
          : null;
        if (!target) {
          container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
          return;
        }
        const containerRect = container.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const offsetTop = targetRect.top - containerRect.top + container.scrollTop - 16;
        container.scrollTo({
          top: Math.max(0, offsetTop),
          behavior: "smooth",
        });
      });
    },

    markFreshMessages(addedMessages) {
      if (this.freshMessageTimer) {
        clearTimeout(this.freshMessageTimer);
        this.freshMessageTimer = null;
      }
      const delays = {};
      let aiIndex = 0;
      for (const msg of addedMessages) {
        if (msg.kind === "user") {
          delays[msg.id] = 0;
          continue;
        }
        delays[msg.id] = Math.min(aiIndex * 160, 640);
        aiIndex += 1;
      }
      this.freshMessageDelays = delays;
      this.freshMessageTimer = setTimeout(() => {
        this.freshMessageDelays = {};
        this.freshMessageTimer = null;
      }, 1500);
    },

    isFreshMessage(messageId) {
      return Object.prototype.hasOwnProperty.call(this.freshMessageDelays, messageId);
    },

    freshMessageStyle(messageId) {
      if (!this.isFreshMessage(messageId)) return "";
      const delay = this.freshMessageDelays[messageId] || 0;
      return `animation-delay: ${delay}ms`;
    },

    autoResizeChatInput(event) {
      const el = event?.target || document.getElementById("skald-chat-input");
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    },

    handleChatKeydown(event) {
      if (event.key !== "Enter" || event.shiftKey) return;
      const isMobileTouch = typeof window !== "undefined" && (
        (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 768)
      );
      if (isMobileTouch && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      this.sendTurn();
    },

    startEditMessage(msg) {
      if (!msg?.id) return;
      this.editingMessageId = msg.id;
      this.editingMessageContent = msg.content || "";
    },

    resolveMessageVoiceGender(msg) {
      if (!msg) return "";
      if (msg.kind === "user") {
        const persona = this.personas.find((p) => p.id === this.activeSession?.personaId);
        return persona?.voiceGender || "";
      }
      if (msg.kind === "narrator") {
        const gm = this.gameMasters.find((g) => g.id === (msg.speakerId || this.activeSession?.gameMasterId));
        return gm?.voiceGender || "";
      }
      if (msg.kind === "character") {
        const char = this.characters.find((c) => c.id === msg.speakerId);
        return char?.voiceGender || "";
      }
      return "";
    },

    pickGermanVoice(voices, gender) {
      const deVoices = (voices || []).filter((v) => v.lang && v.lang.toLowerCase().startsWith("de"));
      if (deVoices.length === 0) return { voice: null, matchedGender: false };
      if (gender === "female") {
        const match = deVoices.find((v) =>
          /anna|helena|petra|katja|hedda|marlene|vicki|claire|gisela|sabine|lisa|female|frau|weiblich|deg|deb|dea/i.test(
            `${v.name} ${v.voiceURI}`,
          )
        );
        if (match) return { voice: match, matchedGender: true };
        return { voice: deVoices[0], matchedGender: false };
      }
      if (gender === "male") {
        const match = deVoices.find((v) =>
          /markus|martin|yannick|stefan|conrad|hans|daniel|frank|klaus|male|mann|männlich|ded|def/i.test(
            `${v.name} ${v.voiceURI}`,
          )
        );
        if (match) return { voice: match, matchedGender: true };
        return { voice: deVoices[1] || deVoices[0], matchedGender: deVoices.length > 1 };
      }
      return { voice: deVoices[0], matchedGender: true };
    },

    stopSpeaking() {
      if (this.speechNextTimer) {
        clearTimeout(this.speechNextTimer);
        this.speechNextTimer = null;
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      this.speakingMessageId = "";
    },

    findNextSpeakableMessage(afterMsgId) {
      const msgs = this.activeSession?.messages || [];
      const idx = msgs.findIndex((m) => m.id === afterMsgId);
      if (idx === -1) return null;
      for (let i = idx + 1; i < msgs.length; i++) {
        const candidate = msgs[i];
        if (candidate && candidate.kind !== "image" && String(candidate.content || "").trim()) {
          return candidate;
        }
      }
      return null;
    },

    toggleSpeakMessage(msg) {
      if (!msg?.id) return;
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        alert("Sprachausgabe (Web Speech API) wird von diesem Browser nicht unterstützt.");
        return;
      }
      if (this.speakingMessageId === msg.id) {
        this.stopSpeaking();
        return;
      }
      this.speakMessage(msg);
    },

    speakMessage(msg) {
      if (!msg?.id) return;
      if (this.speechNextTimer) {
        clearTimeout(this.speechNextTimer);
        this.speechNextTimer = null;
      }
      window.speechSynthesis.cancel();
      const cleanText = String(msg.content || "")
        .replace(/\*\*([^*\n]+)\*\*/g, "$1")
        .replace(/\*([^*\n]+)\*/g, "$1")
        .trim();
      if (!cleanText) return;

      const utter = new SpeechSynthesisUtterance(cleanText);
      utter.lang = "de-DE";
      const gender = this.resolveMessageVoiceGender(msg);
      const { voice, matchedGender } = this.pickGermanVoice(window.speechSynthesis.getVoices(), gender);
      if (voice) utter.voice = voice;
      if (!matchedGender && gender) {
        utter.pitch = gender === "female" ? 1.12 : 0.86;
      }
      utter.onend = () => {
        if (this.speakingMessageId !== msg.id) return;
        const nextMsg = this.findNextSpeakableMessage(msg.id);
        if (!nextMsg) {
          this.speakingMessageId = "";
          return;
        }
        this.speechNextTimer = setTimeout(() => {
          this.speechNextTimer = null;
          if (this.speakingMessageId !== msg.id) return;
          this.speakMessage(nextMsg);
        }, 450);
      };
      utter.onerror = () => {
        if (this.speakingMessageId === msg.id) {
          this.speakingMessageId = "";
        }
      };
      this.speakingMessageId = msg.id;
      window.speechSynthesis.speak(utter);
    },

    cancelEditMessage() {
      this.editingMessageId = "";
      this.editingMessageContent = "";
    },

    async saveEditedMessage() {
      if (!this.activeSession?.id || !this.editingMessageId) return;
      const content = this.editingMessageContent.trim();
      if (!content) return;
      const res = await fetch(
        `./api/sessions/${encodeURIComponent(this.activeSession.id)}/messages/${encodeURIComponent(this.editingMessageId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Nachricht konnte nicht gespeichert werden");
        return;
      }
      this.activeSession = data.item;
      this.sessions = this.sessions.map((s) => (s.id === data.item.id ? data.item : s));
      this.cancelEditMessage();
    },

    async deleteChatMessage(messageId, fromHere = false) {
      if (!this.activeSession?.id || !messageId) return;
      const question = fromHere
        ? "Diese Nachricht und alle nachfolgenden Antworten entfernen?"
        : "Diese Nachricht wirklich löschen?";
      if (!confirm(question)) return;
      const suffix = fromHere ? "?fromHere=1" : "";
      const res = await fetch(
        `./api/sessions/${encodeURIComponent(this.activeSession.id)}/messages/${encodeURIComponent(messageId)}${suffix}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Nachricht konnte nicht gelöscht werden");
        return;
      }
      if (this.editingMessageId === messageId) {
        this.cancelEditMessage();
      }
      this.activeSession = data.item;
      this.sessions = this.sessions.map((s) => (s.id === data.item.id ? data.item : s));
    },

    async sendTurn(event) {
      event?.preventDefault?.();
      const msg = this.chatInput.trim();
      if (!msg || !this.activeSession || this.turnLoading) return;
      this.chatInput = "";
      const inputEl = document.getElementById("skald-chat-input");
      if (inputEl) inputEl.style.height = "";
      await this.executeTurn({ message: msg });
    },

    async continueScene() {
      if (!this.activeSession || this.turnLoading) return;
      await this.executeTurn({});
    },

    async nudgeCharacter(event) {
      const id = event?.currentTarget?.dataset?.id;
      if (!id || !this.activeSession || this.turnLoading) return;
      await this.executeTurn({ forceCharacterId: id });
    },

    async addCharacterToActiveSession(event) {
      event?.stopPropagation?.();
      const id = event?.currentTarget?.dataset?.id;
      if (!id || !this.activeSession) return;
      const currentIds = Array.isArray(this.activeSession.characterIds) ? this.activeSession.characterIds : [];
      if (currentIds.includes(id)) return;
      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterIds: [...currentIds, id],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Charakter konnte nicht hinzugefügt werden");
        return;
      }
      this.activeSession = data.item;
      this.sessions = this.sessions.map((s) => s.id === data.item.id ? data.item : s);
      const char = this.characters.find((c) => c.id === id);
      this.notify(`${char?.name || id} zur Szene "${data.item.title}" hinzugefügt.`);
    },

    async executeTurn(payload) {
      const prevIds = new Set((this.activeSession?.messages || []).map((m) => m.id));
      this.turnLoading = true;
      this.scrollToBottom();
      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Fehler beim Turn");
          return;
        }
        const added = (data.session?.messages || []).filter((m) => !prevIds.has(m.id));
        this.markFreshMessages(added);
        this.activeSession = data.session;
        this.sceneStateDraft = data.session.sceneState || "";
        this.gmNotesDraft = data.session.gmNotes || "";
        this.compressedSummaryDraft = data.session.compressedSummary || "";
        this.sessions = this.sessions.map((s) => s.id === data.session.id ? data.session : s);
        const firstReadTarget = added.find((m) => m.kind !== "user") || added[0];
        this.scrollToMessageStart(firstReadTarget?.id);
      } finally {
        this.turnLoading = false;
      }
    },

    async generateSceneImage() {
      if (!this.activeSession || this.imageLoading) return;
      const prevIds = new Set((this.activeSession?.messages || []).map((m) => m.id));
      this.imageLoading = true;
      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}/scene-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Bildgenerierung fehlgeschlagen");
          return;
        }
        const added = (data.session?.messages || []).filter((m) => !prevIds.has(m.id));
        this.markFreshMessages(added);
        this.activeSession = data.session;
        this.sessions = this.sessions.map((s) => s.id === data.session.id ? data.session : s);
        const firstReadTarget = added[0];
        this.scrollToMessageStart(firstReadTarget?.id);
      } finally {
        this.imageLoading = false;
      }
    },

    notify(message, level = "success", timeout = 3000) {
      globalThis.dispatchEvent(
        new CustomEvent("showSystemAlert", {
          detail: { message, level, timeout },
        }),
      );
    },

    toggleNotesPanel() {
      this.showNotesPanel = !this.showNotesPanel;
      if (this.showNotesPanel) {
        this.loadSessionPromptPreview();
      }
    },

    async loadSessionPromptPreview() {
      if (!this.activeSession?.id) return;
      this.sessionPromptLoading = true;
      try {
        const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}/prompt-preview`);
        if (res.ok) {
          const data = await res.json();
          this.sessionPromptPreview = data.preview || "";
        }
      } finally {
        this.sessionPromptLoading = false;
      }
    },

    formatChatText(raw) {
      const text = String(raw || "");
      const escaped = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
      return escaped
        .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*\n]+)\*/g, '<em class="opacity-85">$1</em>')
        .replace(/\n/g, "<br>");
    },

    openHelpModal() {
      this.showHelpModal = true;
    },

    closeHelpModal() {
      this.showHelpModal = false;
    },

    toggleWorkshop() {
      this.showWorkshop = !this.showWorkshop;
    },

    clearWorkshop() {
      this.workshopMessages = [];
    },

    async sendWorkshop(event) {
      event?.preventDefault?.();
      const text = this.workshopInput.trim();
      if (!text || this.workshopLoading) return;
      if (this.workshopModelId) {
        localStorage.setItem("skaldmate_workshop_model_v1", this.workshopModelId);
      }
      this.workshopMessages = [...this.workshopMessages, { role: "user", content: text }];
      this.workshopInput = "";
      this.workshopLoading = true;
      try {
        const payloadMessages = this.workshopMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await fetch("./api/workshop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: this.workshopModelId || this.activeSession?.modelId || this.newSessionForm.modelId || undefined,
            context: {
              activeSessionId: this.activeSession?.id || undefined,
              activeSessionTitle: this.activeSession?.title || undefined,
              activeLocationId: this.activeSession?.locationId || undefined,
              sidebarTab: this.sidebarTab || undefined,
              viewMode: this.viewMode || undefined,
            },
            messages: payloadMessages,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.workshopMessages = [...this.workshopMessages, { role: "assistant", content: "Fehler: " + (data.error || "Unbekannt") }];
          return;
        }
        this.workshopMessages = [...this.workshopMessages, {
          role: "assistant",
          content: data.reply,
          toolsUsed: data.toolsUsed || [],
        }];
        if (data.mutated) {
          await this.loadBootstrap();
        }
        this.$nextTick(() => {
          const el = document.getElementById("skald-workshop-thread");
          if (el) el.scrollTop = el.scrollHeight;
        });
      } finally {
        this.workshopLoading = false;
      }
    },

    async saveSceneState() {
      if (!this.activeSession) return;
      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: this.sessionTitleDraft,
          modelId: this.sessionModelIdDraft || "",
          imageModelId: this.sessionImageModelIdDraft || "",
          sceneState: this.sceneStateDraft,
          gmNotes: this.gmNotesDraft,
          compressedSummary: this.compressedSummaryDraft,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.activeSession = data.item;
        this.sessionTitleDraft = data.item.title || "";
        this.sessionModelIdDraft = data.item.modelId || "";
        this.sessionImageModelIdDraft = data.item.imageModelId || "";
        this.sessions = this.sessions.map((s) => s.id === data.item.id ? data.item : s);
        this.loadSessionPromptPreview();
        this.notify("Szenenzustand & Notizen gespeichert.");
      }
    },

    async addInventoryItem(event) {
      event?.preventDefault?.();
      const item = this.newInventoryItem.trim();
      if (!item || !this.activeSession) return;
      const current = Array.isArray(this.activeSession.inventory) ? this.activeSession.inventory : [];
      if (current.some((x) => x.toLowerCase() === item.toLowerCase())) {
        this.newInventoryItem = "";
        return;
      }
      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory: [...current, item] }),
      });
      if (res.ok) {
        const data = await res.json();
        this.activeSession = data.item;
        this.sessions = this.sessions.map((s) => s.id === data.item.id ? data.item : s);
        this.newInventoryItem = "";
      }
    },

    async removeInventoryItem(event) {
      const target = event?.currentTarget?.dataset?.item;
      if (!target || !this.activeSession) return;
      const current = Array.isArray(this.activeSession.inventory) ? this.activeSession.inventory : [];
      const next = current.filter((x) => x !== target);
      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventory: next }),
      });
      if (res.ok) {
        const data = await res.json();
        this.activeSession = data.item;
        this.sessions = this.sessions.map((s) => s.id === data.item.id ? data.item : s);
      }
    },

    async changeSessionLocation(event) {
      const nextLocId = event?.target?.value;
      if (!this.activeSession || !nextLocId) return;
      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: nextLocId }),
      });
      if (res.ok) {
        const data = await res.json();
        this.activeSession = data.item;
        this.sessions = this.sessions.map((s) => s.id === data.item.id ? data.item : s);
        this.notify("Ort der Szene gewechselt.", "info");
      }
    },

    closeEditor() {
      this.viewMode = this.activeSession ? "chat" : "new-session";
    },

    // Character CRUD
    newCharacterForm() {
      this.charForm = {
        id: "",
        name: "",
        role: "",
        appearance: "",
        personality: "",
        goals: "",
        speechStyle: "",
        greeting: "",
        exampleDialogue: "",
        relationships: "",
        portraitPrompt: "",
        voiceGender: "",
        modelId: "",
        portraitFile: "",
      };
      this.editorType = "character";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editCharacterItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const c = this.characters.find((x) => x.id === id);
      if (!c) return;
      this.charForm = {
        ...c,
        exampleDialogue: c.exampleDialogue || "",
        relationships: c.relationships || "",
        portraitPrompt: c.portraitPrompt || "",
        voiceGender: c.voiceGender || "",
        modelId: c.modelId || "",
        portraitFile: c.portraitFile || "",
      };
      this.editorType = "character";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    async saveCharacterForm(event) {
      event?.preventDefault?.();
      const res = await fetch("./api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...this.charForm,
          modelId: this.charForm.modelId || undefined,
          portraitFile: this.charForm.portraitFile || undefined,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      this.charForm = {
        ...data.item,
        exampleDialogue: data.item.exampleDialogue || "",
        relationships: data.item.relationships || "",
        portraitPrompt: data.item.portraitPrompt || "",
        modelId: data.item.modelId || "",
        portraitFile: data.item.portraitFile || "",
      };
      await this.loadAll();
      this.notify(`Charakter "${data.item.name}" gespeichert.`);
    },
    async deleteEntityWithGuard(url, confirmMessage) {
      if (!confirm(confirmMessage)) return;
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Löschen fehlgeschlagen.");
        return;
      }
      await this.loadAll();
      this.closeEditor();
    },
    async deleteCharacterForm() {
      if (!this.charForm.id) return;
      await this.deleteEntityWithGuard(
        `./api/characters/${encodeURIComponent(this.charForm.id)}`,
        `Charakter "${this.charForm.name || this.charForm.id}" wirklich löschen?`,
      );
    },
    async generatePortrait() {
      if (!this.charForm.id || this.portraitLoading) return;
      this.portraitLoading = true;
      try {
        const res = await fetch(`./api/characters/${encodeURIComponent(this.charForm.id)}/portrait`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: this.charForm.portraitPrompt || undefined,
            imageModelId: this.newSessionForm.imageModelId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Porträt-Fehler");
          return;
        }
        this.charForm.portraitFile = data.fileName;
        if (data.item?.portraitPrompt) {
          this.charForm.portraitPrompt = data.item.portraitPrompt;
        }
        await this.loadAll();
      } finally {
        this.portraitLoading = false;
      }
    },
    async deletePortrait() {
      if (!this.charForm.id || !this.charForm.portraitFile) return;
      if (!confirm(`Porträt von "${this.charForm.name || this.charForm.id}" wirklich löschen?`)) return;
      const res = await fetch(`./api/characters/${encodeURIComponent(this.charForm.id)}/portrait`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Porträt konnte nicht gelöscht werden.");
        return;
      }
      this.charForm.portraitFile = "";
      await this.loadAll();
      this.notify("Porträt entfernt.");
    },

    // Persona CRUD
    newPersonaForm() {
      this.personaForm = { id: "", name: "", role: "", appearance: "", traits: "", background: "", voiceGender: "", portraitFile: "", isDefault: false };
      this.editorType = "persona";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editPersonaItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const p = this.personas.find((x) => x.id === id);
      if (!p) return;
      this.personaForm = { ...p, voiceGender: p.voiceGender || "", portraitFile: p.portraitFile || "", isDefault: Boolean(p.isDefault) };
      this.editorType = "persona";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    async savePersonaForm(event) {
      event?.preventDefault?.();
      const res = await fetch("./api/personas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...this.personaForm,
          portraitFile: this.personaForm.portraitFile || undefined,
          isDefault: Boolean(this.personaForm.isDefault),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.personaForm = { ...data.item, portraitFile: data.item.portraitFile || "", isDefault: Boolean(data.item.isDefault) };
        await this.loadAll();
        this.notify(`Persona "${data.item.name}" gespeichert.`);
      }
    },
    async generatePersonaPortrait() {
      if (!this.personaForm.id || this.personaPortraitLoading) return;
      this.personaPortraitLoading = true;
      try {
        const res = await fetch(`./api/personas/${encodeURIComponent(this.personaForm.id)}/portrait`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageModelId: this.newSessionForm.imageModelId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Porträt-Fehler");
          return;
        }
        this.personaForm.portraitFile = data.fileName;
        await this.loadAll();
      } finally {
        this.personaPortraitLoading = false;
      }
    },
    async deletePersonaPortrait() {
      if (!this.personaForm.id || !this.personaForm.portraitFile) return;
      if (!confirm(`Porträt von "${this.personaForm.name || this.personaForm.id}" wirklich löschen?`)) return;
      const res = await fetch(`./api/personas/${encodeURIComponent(this.personaForm.id)}/portrait`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Porträt konnte nicht gelöscht werden.");
        return;
      }
      this.personaForm.portraitFile = "";
      await this.loadAll();
      this.notify("Porträt entfernt.");
    },
    async deletePersonaForm() {
      if (!this.personaForm.id) return;
      await this.deleteEntityWithGuard(
        `./api/personas/${encodeURIComponent(this.personaForm.id)}`,
        `Persona "${this.personaForm.name || this.personaForm.id}" wirklich löschen?`,
      );
    },

    // Location CRUD
    newLocationForm() {
      this.locationForm = {
        id: "",
        name: "",
        parentId: "",
        residentIds: [],
        description: "",
        atmosphere: "",
        details: "",
        openingMessage: "",
        defaultSceneState: "",
        imagePrompt: "",
        imageFile: "",
        mapPrompt: "",
        mapFile: "",
      };
      this.editorType = "location";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editLocationItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const l = this.locations.find((x) => x.id === id);
      if (!l) return;
      this.locationForm = {
        ...l,
        parentId: l.parentId || "",
        residentIds: Array.isArray(l.residentIds) ? [...l.residentIds] : [],
        openingMessage: l.openingMessage || "",
        defaultSceneState: l.defaultSceneState || "",
        imagePrompt: l.imagePrompt || "",
        imageFile: l.imageFile || "",
        mapPrompt: l.mapPrompt || "",
        mapFile: l.mapFile || "",
      };
      this.editorType = "location";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    isResidentSelected(charId) {
      return Array.isArray(this.locationForm.residentIds) && this.locationForm.residentIds.includes(charId);
    },
    toggleLocationResident(event) {
      const id = event?.currentTarget?.dataset?.id;
      if (!id) return;
      const current = Array.isArray(this.locationForm.residentIds) ? this.locationForm.residentIds : [];
      if (current.includes(id)) {
        this.locationForm.residentIds = current.filter((x) => x !== id);
      } else {
        this.locationForm.residentIds = [...current, id];
      }
    },
    async saveLocationForm(event) {
      event?.preventDefault?.();
      const res = await fetch("./api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...this.locationForm,
          parentId: this.locationForm.parentId || undefined,
          residentIds: this.locationForm.residentIds || [],
          imageFile: this.locationForm.imageFile || undefined,
          mapFile: this.locationForm.mapFile || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.locationForm = {
          ...data.item,
          parentId: data.item.parentId || "",
          residentIds: Array.isArray(data.item.residentIds) ? [...data.item.residentIds] : [],
          openingMessage: data.item.openingMessage || "",
          defaultSceneState: data.item.defaultSceneState || "",
          imagePrompt: data.item.imagePrompt || "",
          imageFile: data.item.imageFile || "",
          mapPrompt: data.item.mapPrompt || "",
          mapFile: data.item.mapFile || "",
        };
        await this.loadAll();
        this.notify(`Ort "${data.item.name}" gespeichert.`);
      }
    },
    async generateLocationImage() {
      if (!this.locationForm.id || this.locationImageLoading) return;
      this.locationImageLoading = true;
      try {
        const res = await fetch(`./api/locations/${encodeURIComponent(this.locationForm.id)}/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: this.locationForm.imagePrompt || undefined,
            imageModelId: this.newSessionForm.imageModelId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Ortsbild-Fehler");
          return;
        }
        this.locationForm.imageFile = data.fileName;
        if (data.item?.imagePrompt) {
          this.locationForm.imagePrompt = data.item.imagePrompt;
        }
        await this.loadAll();
      } finally {
        this.locationImageLoading = false;
      }
    },
    async generateLocationMap() {
      if (!this.locationForm.id || this.locationMapLoading) return;
      this.locationMapLoading = true;
      try {
        const res = await fetch(`./api/locations/${encodeURIComponent(this.locationForm.id)}/map`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: this.locationForm.mapPrompt || undefined,
            imageModelId: this.newSessionForm.imageModelId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "Karten-Fehler");
          return;
        }
        this.locationForm.mapFile = data.fileName;
        if (data.item?.mapPrompt) {
          this.locationForm.mapPrompt = data.item.mapPrompt;
        }
        await this.loadAll();
        this.notify("Ortskarte generiert.");
      } finally {
        this.locationMapLoading = false;
      }
    },
    async elaborateLocationMap() {
      if (!this.locationForm.name?.trim() || this.locationElaborateLoading) return;
      this.locationElaborateLoading = true;
      try {
        const res = await fetch("./api/locations/elaborate-map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: this.locationForm.id || undefined,
            name: this.locationForm.name.trim(),
            description: this.locationForm.description || "",
            atmosphere: this.locationForm.atmosphere || "",
            details: this.locationForm.details || "",
            mapPrompt: this.locationForm.mapPrompt || "",
            modelId: this.newSessionForm.modelId || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(data.error || "KI-Ausarbeitung fehlgeschlagen");
          return;
        }
        if (data.description) this.locationForm.description = data.description;
        if (data.mapPrompt) this.locationForm.mapPrompt = data.mapPrompt;
        this.notify("Beschreibung & Karten-Prompt ausgearbeitet (noch speichern!).");
      } finally {
        this.locationElaborateLoading = false;
      }
    },
    async deleteLocationForm() {
      if (!this.locationForm.id) return;
      await this.deleteEntityWithGuard(
        `./api/locations/${encodeURIComponent(this.locationForm.id)}`,
        `Ort "${this.locationForm.name || this.locationForm.id}" wirklich löschen?`,
      );
    },

    // GameMaster CRUD
    newGmForm() {
      this.gmForm = { id: "", name: "", style: "neutral", narrationFrequency: "dann_und_wann", systemPrompt: "", voiceGender: "", modelId: "" };
      this.editorType = "gamemaster";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editGmItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const g = this.gameMasters.find((x) => x.id === id);
      if (!g) return;
      this.gmForm = { ...g, narrationFrequency: g.narrationFrequency || "dann_und_wann", voiceGender: g.voiceGender || "", modelId: g.modelId || "" };
      this.editorType = "gamemaster";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    async saveGmForm(event) {
      event?.preventDefault?.();
      const res = await fetch("./api/gamemasters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...this.gmForm, modelId: this.gmForm.modelId || undefined }),
      });
      if (res.ok) {
        const data = await res.json();
        await this.loadAll();
        this.notify(`Spielleiter "${data.item?.name || this.gmForm.name}" gespeichert.`);
        this.closeEditor();
      }
    },
    async deleteGmForm() {
      if (!this.gmForm.id) return;
      await this.deleteEntityWithGuard(
        `./api/gamemasters/${encodeURIComponent(this.gmForm.id)}`,
        `Spielleiter "${this.gmForm.name || this.gmForm.id}" wirklich löschen?`,
      );
    },

    // Scene Template CRUD & Quick Start
    newSceneForm() {
      const defPersona = this.personas.find((p) => p.isDefault);
      this.sceneForm = {
        id: "",
        title: "",
        locationId: this.locations[0]?.id || "",
        personaId: defPersona?.id || "",
        characterIds: [],
        gameMasterId: this.gameMasters[0]?.id || "chronist",
        modelId: this.textModels[0]?.id || "",
        imageModelId: this.imageModels[0]?.id || "",
        openingMessage: "",
        sceneState: "",
        gmNotes: "",
      };
      this.editorType = "scene";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editSceneItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const sc = this.scenes.find((x) => x.id === id);
      if (!sc) return;
      this.sceneForm = {
        ...sc,
        personaId: sc.personaId || "",
        characterIds: Array.isArray(sc.characterIds) ? [...sc.characterIds] : [],
        modelId: sc.modelId || "",
        imageModelId: sc.imageModelId || "",
        openingMessage: sc.openingMessage || "",
        sceneState: sc.sceneState || "",
        gmNotes: sc.gmNotes || "",
      };
      this.editorType = "scene";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    isSceneCharSelected(charId) {
      return Array.isArray(this.sceneForm.characterIds) && this.sceneForm.characterIds.includes(charId);
    },
    toggleSceneChar(event) {
      const id = event?.currentTarget?.dataset?.id;
      if (!id) return;
      const current = Array.isArray(this.sceneForm.characterIds) ? this.sceneForm.characterIds : [];
      if (current.includes(id)) {
        this.sceneForm.characterIds = current.filter((x) => x !== id);
      } else {
        this.sceneForm.characterIds = [...current, id];
      }
    },
    async saveSceneForm(event) {
      event?.preventDefault?.();
      const res = await fetch("./api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...this.sceneForm,
          personaId: this.sceneForm.personaId || undefined,
          modelId: this.sceneForm.modelId || undefined,
          imageModelId: this.sceneForm.imageModelId || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.sceneForm = {
          ...data.item,
          personaId: data.item.personaId || "",
          characterIds: Array.isArray(data.item.characterIds) ? [...data.item.characterIds] : [],
          modelId: data.item.modelId || "",
          imageModelId: data.item.imageModelId || "",
          openingMessage: data.item.openingMessage || "",
          sceneState: data.item.sceneState || "",
          gmNotes: data.item.gmNotes || "",
        };
        await this.loadAll();
        this.notify(`Szene "${data.item.title}" gespeichert.`);
      }
    },
    async deleteSceneForm() {
      if (!this.sceneForm.id) return;
      if (!confirm(`Szene "${this.sceneForm.title || this.sceneForm.id}" wirklich löschen?`)) return;
      const res = await fetch(`./api/scenes/${encodeURIComponent(this.sceneForm.id)}`, { method: "DELETE" });
      if (res.ok) {
        await this.loadAll();
        this.notify("Szene gelöscht.");
        this.closeEditor();
      }
    },
    async startChatFromScene(event) {
      event?.stopPropagation?.();
      const id = event?.currentTarget?.dataset?.id;
      if (!id || this.sceneStartLoading) return;
      this.sceneStartLoading = true;
      try {
        const res = await fetch(`./api/scenes/${encodeURIComponent(id)}/start`, {
          method: "POST",
        });
        if (!res.ok) return;
        const data = await res.json();
        this.sessions = [data.item, ...this.sessions];
        this.activeSession = data.item;
        this.sessionTitleDraft = data.item.title || "";
        this.sessionModelIdDraft = data.item.modelId || "";
        this.sessionImageModelIdDraft = data.item.imageModelId || "";
        this.sceneStateDraft = data.item.sceneState || "";
        this.gmNotesDraft = data.item.gmNotes || "";
        this.compressedSummaryDraft = data.item.compressedSummary || "";
        this.sidebarTab = "sessions";
        this.viewMode = "chat";
        this.mobileMenuOpen = false;
        this.scrollToBottom();
      } finally {
        this.sceneStartLoading = false;
      }
    },
    async startChatFromSceneForm() {
      if (!this.sceneForm.title?.trim() || !this.sceneForm.locationId || this.creatingSession) return;
      this.creatingSession = true;
      try {
        const res = await fetch("./api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: this.sceneForm.title.trim(),
            locationId: this.sceneForm.locationId,
            personaId: this.sceneForm.personaId || undefined,
            characterIds: this.sceneForm.characterIds || [],
            gameMasterId: this.sceneForm.gameMasterId || "chronist",
            modelId: this.sceneForm.modelId || undefined,
            imageModelId: this.sceneForm.imageModelId || undefined,
            sceneState: this.sceneForm.sceneState || "",
            gmNotes: this.sceneForm.gmNotes || "",
            openingMessage: this.sceneForm.openingMessage || undefined,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        this.sessions = [data.item, ...this.sessions];
        this.activeSession = data.item;
        this.sessionTitleDraft = data.item.title || "";
        this.sessionModelIdDraft = data.item.modelId || "";
        this.sessionImageModelIdDraft = data.item.imageModelId || "";
        this.sceneStateDraft = data.item.sceneState || "";
        this.gmNotesDraft = data.item.gmNotes || "";
        this.compressedSummaryDraft = data.item.compressedSummary || "";
        this.sidebarTab = "sessions";
        this.viewMode = "chat";
        this.scrollToBottom();
      } finally {
        this.creatingSession = false;
      }
    },
    async saveNewSessionAsScene() {
      if (!this.newSessionForm.title?.trim() || !this.newSessionForm.locationId) {
        alert("Bitte Titel und Ort angeben.");
        return;
      }
      const res = await fetch("./api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: this.newSessionForm.title.trim(),
          locationId: this.newSessionForm.locationId,
          personaId: this.newSessionForm.personaId || undefined,
          characterIds: this.newSessionForm.characterIds || [],
          gameMasterId: this.newSessionForm.gameMasterId || "chronist",
          modelId: this.newSessionForm.modelId || undefined,
          imageModelId: this.newSessionForm.imageModelId || undefined,
          openingMessage: this.newSessionForm.openingMessage || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await this.loadAll();
        this.notify(`Szene "${data.item.title}" gespeichert.`);
      }
    },
    async exportSessionToNotemate() {
      if (!this.activeSession?.id) return;
      const slug = String(this.activeSession.title || "geschichte")
        .toLowerCase()
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/ß/g, "ss")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "geschichte";
      const suggested = `Geschichten/${slug}.md`;
      const path = prompt("Zielpfad in NoteMate (z. B. Geschichten/... oder NSFW/Geschichten/...):", suggested);
      if (!path || !path.trim()) return;

      const res = await fetch(`./api/sessions/${encodeURIComponent(this.activeSession.id)}/export-notemate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Export nach NoteMate fehlgeschlagen");
        return;
      }
      this.notify(`Geschichte in NoteMate gespeichert: ${data.path}`);
    },

    async saveActiveSessionAsScene() {
      if (!this.activeSession) return;
      const res = await fetch("./api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: this.activeSession.title,
          locationId: this.activeSession.locationId,
          personaId: this.activeSession.personaId || undefined,
          characterIds: this.activeSession.characterIds || [],
          gameMasterId: this.activeSession.gameMasterId || "chronist",
          modelId: this.activeSession.modelId || undefined,
          imageModelId: this.activeSession.imageModelId || undefined,
          sceneState: this.sceneStateDraft || this.activeSession.sceneState || "",
          gmNotes: this.gmNotesDraft || this.activeSession.gmNotes || "",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        await this.loadAll();
        this.notify(`Setup als Szene "${data.item.title}" gespeichert.`);
      }
    },
  }));
});
