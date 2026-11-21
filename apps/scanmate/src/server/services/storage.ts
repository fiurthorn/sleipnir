/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { DocumentMetadata, SaveDocumentPayload } from "./types.ts";

import { PersistentSearchIndex } from "@sleipnir/core/search";
import { ensureDir } from "@std/fs";
import { join, relative } from "@std/path";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import { createPdfFromImages } from "./pdf.ts";
import { documentMetadataSchema } from "./types.ts";

const DOCUMENTS_DIR = Deno.env.get("SCANMATE_DATA_DIR") ||
  new URL("../../../data/documents", import.meta.url).pathname;

const PENDING_DIR = join(DOCUMENTS_DIR, ".pending");

export interface PendingScanMeta {
  id: string;
  createdAt: string;
  label: string;
  pageCount: number;
}

export interface PendingScan extends PendingScanMeta {
  pages: string[];
}

interface ScanSearchDoc {
  id: string;
  title: string;
  sender: string;
  category: string;
  tags: string;
  summary: string;
  targetPath: string;
  ocrText: string;
}

const scanSearchIndex = new PersistentSearchIndex<ScanSearchDoc>({
  fields: ["title", "sender", "tags", "category", "summary", "targetPath", "ocrText"],
  storeFields: ["id"],
  boost: {
    title: 4,
    sender: 3,
    tags: 3,
    category: 2,
    summary: 2,
    targetPath: 1.5,
    ocrText: 1,
  },
  persistPath: join(DOCUMENTS_DIR, ".search-index.json"),
});

export interface ScanSession {
  token: string;
  createdAt: string;
  expiresAt: string;
  label: string;
  status: "open" | "submitted";
  pendingScanId?: string;
}

function sanitizeFilename(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9äöüÄÖÜß\-_ ]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 60);
}

function sanitizeSubpath(subpath?: string): string {
  if (!subpath) return "";
  return subpath
    .replace(/\\/g, "/")
    .split("/")
    .map((seg) => sanitizeFilename(seg))
    .filter((seg) => seg && seg !== "." && seg !== "..")
    .join("/");
}

export async function initStorage(): Promise<void> {
  await ensureDir(DOCUMENTS_DIR);
}

/**
 * Listet alle Ordner/Pfade unterhalb von DOCUMENTS_DIR auf (für Ordnerauswahl im UI).
 */
export async function listFolderPaths(): Promise<string[]> {
  await initStorage();
  const folders: string[] = [""]; // Root immer vorhanden

  async function walk(dir: string) {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.isDirectory && !entry.name.startsWith(".")) {
          const full = join(dir, entry.name);
          const rel = relative(DOCUMENTS_DIR, full).replace(/\\/g, "/");
          folders.push(rel);
          await walk(full);
        }
      }
    } catch {
      // ignore
    }
  }

  await walk(DOCUMENTS_DIR);
  return folders.sort();
}

/**
 * Erstellt einen neuen Unterordner im Ablageverzeichnis.
 */
export async function createFolder(subpath: string): Promise<string> {
  const safe = sanitizeSubpath(subpath);
  if (!safe) return "";
  const full = join(DOCUMENTS_DIR, safe);
  await ensureDir(full);
  return safe;
}

function getSidecarRelPath(doc: DocumentMetadata): string {
  return doc.fileNameYaml || doc.fileNameJson || doc.fileNamePdf.replace(/\.pdf$/i, ".yaml");
}

function serializeMetadataYaml(doc: DocumentMetadata): string {
  const clean = Object.fromEntries(
    Object.entries(doc).filter(([, value]) => value !== undefined),
  );
  return stringifyYaml(clean);
}

export async function listAllDocuments(): Promise<DocumentMetadata[]> {
  await initStorage();
  const byId = new Map<string, DocumentMetadata>();

  async function scanDir(currentDir: string) {
    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory && !entry.name.startsWith(".")) {
          await scanDir(fullPath);
          continue;
        }
        if (!entry.isFile) continue;

        const isYaml = entry.name.endsWith(".yaml") || entry.name.endsWith(".yml");
        const isJson = entry.name.endsWith(".json");
        if (!isYaml && !isJson) continue;

        try {
          const content = await Deno.readTextFile(fullPath);
          const parsed = isYaml ? parseYaml(content) : JSON.parse(content);
          const validated = documentMetadataSchema.safeParse(parsed);
          if (!validated.success) continue;

          // YAML hat Vorrang vor Legacy-JSON bei gleicher Dokument-ID
          if (isYaml || !byId.has(validated.data.id)) {
            byId.set(validated.data.id, validated.data);
          }
        } catch (err) {
          console.warn(`Fehler beim Lesen von ${entry.name}:`, err);
        }
      }
    } catch {
      // ignore
    }
  }

  await scanDir(DOCUMENTS_DIR);

  // Sortiere absteigend nach Datum oder Erstellungszeit
  return Array.from(byId.values()).sort((a, b) => {
    const dateA = a.date || a.createdAt;
    const dateB = b.date || b.createdAt;
    return dateB.localeCompare(dateA);
  });
}

