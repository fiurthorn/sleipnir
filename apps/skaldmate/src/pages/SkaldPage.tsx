/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { LOGO_WORDMARK, LOGO_WORDMARK_LIGHT, MateSwitcher, ThemeToggle } from "@sleipnir/core";

export const SkaldPage = () => {
  return (
    <div x-data="skaldmate" class="flex flex-col h-dvh overflow-hidden bg-base-100">
      <MateSwitcher current="skald" />
      <div class="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile Backdrop */}
        <div
          x-show="mobileMenuOpen"
          x-on:click="closeMobileMenu"
          class="fixed inset-0 bg-black/50 z-40 md:hidden"
          style="display: none;"
        />

        {/* SIDEBAR */}
        <aside
          class="w-full md:w-80 bg-base-200 border-r border-base-content/10 flex flex-col z-50 md:z-10 md:relative"
          x-bind:class="mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl flex' : 'hidden md:flex'"
        >
          <div class="p-4 border-b border-base-content/10 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <img
                src={LOGO_WORDMARK}
                alt="fiurthorn"
                class="h-6 w-auto"
                x-show="$store.theme.mode === 'dark'"
                style="display: none;"
              />
              <img
                src={LOGO_WORDMARK_LIGHT}
                alt="fiurthorn"
                class="h-6 w-auto"
                x-show="$store.theme.mode !== 'dark'"
              />
              <span class="badge badge-primary badge-outline font-mono text-[10px]">Skaldmate</span>
            </div>
            <div class="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                class="btn btn-ghost btn-xs btn-square md:hidden"
                x-on:click="closeMobileMenu"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Navigation: Mobile Dropdown */}
          <div class="p-2 border-b border-base-content/10 md:hidden">
            <select class="select select-sm select-bordered w-full font-medium" x-model="sidebarTab">
              <option value="sessions">💬 Chats</option>
              <option value="scenes">🎬 Szenen</option>
              <option value="characters">🧑 Charaktere</option>
              <option value="personas">🎭 Ich</option>
              <option value="locations">📍 Orte</option>
              <option value="gamemasters">🎙 Leiter</option>
            </select>
          </div>

          {/* Navigation: Desktop Scrollable Tabs with < and > */}
          <div class="hidden md:flex items-center gap-1 p-2 border-b border-base-content/10">
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square shrink-0"
              x-on:click="scrollSidebarTabs(-1)"
              title="Tabs nach links scrollen"
            >
              ‹
            </button>
            <div
              id="skald-sidebar-tabs"
              x-on:wheel="scrollSidebarTabsWheel"
              class="flex-1 flex items-center gap-1 overflow-x-auto select-none text-[11px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'sessions' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabSessions"
              >
                Chats
              </button>
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'scenes' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabScenes"
              >
                Szenen
              </button>
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'characters' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabCharacters"
              >
                Charaktere
              </button>
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'personas' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabPersonas"
              >
                Ich
              </button>
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'locations' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabLocations"
              >
                Orte
              </button>
              <button
                type="button"
                class="btn btn-xs shrink-0"
                x-bind:class="sidebarTab === 'gamemasters' ? 'btn-primary' : 'btn-ghost'"
                x-on:click="setTabGameMasters"
              >
                Leiter
              </button>
            </div>
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square shrink-0"
              x-on:click="scrollSidebarTabs(1)"
              title="Tabs nach rechts scrollen"
            >
              ›
            </button>
          </div>

          {/* Sidebar Content */}
          <div class="flex-1 overflow-y-auto p-3 space-y-2">
            {/* TAB: CHATS */}
            <div x-show="sidebarTab === 'sessions'" class="space-y-2">
              <button
                type="button"
                class="btn btn-primary btn-sm w-full"
                x-on:click="openNewSession"
              >
                + Neuer Chat
              </button>
              <template x-for="s in sessions" x-bind:key="s.id">
                <div
                  class="flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition"
                  x-bind:class="activeSession && activeSession.id === s.id ? 'bg-primary text-primary-content font-medium' : 'hover:bg-base-300'"
                  x-bind:data-id="s.id"
                  x-on:click="selectSession"
                >
                  <span class="truncate" x-text="s.title" />
                </div>
              </template>
            </div>

            {/* TAB: SZENEN (VORLAGEN) */}
            <div x-show="sidebarTab === 'scenes'" class="space-y-2" style="display: none;">
              <button type="button" class="btn btn-outline btn-xs w-full" x-on:click="newSceneForm">
                + Neue Szene
              </button>
              <template x-for="sc in scenes" x-bind:key="sc.id">
                <div
                  class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                  x-bind:data-id="sc.id"
                  x-on:click="editSceneItem"
                >
                  <div class="min-w-0">
                    <div class="truncate font-medium" x-text="sc.title" />
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs h-6 min-h-0 px-2 text-primary shrink-0"
                    title="Chat starten"
                    x-bind:data-id="sc.id"
                    x-bind:disabled="sceneStartLoading"
                    x-on:click="startChatFromScene"
                  >
                    + Chat starten
                  </button>
                </div>
              </template>
              <p x-show="scenes.length === 0" class="text-xs opacity-60 px-1 pt-1">
                Noch keine Szenen gespeichert. Lege eine Vorlage an, um daraus beliebig viele Chats zu starten.
              </p>
            </div>

            {/* TAB: CHARAKTERE */}
            <div x-show="sidebarTab === 'characters'" class="space-y-2" style="display: none;">
              <button type="button" class="btn btn-outline btn-xs w-full" x-on:click="newCharacterForm">
                + Neuer Charakter
              </button>
              <template x-for="c in characters" x-bind:key="c.id">
                <div
                  class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                  x-bind:data-id="c.id"
                  x-on:click="editCharacterItem"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <img
                      x-show="c.portraitFile"
                      x-bind:src="'./api/assets/' + c.portraitFile"
                      class="w-7 h-7 rounded-full object-cover shrink-0"
                      style="display: none;"
                    />
                    <span class="truncate" x-text="c.name" />
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span class="text-[10px] opacity-60 truncate max-w-[80px]" x-text="c.role" />
                    <button
                      x-show="activeSession && !(activeSession.characterIds || []).includes(c.id)"
                      type="button"
                      class="btn btn-ghost btn-xs h-6 min-h-0 px-1.5 text-primary"
                      title="Zur aktuellen Szene hinzufügen"
                      x-bind:data-id="c.id"
                      x-on:click="addCharacterToActiveSession"
                      style="display: none;"
                    >
                      +
                    </button>
                    <span
                      x-show="activeSession && (activeSession.characterIds || []).includes(c.id)"
                      class="text-[11px] text-success px-1"
                      title="Bereits in der aktuellen Szene"
                      style="display: none;"
                    >
                      ✓
                    </span>
                  </div>
                </div>
              </template>
            </div>

            {/* TAB: PERSONAS */}
            <div x-show="sidebarTab === 'personas'" class="space-y-2" style="display: none;">
              <button type="button" class="btn btn-outline btn-xs w-full" x-on:click="newPersonaForm">
                + Neue eigene Persona
              </button>
              <template x-for="p in personas" x-bind:key="p.id">
                <div
                  class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                  x-bind:data-id="p.id"
                  x-on:click="editPersonaItem"
                >
                  <div class="flex items-center gap-2 min-w-0">
                    <img
                      x-show="p.portraitFile"
                      x-bind:src="'./api/assets/' + p.portraitFile"
                      class="w-7 h-7 rounded-full object-cover shrink-0"
                      style="display: none;"
                    />
                    <span class="truncate" x-text="(p.isDefault ? '★ ' : '') + p.name" />
                  </div>
                  <span class="text-[10px] opacity-60 truncate" x-text="p.role" />
                </div>
              </template>
            </div>

            {/* TAB: ORTE (BAUM) */}
            <div x-show="sidebarTab === 'locations'" class="space-y-1.5" style="display: none;">
              <button type="button" class="btn btn-outline btn-xs w-full mb-1" x-on:click="newLocationForm">
                + Neuer Ort
              </button>
              <template x-for="l in locationTree" x-bind:key="l.id">
                <div
                  class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                  x-bind:style="'padding-left: ' + (10 + l.depth * 14) + 'px'"
                  x-bind:data-id="l.id"
                  x-on:click="editLocationItem"
                >
                  <span class="truncate" x-text="(l.depth > 0 ? '└─ ' : '📍 ') + l.name" />
                  <span
                    x-show="l.residentIds && l.residentIds.length > 0"
                    class="badge badge-xs badge-ghost font-mono"
                    x-text="l.residentIds ? l.residentIds.length + ' vor Ort' : ''"
                    style="display: none;"
                  />
                </div>
              </template>
            </div>

            {/* TAB: SPIELLEITER */}
            <div x-show="sidebarTab === 'gamemasters'" class="space-y-2" style="display: none;">
              <button type="button" class="btn btn-outline btn-xs w-full" x-on:click="newGmForm">
                + Neuer Spielleiter
              </button>
              <template x-for="g in gameMasters" x-bind:key="g.id">
                <div
                  class="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                  x-bind:data-id="g.id"
                  x-on:click="editGmItem"
                >
                  <span class="truncate" x-text="'🎭 ' + g.name" />
                  <span class="text-[10px] opacity-60" x-text="g.style" />
                </div>
              </template>
            </div>
          </div>
        </aside>

        {/* MAIN AREA */}
        <main class="flex-1 min-h-0 flex flex-col overflow-hidden bg-base-100">
          {/* Top Bar */}
          <header class="navbar shrink-0 bg-base-100 border-b border-base-content/10 px-2.5 sm:px-4 py-1.5 sm:py-2 min-h-12 flex flex-nowrap items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <button
                type="button"
                class="btn btn-ghost btn-sm sm:btn-xs btn-square md:hidden shrink-0"
                x-on:click="openMobileMenu"
              >
                ☰
              </button>
              <span
                class="font-bold text-base sm:text-sm md:text-base truncate"
                x-text="activeSession ? activeSession.title : 'Skaldmate'"
              />
              <span
                x-show="activeSession"
                class="badge badge-sm badge-outline font-mono hidden sm:inline-flex shrink-0"
                x-text="'📍 ' + activeLocationName"
                style="display: none;"
              />
            </div>

            {/* Desktop Header Actions */}
            <div class="hidden sm:flex items-center gap-1.5 shrink-0">
              <template x-if="activeSession">
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    class="btn btn-xs btn-outline"
                    x-bind:disabled="turnLoading"
                    x-on:click="continueScene"
                    title="Spielleiter & Charaktere ohne eigene Nachricht fortfahren lassen"
                  >
                    ▶ Weiter
                  </button>
                  <button
                    type="button"
                    class="btn btn-xs btn-outline"
                    x-bind:disabled="imageLoading"
                    x-on:click="generateSceneImage"
                    title="Szenenbild aus aktuellem Moment generieren"
                  >
                    <span x-show="imageLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                    <span>🖼 Szene</span>
                  </button>
                </div>
              </template>
              <button
                type="button"
                class="btn btn-xs btn-outline"
                x-bind:class="showWorkshop ? 'btn-primary' : ''"
                x-on:click="toggleWorkshop"
                title="Neutraler Werkstatt-Chat zum Entwickeln von Charakteren & Szenen"
              >
                🧠 Werkstatt
              </button>
              <button
                type="button"
                class="btn btn-xs btn-ghost font-mono"
                x-on:click="openHelpModal"
                title="Kurzanleitung & Makrosyntax"
              >
                ? Hilfe
              </button>
            </div>

            {/* Mobile Header Actions (kompakt im Menü) */}
            <div class="flex sm:hidden items-center gap-1.5 shrink-0">
              <button
                x-show="activeSession"
                type="button"
                class="btn btn-sm btn-outline px-2.5"
                x-bind:disabled="turnLoading"
                x-on:click="continueScene"
                title="Weiter"
                style="display: none;"
              >
                ▶ Weiter
              </button>
              <div class="dropdown dropdown-end">
                <button type="button" tabindex={0} class="btn btn-sm btn-ghost btn-square text-lg" aria-label="Menü">
                  ⋮
                </button>
                <ul
                  tabindex={0}
                  class="dropdown-content menu bg-base-200 border border-base-content/15 rounded-box z-50 w-52 p-2 shadow-xl gap-1"
                >
                  <li x-show="activeSession" style="display: none;">
                    <button
                      type="button"
                      x-bind:disabled="imageLoading"
                      x-on:click="generateSceneImage"
                    >
                      <span x-show="imageLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                      <span>🖼 Szenenbild erstellen</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" x-on:click="toggleWorkshop">
                      <span>🧠 Werkstatt-Chat</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" x-on:click="openHelpModal">
                      <span>❓ Kurzanleitung &amp; Makros</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </header>

          {/* VIEW A: ENTITY EDITOR */}
          <section x-show="viewMode === 'editor'" class="flex-1 overflow-y-auto p-4 md:p-6" style="display: none;">
            <div class="max-w-2xl mx-auto card bg-base-200 border border-base-content/10">
              <div class="card-body gap-3">
                {/* Character Editor */}
                <template x-if="editorType === 'character'">
                  <form x-on:submit="saveCharacterForm" class="flex flex-col gap-3">
                    <div class="flex justify-between items-center">
                      <h2 class="font-bold text-lg">Charakter</h2>
                      <button
                        x-show="charForm.id && !charForm.portraitFile"
                        type="button"
                        class="btn btn-xs btn-outline"
                        x-bind:disabled="portraitLoading"
                        x-on:click="generatePortrait"
                      >
                        <span x-show="portraitLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                        <span>🖼 Porträt generieren</span>
                      </button>
                    </div>
                    <div x-show="charForm.portraitFile" class="flex items-center gap-3" style="display: none;">
                      <div class="relative inline-block">
                        <img
                          x-bind:src="charForm.portraitFile ? './api/assets/' + charForm.portraitFile : ''"
                          class="w-20 h-20 rounded-xl object-cover border border-base-content/15"
                        />
                        <button
                          type="button"
                          class="btn btn-circle btn-xs btn-error absolute -top-2 -right-2 shadow"
                          title="Porträt löschen"
                          aria-label="Porträt löschen"
                          x-on:click="deletePortrait"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Name</span>
                        <input type="text" placeholder="z. B. Lena" class="input input-sm input-bordered w-full" x-model="charForm.name" required />
                      </label>
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Rolle</span>
                        <input
                          type="text"
                          placeholder="z. B. Nachbarin, Detektiv, Waldläufer"
                          class="input input-sm input-bordered w-full"
                          x-model="charForm.role"
                        />
                      </label>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Aussehen</span>
                      <textarea
                        rows={2}
                        placeholder="Optik, Kleidung, markante Merkmale"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.appearance"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Charakterzüge &amp; Persönlichkeit</span>
                      <textarea
                        rows={2}
                        placeholder="Wie verhält sich der Charakter? Stärken, Macken, Temperament"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.personality"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Ziele &amp; Motivation</span>
                      <textarea
                        rows={2}
                        placeholder="Was will der Charakter erreichen?"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.goals"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Sprechstil</span>
                      <input
                        type="text"
                        placeholder="z. B. direkt, sarkastisch, ruhig, bildhaft"
                        class="input input-sm input-bordered w-full"
                        x-model="charForm.speechStyle"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Vorlesestimme (Browser-TTS)</span>
                      <select class="select select-sm select-bordered w-full" x-model="charForm.voiceGender">
                        <option value="">(Automatisch / Standard)</option>
                        <option value="female">Weiblich</option>
                        <option value="male">Männlich</option>
                      </select>
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Erster Auftritt / Begrüßung (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="Was sagt oder tut der Charakter bei der Szenen-Initialisierung?"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.greeting"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Typische Beispielsätze / Zitate</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. ‚Spar dir die Ausreden, ich hab’s genau gesehen.‘"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.exampleDialogue"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Beziehungen zu anderen Charakteren</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. Misstraut dem Kommissar, kennt Stefan aus der Nachbarschaft"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="charForm.relationships"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Porträt-Prompt (optional, wird sonst automatisch gebaut)</span>
                      <textarea
                        rows={2}
                        placeholder="Englischer oder deutscher Bild-Prompt für die Porträt-Generierung..."
                        class="textarea textarea-sm textarea-bordered font-mono text-xs w-full"
                        x-model="charForm.portraitPrompt"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Eigenes Modell (optional)</span>
                      <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="charForm.modelId">
                        <option value="">(Szenen-Standardmodell verwenden)</option>
                        <template x-for="m in textModels" x-bind:key="m.id">
                          <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                        </template>
                      </select>
                    </label>
                    <div class="flex justify-end gap-2 pt-2">
                      <button x-show="charForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deleteCharacterForm">
                        Löschen
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                      <button type="submit" class="btn btn-xs btn-primary">Speichern</button>
                    </div>
                  </form>
                </template>

                {/* Persona Editor */}
                <template x-if="editorType === 'persona'">
                  <form x-on:submit="savePersonaForm" class="flex flex-col gap-3">
                    <div class="flex justify-between items-center">
                      <h2 class="font-bold text-lg">Meine Persona</h2>
                      <button
                        x-show="personaForm.id && !personaForm.portraitFile"
                        type="button"
                        class="btn btn-xs btn-outline"
                        x-bind:disabled="personaPortraitLoading"
                        x-on:click="generatePersonaPortrait"
                      >
                        <span x-show="personaPortraitLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                        <span>🖼 Porträt generieren</span>
                      </button>
                    </div>
                    <div x-show="personaForm.portraitFile" class="flex items-center gap-3" style="display: none;">
                      <div class="relative inline-block">
                        <img
                          x-bind:src="personaForm.portraitFile ? './api/assets/' + personaForm.portraitFile : ''"
                          class="w-20 h-20 rounded-xl object-cover border border-base-content/15"
                        />
                        <button
                          type="button"
                          class="btn btn-circle btn-xs btn-error absolute -top-2 -right-2 shadow"
                          title="Porträt löschen"
                          aria-label="Porträt löschen"
                          x-on:click="deletePersonaPortrait"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Name in der Geschichte</span>
                      <input
                        type="text"
                        placeholder="z. B. Stefan"
                        class="input input-sm input-bordered w-full"
                        x-model="personaForm.name"
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Rolle</span>
                      <input
                        type="text"
                        placeholder="z. B. Reisender, Ermittler, Nachbar"
                        class="input input-sm input-bordered w-full"
                        x-model="personaForm.role"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Aussehen</span>
                      <textarea
                        rows={2}
                        placeholder="Optik, Kleidung, markante Merkmale"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="personaForm.appearance"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Eigenschaften &amp; Charakterzüge</span>
                      <textarea
                        rows={2}
                        placeholder="Stärken, Schwächen, Auftreten"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="personaForm.traits"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Hintergrund</span>
                      <textarea
                        rows={2}
                        placeholder="Kurze Vorgeschichte / Motivation"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="personaForm.background"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Vorlesestimme (Browser-TTS)</span>
                      <select class="select select-sm select-bordered w-full" x-model="personaForm.voiceGender">
                        <option value="">(Automatisch / Standard)</option>
                        <option value="female">Weiblich</option>
                        <option value="male">Männlich</option>
                      </select>
                    </label>
                    <label class="label cursor-pointer justify-start gap-2 pt-1">
                      <input type="checkbox" class="checkbox checkbox-xs checkbox-primary" x-model="personaForm.isDefault" />
                      <span class="label-text text-xs">Als Standard-Persona für neue Szenen verwenden</span>
                    </label>
                    <div class="flex justify-end gap-2 pt-2">
                      <button x-show="personaForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deletePersonaForm">
                        Löschen
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                      <button type="submit" class="btn btn-xs btn-primary">Speichern</button>
                    </div>
                  </form>
                </template>

                {/* Location Editor */}
                <template x-if="editorType === 'location'">
                  <form x-on:submit="saveLocationForm" class="flex flex-col gap-3">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                      <h2 class="font-bold text-lg">Ort / Location</h2>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          class="btn btn-xs btn-outline"
                          x-bind:disabled="locationElaborateLoading || !locationForm.name"
                          x-on:click="elaborateLocationMap"
                          title="Ortsbeschreibung & Karten-Layout mit Text-KI ausarbeiten"
                        >
                          <span x-show="locationElaborateLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                          <span>✨ Lage &amp; Beschreibung</span>
                        </button>
                        <button
                          x-show="locationForm.id"
                          type="button"
                          class="btn btn-xs btn-outline"
                          x-bind:disabled="locationImageLoading"
                          x-on:click="generateLocationImage"
                        >
                          <span x-show="locationImageLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                          <span>🖼 Ortsbild</span>
                        </button>
                        <button
                          x-show="locationForm.id"
                          type="button"
                          class="btn btn-xs btn-outline btn-primary"
                          x-bind:disabled="locationMapLoading"
                          x-on:click="generateLocationMap"
                        >
                          <span x-show="locationMapLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                          <span>🗺 Karte</span>
                        </button>
                      </div>
                    </div>
                    <div
                      x-show="locationForm.imageFile || locationForm.mapFile"
                      class="grid grid-cols-1 md:grid-cols-2 gap-3"
                      style="display: none;"
                    >
                      <div
                        x-show="locationForm.imageFile"
                        class="rounded-xl overflow-hidden border border-base-content/15 bg-base-300/40"
                        style="display: none;"
                      >
                        <div class="px-2.5 py-1 text-[11px] font-semibold opacity-70 border-b border-base-content/10">
                          🖼 Ortsbild
                        </div>
                        <img
                          x-bind:src="locationForm.imageFile ? './api/assets/' + locationForm.imageFile : ''"
                          class="w-full h-auto object-cover"
                        />
                      </div>
                      <div
                        x-show="locationForm.mapFile"
                        class="rounded-xl overflow-hidden border border-base-content/15 bg-base-300/40"
                        style="display: none;"
                      >
                        <div class="px-2.5 py-1 text-[11px] font-semibold opacity-70 border-b border-base-content/10">
                          🗺 Landkarte / Grundriss
                        </div>
                        <img
                          x-bind:src="locationForm.mapFile ? './api/assets/' + locationForm.mapFile : ''"
                          class="w-full h-auto object-cover"
                        />
                      </div>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Ortsname</span>
                      <input
                        type="text"
                        placeholder="z. B. Wohnung, Stadt, Taverne"
                        class="input input-sm input-bordered w-full"
                        x-model="locationForm.name"
                        required
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Übergeordneter Ort (Ortsbaum, optional)</span>
                      <select class="select select-sm select-bordered w-full" x-model="locationForm.parentId">
                        <option value="">(Kein übergeordneter Ort / Wurzel)</option>
                        <template x-for="l in locations" x-bind:key="l.id">
                          <option
                            x-bind:value="l.id"
                            x-bind:disabled="l.id === locationForm.id"
                            x-text="l.name"
                          />
                        </template>
                      </select>
                    </label>
                    <div>
                      <span class="label-text text-xs block mb-1.5">Ortsgebundene Charaktere (z. B. Barkeeper, Händler)</span>
                      <div class="flex flex-wrap gap-1.5">
                        <template x-for="c in characters" x-bind:key="c.id">
                          <button
                            type="button"
                            class="btn btn-xs"
                            x-bind:class="isResidentSelected(c.id) ? 'btn-primary' : 'btn-outline'"
                            x-bind:data-id="c.id"
                            x-on:click="toggleLocationResident"
                            x-text="c.name"
                          />
                        </template>
                        <span x-show="characters.length === 0" class="text-xs opacity-60">
                          Noch keine Charaktere angelegt.
                        </span>
                      </div>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Beschreibung des Ortes</span>
                      <textarea
                        rows={3}
                        placeholder="Wie sieht der Ort aus? Architektur, Einrichtung, Umgebung..."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="locationForm.description"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Atmosphäre / Licht / Geräusche</span>
                      <input
                        type="text"
                        placeholder="z. B. warmes Lampenlicht, entferntes Straßenrauschen"
                        class="input input-sm input-bordered w-full"
                        x-model="locationForm.atmosphere"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Wichtige Details / Requisiten</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. Esstisch, offener Balkon, knarrende Dielen"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="locationForm.details"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Initialer Start-Text im Dialog (optional, Makros erlaubt)</span>
                      <textarea
                        rows={2}
                        placeholder="Wird beim Szenenstart direkt als erster Text im Chat angezeigt..."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="locationForm.openingMessage"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Standard-Startzustand für neue Szenen (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. Später Abend, draußen nieselt es leicht."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="locationForm.defaultSceneState"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Ortsbild-Prompt (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="Wird sonst automatisch aus Beschreibung & Atmosphäre erzeugt..."
                        class="textarea textarea-sm textarea-bordered font-mono text-xs w-full"
                        x-model="locationForm.imagePrompt"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Karten-Beschreibung / Räumliches Layout (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. Im Norden die Berge, im Zentrum der Marktplatz, östlich die Taverne... (wird sonst aus Beschreibung + Unter-Orten erzeugt)"
                        class="textarea textarea-sm textarea-bordered font-mono text-xs w-full"
                        x-model="locationForm.mapPrompt"
                      />
                    </label>
                    <div class="flex justify-end gap-2 pt-2">
                      <button x-show="locationForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deleteLocationForm">
                        Löschen
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                      <button type="submit" class="btn btn-xs btn-primary">Speichern</button>
                    </div>
                  </form>
                </template>

                {/* GameMaster Editor */}
                <template x-if="editorType === 'gamemaster'">
                  <form x-on:submit="saveGmForm" class="flex flex-col gap-3">
                    <h2 class="font-bold text-lg">Spielleiter</h2>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Name</span>
                        <input
                          type="text"
                          placeholder="z. B. Der Chronist"
                          class="input input-sm input-bordered w-full"
                          x-model="gmForm.name"
                          required
                        />
                      </label>
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Erzählstil</span>
                        <input
                          type="text"
                          placeholder="z. B. neutral, noir, spannend"
                          class="input input-sm input-bordered w-full"
                          x-model="gmForm.style"
                        />
                      </label>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Erzähler-Frequenz</span>
                      <select class="select select-sm select-bordered w-full" x-model="gmForm.narrationFrequency">
                        <option value="immer">Immer (jede Runde)</option>
                        <option value="dann_und_wann">Dann und wann (Stimme aus dem Off)</option>
                        <option value="nur_bei_aenderungen">Nur bei Ereignissen / Änderungen</option>
                      </select>
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Vorlesestimme (Browser-TTS)</span>
                      <select class="select select-sm select-bordered w-full" x-model="gmForm.voiceGender">
                        <option value="">(Automatisch / Standard)</option>
                        <option value="female">Weiblich</option>
                        <option value="male">Männlich</option>
                      </select>
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Regie-Anweisung / System-Prompt</span>
                      <textarea
                        rows={4}
                        placeholder="Wie soll der Spielleiter die Welt und das Tempo führen?"
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="gmForm.systemPrompt"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Eigenes Modell (optional)</span>
                      <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="gmForm.modelId">
                        <option value="">(Szenen-Standardmodell verwenden)</option>
                        <template x-for="m in textModels" x-bind:key="m.id">
                          <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                        </template>
                      </select>
                    </label>
                    <div class="flex justify-end gap-2 pt-2">
                      <button x-show="gmForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deleteGmForm">
                        Löschen
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                      <button type="submit" class="btn btn-xs btn-primary">Speichern</button>
                    </div>
                  </form>
                </template>

                {/* Scene Template Editor */}
                <template x-if="editorType === 'scene'">
                  <form x-on:submit="saveSceneForm" class="flex flex-col gap-3">
                    <h2 class="font-bold text-lg">Szene (Vorlage)</h2>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Szenen-Titel</span>
                      <input
                        type="text"
                        placeholder="z. B. Hafenkrimi im Regen"
                        class="input input-sm input-bordered w-full"
                        x-model="sceneForm.title"
                        required
                      />
                    </label>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Ort / Location</span>
                        <select class="select select-sm select-bordered w-full" x-model="sceneForm.locationId" required>
                          <template x-for="l in locations" x-bind:key="l.id">
                            <option x-bind:value="l.id" x-text="l.name" />
                          </template>
                        </select>
                      </label>
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Meine Persona</span>
                        <select class="select select-sm select-bordered w-full" x-model="sceneForm.personaId">
                          <option value="">(Ohne feste Persona / Du)</option>
                          <template x-for="p in personas" x-bind:key="p.id">
                            <option x-bind:value="p.id" x-text="p.name" />
                          </template>
                        </select>
                      </label>
                    </div>
                    <div>
                      <span class="label-text text-xs block mb-1.5">Begleiter / Charaktere</span>
                      <div class="flex flex-wrap gap-1.5">
                        <template x-for="c in characters" x-bind:key="c.id">
                          <button
                            type="button"
                            class="btn btn-xs"
                            x-bind:class="isSceneCharSelected(c.id) ? 'btn-primary' : 'btn-outline'"
                            x-bind:data-id="c.id"
                            x-on:click="toggleSceneChar"
                            x-text="c.name"
                          />
                        </template>
                      </div>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Spielleiter</span>
                        <select class="select select-sm select-bordered w-full" x-model="sceneForm.gameMasterId">
                          <template x-for="g in gameMasters" x-bind:key="g.id">
                            <option x-bind:value="g.id" x-text="g.name" />
                          </template>
                        </select>
                      </label>
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Text-Modell</span>
                        <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="sceneForm.modelId">
                          <option value="">(Standard)</option>
                          <template x-for="m in textModels" x-bind:key="m.id">
                            <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                          </template>
                        </select>
                      </label>
                      <label class="flex flex-col gap-1 w-full">
                        <span class="label-text text-xs mb-1">Bild-Modell</span>
                        <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="sceneForm.imageModelId">
                          <option value="">(Standard)</option>
                          <template x-for="m in imageModels" x-bind:key="m.id">
                            <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                          </template>
                        </select>
                      </label>
                    </div>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Start-Szenenzustand (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="z. B. Später Abend, draußen regnet es..."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="sceneForm.sceneState"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Eröffnungsdialog / Start-Szene (optional, Makros erlaubt)</span>
                      <textarea
                        rows={2}
                        placeholder="Optionaler Einstieg für neue Chats aus dieser Szene..."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="sceneForm.openingMessage"
                      />
                    </label>
                    <label class="flex flex-col gap-1 w-full">
                      <span class="label-text text-xs mb-1">Spielleiter-Notizen (optional)</span>
                      <textarea
                        rows={2}
                        placeholder="Geheime Plot-Fäden oder Hinweise..."
                        class="textarea textarea-sm textarea-bordered w-full"
                        x-model="sceneForm.gmNotes"
                      />
                    </label>
                    <div class="flex flex-wrap justify-end gap-2 pt-2">
                      <button x-show="sceneForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deleteSceneForm">
                        Löschen
                      </button>
                      <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                      <button type="submit" class="btn btn-xs btn-outline btn-primary">💾 Speichern</button>
                      <button
                        type="button"
                        class="btn btn-xs btn-primary"
                        x-bind:disabled="creatingSession"
                        x-on:click="startChatFromSceneForm"
                      >
                        + Chat starten
                      </button>
                    </div>
                  </form>
                </template>
              </div>
            </div>
          </section>

          {/* VIEW B: NEW SESSION SETUP */}
          <section x-show="viewMode === 'new-session'" class="flex-1 overflow-y-auto p-4 md:p-6">
            <form x-on:submit="createSession" class="max-w-2xl mx-auto card bg-base-200 border border-base-content/10">
              <div class="card-body gap-4">
                <h2 class="card-title text-lg">Neue Szene zusammenklicken</h2>

                <label class="flex flex-col gap-1 w-full">
                  <span class="label-text text-xs mb-1">Szenen-Titel</span>
                  <input
                    type="text"
                    class="input input-sm input-bordered w-full"
                    placeholder="z. B. Abend in der Wohnung"
                    x-model="newSessionForm.title"
                    required
                  />
                </label>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label class="flex flex-col gap-1 w-full">
                    <span class="label-text text-xs mb-1">Ort / Location</span>
                    <select class="select select-sm select-bordered w-full" x-model="newSessionForm.locationId" required>
                      <template x-for="l in locations" x-bind:key="l.id">
                        <option x-bind:value="l.id" x-text="l.name" />
                      </template>
                    </select>
                  </label>

                  <label class="flex flex-col gap-1 w-full">
                    <span class="label-text text-xs mb-1">Meine Persona</span>
                    <select class="select select-sm select-bordered w-full" x-model="newSessionForm.personaId">
                      <option value="">(Ohne feste Persona / Du)</option>
                      <template x-for="p in personas" x-bind:key="p.id">
                        <option x-bind:value="p.id" x-text="p.name" />
                      </template>
                    </select>
                  </label>
                </div>

                <div>
                  <span class="label-text text-xs block mb-1">Reisegruppe (Begleiter, die von Ort zu Ort mitkommen)</span>
                  <p class="text-[11px] opacity-60 mb-2">
                    Ortsgebundene Charaktere (z. B. Barkeeper) stoßen je nach besuchter Location automatisch dazu.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <template x-for="c in characters" x-bind:key="c.id">
                      <button
                        type="button"
                        class="btn btn-xs"
                        x-bind:class="isCharSelectedForNew(c.id) ? 'btn-primary' : 'btn-outline'"
                        x-bind:data-id="c.id"
                        x-on:click="toggleNewSessionChar"
                        x-text="c.name"
                      />
                    </template>
                    <span x-show="characters.length === 0" class="text-xs opacity-60">
                      Lege links unter „Charaktere“ zuerst Charaktere an.
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label class="flex flex-col gap-1 w-full">
                    <span class="label-text text-xs mb-1">Spielleiter</span>
                    <select class="select select-sm select-bordered w-full" x-model="newSessionForm.gameMasterId">
                      <template x-for="g in gameMasters" x-bind:key="g.id">
                        <option x-bind:value="g.id" x-text="g.name" />
                      </template>
                    </select>
                  </label>

                  <label class="flex flex-col gap-1 w-full">
                    <span class="label-text text-xs mb-1">Text-Modell</span>
                    <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="newSessionForm.modelId">
                      <template x-for="m in textModels" x-bind:key="m.id">
                        <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                      </template>
                    </select>
                  </label>

                  <label class="flex flex-col gap-1 w-full">
                    <span class="label-text text-xs mb-1">Bild-Modell</span>
                    <select class="select select-sm select-bordered font-mono text-xs w-full" x-model="newSessionForm.imageModelId">
                      <template x-for="m in imageModels" x-bind:key="m.id">
                        <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                      </template>
                    </select>
                  </label>
                </div>

                <label class="flex flex-col gap-1 w-full">
                  <span class="label-text text-xs mb-1">Eröffnungsdialog / Start-Szene (optional, Makros erlaubt)</span>
                  <textarea
                    rows={2}
                    class="textarea textarea-sm textarea-bordered w-full"
                    placeholder="Optionaler eigener Einstieg, auf dem Spielleiter &amp; Charaktere direkt aufbauen..."
                    x-model="newSessionForm.openingMessage"
                  />
                </label>

                <div class="card-actions justify-end gap-2 pt-2">
                  <button type="button" class="btn btn-outline btn-sm" x-on:click="saveNewSessionAsScene">
                    💾 Als Szene speichern
                  </button>
                  <button type="submit" class="btn btn-primary btn-sm" x-bind:disabled="creatingSession">
                    <span x-show="creatingSession" class="loading loading-spinner loading-xs" style="display: none;" />
                    <span>Chat starten</span>
                  </button>
                </div>
              </div>
            </form>
          </section>

          {/* VIEW C: ACTIVE GROUP CHAT */}
          <section x-show="viewMode === 'chat'" class="flex-1 min-h-0 flex flex-col overflow-hidden" style="display: none;">
            {/* Active Cast Bar (location switch + party + location residents) */}
            <div class="shrink-0 px-3 sm:px-4 py-2 bg-base-200/60 border-b border-base-content/10 flex flex-nowrap overflow-x-auto sm:flex-wrap items-center gap-2 text-xs">
              <select
                class="select select-sm sm:select-xs select-bordered bg-base-100 font-semibold shrink-0"
                x-bind:value="activeSession ? activeSession.locationId : ''"
                x-on:change="changeSessionLocation"
                title="Aktuellen Ort wechseln"
              >
                <template x-for="l in locationTree" x-bind:key="l.id">
                  <option x-bind:value="l.id" x-text="(l.depth > 0 ? '↳ ' : '📍 ') + l.name" />
                </template>
              </select>
              <button
                x-show="activeLocation && activeLocation.mapFile"
                type="button"
                class="btn btn-sm sm:btn-xs btn-ghost px-2 sm:px-1.5 shrink-0"
                x-on:click="openLocationMediaModal('map')"
                title="Ortskarte / Grundriss anzeigen"
                style="display: none;"
              >
                🗺
              </button>
              <button
                x-show="activeLocation && activeLocation.imageFile"
                type="button"
                class="btn btn-sm sm:btn-xs btn-ghost px-2 sm:px-1.5 shrink-0"
                x-on:click="openLocationMediaModal('image')"
                title="Ortsbild anzeigen"
                style="display: none;"
              >
                🖼
              </button>
              <span class="opacity-60 shrink-0">Gruppe:</span>
              <template x-for="c in activeCast" x-bind:key="c.id">
                <button
                  type="button"
                  class="badge badge-md sm:badge-sm badge-outline hover:badge-primary cursor-pointer gap-1.5 py-3 sm:py-2.5 shrink-0"
                  x-bind:data-id="c.id"
                  x-on:click="nudgeCharacter"
                  title="Begleiter – klicken zum Antworten"
                >
                  <img
                    x-show="c.portraitFile"
                    x-bind:src="'./api/assets/' + c.portraitFile"
                    class="w-4 h-4 rounded-full object-cover"
                    style="display: none;"
                  />
                  <span x-text="c.name" />
                </button>
              </template>
              <template x-if="activeResidents.length > 0">
                <span class="opacity-60 ml-1 shrink-0">Vor Ort:</span>
              </template>
              <template x-for="r in activeResidents" x-bind:key="r.id">
                <button
                  type="button"
                  class="badge badge-md sm:badge-sm badge-secondary badge-outline hover:badge-secondary cursor-pointer gap-1.5 py-3 sm:py-2.5 shrink-0"
                  x-bind:data-id="r.id"
                  x-on:click="nudgeCharacter"
                  title="Charakter vor Ort – klicken zum Antworten"
                >
                  <img
                    x-show="r.portraitFile"
                    x-bind:src="'./api/assets/' + r.portraitFile"
                    class="w-4 h-4 rounded-full object-cover"
                    style="display: none;"
                  />
                  <span x-text="'📍 ' + r.name" />
                </button>
              </template>
            </div>

            {/* Collapsible Zustand & Initial Prompt Bar */}
            <button
              type="button"
              class="shrink-0 w-full px-3 sm:px-4 py-2.5 sm:py-1.5 bg-base-200/40 hover:bg-base-200/80 border-b border-base-content/10 flex items-center justify-between text-sm sm:text-xs transition cursor-pointer"
              x-on:click="toggleNotesPanel"
            >
              <span class="font-semibold flex items-center gap-2 sm:gap-1.5">
                <span class="font-mono w-3 text-center" x-text="showNotesPanel ? '⌄' : '›'" />
                <span>Zustand &amp; Parameter</span>
              </span>
              <span class="text-xs sm:text-[11px] opacity-60 truncate max-w-[55%]" x-text="activeSession ? activeSession.title : ''" />
            </button>

            {/* Optional Scene State, Inventory, GM Notes & Compressed Summary Drawer */}
            <div
              x-show="showNotesPanel"
              class="flex-1 min-h-0 sm:flex-none sm:shrink-0 block p-4 pb-10 sm:px-4 sm:py-3 bg-base-200 border-b border-base-content/10 space-y-3.5 sm:space-y-3 sm:max-h-[65vh] overflow-y-auto overscroll-y-contain"
              style="display: none;"
            >
              <div class="flex flex-wrap justify-between items-center text-sm sm:text-xs gap-2">
                <span class="font-semibold">Chat-Titel &amp; Zustand</span>
                <div class="flex flex-wrap items-center gap-2">
                  <button type="button" class="btn btn-sm sm:btn-xs btn-outline" x-on:click="saveActiveSessionAsScene">💾 Als Szene</button>
                  <button type="button" class="btn btn-sm sm:btn-xs btn-outline" x-on:click="exportSessionToNotemate">📓 Nach NoteMate</button>
                  <button type="button" class="btn btn-sm sm:btn-xs btn-outline" x-on:click="openCloneModal">📋 Klonen</button>
                  <button type="button" class="btn btn-sm sm:btn-xs btn-error btn-outline" x-on:click="deleteActiveSession">🗑 Löschen</button>
                  <button type="button" class="btn btn-sm sm:btn-xs btn-primary" x-on:click="saveSceneState">Speichern</button>
                </div>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                <label class="flex flex-col gap-1 w-full">
                  <span class="text-xs sm:text-[11px] font-semibold opacity-70">Chat-Name</span>
                  <input
                    type="text"
                    class="input input-sm sm:input-xs input-bordered w-full text-base sm:text-xs"
                    placeholder="Name dieses Chats..."
                    x-model="sessionTitleDraft"
                  />
                </label>
                <label class="flex flex-col gap-1 w-full">
                  <span class="text-xs sm:text-[11px] font-semibold opacity-70">Text-Modell</span>
                  <select class="select select-sm sm:select-xs select-bordered font-mono w-full text-sm sm:text-xs" x-model="sessionModelIdDraft">
                    <option value="">(Standard)</option>
                    <template x-for="m in textModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                    </template>
                  </select>
                </label>
                <label class="flex flex-col gap-1 w-full">
                  <span class="text-xs sm:text-[11px] font-semibold opacity-70">Bild-Modell</span>
                  <select
                    class="select select-sm sm:select-xs select-bordered font-mono w-full text-sm sm:text-xs"
                    x-model="sessionImageModelIdDraft"
                  >
                    <option value="">(Standard)</option>
                    <template x-for="m in imageModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                    </template>
                  </select>
                </label>
              </div>
              <div
                x-show="activeSession && activeSession.variables && Object.keys(activeSession.variables).length > 0"
                class="flex flex-wrap items-center gap-1.5 text-xs sm:text-[11px]"
                style="display: none;"
              >
                <span class="font-semibold opacity-70">Variablen:</span>
                <template x-for="[vKey, vVal] in Object.entries(activeSession?.variables || {})" x-bind:key="vKey">
                  <span class="badge badge-sm sm:badge-xs badge-outline font-mono" x-text="'{{$' + vKey + '}} = ' + vVal" />
                </template>
              </div>
              <label class="flex flex-col gap-1 w-full">
                <span class="text-xs sm:text-[11px] font-semibold opacity-70">Aktueller Szenenzustand (Spielleiter-Notiz)</span>
                <textarea
                  rows={3}
                  class="textarea textarea-sm sm:textarea-xs textarea-bordered w-full text-base sm:text-xs"
                  x-model="sceneStateDraft"
                />
              </label>

              {/* Tasche / Gepäck */}
              <div class="flex flex-col gap-2 pt-2 border-t border-base-content/10">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs sm:text-[11px] font-semibold">🎒 Tasche / Gepäck</span>
                  <span class="text-[11px] sm:text-[10px] opacity-60">Wird vom Spielleiter &amp; dir gepflegt</span>
                </div>
                <div class="flex flex-wrap gap-1.5" x-show="activeSession && (activeSession.inventory || []).length > 0" style="display: none;">
                  <template x-for="item in (activeSession ? (activeSession.inventory || []) : [])" x-bind:key="item">
                    <span class="badge badge-md sm:badge-sm badge-outline gap-1.5 py-2.5 sm:py-2">
                      <span x-text="item" />
                      <button
                        type="button"
                        class="hover:text-error cursor-pointer font-bold"
                        title="Aus Tasche entfernen"
                        x-bind:data-item="item"
                        x-on:click="removeInventoryItem"
                      >
                        ×
                      </button>
                    </span>
                  </template>
                </div>
                <div x-show="!activeSession || !(activeSession.inventory || []).length" class="text-xs sm:text-[11px] opacity-50">
                  Tasche ist leer.
                </div>
                <form class="flex gap-2" x-on:submit="addInventoryItem">
                  <input
                    type="text"
                    class="input input-sm sm:input-xs input-bordered flex-1 text-base sm:text-xs"
                    placeholder="Gegenstand hinzufügen (z. B. Messingschlüssel)..."
                    x-model="newInventoryItem"
                  />
                  <button type="submit" class="btn btn-sm sm:btn-xs btn-outline">+</button>
                </form>
              </div>

              {/* Geheimer Spielleiter-Merkzettel */}
              <div class="flex flex-col gap-1.5 pt-2 border-t border-base-content/10">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs sm:text-[11px] font-semibold">🗝️ Spielleiter-Merkzettel (nur SL)</span>
                  <span class="text-[11px] sm:text-[10px] opacity-60">Charaktere sehen diese Notizen nicht</span>
                </div>
                <textarea
                  rows={2}
                  class="textarea textarea-sm sm:textarea-xs textarea-bordered w-full text-base sm:text-xs"
                  placeholder="Offene Plot-Fäden, versteckte Hinweise oder Pläne für später..."
                  x-model="gmNotesDraft"
                />
              </div>

              <div x-show="compressedSummaryDraft" class="flex flex-col gap-1.5 pt-2 border-t border-base-content/10" style="display: none;">
                <span class="text-xs sm:text-[11px] font-semibold opacity-70">Komprimierte Vorgeschichte (automatisch verdichtet)</span>
                <textarea
                  rows={2}
                  class="textarea textarea-sm sm:textarea-xs textarea-bordered w-full opacity-80 text-base sm:text-xs"
                  x-model="compressedSummaryDraft"
                />
              </div>

              <details
                class="pt-2 border-t border-base-content/10"
                x-on:toggle="if ($el.open) { loadSessionPromptPreview(); $nextTick(() => $el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })); }"
              >
                <summary class="text-xs sm:text-[11px] font-semibold opacity-80 cursor-pointer select-none hover:opacity-100 py-1">
                  🔍 Initialer Prompt, aufgelöste Makros &amp; Parameter anzeigen
                </summary>
                <div class="mt-2 flex flex-col gap-2 text-xs sm:text-[11px]">
                  <div class="flex flex-wrap gap-2 opacity-80">
                    <span>
                      <strong>Persona:</strong> <span x-text="activePersonaName" />
                    </span>
                    <span>·</span>
                    <span>
                      <strong>Spielleiter:</strong> <span x-text="activeGameMasterName" />
                    </span>
                    <span>·</span>
                    <span>
                      <strong>Ort:</strong> <span x-text="activeLocationName" />
                    </span>
                  </div>
                  <pre
                    class="whitespace-pre-wrap break-words font-mono text-xs sm:text-[11px] bg-base-300/60 border border-base-content/10 rounded-lg p-3 min-h-24 max-h-96 overflow-y-auto leading-relaxed text-base-content"
                    x-text="sessionPromptLoading ? 'Lade Prompt-Vorschau...' : (sessionPromptPreview || (activeSession ? activeSession.resolvedContext : '') || '(Kein Kontext vorhanden)')"
                  />
                </div>
              </details>
            </div>

            {/* Messages */}
            <div
              id="skald-thread"
              x-bind:class="showNotesPanel ? 'hidden sm:block' : ''"
              class="flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-2.5 py-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5 max-w-4xl w-full mx-auto"
            >
              <template x-for="msg in (activeSession ? activeSession.messages : [])" x-bind:key="msg.id">
                <div
                  class="group"
                  x-bind:data-msg-id="msg.id"
                  x-bind:class="isFreshMessage(msg.id) ? 'skald-msg-enter' : ''"
                  x-bind:style="freshMessageStyle(msg.id)"
                >
                  {/* User */}
                  <template x-if="msg.kind === 'user'">
                    <div class="chat chat-end">
                      <div x-show="msg.portraitFile" class="chat-image avatar" style="display: none;">
                        <div class="w-7 sm:w-9 rounded-full">
                          <img x-bind:src="msg.portraitFile ? './api/assets/' + msg.portraitFile : ''" />
                        </div>
                      </div>
                      <div class="chat-header text-xs opacity-70 mb-1 flex items-center gap-2">
                        <span x-text="msg.speakerName" />
                        <span class="inline-flex items-center gap-1 opacity-75 sm:opacity-35 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            x-bind:class="speakingMessageId === msg.id ? 'text-primary opacity-100' : ''"
                            x-bind:title="speakingMessageId === msg.id ? 'Vorlesen stoppen' : 'Nachricht vorlesen'"
                            x-on:click="toggleSpeakMessage(msg)"
                            x-text="speakingMessageId === msg.id ? '⏹' : '🔊'"
                          />
                          <button type="button" class="btn btn-ghost btn-xs px-1 min-h-0 h-5" title="Bearbeiten" x-on:click="startEditMessage(msg)">
                            ✎
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Nur diese Nachricht löschen"
                            x-on:click="deleteChatMessage(msg.id, false)"
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Diese und alle folgenden Nachrichten entfernen"
                            x-on:click="deleteChatMessage(msg.id, true)"
                          >
                            ✂
                          </button>
                        </span>
                      </div>
                      <template x-if="editingMessageId !== msg.id">
                        <div
                          class="chat-bubble chat-bubble-primary text-[15px] sm:text-sm leading-relaxed max-w-[90%] sm:max-w-[80%]"
                          x-html="formatChatText(msg.content)"
                        />
                      </template>
                      <template x-if="editingMessageId === msg.id">
                        <div class="w-full max-w-xl bg-base-200 border border-base-content/15 rounded-xl p-2.5 flex flex-col gap-2">
                          <textarea
                            rows={3}
                            class="textarea textarea-bordered w-full text-base sm:text-sm leading-snug"
                            x-model="editingMessageContent"
                          />
                          <div class="flex justify-end gap-1.5">
                            <button type="button" class="btn btn-xs btn-ghost" x-on:click="cancelEditMessage">Abbrechen</button>
                            <button type="button" class="btn btn-xs btn-primary" x-on:click="saveEditedMessage">Speichern</button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>

                  {/* Narrator / Game Master */}
                  <template x-if="msg.kind === 'narrator'">
                    <div class="my-2 px-3 sm:px-4 py-2.5 rounded-xl bg-base-200/80 border border-base-content/10 text-[15px] sm:text-sm leading-relaxed italic text-base-content/85">
                      <div class="flex items-center justify-between gap-2 mb-1 not-italic">
                        <span class="font-semibold text-primary text-xs sm:text-sm" x-text="msg.speakerName + ':'" />
                        <span class="inline-flex items-center gap-1 opacity-75 sm:opacity-35 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            x-bind:class="speakingMessageId === msg.id ? 'text-primary opacity-100' : ''"
                            x-bind:title="speakingMessageId === msg.id ? 'Vorlesen stoppen' : 'Nachricht vorlesen'"
                            x-on:click="toggleSpeakMessage(msg)"
                            x-text="speakingMessageId === msg.id ? '⏹' : '🔊'"
                          />
                          <button type="button" class="btn btn-ghost btn-xs px-1 min-h-0 h-5" title="Bearbeiten" x-on:click="startEditMessage(msg)">
                            ✎
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Nur diese Nachricht löschen"
                            x-on:click="deleteChatMessage(msg.id, false)"
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Diese und alle folgenden Nachrichten entfernen"
                            x-on:click="deleteChatMessage(msg.id, true)"
                          >
                            ✂
                          </button>
                        </span>
                      </div>
                      <template x-if="editingMessageId !== msg.id">
                        <div x-html="formatChatText(msg.content)" />
                      </template>
                      <template x-if="editingMessageId === msg.id">
                        <div class="not-italic flex flex-col gap-2 mt-1">
                          <textarea
                            rows={3}
                            class="textarea textarea-bordered w-full text-base sm:text-sm leading-snug"
                            x-model="editingMessageContent"
                          />
                          <div class="flex justify-end gap-1.5">
                            <button type="button" class="btn btn-xs btn-ghost" x-on:click="cancelEditMessage">Abbrechen</button>
                            <button type="button" class="btn btn-xs btn-primary" x-on:click="saveEditedMessage">Speichern</button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>

                  {/* Character */}
                  <template x-if="msg.kind === 'character'">
                    <div class="chat chat-start">
                      <div x-show="msg.portraitFile" class="chat-image avatar" style="display: none;">
                        <div class="w-7 sm:w-9 rounded-full">
                          <img x-bind:src="msg.portraitFile ? './api/assets/' + msg.portraitFile : ''" />
                        </div>
                      </div>
                      <div class="chat-header text-xs opacity-70 mb-1 flex items-center gap-2">
                        <span x-text="msg.speakerName" />
                        <span class="inline-flex items-center gap-1 opacity-75 sm:opacity-35 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            x-bind:class="speakingMessageId === msg.id ? 'text-primary opacity-100' : ''"
                            x-bind:title="speakingMessageId === msg.id ? 'Vorlesen stoppen' : 'Nachricht vorlesen'"
                            x-on:click="toggleSpeakMessage(msg)"
                            x-text="speakingMessageId === msg.id ? '⏹' : '🔊'"
                          />
                          <button type="button" class="btn btn-ghost btn-xs px-1 min-h-0 h-5" title="Bearbeiten" x-on:click="startEditMessage(msg)">
                            ✎
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Nur diese Nachricht löschen"
                            x-on:click="deleteChatMessage(msg.id, false)"
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Diese und alle folgenden Nachrichten entfernen"
                            x-on:click="deleteChatMessage(msg.id, true)"
                          >
                            ✂
                          </button>
                        </span>
                      </div>
                      <template x-if="editingMessageId !== msg.id">
                        <div
                          class="chat-bubble text-[15px] sm:text-sm leading-relaxed max-w-[90%] sm:max-w-[80%]"
                          x-html="formatChatText(msg.content)"
                        />
                      </template>
                      <template x-if="editingMessageId === msg.id">
                        <div class="w-full max-w-xl bg-base-200 border border-base-content/15 rounded-xl p-2.5 flex flex-col gap-2">
                          <textarea
                            rows={3}
                            class="textarea textarea-bordered w-full text-base sm:text-sm leading-snug"
                            x-model="editingMessageContent"
                          />
                          <div class="flex justify-end gap-1.5">
                            <button type="button" class="btn btn-xs btn-ghost" x-on:click="cancelEditMessage">Abbrechen</button>
                            <button type="button" class="btn btn-xs btn-primary" x-on:click="saveEditedMessage">Speichern</button>
                          </div>
                        </div>
                      </template>
                    </div>
                  </template>

                  {/* Scene Image */}
                  <template x-if="msg.kind === 'image'">
                    <div class="chat chat-start">
                      <div class="chat-header text-xs opacity-70 mb-1 flex items-center gap-2">
                        <span>Szenenbild</span>
                        <span class="inline-flex items-center gap-1 opacity-75 sm:opacity-35 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Bild-Nachricht löschen"
                            x-on:click="deleteChatMessage(msg.id, false)"
                          >
                            🗑
                          </button>
                          <button
                            type="button"
                            class="btn btn-ghost btn-xs px-1 min-h-0 h-5"
                            title="Diese und alle folgenden Nachrichten entfernen"
                            x-on:click="deleteChatMessage(msg.id, true)"
                          >
                            ✂
                          </button>
                        </span>
                      </div>
                      <div class="chat-bubble p-3 max-w-lg space-y-2">
                        <img
                          x-bind:src="'./api/assets/' + msg.imageFile"
                          class="rounded-lg w-full h-auto object-cover"
                        />
                        <p class="text-[11px] opacity-60 font-mono" x-text="msg.imagePrompt" />
                      </div>
                    </div>
                  </template>
                </div>
              </template>

              <div x-show="turnLoading" class="flex items-center gap-2 text-xs opacity-60 py-2" style="display: none;">
                <span class="loading loading-dots loading-sm" />
                <span>Spielleiter &amp; Charaktere reagieren...</span>
              </div>
            </div>

            {/* Input */}
            <form
              x-on:submit="sendTurn"
              x-bind:class="showNotesPanel ? 'hidden sm:block' : ''"
              class="shrink-0 p-2.5 sm:p-3 md:p-4 border-t border-base-content/10 bg-base-100"
            >
              <div class="max-w-4xl mx-auto flex items-end gap-2">
                <textarea
                  id="skald-chat-input"
                  rows={2}
                  class="textarea textarea-bordered flex-1 text-base sm:text-sm leading-snug min-h-[3.25rem] max-h-40 resize-none py-2 px-3"
                  placeholder="Was tust oder sagst du? (@Name spricht gezielt jemanden an)"
                  x-model="chatInput"
                  x-on:input="autoResizeChatInput"
                  x-on:keydown="handleChatKeydown"
                  x-bind:disabled="turnLoading"
                />
                <button type="submit" class="btn btn-primary btn-sm md:btn-md shrink-0" x-bind:disabled="turnLoading">
                  Senden
                </button>
              </div>
            </form>
          </section>
        </main>

        {/* RIGHT DRAWER: NEUTRALER WERKSTATT-CHAT */}
        <aside
          x-show="showWorkshop"
          class="fixed inset-0 md:static w-full md:w-96 bg-base-200 border-l border-base-content/10 flex flex-col z-50 md:z-30"
          style="display: none;"
        >
          <div class="px-4 py-3 border-b border-base-content/10 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-2">
              <div>
                <h3 class="font-bold text-sm">🧠 Werkstatt-Chat</h3>
                <p class="text-[11px] opacity-60">Neutraler Assistent für Charaktere, Orte &amp; Ideen</p>
              </div>
              <div class="flex items-center gap-1">
                <button type="button" class="btn btn-ghost btn-xs" x-on:click="clearWorkshop" title="Chat leeren">🗑</button>
                <button type="button" class="btn btn-ghost btn-xs" x-on:click="toggleWorkshop">✕</button>
              </div>
            </div>
            <select
              class="select select-xs select-bordered font-mono w-full bg-base-100"
              x-model="workshopModelId"
              aria-label="Werkstatt-Modell"
            >
              <template x-for="m in textModels" x-bind:key="m.id">
                <option x-bind:value="m.id" x-text="'Modell: ' + m.name + ' · ' + m.providerName" />
              </template>
            </select>
          </div>

          <div id="skald-workshop-thread" class="flex-1 overflow-y-auto p-3 space-y-3">
            <div x-show="workshopMessages.length === 0" class="text-xs opacity-60 text-center py-8 px-2">
              Entwirf hier gemeinsam mit der KI neue Charaktere, Charakterzüge, Orte oder Szenen-Ideen – links bleibt alles offen.
            </div>
            <template x-for="(wm, widx) in workshopMessages" x-bind:key="widx">
              <div class="chat" x-bind:class="wm.role === 'user' ? 'chat-end' : 'chat-start'">
                <div class="chat-header text-[11px] opacity-60 mb-0.5" x-text="wm.role === 'user' ? 'Du' : 'Werkstatt'" />
                <div
                  class="chat-bubble text-xs sm:text-sm leading-relaxed"
                  x-bind:class="wm.role === 'user' ? 'chat-bubble-primary' : ''"
                  x-html="formatChatText(wm.content)"
                />
                <div
                  x-show="wm.toolsUsed && wm.toolsUsed.length > 0"
                  class="chat-footer flex flex-wrap gap-1 mt-1"
                  style="display: none;"
                >
                  <template x-for="toolName in (wm.toolsUsed || [])" x-bind:key="toolName">
                    <span class="badge badge-xs badge-outline font-mono opacity-75" x-text="toolName" />
                  </template>
                </div>
              </div>
            </template>
            <div x-show="workshopLoading" class="flex items-center gap-2 text-xs opacity-60" style="display: none;">
              <span class="loading loading-dots loading-xs" />
              <span>Schreibt...</span>
            </div>
          </div>

          <form x-on:submit="sendWorkshop" class="p-3 border-t border-base-content/10 flex gap-2">
            <input
              type="text"
              class="input input-bordered input-sm flex-1"
              placeholder="Idee, Charakterzug, Ort..."
              x-model="workshopInput"
              x-bind:disabled="workshopLoading"
            />
            <button type="submit" class="btn btn-primary btn-sm" x-bind:disabled="workshopLoading">Senden</button>
          </form>
        </aside>

        {/* HELP MODAL: SCHREIBKONVENTIONEN & MAKROSYNTAX */}
        <div
          x-show="showHelpModal"
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          style="display: none;"
        >
          <div class="card bg-base-200 border border-base-content/15 max-w-xl w-full shadow-2xl">
            <div class="card-body gap-4">
              <div class="flex justify-between items-center border-b border-base-content/10 pb-2">
                <h3 class="font-bold text-base">Kurzanleitung &amp; Makrosyntax</h3>
                <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeHelpModal">✕</button>
              </div>

              <div class="space-y-3 text-xs sm:text-sm">
                <div>
                  <h4 class="font-semibold text-primary mb-1">Schreibkonventionen im Gruppenchat</h4>
                  <ul class="space-y-1 text-base-content/85 list-disc list-inside">
                    <li>
                      <code class="font-mono bg-base-300 px-1 rounded">*Handlung oder Geste*</code> – beschreibt Körpersprache oder Aktionen (z. B.
                      {" "}
                      <span class="italic">*stellt die Tasse ab*</span>)
                    </li>
                    <li>
                      <code class="font-mono bg-base-300 px-1 rounded">&quot;Wörtliche Rede&quot;</code> – direkte Dialoge
                    </li>
                    <li>
                      <code class="font-mono bg-base-300 px-1 rounded">(Gedanke)</code>{" "}
                      – stille, unausgesprochene Gedanken (andere Charaktere hören sie nicht)
                    </li>
                    <li>
                      <code class="font-mono bg-base-300 px-1 rounded">[Regieanweisung]</code> – OOC-Hinweis direkt an den Spielleiter (z. B.{" "}
                      <span class="font-mono">[Zeitsprung zum nächsten Morgen]</span> oder <span class="font-mono">[Es klopft an der Tür]</span>)
                    </li>
                    <li>
                      <code class="font-mono bg-base-300 px-1 rounded">@Name</code>{" "}
                      – spricht gezielt einen anwesenden Charakter an (oder Charakter-Badge oben anklicken)
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 class="font-semibold text-primary mb-1">Makrosyntax (in Nachrichten, Orten &amp; Charakteren)</h4>
                  <ul class="space-y-1 text-base-content/85 list-disc list-inside font-mono text-xs">
                    <li>
                      <span class="bg-base-300 px-1 rounded">{"{{random:Kaffee, Tee, Wasser}}"}</span> /{" "}
                      <span class="bg-base-300 px-1 rounded">{"{{random_of:A|B|C}}"}</span> – wählt zufällig einen Eintrag
                    </li>
                    <li>
                      <span class="bg-base-300 px-1 rounded">{"{{roll:1d10}}"}</span>,{" "}
                      <span class="bg-base-300 px-1 rounded">{"{{roll:2d20}}"}</span>,{" "}
                      <span class="bg-base-300 px-1 rounded">{"{{roll:2d6+3}}"}</span> – würfelt RPG-Würfel
                    </li>
                    <li>
                      <span class="bg-base-300 px-1 rounded">{"{{rand:1-100}}"}</span> – Zufallszahl von–bis
                    </li>
                    <li>
                      <span class="bg-base-300 px-1 rounded">{"{{time}}"}</span>, <span class="bg-base-300 px-1 rounded">{"{{date}}"}</span>,{" "}
                      <span class="bg-base-300 px-1 rounded">{"{{timestamp}}"}</span> – Uhrzeit / Datum / Zeitstempel
                    </li>
                  </ul>
                </div>
              </div>

              <div class="card-actions justify-end pt-1">
                <button type="button" class="btn btn-xs btn-primary" x-on:click="closeHelpModal">Verstanden</button>
              </div>
            </div>
          </div>
        </div>

        {/* CHAT START LOADING OVERLAY */}
        <div
          x-show="creatingSession || sceneStartLoading"
          class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          style="display: none;"
        >
          <div class="card bg-base-200 border border-base-content/15 shadow-2xl max-w-sm w-full">
            <div class="card-body items-center text-center gap-3 py-6">
              <span class="loading loading-spinner loading-lg text-primary" />
              <h3 class="font-bold text-base">Szene wird eröffnet…</h3>
              <p class="text-xs opacity-70">
                Ort, Charaktere und Spielleiter bereiten den Einstieg vor.
              </p>
            </div>
          </div>
        </div>

        {/* LOCATION MEDIA MODAL (MAP & SCENE IMAGE) */}
        <div
          x-show="showLocationMediaModal && activeLocation"
          x-on:click="if ($event.target === $event.currentTarget) closeLocationMediaModal()"
          class="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          style="display: none;"
        >
          <div class="card bg-base-200 border border-base-content/15 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div class="card-body gap-3">
              <div class="flex flex-wrap justify-between items-center gap-2 border-b border-base-content/10 pb-2">
                <div class="flex items-center gap-2">
                  <h3 class="font-bold text-base" x-text="activeLocation ? activeLocation.name : ''" />
                  <div class="join">
                    <button
                      x-show="activeLocation && activeLocation.mapFile"
                      type="button"
                      class="btn btn-xs join-item"
                      x-bind:class="locationMediaTab === 'map' ? 'btn-primary' : 'btn-ghost'"
                      x-on:click="locationMediaTab = 'map'"
                      style="display: none;"
                    >
                      🗺 Karte
                    </button>
                    <button
                      x-show="activeLocation && activeLocation.imageFile"
                      type="button"
                      class="btn btn-xs join-item"
                      x-bind:class="locationMediaTab === 'image' ? 'btn-primary' : 'btn-ghost'"
                      x-on:click="locationMediaTab = 'image'"
                      style="display: none;"
                    >
                      🖼 Ortsbild
                    </button>
                  </div>
                </div>
                <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeLocationMediaModal">✕</button>
              </div>

              <div class="rounded-xl overflow-hidden border border-base-content/10 bg-base-300/40">
                <img
                  x-show="locationMediaTab === 'map' && activeLocation && activeLocation.mapFile"
                  x-bind:src="activeLocation && activeLocation.mapFile ? './api/assets/' + activeLocation.mapFile : ''"
                  class="w-full h-auto max-h-[65vh] object-contain mx-auto"
                  style="display: none;"
                />
                <img
                  x-show="locationMediaTab === 'image' && activeLocation && activeLocation.imageFile"
                  x-bind:src="activeLocation && activeLocation.imageFile ? './api/assets/' + activeLocation.imageFile : ''"
                  class="w-full h-auto max-h-[65vh] object-contain mx-auto"
                  style="display: none;"
                />
              </div>

              <p
                x-show="activeLocation && (locationMediaTab === 'map' ? activeLocation.mapPrompt : activeLocation.description)"
                class="text-xs opacity-75 leading-relaxed"
                x-text="activeLocation ? (locationMediaTab === 'map' ? (activeLocation.mapPrompt || activeLocation.description) : activeLocation.description) : ''"
                style="display: none;"
              />
            </div>
          </div>
        </div>

        {/* CLONE SESSION MODAL */}
        <div
          x-show="showCloneModal"
          class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          style="display: none;"
        >
          <form
            x-on:submit="submitCloneSession"
            class="card bg-base-200 border border-base-content/15 max-w-md w-full shadow-2xl"
          >
            <div class="card-body gap-4">
              <div class="flex justify-between items-center border-b border-base-content/10 pb-2">
                <h3 class="font-bold text-base">Szene klonen</h3>
                <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeCloneModal">✕</button>
              </div>

              <label class="flex flex-col gap-1 w-full">
                <span class="label-text text-xs mb-1">Neuer Szenen-Name</span>
                <input
                  type="text"
                  class="input input-sm input-bordered w-full"
                  x-model="cloneForm.title"
                  required
                />
              </label>

              <label class="label cursor-pointer justify-start gap-2.5">
                <input type="checkbox" class="checkbox checkbox-xs checkbox-primary" x-model="cloneForm.includeHistory" />
                <span class="label-text text-xs">
                  Chat-Verlauf mitkopieren <span class="opacity-60">(aus = nur Startbedingungen, frisch starten)</span>
                </span>
              </label>

              <div class="card-actions justify-end gap-2 pt-1">
                <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeCloneModal">Abbrechen</button>
                <button type="submit" class="btn btn-xs btn-primary" x-bind:disabled="cloneLoading">
                  <span x-show="cloneLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                  <span>Klonen</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
