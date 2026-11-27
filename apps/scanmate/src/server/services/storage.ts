/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { DocumentMetadata, SaveDocumentPayload } from "./types.ts";

import { PersistentSearchIndex } from "@sleipnir/core/search";
import { ensureDir } from "@std/fs";
import { join, normalize, relative, resolve } from "@std/path";
import { parse as parseYaml, stringify as stringifyYaml } from "@std/yaml";
import { PDFDocument } from "pdf-lib";
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
  pdfBase64?: string;
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

  const pages = payload.pages ?? [];
  if (!payload.pdfBytes && pages.length === 0) {
    throw new Error("Weder Seitenbilder noch PDF-Daten vorhanden");
  }

  // 1. Original-PDF speichern oder PDF aus Seitenbildern erzeugen
  const pdfBytes = payload.pdfBytes ?? (await createPdfFromImages(pages));
  await Deno.writeFile(pdfFullPath, pdfBytes);

  // 1b. Seite 1 als kompakte Bild-Vorschau ablegen (falls Seitenbilder vorhanden)
  if (pages.length > 0) {
    await saveFirstPagePreview(targetDir, baseName, pages[0]).catch(() => undefined);
  }

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
    pageCount: payload.pageCount ?? (pages.length || 1),
    targetPath: safeTargetDir,
    fileNamePdf: pdfRelPath,
    fileNameYaml: yamlRelPath,
    reviewed: payload.reviewed,
  };

  const validated = documentMetadataSchema.parse(metadata);

  // 3. Sidecar YAML schreiben
  await Deno.writeTextFile(yamlFullPath, serializeMetadataYaml(validated));

  return validated;
}

function resolveDocPathSafe(relPath: string): string | null {
  if (!relPath || typeof relPath !== "string") return null;
  const clean = normalize(relPath.replace(/^(\/|\\)+/, ""));
  if (!clean || clean === "." || clean.startsWith("..")) return null;
  const full = resolve(DOCUMENTS_DIR, clean);
  const base = DOCUMENTS_DIR.endsWith("/") ? DOCUMENTS_DIR.slice(0, -1) : DOCUMENTS_DIR;
  if (full !== base && !full.startsWith(`${base}/`)) return null;
  return full;
}

export async function updateDocumentMetadata(
  id: string,
  updatedData: Partial<DocumentMetadata>,
): Promise<DocumentMetadata | null> {
  const existing = await getDocumentById(id);
  if (!existing) return null;

  const yamlRelPath = existing.fileNameYaml ||
    (existing.fileNameJson ? existing.fileNameJson.replace(/\.json$/i, ".yaml") : getSidecarRelPath(existing));

  const yamlFullPath = resolveDocPathSafe(yamlRelPath);
  if (!yamlFullPath) {
    throw new Error("Ungültiger Sidecar-Dateipfad");
  }

  const merged: DocumentMetadata = {
    ...existing,
    ...updatedData,
    fileNameYaml: yamlRelPath,
    fileNameJson: undefined,
  };
  const validated = documentMetadataSchema.parse(merged);

  await Deno.writeTextFile(yamlFullPath, serializeMetadataYaml(validated));

  if (existing.fileNameJson && existing.fileNameJson !== yamlRelPath) {
    const oldJsonFull = resolveDocPathSafe(existing.fileNameJson);
    if (oldJsonFull) {
      try {
        await Deno.remove(oldJsonFull);
      } catch {
        // ignoriere falls altes JSON nicht mehr existiert
      }
    }
  }

  return validated;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const doc = await getDocumentById(id);
  if (!doc) return false;

  const pdfFullPath = resolveDocPathSafe(doc.fileNamePdf);
  const sidecarPaths = [doc.fileNameYaml, doc.fileNameJson].filter((p): p is string => Boolean(p));

  if (pdfFullPath) {
    try {
      await Deno.remove(pdfFullPath);
    } catch {
      // ignoriere falls PDF schon gelöscht
    }
  }

  for (const relSidecar of sidecarPaths) {
    const sidecarFull = resolveDocPathSafe(relSidecar);
    if (!sidecarFull) continue;
    try {
      await Deno.remove(sidecarFull);
    } catch {
      // ignoriere
    }
  }

  for (const ext of [".preview.jpg", ".preview.png"]) {
    const previewFull = resolveDocPathSafe(doc.fileNamePdf.replace(/\.pdf$/i, ext));
    if (!previewFull) continue;
    try {
      await Deno.remove(previewFull);
    } catch {
      // ignoriere
    }
  }

  return true;
}

async function saveFirstPagePreview(
  targetDir: string,
  baseName: string,
  firstPageDataUrl: string,
): Promise<void> {
  const match = firstPageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const mime = match ? match[1].toLowerCase() : "image/jpeg";
  const b64 = match ? match[2] : firstPageDataUrl;
  const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ext = mime.includes("png") ? ".preview.png" : ".preview.jpg";
  await Deno.writeFile(join(targetDir, `${baseName}${ext}`), raw);
}

export async function getDocumentPreviewBytes(
  relPdfPath: string,
): Promise<{ data: Uint8Array; contentType: string } | null> {
  const normalized = relPdfPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) {
    return null;
  }

  const base = normalized.replace(/\.pdf$/i, "");
  for (
    const [ext, contentType] of [
      [".preview.jpg", "image/jpeg"],
      [".preview.png", "image/png"],
    ] as const
  ) {
    const fullPath = join(DOCUMENTS_DIR, `${base}${ext}`);
    try {
      const data = await Deno.readFile(fullPath);
      return { data, contentType };
    } catch {
      // next candidate
    }
  }

  return null;
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

function decodeBase64ToBytes(rawBase64: string): Uint8Array {
  const clean = rawBase64.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Speichert ein direktes PDF-Dokument (z. B. aus E-Mail-Anhang) in der Agent-Inbox (.pending).
 */
export async function savePendingPdf(
  pdfBase64: string,
  label?: string,
): Promise<PendingScanMeta> {
  await ensureDir(PENDING_DIR);
  const cleanB64 = pdfBase64.replace(/^data:application\/pdf;base64,/, "").replace(/\s/g, "");
  const bytes = decodeBase64ToBytes(cleanB64);
  if (bytes.byteLength < 5 || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") {
    throw new Error("Ungültige PDF-Datei");
  }

  let pageCount = 1;
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pageCount = Math.max(1, doc.getPageCount());
  } catch {
    pageCount = 1;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const cleanLabel = (label || "").trim() || `PDF ${createdAt.slice(0, 16).replace("T", " ")}`;

  const record: PendingScan = {
    id,
    createdAt,
    label: cleanLabel,
    pageCount,
    pages: [],
    pdfBase64: cleanB64,
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
  if (!pending) return null;

  if (pending.pdfBase64) {
    const pdfBytes = decodeBase64ToBytes(pending.pdfBase64);
    const archived = await saveDocument({
      ...metadata,
      reviewed: metadata.reviewed ?? false,
      pdfBytes,
      pageCount: pending.pageCount,
    });
    await deletePendingScan(id);
    return archived;
  }

  if (pending.pages.length === 0) return null;

  const archived = await saveDocument({
    ...metadata,
    reviewed: metadata.reviewed ?? false,
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