export async function getDocumentById(
  id: string,
): Promise<DocumentMetadata | null> {
  const documents = await listAllDocuments();
  return documents.find((doc) => doc.id === id) ?? null;
}

export async function saveDocument(
  payload: SaveDocumentPayload,
): Promise<DocumentMetadata> {
  await initStorage();

  const id = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const datePrefix = payload.date || nowIso.split("T")[0];
  const safeTitle = sanitizeFilename(payload.title || "Dokument");
  const baseName = `${datePrefix}_${safeTitle}_${id.slice(0, 8)}`;

  const safeTargetDir = sanitizeSubpath(payload.targetPath);
  const targetDir = safeTargetDir ? join(DOCUMENTS_DIR, safeTargetDir) : DOCUMENTS_DIR;
  await ensureDir(targetDir);

  const pdfFileName = `${baseName}.pdf`;
  const yamlFileName = `${baseName}.yaml`;

  const pdfRelPath = safeTargetDir ? `${safeTargetDir}/${pdfFileName}` : pdfFileName;
  const yamlRelPath = safeTargetDir ? `${safeTargetDir}/${yamlFileName}` : yamlFileName;

  const pdfFullPath = join(targetDir, pdfFileName);
  const yamlFullPath = join(targetDir, yamlFileName);

  // 1. PDF aus den Seitenbildern erzeugen & speichern
  const pdfBytes = await createPdfFromImages(payload.pages);
  await Deno.writeFile(pdfFullPath, pdfBytes);

  // 2. Metadaten-Objekt erzeugen & validieren
  const metadata: DocumentMetadata = {
    id,
    title: payload.title || "Unbenanntes Dokument",
    category: payload.category || "Sonstiges",
    date: payload.date,
    createdAt: nowIso,
    sender: payload.sender,
    recipient: payload.recipient,
    totalAmount: payload.totalAmount,
    currency: "EUR",
    dueDate: payload.dueDate,
    tags: payload.tags || [],
    summary: payload.summary || "",
    ocrText: payload.ocrText || "",
    pageCount: payload.pages.length,
    targetPath: safeTargetDir,
    fileNamePdf: pdfRelPath,
    fileNameYaml: yamlRelPath,
  };

  const validated = documentMetadataSchema.parse(metadata);

  // 3. Sidecar YAML schreiben
  await Deno.writeTextFile(yamlFullPath, serializeMetadataYaml(validated));

  return validated;
}

export async function updateDocumentMetadata(
  id: string,
  updatedData: Partial<DocumentMetadata>,
): Promise<DocumentMetadata | null> {
  const existing = await getDocumentById(id);
  if (!existing) return null;

  const yamlRelPath = existing.fileNameYaml ||
    (existing.fileNameJson ? existing.fileNameJson.replace(/\.json$/i, ".yaml") : getSidecarRelPath(existing));

  const merged: DocumentMetadata = {
    ...existing,
    ...updatedData,
    fileNameYaml: yamlRelPath,
    fileNameJson: undefined,
  };
  const validated = documentMetadataSchema.parse(merged);

  const yamlFullPath = join(DOCUMENTS_DIR, yamlRelPath);
  await Deno.writeTextFile(yamlFullPath, serializeMetadataYaml(validated));

  if (existing.fileNameJson && existing.fileNameJson !== yamlRelPath) {
    try {
      await Deno.remove(join(DOCUMENTS_DIR, existing.fileNameJson));
    } catch {
      // ignoriere falls altes JSON nicht mehr existiert
    }
  }

  return validated;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const doc = await getDocumentById(id);
  if (!doc) return false;

  const pdfFullPath = join(DOCUMENTS_DIR, doc.fileNamePdf);
  const sidecarPaths = [doc.fileNameYaml, doc.fileNameJson].filter((p): p is string => Boolean(p));

  try {
    await Deno.remove(pdfFullPath);
  } catch {
    // ignoriere falls PDF schon gelöscht
  }

  for (const relSidecar of sidecarPaths) {
    try {
      await Deno.remove(join(DOCUMENTS_DIR, relSidecar));
    } catch {
      // ignoriere
    }
  }

  return true;
}

