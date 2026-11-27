/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { LOGO_WORDMARK, LOGO_WORDMARK_LIGHT, MateSwitcher } from "@sleipnir/core";

export const AgentPage = () => {
  return (
    <>
      <MateSwitcher current="agent" />
      <div x-data="agentmate" class="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 flex-1">
        <header class="flex flex-wrap justify-between items-center gap-4 border-b border-base-content/15 pb-4">
          <div class="flex items-center gap-3">
            <img
              src={LOGO_WORDMARK}
              alt="fiurthorn"
              class="h-8 w-auto"
              x-show="$store.theme.mode === 'dark'"
              style="display: none;"
            />
            <img
              src={LOGO_WORDMARK_LIGHT}
              alt="fiurthorn"
              class="h-8 w-auto"
              x-show="$store.theme.mode !== 'dark'"
            />
            <span class="badge badge-primary badge-outline font-mono text-xs">Agentmate</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <template x-for="srv in mcpServers" x-bind:key="srv.id">
              <span
                class="badge badge-sm font-mono gap-1.5"
                x-bind:class="srv.connected ? 'badge-success badge-outline' : 'badge-error badge-outline'"
                x-text="srv.name + (srv.connected ? ' (' + srv.toolCount + ')' : ' (offline)')"
              />
            </template>

            <select
              class="select select-sm select-bordered bg-base-100 font-mono text-xs"
              x-model="selectedModel"
              aria-label="Modell auswählen"
            >
              <template x-for="m in models" x-bind:key="m.id">
                <option x-bind:value="m.id" x-text="m.name + ' · ' + m.providerName" />
              </template>
            </select>

            <button
              type="button"
              class="btn btn-sm btn-ghost"
              x-on:click="refreshConfig"
              title="MCP-Status aktualisieren"
            >
              ↻
            </button>

            <button
              type="button"
              class="btn btn-sm btn-ghost"
              x-on:click="$store.theme.toggle()"
              x-text="$store.theme.mode === 'dark' ? '☀️ Light' : '🌙 Dark'"
            />
          </div>
        </header>

        <div role="tablist" class="tabs tabs-boxed bg-base-200 self-start">
          <button
            type="button"
            role="tab"
            class="tab gap-1.5"
            x-bind:class="tab === 'triage' ? 'tab-active' : ''"
            x-on:click="setTabTriage"
          >
            <span>Beleg-Triage (ScanMate)</span>
            <span
              x-show="pendingQueue && pendingQueue.available"
              class="badge badge-xs font-mono"
              x-bind:class="pendingQueue && pendingQueue.count > 0 ? 'badge-warning' : 'badge-ghost'"
              x-text="pendingQueue ? pendingQueue.count : 0"
              style="display: none;"
            />
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            x-bind:class="tab === 'chat' ? 'tab-active' : ''"
            x-on:click="setTabChat"
          >
            Assistent (MCP-Chat)
          </button>
        </div>

        {/* TAB 1: BELEG-TRIAGE (CRON + MANUELL) */}
        <section x-show="tab === 'triage'" class="flex flex-col gap-4">
          <div class="card bg-base-100 border border-base-content/10 shadow-sm">
            <div class="card-body flex-row flex-wrap items-center justify-between gap-4 py-4">
              <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="card-title text-base">Automatische Beleg-Triage</h2>
                  <span class="badge badge-ghost badge-sm font-mono" x-text="'Cron: ' + cronSchedule" />
                  <span
                    class="badge badge-sm font-mono"
                    x-bind:class="!pendingQueue || !pendingQueue.available ? 'badge-error badge-outline' : (pendingQueue.count > 0 ? 'badge-warning' : 'badge-success badge-outline')"
                    x-text="!pendingQueue || !pendingQueue.available ? 'Queue: offline' : ('Queue: ' + pendingQueue.count + (pendingQueue.count === 1 ? ' Dokument' : ' Dokumente'))"
                  />
                </div>
                <p class="text-xs text-base-content/70">
                  Läuft automatisch per Deno.cron und archiviert offene Scans nach ScanMate (Status „Zu prüfen“).
                </p>
              </div>
              <button
                type="button"
                class="btn btn-primary btn-sm"
                x-bind:disabled="triageLoading"
                x-on:click="runTriageNow"
              >
                <span x-show="triageLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                <span>Triage jetzt ausführen</span>
              </button>
            </div>
          </div>

          <div class="card bg-base-100 border border-base-content/10 shadow-sm">
            <div class="card-body flex-row flex-wrap items-center justify-between gap-4 py-4">
              <div class="flex flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="card-title text-base">Gmail-Label importieren</h2>
                  <span
                    class="badge badge-sm font-mono"
                    x-bind:class="googleClientId ? 'badge-info badge-outline' : 'badge-ghost'"
                    x-text="googleClientId ? (gmailAccessToken ? 'Google: verbunden' : 'Google: bereit') : 'GOOGLE_CLIENT_ID fehlt'"
                  />
                </div>
                <p class="text-xs text-base-content/70">
                  Holt alle E-Mails mit dem angegebenen Gmail-Label, schiebt echte Anhänge (ohne Inline-Bilder) nach ScanMate und entfernt das Label
                  nach Erfolg.
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  class="input input-bordered input-sm w-40 font-mono text-xs"
                  placeholder="Label (z. B. ScanMate)"
                  x-model="gmailLabel"
                  x-bind:disabled="gmailLoading"
                />
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  x-bind:disabled="gmailLoading || !googleClientId"
                  x-on:click="importFromGmail"
                >
                  <span x-show="gmailLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                  <span>Aus Gmail holen &amp; archivieren</span>
                </button>
              </div>
            </div>
          </div>

          <div x-show="triageError" class="alert alert-error text-sm" style="display: none;">
            <span x-text="triageError" />
          </div>

          <div x-show="triageNotice" class="alert alert-info text-sm" style="display: none;">
            <span x-text="triageNotice" />
          </div>

          <div
            x-show="pendingQueue && pendingQueue.items && pendingQueue.items.length > 0"
            class="card bg-base-100 border border-base-content/10 shadow-sm"
            style="display: none;"
          >
            <div class="card-body gap-2.5 py-4">
              <div class="flex flex-wrap justify-between items-center gap-2 border-b border-base-content/10 pb-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
                  In der Agent-Queue wartend
                </span>
                <span
                  class="badge badge-warning badge-sm font-mono"
                  x-text="pendingQueue.count + (pendingQueue.count === 1 ? ' Dokument' : ' Dokumente')"
                />
              </div>
              <div class="flex flex-col gap-1.5">
                <template x-for="qitem in (pendingQueue ? pendingQueue.items : [])" x-bind:key="qitem.id">
                  <div class="flex flex-wrap justify-between items-center gap-2 px-3 py-2 rounded-lg bg-base-200/60 border border-base-content/10 text-xs">
                    <span class="font-medium" x-text="qitem.label || qitem.id" />
                    <span class="font-mono text-base-content/60" x-text="qitem.pageCount + ' Seite(n) · ' + qitem.createdAt" />
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div x-show="lastTriageRun" class="card bg-base-100 border border-base-content/10 shadow-sm" style="display: none;">
            <div class="card-body gap-3 py-4">
              <div class="flex flex-wrap justify-between items-center gap-2 border-b border-base-content/10 pb-2">
                <span class="text-xs font-semibold uppercase tracking-wider text-base-content/70">
                  Letzter Lauf
                </span>
                <span
                  class="font-mono text-xs text-base-content/60"
                  x-text="lastTriageRun ? (lastTriageRun.ranAt + ' · ' + lastTriageRun.source + ' · ' + lastTriageRun.count + ' Beleg(e)') : ''"
                />
              </div>

              <div class="flex flex-col gap-2">
                <template x-for="item in (lastTriageRun ? lastTriageRun.items : [])" x-bind:key="item.pendingId">
                  <div class="flex flex-wrap justify-between items-center gap-2 p-2.5 rounded-lg bg-base-200/60 border border-base-content/10">
                    <div class="flex flex-col gap-0.5">
                      <span class="font-semibold text-sm" x-text="item.title" />
                      <span
                        class="font-mono text-xs text-base-content/60"
                        x-text="'📁 ' + item.targetPath + (item.sender ? ' · ' + item.sender : '')"
                      />
                      <span x-show="item.error" class="text-xs text-error" x-text="item.error" style="display: none;" />
                    </div>
                    <span
                      class="badge badge-sm"
                      x-bind:class="item.archived ? 'badge-success badge-outline' : 'badge-error badge-outline'"
                      x-text="item.archived ? 'Archiviert (Zu prüfen)' : 'Fehler'"
                    />
                  </div>
                </template>
              </div>
            </div>
          </div>
        </section>

        {/* TAB 2: ASSISTENT CHAT */}
        <section x-show="tab === 'chat'" class="flex flex-col gap-4 flex-1" style="display: none;">
          <div class="card bg-base-100 border border-base-content/10 shadow-sm flex-1 flex flex-col min-h-[420px]">
            <div class="card-body flex-1 flex flex-col gap-3 overflow-y-auto max-h-[60vh]">
              <div x-show="chatMessages.length === 0" class="text-sm text-base-content/60 my-auto text-center py-8">
                Frag mich etwas zu deinen Belegen in ScanMate oder deinen Notizen &amp; Kanban-Boards in NoteMate.
              </div>

              <template x-for="(msg, idx) in chatMessages" x-bind:key="idx">
                <div class="chat" x-bind:class="msg.role === 'user' ? 'chat-end' : 'chat-start'">
                  <div class="chat-header text-xs opacity-60 mb-1" x-text="msg.role === 'user' ? 'Du' : 'Agentmate'" />
                  <div
                    class="chat-bubble text-sm whitespace-pre-wrap"
                    x-bind:class="msg.role === 'user' ? 'chat-bubble-primary' : ''"
                    x-text="msg.content"
                  />
                  <div
                    x-show="msg.toolsUsed && msg.toolsUsed.length > 0"
                    class="chat-footer text-[11px] opacity-60 mt-1 font-mono"
                    x-text="msg.toolsUsed ? 'Tools: ' + msg.toolsUsed.join(', ') : ''"
                    style="display: none;"
                  />
                </div>
              </template>
            </div>

            <form x-on:submit="sendChat" class="p-3 border-t border-base-content/10 flex gap-2">
              <input
                type="text"
                class="input input-bordered input-sm flex-1"
                placeholder="Nachricht an Agentmate (mit ScanMate & NoteMate MCP)..."
                x-model="chatInput"
                x-bind:disabled="chatLoading"
              />
              <button type="submit" class="btn btn-primary btn-sm" x-bind:disabled="chatLoading">
                <span x-show="chatLoading" class="loading loading-spinner loading-xs" style="display: none;" />
                <span>Senden</span>
              </button>
            </form>
          </div>
        </section>
      </div>
    </>
  );
};
