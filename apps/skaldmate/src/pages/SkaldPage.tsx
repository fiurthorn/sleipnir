/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { LOGO_WORDMARK, LOGO_WORDMARK_LIGHT, ThemeToggle } from "@sleipnir/core";

export const SkaldPage = () => {
  return (
    <div x-data="skaldmate" class="flex h-screen overflow-hidden bg-base-100">
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

        {/* Navigation Tabs */}
        <div class="grid grid-cols-5 gap-1 p-2 border-b border-base-content/10 text-[11px]">
          <button
            type="button"
            class="btn btn-xs"
            x-bind:class="sidebarTab === 'sessions' ? 'btn-primary' : 'btn-ghost'"
            x-on:click="setTabSessions"
          >
            Szenen
          </button>
          <button
            type="button"
            class="btn btn-xs"
            x-bind:class="sidebarTab === 'characters' ? 'btn-primary' : 'btn-ghost'"
            x-on:click="setTabCharacters"
          >
            NPCs
          </button>
          <button
            type="button"
            class="btn btn-xs"
            x-bind:class="sidebarTab === 'personas' ? 'btn-primary' : 'btn-ghost'"
            x-on:click="setTabPersonas"
          >
            Ich
          </button>
          <button
            type="button"
            class="btn btn-xs"
            x-bind:class="sidebarTab === 'locations' ? 'btn-primary' : 'btn-ghost'"
            x-on:click="setTabLocations"
          >
            Orte
          </button>
          <button
            type="button"
            class="btn btn-xs"
            x-bind:class="sidebarTab === 'gamemasters' ? 'btn-primary' : 'btn-ghost'"
            x-on:click="setTabGameMasters"
          >
            Leiter
          </button>
        </div>

        {/* Sidebar Content */}
        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          {/* TAB: SZENEN */}
          <div x-show="sidebarTab === 'sessions'" class="space-y-2">
            <button
              type="button"
              class="btn btn-primary btn-sm w-full"
              x-on:click="openNewSession"
            >
              + Neue Szene zusammenklicken
            </button>
            <template x-for="s in sessions" x-bind:key="s.id">
              <div
                class="group flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition"
                x-bind:class="activeSession && activeSession.id === s.id ? 'bg-primary text-primary-content font-medium' : 'hover:bg-base-300'"
                x-bind:data-id="s.id"
                x-on:click="selectSession"
              >
                <span class="truncate" x-text="s.title" />
                <button
                  type="button"
                  class="opacity-0 group-hover:opacity-100 hover:text-error px-1 text-xs"
                  x-bind:data-id="s.id"
                  x-on:click="deleteSessionItem"
                >
                  ✕
                </button>
              </div>
            </template>
          </div>

          {/* TAB: NPCs */}
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
                <span class="text-[10px] opacity-60 truncate" x-text="c.role" />
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
                class="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                x-bind:data-id="p.id"
                x-on:click="editPersonaItem"
              >
                <span class="truncate" x-text="p.name" />
                <span class="text-[10px] opacity-60 truncate" x-text="p.role" />
              </div>
            </template>
          </div>

          {/* TAB: ORTE */}
          <div x-show="sidebarTab === 'locations'" class="space-y-2" style="display: none;">
            <button type="button" class="btn btn-outline btn-xs w-full" x-on:click="newLocationForm">
              + Neuer Ort
            </button>
            <template x-for="l in locations" x-bind:key="l.id">
              <div
                class="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-base-300 cursor-pointer text-sm"
                x-bind:data-id="l.id"
                x-on:click="editLocationItem"
              >
                <span class="truncate" x-text="'📍 ' + l.name" />
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
      <main class="flex-1 flex flex-col overflow-hidden bg-base-100">
        {/* Top Bar */}
        <header class="navbar bg-base-100 border-b border-base-content/10 px-4 py-2 min-h-12 flex justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <button
              type="button"
              class="btn btn-ghost btn-xs btn-square md:hidden"
              x-on:click="openMobileMenu"
            >
              ☰
            </button>
            <span
              class="font-bold text-sm md:text-base truncate"
              x-text="activeSession ? activeSession.title : 'Skaldmate'"
            />
            <span
              x-show="activeSession"
              class="badge badge-sm badge-outline font-mono hidden sm:inline-flex"
              x-text="'📍 ' + activeLocationName"
              style="display: none;"
            />
          </div>

          <div x-show="activeSession" class="flex items-center gap-1.5" style="display: none;">
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
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              x-on:click="toggleNotesPanel"
            >
              📝 Zustand
            </button>
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
                    <h2 class="font-bold text-lg">Charakter (NPC)</h2>
                    <button
                      x-show="charForm.id"
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
                    <img
                      x-bind:src="charForm.portraitFile ? './api/assets/' + charForm.portraitFile : ''"
                      class="w-20 h-20 rounded-xl object-cover border border-base-content/15"
                    />
                  </div>
                  <input type="text" placeholder="Name" class="input input-sm input-bordered" x-model="charForm.name" required />
                  <input
                    type="text"
                    placeholder="Rolle (z. B. Nachbarin, Detektiv, Waldläufer)"
                    class="input input-sm input-bordered"
                    x-model="charForm.role"
                  />
                  <textarea rows={2} placeholder="Aussehen" class="textarea textarea-sm textarea-bordered" x-model="charForm.appearance" />
                  <textarea
                    rows={2}
                    placeholder="Charakterzüge & Persönlichkeit"
                    class="textarea textarea-sm textarea-bordered"
                    x-model="charForm.personality"
                  />
                  <textarea rows={2} placeholder="Ziele & Motivation" class="textarea textarea-sm textarea-bordered" x-model="charForm.goals" />
                  <input
                    type="text"
                    placeholder="Sprechstil (z. B. direkt, sarkastisch, ruhig)"
                    class="input input-sm input-bordered"
                    x-model="charForm.speechStyle"
                  />
                  <select class="select select-sm select-bordered font-mono text-xs" x-model="charForm.modelId">
                    <option value="">(Szenen-Standardmodell verwenden)</option>
                    <template x-for="m in textModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                    </template>
                  </select>
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
                  <h2 class="font-bold text-lg">Meine Persona</h2>
                  <input
                    type="text"
                    placeholder="Dein Name in der Geschichte"
                    class="input input-sm input-bordered"
                    x-model="personaForm.name"
                    required
                  />
                  <input type="text" placeholder="Rolle" class="input input-sm input-bordered" x-model="personaForm.role" />
                  <textarea rows={2} placeholder="Aussehen" class="textarea textarea-sm textarea-bordered" x-model="personaForm.appearance" />
                  <textarea rows={2} placeholder="Eigenschaften" class="textarea textarea-sm textarea-bordered" x-model="personaForm.traits" />
                  <textarea rows={2} placeholder="Hintergrund" class="textarea textarea-sm textarea-bordered" x-model="personaForm.background" />
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
                  <h2 class="font-bold text-lg">Ort / Location</h2>
                  <input
                    type="text"
                    placeholder="Ortsname (z. B. Wohnung, Stadt, Wald)"
                    class="input input-sm input-bordered"
                    x-model="locationForm.name"
                    required
                  />
                  <textarea
                    rows={3}
                    placeholder="Beschreibung des Ortes"
                    class="textarea textarea-sm textarea-bordered"
                    x-model="locationForm.description"
                  />
                  <input type="text" placeholder="Atmosphäre / Stimmung" class="input input-sm input-bordered" x-model="locationForm.atmosphere" />
                  <textarea
                    rows={2}
                    placeholder="Wichtige Details / Objekte"
                    class="textarea textarea-sm textarea-bordered"
                    x-model="locationForm.details"
                  />
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
                  <input type="text" placeholder="Name (z. B. Der Chronist)" class="input input-sm input-bordered" x-model="gmForm.name" required />
                  <input
                    type="text"
                    placeholder="Stil (z. B. neutral, noir, spannend)"
                    class="input input-sm input-bordered"
                    x-model="gmForm.style"
                  />
                  <textarea
                    rows={4}
                    placeholder="Regie-Anweisung / System-Prompt"
                    class="textarea textarea-sm textarea-bordered"
                    x-model="gmForm.systemPrompt"
                  />
                  <select class="select select-sm select-bordered font-mono text-xs" x-model="gmForm.modelId">
                    <option value="">(Szenen-Standardmodell verwenden)</option>
                    <template x-for="m in textModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
                    </template>
                  </select>
                  <div class="flex justify-end gap-2 pt-2">
                    <button x-show="gmForm.id" type="button" class="btn btn-xs btn-error btn-outline mr-auto" x-on:click="deleteGmForm">
                      Löschen
                    </button>
                    <button type="button" class="btn btn-xs btn-ghost" x-on:click="closeEditor">Abbrechen</button>
                    <button type="submit" class="btn btn-xs btn-primary">Speichern</button>
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

              <label class="form-control">
                <span class="label-text text-xs mb-1">Szenen-Titel</span>
                <input
                  type="text"
                  class="input input-sm input-bordered"
                  placeholder="z. B. Abend in der Wohnung"
                  x-model="newSessionForm.title"
                  required
                />
              </label>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label class="form-control">
                  <span class="label-text text-xs mb-1">Ort / Location</span>
                  <select class="select select-sm select-bordered" x-model="newSessionForm.locationId" required>
                    <template x-for="l in locations" x-bind:key="l.id">
                      <option x-bind:value="l.id" x-text="l.name" />
                    </template>
                  </select>
                </label>

                <label class="form-control">
                  <span class="label-text text-xs mb-1">Meine Persona</span>
                  <select class="select select-sm select-bordered" x-model="newSessionForm.personaId">
                    <option value="">(Ohne feste Persona / Du)</option>
                    <template x-for="p in personas" x-bind:key="p.id">
                      <option x-bind:value="p.id" x-text="p.name" />
                    </template>
                  </select>
                </label>
              </div>

              <div>
                <span class="label-text text-xs block mb-2">Anwesende Charaktere (NPCs)</span>
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
                    Lege links unter „NPCs“ zuerst Charaktere an.
                  </span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label class="form-control">
                  <span class="label-text text-xs mb-1">Spielleiter</span>
                  <select class="select select-sm select-bordered" x-model="newSessionForm.gameMasterId">
                    <template x-for="g in gameMasters" x-bind:key="g.id">
                      <option x-bind:value="g.id" x-text="g.name" />
                    </template>
                  </select>
                </label>

                <label class="form-control">
                  <span class="label-text text-xs mb-1">Text-Modell</span>
                  <select class="select select-sm select-bordered font-mono text-xs" x-model="newSessionForm.modelId">
                    <template x-for="m in textModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name" />
                    </template>
                  </select>
                </label>

                <label class="form-control">
                  <span class="label-text text-xs mb-1">Bild-Modell</span>
                  <select class="select select-sm select-bordered font-mono text-xs" x-model="newSessionForm.imageModelId">
                    <template x-for="m in imageModels" x-bind:key="m.id">
                      <option x-bind:value="m.id" x-text="m.name" />
                    </template>
                  </select>
                </label>
              </div>

              <div class="card-actions justify-end pt-2">
                <button type="submit" class="btn btn-primary btn-sm">Szene starten</button>
              </div>
            </div>
          </form>
        </section>

        {/* VIEW C: ACTIVE GROUP CHAT */}
        <section x-show="viewMode === 'chat'" class="flex-1 flex flex-col overflow-hidden" style="display: none;">
          {/* Active Cast Bar (click character to nudge reply) */}
          <div class="px-4 py-2 bg-base-200/60 border-b border-base-content/10 flex flex-wrap items-center gap-2 text-xs">
            <span class="opacity-60">In der Szene:</span>
            <template x-for="c in activeCast" x-bind:key="c.id">
              <button
                type="button"
                class="badge badge-sm badge-outline hover:badge-primary cursor-pointer gap-1.5 py-2.5"
                x-bind:data-id="c.id"
                x-on:click="nudgeCharacter"
                title="Klicken, um diesen Charakter direkt antworten zu lassen"
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
          </div>

          {/* Optional Scene State Drawer */}
          <div x-show="showNotesPanel" class="px-4 py-3 bg-base-200 border-b border-base-content/10 flex flex-col gap-2" style="display: none;">
            <div class="flex justify-between items-center text-xs">
              <span class="font-semibold">Aktueller Szenenzustand (Spielleiter-Notiz)</span>
              <button type="button" class="btn btn-xs btn-primary" x-on:click="saveSceneState">Speichern</button>
            </div>
            <textarea rows={2} class="textarea textarea-xs textarea-bordered w-full" x-model="sceneStateDraft" />
          </div>

          {/* Messages */}
          <div id="skald-thread" class="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 max-w-4xl w-full mx-auto">
            <template x-for="msg in (activeSession ? activeSession.messages : [])" x-bind:key="msg.id">
              <div>
                {/* User */}
                <template x-if="msg.kind === 'user'">
                  <div class="chat chat-end">
                    <div class="chat-header text-xs opacity-60 mb-1" x-text="msg.speakerName" />
                    <div class="chat-bubble chat-bubble-primary text-sm whitespace-pre-wrap leading-relaxed" x-text="msg.content" />
                  </div>
                </template>

                {/* Narrator / Game Master */}
                <template x-if="msg.kind === 'narrator'">
                  <div class="my-2 px-4 py-2.5 rounded-xl bg-base-200/80 border border-base-content/10 text-xs sm:text-sm italic text-base-content/85">
                    <span class="font-semibold not-italic text-primary mr-1.5" x-text="msg.speakerName + ':'" />
                    <span class="whitespace-pre-wrap" x-text="msg.content" />
                  </div>
                </template>

                {/* Character */}
                <template x-if="msg.kind === 'character'">
                  <div class="chat chat-start">
                    <div x-show="msg.portraitFile" class="chat-image avatar" style="display: none;">
                      <div class="w-9 rounded-full">
                        <img x-bind:src="msg.portraitFile ? './api/assets/' + msg.portraitFile : ''" />
                      </div>
                    </div>
                    <div class="chat-header text-xs opacity-60 mb-1" x-text="msg.speakerName" />
                    <div class="chat-bubble text-sm whitespace-pre-wrap leading-relaxed" x-text="msg.content" />
                  </div>
                </template>

                {/* Scene Image */}
                <template x-if="msg.kind === 'image'">
                  <div class="chat chat-start">
                    <div class="chat-header text-xs opacity-60 mb-1">Szenenbild</div>
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
          <form x-on:submit="sendTurn" class="p-3 md:p-4 border-t border-base-content/10 bg-base-100">
            <div class="max-w-4xl mx-auto flex gap-2">
              <input
                type="text"
                class="input input-bordered input-sm md:input-md flex-1"
                placeholder="Was tust oder sagst du? (@Name spricht gezielt jemanden an)"
                x-model="chatInput"
                x-bind:disabled="turnLoading"
              />
              <button type="submit" class="btn btn-primary btn-sm md:btn-md" x-bind:disabled="turnLoading">
                Senden
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};