export async function getDocumentPdfBytes(
  relFilePath: string,
): Promise<Uint8Array | null> {
  // Sicherheits-Check gegen Directory Traversal
  const normalized = relFilePath.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return null;
  }
  const filePath = join(DOCUMENTS_DIR, normalized);
  try {
    return await Deno.readFile(filePath);
  } catch {
    return null;
  }
}

function sanitizePendingId(id: string): string {
  return id.replace(/[^a-zA-Z0-9\-]/g, "");
}

/**
 * Speichert einen unbearbeiteten Roh-Scan in der Agent-Inbox (.pending).
 */
export async function savePendingScan(
  pages: string[],
  label?: string,
): Promise<PendingScanMeta> {
  await ensureDir(PENDING_DIR);
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const cleanLabel = (label || "").trim() || `Scan ${createdAt.slice(0, 16).replace("T", " ")}`;

  const record: PendingScan = {
    id,
    createdAt,
    label: cleanLabel,
    pageCount: pages.length,
    pages,
  };

  await Deno.writeTextFile(
    join(PENDING_DIR, `${id}.json`),
    JSON.stringify(record),
  );

  return {
    id: record.id,
    createdAt: record.createdAt,
    label: record.label,
    pageCount: record.pageCount,
  };
}

/**
 * Listet alle offenen Roh-Scans in der Agent-Inbox (ohne Bilddaten).
 */
