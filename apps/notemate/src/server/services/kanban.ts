/**
 * @project Sleipnir Stack / Notemate Kanban
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { join, resolve } from "@std/path";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import { cleanTagValue, hasNsfwTag } from "./tags.ts";

export const DEFAULT_KANBAN_COLUMNS: readonly string[] = [
  "Eingang",
  "Zurückgestellt",
  "In Bearbeitung",
  "Fertiggestellt",
];

const BOARD_ID_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/i;
const DUE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface KanbanCard {
  id: string;
  title: string;
  column: string;
  order: number;
  tags: string[];
  description: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanBoard {
  id: string;
  title: string;
  columns: string[];
  cards: KanbanCard[];
}

export interface KanbanBoardSummary {
  id: string;
  title: string;
  columns: string[];
  cardCount: number;
}

export interface KanbanStorageConfig {
  dataDir?: string;
}

export interface KanbanFilterOptions {
  includeNsfw?: boolean;
  query?: string;
  tag?: string;
}

export interface CreateCardInput {
  title: string;
  column?: string;
  tags?: string[];
  description?: string;
  dueDate?: string | null;
}

export interface UpdateCardInput {
  title?: string;
  column?: string;
  order?: number;
  tags?: string[];
  description?: string;
  dueDate?: string | null;
}

export interface OverdueCardEntry {
  boardId: string;
  boardTitle: string;
  card: KanbanCard;
}

export function getLocalDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function normalizeDueDate(raw?: string | null): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (!DUE_DATE_REGEX.test(trimmed)) {
    throw new Error("Ungültiges Fälligkeitsdatum. Erwartet wird YYYY-MM-DD.");
  }
  const [y, m, d] = trimmed.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() + 1 !== m ||
    check.getUTCDate() !== d
  ) {
    throw new Error("Ungültiges Kalenderdatum.");
  }
  return trimmed;
}

export function isCardOverdue(card: KanbanCard, today = getLocalDateIso()): boolean {
  if (!card.dueDate) return false;
  if (card.column.trim().toLowerCase() === "fertiggestellt") return false;
  return card.dueDate < today;
}

function normalizeBoardId(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  if (!slug || !BOARD_ID_REGEX.test(slug)) {
    throw new Error("Ungültige Board-ID.");
  }
  return slug;
}

function normalizeTags(rawTags?: readonly string[]): string[] {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of rawTags) {
    if (typeof raw !== "string") continue;
    const cleaned = cleanTagValue(raw);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

function normalizeColumns(rawColumns?: readonly string[]): string[] {
  if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
    return [...DEFAULT_KANBAN_COLUMNS];
  }
  const seen = new Set<string>();
  const result: string[] = [];

  for (const col of rawColumns) {
    if (typeof col !== "string") continue;
    const trimmed = col.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result.length > 0 ? result : [...DEFAULT_KANBAN_COLUMNS];
}

export class KanbanStorage {
  private kanbanDir: string;
  private writeLocks = new Map<string, Promise<void>>();

  constructor(config?: KanbanStorageConfig) {
    const rawDir = config?.dataDir || Deno.env.get("NOTEMATE_DATA_DIR") || "./data/notes";
    this.kanbanDir = join(resolve(rawDir), ".kanban");
    this.ensureDirSync();
  }

  private ensureDirSync(): void {
    try {
      Deno.mkdirSync(this.kanbanDir, { recursive: true });
    } catch (e) {
      console.error("Failed to initialize kanban directory:", e);
    }
  }

  private resolveBoardPath(boardId: string): string {
    if (!boardId || typeof boardId !== "string" || !BOARD_ID_REGEX.test(boardId.trim())) {
      throw new Error("Ungültige Board-ID.");
    }
    const cleanId = boardId.trim();
    const target = resolve(this.kanbanDir, `${cleanId}.yaml`);
    if (!target.startsWith(this.kanbanDir)) {
      throw new Error("Zugriff verweigert.");
    }
    return target;
  }

  private withBoardLock<T>(boardId: string, task: () => Promise<T>): Promise<T> {
    const prev = this.writeLocks.get(boardId) ?? Promise.resolve();
    const next = prev.then(task, task);
    const settled = next.then(() => undefined, () => undefined);
    this.writeLocks.set(boardId, settled);
    return next;
  }

  private async writeBoardAtomic(board: KanbanBoard): Promise<void> {
    await Deno.mkdir(this.kanbanDir, { recursive: true });
    const targetPath = this.resolveBoardPath(board.id);
    const tmpPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
    const yaml = stringifyYaml({
      id: board.id,
      title: board.title,
      columns: board.columns,
      cards: board.cards,
    });
    await Deno.writeTextFile(tmpPath, yaml);
    await Deno.rename(tmpPath, targetPath);
  }

  private async readBoardRaw(boardId: string): Promise<KanbanBoard> {
    const targetPath = this.resolveBoardPath(boardId);
    const raw = await Deno.readTextFile(targetPath);
    const parsed = parseYaml(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      throw new Error(`Ungültiges Board-YAML: ${boardId}`);
    }

    const columns = normalizeColumns(
      Array.isArray(parsed.columns) ? parsed.columns.filter((c): c is string => typeof c === "string") : undefined,
    );
    const defaultCol = columns[0];
    const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
    const cards: KanbanCard[] = [];

    for (const entry of rawCards) {
      if (!entry || typeof entry !== "object") continue;
      const c = entry as Record<string, unknown>;
      const title = typeof c.title === "string" ? c.title.trim() : "";
      if (!title) continue;
      const rawCol = typeof c.column === "string" ? c.column.trim() : defaultCol;
      const column = columns.includes(rawCol) ? rawCol : defaultCol;
      const now = new Date().toISOString();

      const dueDate = typeof c.dueDate === "string" && DUE_DATE_REGEX.test(c.dueDate.trim()) ? c.dueDate.trim() : undefined;

      cards.push({
        id: typeof c.id === "string" && c.id.trim() ? c.id.trim() : this.generateCardId(),
        title,
        column,
        order: typeof c.order === "number" && Number.isFinite(c.order) ? c.order : cards.length,
        tags: normalizeTags(Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === "string") : []),
        description: typeof c.description === "string" ? c.description : "",
        ...(dueDate ? { dueDate } : {}),
        createdAt: typeof c.createdAt === "string" ? c.createdAt : now,
        updatedAt: typeof c.updatedAt === "string" ? c.updatedAt : now,
      });
    }

    return {
      id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id.trim() : boardId,
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title.trim() : boardId,
      columns,
      cards,
    };
  }

  private generateCardId(): string {
    return `k_${crypto.randomUUID().slice(0, 6)}`;
  }

  private reindexColumn(cards: KanbanCard[], column: string): void {
    const colCards = cards
      .filter((c) => c.column === column)
      .sort((a, b) => a.order - b.order);
    colCards.forEach((card, idx) => {
      card.order = idx;
    });
  }

  async ensureDefaultBoard(): Promise<void> {
    await Deno.mkdir(this.kanbanDir, { recursive: true });
    for await (const entry of Deno.readDir(this.kanbanDir)) {
      if (entry.isFile && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
        return;
      }
    }
    await this.createBoard("Projekte", "projekte");
  }

  async listBoards(options?: { includeNsfw?: boolean }): Promise<KanbanBoardSummary[]> {
    await this.ensureDefaultBoard();
    const includeNsfw = options?.includeNsfw ?? true;
    const summaries: KanbanBoardSummary[] = [];

    for await (const entry of Deno.readDir(this.kanbanDir)) {
      if (!entry.isFile || (!entry.name.endsWith(".yaml") && !entry.name.endsWith(".yml"))) {
        continue;
      }
      const id = entry.name.replace(/\.ya?ml$/i, "");
      try {
        const board = await this.readBoardRaw(id);
        const visibleCards = includeNsfw ? board.cards : board.cards.filter((c) => !hasNsfwTag(c.tags));
        summaries.push({
          id: board.id,
          title: board.title,
          columns: board.columns,
          cardCount: visibleCards.length,
        });
      } catch (e) {
        console.error(`Failed to read kanban board ${entry.name}:`, e);
      }
    }

    return summaries.sort((a, b) => a.title.localeCompare(b.title, "de", { sensitivity: "base" }));
  }

  async createBoard(
    title: string,
    id?: string,
    columns?: string[],
  ): Promise<KanbanBoard> {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      throw new Error("Board-Titel darf nicht leer sein.");
    }
    const boardId = normalizeBoardId(id?.trim() || cleanTitle);
    const boardPath = this.resolveBoardPath(boardId);

    return await this.withBoardLock(boardId, async () => {
      try {
        await Deno.stat(boardPath);
        throw new Error(`Board '${boardId}' existiert bereits.`);
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) {
          throw err;
        }
      }

      const board: KanbanBoard = {
        id: boardId,
        title: cleanTitle,
        columns: normalizeColumns(columns),
        cards: [],
      };
      await this.writeBoardAtomic(board);
      return board;
    });
  }

  async getBoard(
    boardId: string,
    options?: KanbanFilterOptions,
  ): Promise<{ board: KanbanBoard; hiddenCount: number }> {
    const includeNsfw = options?.includeNsfw ?? true;
    const query = options?.query?.trim().toLowerCase() ?? "";
    const tagFilter = options?.tag?.trim().toLowerCase() ?? "";

    const board = await this.readBoardRaw(boardId);
    let hiddenCount = 0;

    const visibleCards = board.cards
      .filter((card) => {
        if (!includeNsfw && hasNsfwTag(card.tags)) {
          hiddenCount += 1;
          return false;
        }
        if (tagFilter && !card.tags.some((t) => t.toLowerCase() === tagFilter)) {
          return false;
        }
        if (query) {
          const haystack = `${card.id} ${card.title} ${card.description} ${card.tags.join(" ")}`.toLowerCase();
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.order - b.order);

    return {
      board: {
        ...board,
        cards: visibleCards,
      },
      hiddenCount,
    };
  }

  async addCard(boardId: string, input: CreateCardInput): Promise<KanbanCard> {
    const title = input.title?.trim();
    if (!title) {
      throw new Error("Kartentitel darf nicht leer sein.");
    }

    return await this.withBoardLock(boardId, async () => {
      const board = await this.readBoardRaw(boardId);
      const targetCol = input.column?.trim() || board.columns[0];
      if (!board.columns.includes(targetCol)) {
        throw new Error(`Unbekannte Spalte '${targetCol}'. Erlaubt: ${board.columns.join(", ")}`);
      }

      const existingInCol = board.cards.filter((c) => c.column === targetCol);
      const now = new Date().toISOString();
      const dueDate = normalizeDueDate(input.dueDate);
      const card: KanbanCard = {
        id: this.generateCardId(),
        title,
        column: targetCol,
        order: existingInCol.length,
        tags: normalizeTags(input.tags),
        description: typeof input.description === "string" ? input.description : "",
        ...(dueDate ? { dueDate } : {}),
        createdAt: now,
        updatedAt: now,
      };

      board.cards.push(card);
      await this.writeBoardAtomic(board);
      return card;
    });
  }

  async updateCard(
    boardId: string,
    cardId: string,
    patch: UpdateCardInput,
  ): Promise<KanbanCard> {
    if (!cardId.trim()) {
      throw new Error("Karten-ID fehlt.");
    }

    return await this.withBoardLock(boardId, async () => {
      const board = await this.readBoardRaw(boardId);
      const card = board.cards.find((c) => c.id === cardId.trim());
      if (!card) {
        throw new Error(`Karte '${cardId}' nicht gefunden.`);
      }

      if (typeof patch.title === "string") {
        const nextTitle = patch.title.trim();
        if (!nextTitle) {
          throw new Error("Kartentitel darf nicht leer sein.");
        }
        card.title = nextTitle;
      }

      if (typeof patch.description === "string") {
        card.description = patch.description;
      }

      if (Array.isArray(patch.tags)) {
        card.tags = normalizeTags(patch.tags);
      }

      if (patch.dueDate !== undefined) {
        const nextDueDate = normalizeDueDate(patch.dueDate);
        if (nextDueDate) {
          card.dueDate = nextDueDate;
        } else {
          delete card.dueDate;
        }
      }

      const prevColumn = card.column;
      const nextColumn = typeof patch.column === "string" ? patch.column.trim() : prevColumn;
      if (!board.columns.includes(nextColumn)) {
        throw new Error(`Unbekannte Spalte '${nextColumn}'. Erlaubt: ${board.columns.join(", ")}`);
      }

      if (nextColumn !== prevColumn || typeof patch.order === "number") {
        this.applyMove(board, card, nextColumn, patch.order);
      }

      card.updatedAt = new Date().toISOString();
      await this.writeBoardAtomic(board);
      return card;
    });
  }

  async moveCard(
    boardId: string,
    cardId: string,
    targetColumn: string,
    targetOrder?: number,
  ): Promise<KanbanCard> {
    return await this.updateCard(boardId, cardId, {
      column: targetColumn,
      order: targetOrder,
    });
  }

  private applyMove(
    board: KanbanBoard,
    card: KanbanCard,
    targetColumn: string,
    targetOrder?: number,
  ): void {
    const prevColumn = card.column;
    card.column = targetColumn;

    const targetCards = board.cards
      .filter((c) => c.column === targetColumn && c.id !== card.id)
      .sort((a, b) => a.order - b.order);

    const insertIdx = typeof targetOrder === "number" && Number.isFinite(targetOrder)
      ? Math.max(0, Math.min(Math.trunc(targetOrder), targetCards.length))
      : targetCards.length;

    targetCards.splice(insertIdx, 0, card);
    targetCards.forEach((c, idx) => {
      c.order = idx;
    });

    if (prevColumn !== targetColumn) {
      this.reindexColumn(board.cards, prevColumn);
    }
  }

  async deleteCard(boardId: string, cardId: string): Promise<void> {
    if (!cardId.trim()) {
      throw new Error("Karten-ID fehlt.");
    }

    await this.withBoardLock(boardId, async () => {
      const board = await this.readBoardRaw(boardId);
      const idx = board.cards.findIndex((c) => c.id === cardId.trim());
      if (idx === -1) {
        throw new Error(`Karte '${cardId}' nicht gefunden.`);
      }
      const [removed] = board.cards.splice(idx, 1);
      this.reindexColumn(board.cards, removed.column);
      await this.writeBoardAtomic(board);
    });
  }

  async listOverdueCards(options?: {
    boardId?: string;
    referenceDate?: string;
  }): Promise<{ today: string; items: OverdueCardEntry[] }> {
    const today = options?.referenceDate ? normalizeDueDate(options.referenceDate) ?? getLocalDateIso() : getLocalDateIso();

    const boardIds: string[] = [];
    if (options?.boardId?.trim()) {
      boardIds.push(options.boardId.trim());
    } else {
      const boards = await this.listBoards({ includeNsfw: true });
      for (const b of boards) {
        boardIds.push(b.id);
      }
    }

    const items: OverdueCardEntry[] = [];
    for (const id of boardIds) {
      const board = await this.readBoardRaw(id);
      for (const card of board.cards) {
        if (isCardOverdue(card, today)) {
          items.push({
            boardId: board.id,
            boardTitle: board.title,
            card,
          });
        }
      }
    }

    items.sort((a, b) => {
      const dateCmp = (a.card.dueDate ?? "").localeCompare(b.card.dueDate ?? "");
      if (dateCmp !== 0) return dateCmp;
      return a.boardTitle.localeCompare(b.boardTitle, "de", { sensitivity: "base" });
    });

    return { today, items };
  }
}
