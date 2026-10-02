/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { DocumentMetadata, SaveDocumentPayload } from "./types.ts";

import { ensureDir } from "@std/fs";
import { join, relative } from "@std/path";
import { createPdfFromImages } from "./pdf.ts";
import { documentMetadataSchema } from "./types.ts";

const DOCUMENTS_DIR = Deno.env.get("SCANMATE_DATA_DIR") ||
  new URL("../../../data/documents", import.meta.url).pathname;

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

export async function listAllDocuments(): Promise<DocumentMetadata[]> {
  await initStorage();
  const documents: DocumentMetadata[] = [];

  async function scanDir(currentDir: string) {
    try {
      for await (const entry of Deno.readDir(currentDir)) {
        const fullPath = join(currentDir, entry.name);
        if (entry.isDirectory && !entry.name.startsWith(".")) {
          await scanDir(fullPath);
        } else if (entry.isFile && entry.name.endsWith(".json")) {
          try {
            const content = await Deno.readTextFile(fullPath);
            const parsed = JSON.parse(content);
            const validated = documentMetadataSchema.safeParse(parsed);
            if (validated.success) {
              documents.push(validated.data);
            }
          } catch (err) {
            console.warn(`Fehler beim Lesen von ${entry.name}:`, err);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  await scanDir(DOCUMENTS_DIR);

  // Sortiere absteigend nach Datum oder Erstellungszeit
  return documents.sort((a, b) => {
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
  const jsonFileName = `${baseName}.json`;

  const pdfRelPath = safeTargetDir ? `${safeTargetDir}/${pdfFileName}` : pdfFileName;
  const jsonRelPath = safeTargetDir ? `${safeTargetDir}/${jsonFileName}` : jsonFileName;

  const pdfFullPath = join(targetDir, pdfFileName);
  const jsonFullPath = join(targetDir, jsonFileName);

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
    fileNameJson: jsonRelPath,
  };

  const validated = documentMetadataSchema.parse(metadata);

  // 3. Sidecar JSON schreiben
  await Deno.writeTextFile(jsonFullPath, JSON.stringify(validated, null, 2));

  return validated;
}

export async function updateDocumentMetadata(
  id: string,
  updatedData: Partial<DocumentMetadata>,
): Promise<DocumentMetadata | null> {
  const existing = await getDocumentById(id);
  if (!existing) return null;

  const merged = { ...existing, ...updatedData };
  const validated = documentMetadataSchema.parse(merged);

  const jsonFullPath = join(DOCUMENTS_DIR, existing.fileNameJson);
  await Deno.writeTextFile(jsonFullPath, JSON.stringify(validated, null, 2));

  return validated;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const doc = await getDocumentById(id);
  if (!doc) return false;

  const pdfFullPath = join(DOCUMENTS_DIR, doc.fileNamePdf);
  const jsonFullPath = join(DOCUMENTS_DIR, doc.fileNameJson);

  try {
    await Deno.remove(pdfFullPath);
  } catch {
    // ignoriere falls PDF schon gelöscht
  }

  try {
    await Deno.remove(jsonFullPath);
  } catch {
    // ignoriere
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
