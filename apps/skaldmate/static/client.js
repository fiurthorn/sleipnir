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
    sessions: [],
    activeSession: null,

    showNotesPanel: false,
    showHelpModal: false,
    showWorkshop: false,
    workshopMessages: [],
    workshopInput: "",
    workshopLoading: false,
    sceneStateDraft: "",
    compressedSummaryDraft: "",
    creatingSession: false,
    chatInput: "",
    turnLoading: false,
    imageLoading: false,
    portraitLoading: false,
    personaPortraitLoading: false,
    locationImageLoading: false,

    newSessionForm: {
      title: "",
      locationId: "",
      personaId: "",
      characterIds: [],
      gameMasterId: "chronist",
      modelId: "",
      imageModelId: "",
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
      modelId: "",
      portraitFile: "",
    },
    personaForm: { id: "", name: "", role: "", appearance: "", traits: "", background: "", portraitFile: "", isDefault: false },
    locationForm: {
      id: "",
      name: "",
      parentId: "",
      residentIds: [],
      description: "",
      atmosphere: "",
      details: "",
      defaultSceneState: "",
      imagePrompt: "",
      imageFile: "",
    },
    gmForm: { id: "", name: "", style: "neutral", systemPrompt: "", modelId: "" },

    async init() {
      await this.loadAll();
      if (this.sessions.length > 0) {
        this.activeSession = this.sessions[0];
        this.sceneStateDraft = this.activeSession.sceneState || "";
        this.viewMode = "chat";
      }
    },

    async loadAll() {
      const [cfgRes, pRes, cRes, lRes, gRes, sRes] = await Promise.all([
        fetch("./api/config"),
        fetch("./api/personas"),
        fetch("./api/characters"),
        fetch("./api/locations"),
        fetch("./api/gamemasters"),
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
      if (sRes.ok) this.sessions = (await sRes.json()).items || [];
    },

    openMobileMenu() { this.mobileMenuOpen = true; },
    closeMobileMenu() { this.mobileMenuOpen = false; },
    setTabSessions() { this.sidebarTab = "sessions"; },
    setTabCharacters() { this.sidebarTab = "characters"; },
    setTabPersonas() { this.sidebarTab = "personas"; },
    setTabLocations() { this.sidebarTab = "locations"; },
    setTabGameMasters() { this.sidebarTab = "gamemasters"; },

    get activeLocationName() {
      if (!this.activeSession) return "";
      const loc = this.locations.find((l) => l.id === this.activeSession.locationId);
      return loc ? loc.name : this.activeSession.locationId;
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
        this.sceneStateDraft = data.item.sceneState || "";
        this.compressedSummaryDraft = data.item.compressedSummary || "";
        this.newSessionForm.title = "";
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
      this.sceneStateDraft = found.sceneState || "";
      this.compressedSummaryDraft = found.compressedSummary || "";
      this.viewMode = "chat";
      this.mobileMenuOpen = false;
      this.scrollToBottom();
    },

    async deleteSessionItem(event) {
      event?.stopPropagation?.();
      const id = event?.currentTarget?.dataset?.id;
      if (!id) return;
      await fetch(`./api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
      this.sessions = this.sessions.filter((s) => s.id !== id);
      if (this.activeSession?.id === id) {
        this.activeSession = this.sessions[0] || null;
        this.viewMode = this.activeSession ? "chat" : "new-session";
      }
    },

    scrollToBottom() {
      this.$nextTick(() => {
        const el = document.getElementById("skald-thread");
        if (el) el.scrollTop = el.scrollHeight;
      });
    },

    async sendTurn(event) {
      event?.preventDefault?.();
      const msg = this.chatInput.trim();
      if (!msg || !this.activeSession || this.turnLoading) return;
      this.chatInput = "";
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

    async executeTurn(payload) {
      this.turnLoading = true;
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
        this.activeSession = data.session;
        this.sceneStateDraft = data.session.sceneState || "";
        this.compressedSummaryDraft = data.session.compressedSummary || "";
        this.sessions = this.sessions.map((s) => s.id === data.session.id ? data.session : s);
        this.scrollToBottom();
      } finally {
        this.turnLoading = false;
      }
    },

    async generateSceneImage() {
      if (!this.activeSession || this.imageLoading) return;
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
        this.activeSession = data.session;
        this.sessions = this.sessions.map((s) => s.id === data.session.id ? data.session : s);
        this.scrollToBottom();
      } finally {
        this.imageLoading = false;
      }
    },

    toggleNotesPanel() {
      this.showNotesPanel = !this.showNotesPanel;
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
      this.workshopMessages = [...this.workshopMessages, { role: "user", content: text }];
      this.workshopInput = "";
      this.workshopLoading = true;
      try {
        const res = await fetch("./api/workshop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: this.activeSession?.modelId || this.newSessionForm.modelId || undefined,
            messages: this.workshopMessages,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          this.workshopMessages = [...this.workshopMessages, { role: "assistant", content: "Fehler: " + (data.error || "Unbekannt") }];
          return;
        }
        this.workshopMessages = [...this.workshopMessages, { role: "assistant", content: data.reply }];
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
          sceneState: this.sceneStateDraft,
          compressedSummary: this.compressedSummaryDraft,
        }),
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
    },
    async deleteCharacterForm() {
      if (!this.charForm.id) return;
      await fetch(`./api/characters/${encodeURIComponent(this.charForm.id)}`, { method: "DELETE" });
      await this.loadAll();
      this.closeEditor();
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

    // Persona CRUD
    newPersonaForm() {
      this.personaForm = { id: "", name: "", role: "", appearance: "", traits: "", background: "", portraitFile: "", isDefault: false };
      this.editorType = "persona";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editPersonaItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const p = this.personas.find((x) => x.id === id);
      if (!p) return;
      this.personaForm = { ...p, portraitFile: p.portraitFile || "", isDefault: Boolean(p.isDefault) };
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
    async deletePersonaForm() {
      if (!this.personaForm.id) return;
      await fetch(`./api/personas/${encodeURIComponent(this.personaForm.id)}`, { method: "DELETE" });
      await this.loadAll();
      this.closeEditor();
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
        defaultSceneState: "",
        imagePrompt: "",
        imageFile: "",
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
        defaultSceneState: l.defaultSceneState || "",
        imagePrompt: l.imagePrompt || "",
        imageFile: l.imageFile || "",
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
        }),
      });
      if (res.ok) {
        const data = await res.json();
        this.locationForm = {
          ...data.item,
          parentId: data.item.parentId || "",
          residentIds: Array.isArray(data.item.residentIds) ? [...data.item.residentIds] : [],
          defaultSceneState: data.item.defaultSceneState || "",
          imagePrompt: data.item.imagePrompt || "",
          imageFile: data.item.imageFile || "",
        };
        await this.loadAll();
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
    async deleteLocationForm() {
      if (!this.locationForm.id) return;
      await fetch(`./api/locations/${encodeURIComponent(this.locationForm.id)}`, { method: "DELETE" });
      await this.loadAll();
      this.closeEditor();
    },

    // GameMaster CRUD
    newGmForm() {
      this.gmForm = { id: "", name: "", style: "neutral", systemPrompt: "", modelId: "" };
      this.editorType = "gamemaster";
      this.viewMode = "editor";
      this.mobileMenuOpen = false;
    },
    editGmItem(event) {
      const id = event?.currentTarget?.dataset?.id;
      const g = this.gameMasters.find((x) => x.id === id);
      if (!g) return;
      this.gmForm = { ...g, modelId: g.modelId || "" };
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
        await this.loadAll();
        this.closeEditor();
      }
    },
    async deleteGmForm() {
      if (!this.gmForm.id) return;
      await fetch(`./api/gamemasters/${encodeURIComponent(this.gmForm.id)}`, { method: "DELETE" });
      await this.loadAll();
      this.closeEditor();
    },
  }));
});
