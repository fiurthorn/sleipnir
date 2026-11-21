/**
 * @project Sleipnir Stack / Core Search
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import MiniSearch from "minisearch";

export interface SearchIndexConfig<TDoc extends { id: string }> {
  fields: Array<Extract<keyof TDoc, string>>;
  storeFields?: Array<Extract<keyof TDoc, string>>;
  boost?: Record<string, number>;
  persistPath?: string;
  debounceMs?: number;
}

export interface SyncEntry<TDoc extends { id: string }> {
  id: string;
  mtimeMs: number;
  load: () => Promise<TDoc | null>;
}

export interface SearchHit<TDoc> {
  id: string;
  score: number;
  terms: string[];
  doc: TDoc;
}

interface PersistedEnvelope {
  version: number;
  mtimes: Record<string, number>;
  index: ReturnType<MiniSearch["toJSON"]>;
}

/**
 * Persistent, debounced MiniSearch wrapper with mtime-based delta sync on startup.
 */
export class PersistentSearchIndex<TDoc extends { id: string }> {
  private readonly config: SearchIndexConfig<TDoc>;
  private index: MiniSearch<TDoc>;
  private mtimes = new Map<string, number>();
  private initialized = false;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(config: SearchIndexConfig<TDoc>) {
    this.config = config;
    this.index = this.createEmptyIndex();
  }

  private createEmptyIndex(): MiniSearch<TDoc> {
    return new MiniSearch<TDoc>({
      fields: this.config.fields,
      storeFields: this.config.storeFields ?? [],
    });
  }

  /**
   * Loads any persisted index from disk once, then applies only added/modified/deleted entries.
   */
  async syncFromEntries(entries: SyncEntry<TDoc>[]): Promise<void> {
    if (!this.initialized) {
      await this.tryLoadFromDisk();
      this.initialized = true;
    }

    let dirty = false;
    const seen = new Set<string>();

    for (const entry of entries) {
      seen.add(entry.id);
      const cachedMtime = this.mtimes.get(entry.id);
      if (cachedMtime !== undefined && cachedMtime === entry.mtimeMs && this.index.has(entry.id)) {
        continue;
      }

      const doc = await entry.load();
      if (!doc) continue;

      if (this.index.has(entry.id)) {
        this.index.replace(doc);
      } else {
        this.index.add(doc);
      }
      this.mtimes.set(entry.id, entry.mtimeMs);
      dirty = true;
    }

    for (const oldId of Array.from(this.mtimes.keys())) {
      if (seen.has(oldId)) continue;
      if (this.index.has(oldId)) {
        this.index.discard(oldId);
      }
      this.mtimes.delete(oldId);
      dirty = true;
    }

    if (dirty) {
      this.scheduleSave();
    }
  }

  /**
   * Immediately upserts a single document in RAM and schedules debounced disk persistence.
   */
  upsert(doc: TDoc, mtimeMs: number = Date.now()): void {
    if (this.index.has(doc.id)) {
      this.index.replace(doc);
    } else {
      this.index.add(doc);
    }
    this.mtimes.set(doc.id, mtimeMs);
    this.initialized = true;
    this.scheduleSave();
  }

  /**
   * Immediately removes a document from RAM and schedules debounced disk persistence.
   */
  remove(id: string): void {
    if (this.index.has(id)) {
      this.index.discard(id);
    }
    this.mtimes.delete(id);
    this.scheduleSave();
  }

  /**
   * Searches with field boosting, prefix and fuzzy matching.
   * Uses AND combination first and falls back to OR if AND returns no matches.
   */
  search(query: string, limit = 25): Array<SearchHit<TDoc>> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const baseOpts = {
      boost: this.config.boost ?? {},
      prefix: true,
      fuzzy: 0.2,
    };

    let raw = this.index.search(trimmed, { ...baseOpts, combineWith: "AND" });
    if (raw.length === 0) {
      raw = this.index.search(trimmed, { ...baseOpts, combineWith: "OR" });
    }

    return raw.slice(0, limit).map((hit) => ({
      id: String(hit.id),
      score: hit.score,
      terms: hit.terms,
      doc: hit as unknown as TDoc,
    }));
  }

  /**
   * Flushes the serialized index to disk immediately (useful in tests or graceful shutdown).
   */
  async flush(): Promise<void> {
    if (this.saveTimer !== undefined) {
      clearTimeout(this.saveTimer);
      this.saveTimer = undefined;
    }
    if (!this.config.persistPath) return;

    const payload: PersistedEnvelope = {
      version: 1,
      mtimes: Object.fromEntries(this.mtimes),
      index: this.index.toJSON(),
    };

    await Deno.writeTextFile(this.config.persistPath, JSON.stringify(payload));
  }

  private scheduleSave(): void {
    if (!this.config.persistPath) return;
    if (this.saveTimer !== undefined) {
      clearTimeout(this.saveTimer);
    }
    const delay = this.config.debounceMs ?? 2000;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined;
      this.flush().catch((err) => {
        console.warn("[SearchIndex] Failed to persist index:", err);
      });
    }, delay);
  }

  private async tryLoadFromDisk(): Promise<void> {
    if (!this.config.persistPath) return;
    try {
      const raw = await Deno.readTextFile(this.config.persistPath);
      const parsed = JSON.parse(raw) as PersistedEnvelope;
      if (parsed.version !== 1 || !parsed.index) return;

      this.index = MiniSearch.loadJSON<TDoc>(JSON.stringify(parsed.index), {
        fields: this.config.fields,
        storeFields: this.config.storeFields ?? [],
      });
      this.mtimes = new Map(Object.entries(parsed.mtimes ?? {}));
    } catch {
      // Kein gespeicherter Index vorhanden oder inkompatibel -> sauber neu aufbauen
      this.index = this.createEmptyIndex();
      this.mtimes.clear();
    }
  }
}
