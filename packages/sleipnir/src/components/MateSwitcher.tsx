/**
 * @project Sleipnir Stack / Components
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { HtmlEscapedString } from "hono/utils/html";

export type MateAppId = "chat" | "notes" | "scan" | "agent";

interface MateEntry {
  id: MateAppId;
  name: string;
  icon: string;
  subdomain: string;
  port: number;
}

const MATES: MateEntry[] = [
  { id: "chat", name: "Chatmate", icon: "💬", subdomain: "chat", port: 3002 },
  { id: "notes", name: "Notemate", icon: "📝", subdomain: "notes", port: 3003 },
  { id: "scan", name: "Scanmate", icon: "📷", subdomain: "scan", port: 3004 },
  { id: "agent", name: "Agentmate", icon: "🤖", subdomain: "agent", port: 3005 },
];

export const MateSwitcher = (props: {
  current?: MateAppId;
}): HtmlEscapedString | Promise<HtmlEscapedString> => {
  return (
    <nav
      x-data="mateSwitcher"
      aria-label="Sleipnir Apps"
      class="w-full shrink-0 bg-base-200/95 border-b border-base-content/10 px-2 sm:px-4 py-1 flex items-center justify-between gap-2 z-30 overflow-x-auto"
    >
      <div class="flex items-center gap-1 sm:gap-1.5">
        <span class="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono font-bold uppercase tracking-wider opacity-50 pr-2 mr-1 border-r border-base-content/15 select-none">
          🐎 Sleipnir
        </span>
        {MATES.map((m) => {
          const isCurrent = props.current === m.id;
          return (
            <a
              href={`http://localhost:${m.port}/`}
              data-mate-sub={m.subdomain}
              data-mate-port={String(m.port)}
              class={`btn btn-xs rounded-lg gap-1.5 font-medium whitespace-nowrap ${
                isCurrent ? "btn-primary font-bold shadow-xs" : "btn-ghost text-base-content/75 hover:text-base-content"
              }`}
              aria-current={isCurrent ? "page" : undefined}
            >
              <span>{m.icon}</span>
              <span>{m.name}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
};
