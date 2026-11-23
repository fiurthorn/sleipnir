/**
 * @project Sleipnir Stack / Scanmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Hono } from "hono";
import { z } from "zod";
import {
  createFolder,
  deleteDocument,
  deletePendingScan,
  getDocumentById,
  getDocumentPdfBytes,
  getDocumentPreviewBytes,
  getScanSession,
  listAllDocuments,
  listFolderPaths,
  listPendingScans,
  saveDocument,
  savePendingScan,
  submitScanSession,
  updateDocumentMetadata,
} from "../services/storage.ts";
import { extractDocumentMetadataWithAi, getAvailableVisionModels } from "../services/ai.ts";
import { documentMetadataSchema } from "../services/types.ts";

export const api = new Hono();

const analyzeBodySchema = z.object({
  pages: z.array(z.string().min(1)).min(
    1,
    "Mindestens eine Seite erforderlich",
  ),
  model: z.string().optional(),
});

const saveBodySchema = z.object({
  title: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  sender: z.string().optional(),
  recipient: z.string().optional(),
  totalAmount: z.number().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  ocrText: z.string().optional(),
  targetPath: z.string().optional(),
  pages: z.array(z.string().min(1)).min(
    1,
    "Mindestens eine Seite erforderlich",
  ),
});

// GET /api/folders - Liste aller vorhandenen Unterordner
api.get("/folders", async (c) => {
  const folders = await listFolderPaths();
  return c.json({ ok: true, folders });
});

// POST /api/folders - Neuen Unterordner anlegen
api.post("/folders", async (c) => {
  const raw = await c.req.json().catch(() => undefined);
  const path = typeof raw?.path === "string" ? raw.path.trim() : "";
  if (!path) {
    return c.json({ ok: false, error: "Ordnerpfad fehlt" }, 400);
  }
  const created = await createFolder(path);
  return c.json({ ok: true, path: created });
});

// GET /api/models - Liste verfügbarer Vision-Modelle
api.get("/models", (c) => {
  const models = getAvailableVisionModels();
  return c.json({ ok: true, models });
});

// GET /api/documents - Liste aller archivierten Dokumente
api.get("/documents", async (c) => {
  const docs = await listAllDocuments();
  return c.json({ ok: true, documents: docs });
});

// GET /api/documents/:id - Einzelnes Dokument holen
api.get("/documents/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ ok: false, error: "ID fehlt" }, 400);

  const doc = await getDocumentById(id);
  if (!doc) return c.json({ ok: false, error: "Dokument nicht gefunden" }, 404);

  return c.json({ ok: true, document: doc });
});

// POST /api/analyze - KI Vision Analyse & OCR für gescannte Seiten
api.post("/analyze", async (c) => {
  const rawBody = await c.req.json().catch(() => undefined);
  const parsed = analyzeBodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe",
    }, 400);
  }

  try {
    const result = await extractDocumentMetadataWithAi(
      parsed.data.pages,
      parsed.data.model,
    );
    return c.json({ ok: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: msg }, 500);
  }
});

// POST /api/documents - Dokument speichern (PDF bündeln + JSON-Sidecar ablegen)
api.post("/documents", async (c) => {
  const rawBody = await c.req.json().catch(() => undefined);
  const parsed = saveBodySchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ungültige Daten",
    }, 400);
  }

  try {
    const saved = await saveDocument(parsed.data);
    return c.json({ ok: true, document: saved }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: msg }, 500);
  }
});

// PUT /api/documents/:id - Metadaten aktualisieren
api.put("/documents/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ ok: false, error: "ID fehlt" }, 400);

  const rawBody = await c.req.json().catch(() => undefined);
  const updateSchema = documentMetadataSchema.partial();
  const parsed = updateSchema.safeParse(rawBody);

  if (!parsed.success) {
    return c.json({
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ungültige Daten",
    }, 400);
  }

  try {
    const updated = await updateDocumentMetadata(id, parsed.data);
    if (!updated) {
      return c.json({ ok: false, error: "Dokument nicht gefunden" }, 404);
    }
    return c.json({ ok: true, document: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ ok: false, error: msg }, 500);
  }
});

// DELETE /api/documents/:id - Dokument löschen
api.delete("/documents/:id", async (c) => {
  const id = c.req.param("id");
  if (!id) return c.json({ ok: false, error: "ID fehlt" }, 400);

  const success = await deleteDocument(id);
  if (!success) {
    return c.json({ ok: false, error: "Dokument nicht gefunden" }, 404);
  }

  return c.json({ ok: true });
});

// GET /api/pdf/* - PDF-Datei streamen/herunterladen (auch in Unterordnern & mit basePath)
api.get("/pdf/*", async (c) => {
  const match = c.req.path.match(/\/(?:api\/)?pdf\/(.+)$/);
  const fullPath = match ? decodeURIComponent(match[1]) : "";
  if (!fullPath || !fullPath.endsWith(".pdf")) {
    return c.text("Ungültiger Dateiname", 400);
  }

  const bytes = await getDocumentPdfBytes(fullPath);
  if (!bytes) {
    return c.text("PDF nicht gefunden", 404);
  }

  const baseFileName = fullPath.split("/").pop() || "document.pdf";

  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${baseFileName}"`,
    },
  });
});

// GET /api/preview/* - Seite-1-Vorschaubild eines archivierten PDFs
api.get("/preview/*", async (c) => {
  const match = c.req.path.match(/\/(?:api\/)?preview\/(.+)$/);
  const fullPath = match ? decodeURIComponent(match[1]) : "";
  if (!fullPath || !fullPath.endsWith(".pdf")) {
    return c.text("Ungültiger Dateiname", 400);
  }

  const preview = await getDocumentPreviewBytes(fullPath);
  if (!preview) {
    return c.text("Vorschau nicht gefunden", 404);
  }

  return new Response(preview.data as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": preview.contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
});

const pendingBodySchema = z.object({
  pages: z.array(z.string().min(1)).min(1, "Mindestens eine Seite erforderlich"),
  label: z.string().optional(),
});

// GET /api/pending - Offene Roh-Scans in der Agent-Inbox auflisten
api.get("/pending", async (c) => {
  const items = await listPendingScans();
  return c.json({ ok: true, items });
});

// POST /api/pending - Roh-Scan für Agent-Analyse in der Inbox ablegen
api.post("/pending", async (c) => {
  const raw = await c.req.json().catch(() => undefined);
  const parsed = pendingBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues[0]?.message || "Ungültige Eingabe" }, 400);
  }

  const item = await savePendingScan(parsed.data.pages, parsed.data.label);
  return c.json({ ok: true, item }, 201);
});

// DELETE /api/pending/:id - Offenen Roh-Scan verwerfen
api.delete("/pending/:id", async (c) => {
  const id = c.req.param("id");
  const deleted = await deletePendingScan(id);
  if (!deleted) {
    return c.json({ ok: false, error: "Pending-Scan nicht gefunden" }, 404);
  }
  return c.json({ ok: true });
});

// GET /api/sessions/:token - Scan-Session-Status prüfen
api.get("/sessions/:token", async (c) => {
  const session = await getScanSession(c.req.param("token"));
  if (!session) {
    return c.json({ ok: false, error: "Scan-Link abgelaufen oder ungültig" }, 404);
  }
  return c.json({ ok: true, session });
});

// POST /api/sessions/:token/submit - Gescannte Seiten über Session einreichen
api.post("/sessions/:token/submit", async (c) => {
  const raw = await c.req.json().catch(() => undefined);
  const parsed = pendingBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.issues[0]?.message || "Ungültige Eingabe" }, 400);
  }

  const result = await submitScanSession(
    c.req.param("token"),
    parsed.data.pages,
    parsed.data.label,
  );
  if (!result) {
    return c.json({ ok: false, error: "Scan-Link abgelaufen, ungültig oder bereits verwendet" }, 410);
  }
  return c.json({ ok: true, ...result }, 201);
});
