/**
 * @project Sleipnir Stack / Notemate Calendar
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { KanbanRecurrence, KanbanStorage } from "./kanban.ts";

const RECURRENCE_RRULE_MAP: Record<KanbanRecurrence, string> = {
  weekly: "FREQ=WEEKLY",
  monthly: "FREQ=MONTHLY",
  quarterly: "FREQ=MONTHLY;INTERVAL=3",
  yearly: "FREQ=YEARLY",
};

export interface CalendarIcsOptions {
  baseUrl: string;
  includeNsfw?: boolean;
  calendarName?: string;
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\r\n", "\\n")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldIcsLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let offset = 0;
  chunks.push(line.slice(0, 75));
  offset = 75;
  while (offset < line.length) {
    chunks.push(` ${line.slice(offset, offset + 74)}`);
    offset += 74;
  }
  return chunks.join("\r\n");
}

function formatIcsDate(dueDate: string): string {
  return dueDate.replaceAll("-", "");
}

function addOneDayIcs(dueDate: string): string {
  const [y, m, d] = dueDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const year = String(next.getUTCFullYear()).padStart(4, "0");
  const month = String(next.getUTCMonth() + 1).padStart(2, "0");
  const day = String(next.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatIcsTimestamp(iso: string): string {
  const parsed = new Date(iso);
  const date = Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  const y = String(date.getUTCFullYear()).padStart(4, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export async function buildKanbanCalendarIcs(
  kanban: KanbanStorage,
  options: CalendarIcsOptions,
): Promise<string> {
  const includeNsfw = options.includeNsfw ?? true;
  const cleanBaseUrl = options.baseUrl.replace(/\/+$/, "");
  const calendarName = options.calendarName?.trim() || "NoteMate Kanban";

  const boardSummaries = await kanban.listBoards({ includeNsfw });
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sleipnir Stack//NoteMate Kanban//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const summary of boardSummaries) {
    const { board } = await kanban.getBoard(summary.id, { includeNsfw });
    const boardLink = `${cleanBaseUrl}/?board=${encodeURIComponent(board.id)}`;

    for (const card of board.cards) {
      if (!card.dueDate) continue;

      const dtStart = formatIcsDate(card.dueDate);
      const dtEnd = addOneDayIcs(card.dueDate);
      const dtStamp = formatIcsTimestamp(card.updatedAt || card.createdAt);

      lines.push(
        "BEGIN:VEVENT",
        `UID:${board.id}-${card.id}@notemate.sleipnir`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        ...(card.recurrence ? [`RRULE:${RECURRENCE_RRULE_MAP[card.recurrence]}`] : []),
        `SUMMARY:${escapeIcsText(card.title)}`,
        `DESCRIPTION:${escapeIcsText(boardLink)}`,
        `URL:${boardLink}`,
        "END:VEVENT",
      );
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.map(foldIcsLine).join("\r\n")}\r\n`;
}