export async function listPendingScans(): Promise<PendingScanMeta[]> {
  await ensureDir(PENDING_DIR);
  const items: PendingScanMeta[] = [];

  try {
    for await (const entry of Deno.readDir(PENDING_DIR)) {
      if (!entry.isFile || !entry.name.endsWith(".json") || entry.name.startsWith("session_")) continue;
      try {
        const raw = await Deno.readTextFile(join(PENDING_DIR, entry.name));
        const parsed = JSON.parse(raw) as Partial<PendingScan>;
        if (!parsed.id || !parsed.createdAt) continue;
        items.push({
          id: parsed.id,
          createdAt: parsed.createdAt,
          label: parsed.label || "Unbenannter Scan",
          pageCount: Array.isArray(parsed.pages) ? parsed.pages.length : (parsed.pageCount ?? 0),
        });
      } catch {
        // defekte Datei überspringen
      }
    }
  } catch {
    // ignore
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Lädt einen offenen Roh-Scan inklusive seiner Seitenbilder.
 */
export async function getPendingScan(id: string): Promise<PendingScan | null> {
  const safeId = sanitizePendingId(id);
  if (!safeId) return null;

  try {
    const raw = await Deno.readTextFile(join(PENDING_DIR, `${safeId}.json`));
    return JSON.parse(raw) as PendingScan;
  } catch {
    return null;
  }
}

/**
 * Löscht einen offenen Roh-Scan aus der Agent-Inbox.
 */
export async function deletePendingScan(id: string): Promise<boolean> {
  const safeId = sanitizePendingId(id);
  if (!safeId) return false;

  try {
    await Deno.remove(join(PENDING_DIR, `${safeId}.json`));
    return true;
  } catch {
    return false;
  }
}

/**
 * Archiviert einen offenen Roh-Scan mit den vom Agent analysierten Metadaten
 * und entfernt ihn anschließend aus der Agent-Inbox.
 */
export async function archivePendingScan(
  id: string,
  metadata: Omit<SaveDocumentPayload, "pages">,
): Promise<DocumentMetadata | null> {
  const pending = await getPendingScan(id);
  if (!pending || pending.pages.length === 0) return null;

  const archived = await saveDocument({
    ...metadata,
    pages: pending.pages,
  });

  await deletePendingScan(id);
  return archived;
}

async function cleanupExpiredSessions(maxAgeMs = 60 * 60_000): Promise<void> {
  try {
    const cutoff = Date.now() - maxAgeMs;
    for await (const entry of Deno.readDir(PENDING_DIR)) {
      if (!entry.isFile || !entry.name.startsWith("session_") || !entry.name.endsWith(".json")) {
        continue;
      }
      const fullPath = join(PENDING_DIR, entry.name);
      try {
        const raw = await Deno.readTextFile(fullPath);
        const session = JSON.parse(raw) as Partial<ScanSession>;
        if (!session.expiresAt || Date.parse(session.expiresAt) < cutoff) {
          await Deno.remove(fullPath);
        }
      } catch {
        // defekte Session-Datei aufräumen
        await Deno.remove(fullPath).catch(() => {});
      }
    }
  } catch {
    // ignore
  }
}

/**
 * Erstellt eine zeitlich begrenzte Upload-/Scan-Session (Standard: 10 Minuten).
 */
export async function createScanSession(
  label?: string,
  ttlMinutes = 10,
): Promise<ScanSession> {
  await ensureDir(PENDING_DIR);
  await cleanupExpiredSessions();
  const token = crypto.randomUUID().replace(/-/g, "");
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMinutes * 60_000).toISOString();
  const cleanLabel = (label || "").trim() || `Scan-Session ${createdAt.slice(11, 16)}`;

  const session: ScanSession = {
    token,
    createdAt,
    expiresAt,
    label: cleanLabel,
    status: "open",
  };

  await Deno.writeTextFile(
    join(PENDING_DIR, `session_${token}.json`),
    JSON.stringify(session),
  );

  return session;
}

/**
 * Liest eine Scan-Session und prüft, ob sie noch existiert und nicht abgelaufen ist.
 */
export async function getScanSession(token: string): Promise<ScanSession | null> {
  const safeToken = sanitizePendingId(token);
  if (!safeToken) return null;

  const filePath = join(PENDING_DIR, `session_${safeToken}.json`);
  try {
    const raw = await Deno.readTextFile(filePath);
    const session = JSON.parse(raw) as ScanSession;
    if (Date.now() > Date.parse(session.expiresAt)) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Reicht gescannte Seiten über eine gültige Scan-Session in die Agent-Inbox ein.
 */
export async function submitScanSession(
  token: string,
  pages: string[],
  labelOverride?: string,
): Promise<{ session: ScanSession; pending: PendingScanMeta } | null> {
  const session = await getScanSession(token);
  if (!session || session.status !== "open") return null;

  const pending = await savePendingScan(pages, labelOverride || session.label);
  const updated: ScanSession = {
    ...session,
    status: "submitted",
    pendingScanId: pending.id,
  };

  await Deno.writeTextFile(
    join(PENDING_DIR, `session_${session.token}.json`),
    JSON.stringify(updated),
  );

  return { session: updated, pending };
}

/**
 * Durchsucht archivierte Dokumente via MiniSearch (Title/Sender/Tags geboostet).
 */
export async function searchDocuments(
  query: string,
  options?: { category?: string; folder?: string; limit?: number },
): Promise<Array<DocumentMetadata & { score: number }>> {
  await initStorage();
  const docs = await listAllDocuments();
  const byId = new Map(docs.map((d) => [d.id, d]));

  const entries = await Promise.all(
    docs.map(async (doc) => {
      const sidecarPath = join(DOCUMENTS_DIR, getSidecarRelPath(doc));
      const stat = await Deno.stat(sidecarPath).catch(() => null);
      const mtimeMs = stat?.mtime?.getTime() ?? 0;
      return {
        id: doc.id,
        mtimeMs,
        load: (): Promise<ScanSearchDoc> =>
          Promise.resolve({
            id: doc.id,
            title: doc.title,
            sender: doc.sender ?? "",
            category: doc.category,
            tags: doc.tags.join(" "),
            summary: doc.summary ?? "",
            targetPath: doc.targetPath ?? "",
            ocrText: doc.ocrText ?? "",
          }),
      };
    }),
  );

  await scanSearchIndex.syncFromEntries(entries);
  const hits = scanSearchIndex.search(query, Math.max(options?.limit ?? 50, 100));

  const results: Array<DocumentMetadata & { score: number }> = [];
  for (const hit of hits) {
    const doc = byId.get(hit.id);
    if (!doc) continue;
    if (options?.category && doc.category.toLowerCase() !== options.category.toLowerCase()) continue;
    if (options?.folder !== undefined && (doc.targetPath || "") !== options.folder) continue;
    results.push({ ...doc, score: Number(hit.score.toFixed(2)) });
    if (results.length >= (options?.limit ?? 50)) break;
  }

  return results;
}
