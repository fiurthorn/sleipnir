/**
 * @project Sleipnir Stack / Scanmate MCP
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { MCP_ANNOTATIONS, mcpError, mcpJson, McpServer, z } from "@sleipnir/core/mcp";
import QRCode from "qrcode";
import { VERSION } from "../../../../packages/sleipnir/src/version.g.ts";
import {
  archivePendingScan,
  createFolder,
  createScanSession,
  deletePendingScan,
  getDocumentById,
  getPendingScan,
  listAllDocuments,
  listFolderPaths,
  listPendingScans,
  searchDocuments,
  updateDocumentMetadata,
} from "./services/storage.ts";

interface ParsedDataUrl {
  mimeType: string;
  data: string;
}

function parseImageDataUrl(input: string): ParsedDataUrl {
  const match = input.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1],
      data: match[2],
    };
  }
  return {
    mimeType: "image/jpeg",
    data: input,
  };
}

/**
 * Creates a configured ScanMate MCP server for reading, analyzing (pending inbox), and archiving documents.
 */
export function createScanmateMcpServer(
  publicBaseUrl = "http://localhost:3002",
): McpServer {
  const server = new McpServer({
    name: "scanmate",
    version: VERSION,
  });

  server.tool(
    "scanmate_create_scan_session",
    "Erzeugt einen zeitlich begrenzten Scan-Link (Standard: 10 Min.) plus QR-Code für Desktop & Handy (voller Scan-Client mit Trimming, Perspektiv-Korrektur & Multipage).",
    {
      label: z
        .string()
        .optional()
        .describe("Optionales Label für den Scan (z. B. 'Stromrechnung')"),
      ttlMinutes: z
        .number()
        .int()
        .min(1)
        .max(60)
        .default(10)
        .describe("Gültigkeitsdauer in Minuten"),
    },
    MCP_ANNOTATIONS.write,
    async ({ label, ttlMinutes }) => {
      try {
        const session = await createScanSession(label, ttlMinutes);
        const cleanBase = publicBaseUrl.replace(/\/$/, "");
        const scanUrl = `${cleanBase}/scan/${session.token}`;
        const qrDataUrl = await QRCode.toDataURL(scanUrl, {
          width: 320,
          margin: 2,
        });
        const parsedQr = parseImageDataUrl(qrDataUrl);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  scanUrl,
                  token: session.token,
                  label: session.label,
                  expiresAt: session.expiresAt,
                  ttlMinutes,
                },
                null,
                2,
              ),
            },
            {
              type: "image" as const,
              data: parsedQr.data,
              mimeType: parsedQr.mimeType,
            },
          ],
        };
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Scan-Session konnte nicht erstellt werden",
        );
      }
    },
  );

  server.tool(
    "scanmate_list_pending",
    "Listet alle unverarbeiteten Roh-Scans in der Agent-Inbox auf (ohne Bilddaten).",
    {},
    MCP_ANNOTATIONS.readOnly,
    async () => {
      try {
        const items = await listPendingScans();
        return mcpJson({ count: items.length, items });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden der Inbox",
        );
      }
    },
  );

  server.tool(
    "scanmate_get_pending_images",
    "Lädt die Seitenbilder eines offenen Roh-Scans aus der Inbox als Bild-Content zur Vision-Analyse. Optional per page (1-basiert) einzeln abrufbar bei großen Scans.",
    {
      id: z.string().min(1).describe("ID des Pending-Scans"),
      page: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe(
          "Optionale 1-basierte Seitennummer (für große Multi-Page-Scans)",
        ),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ id, page }) => {
      try {
        const scan = await getPendingScan(id);
        if (!scan) {
          return mcpError(`Pending-Scan '${id}' nicht gefunden`);
        }

        if (page !== undefined && page > scan.pages.length) {
          return mcpError(
            `Seite ${page} existiert nicht (Dokument hat ${scan.pages.length} Seite(n))`,
          );
        }

        const selectedPages = page !== undefined ? [scan.pages[page - 1]] : scan.pages;
        const imageBlocks = selectedPages.map((pageData) => {
          const parsed = parseImageDataUrl(pageData);
          return {
            type: "image" as const,
            data: parsed.data,
            mimeType: parsed.mimeType,
          };
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                id: scan.id,
                label: scan.label,
                createdAt: scan.createdAt,
                pageCount: scan.pageCount,
                returnedPage: page ?? "all",
              }),
            },
            ...imageBlocks,
          ],
        };
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden der Scan-Bilder",
        );
      }
    },
  );

  server.tool(
    "scanmate_archive_pending",
    "Archiviert einen Pending-Scan mit den vom Agent extrahierten Metadaten (erzeugt PDF + JSON im Archiv und löscht den Pending-Scan).",
    {
      pendingId: z
        .string()
        .min(1)
        .describe("ID des zu archivierenden Pending-Scans"),
      title: z.string().min(1).describe("Dokumenttitel"),
      category: z
        .string()
        .default("Sonstiges")
        .describe(
          "Kategorie (z. B. Rechnung, Vertrag, Brief, Beleg, Sonstiges)",
        ),
      date: z
        .string()
        .optional()
        .describe("Dokumentdatum im Format YYYY-MM-DD"),
      sender: z.string().optional().describe("Absender / Aussteller"),
      recipient: z.string().optional().describe("Empfänger"),
      totalAmount: z.number().optional().describe("Gesamtbetrag als Zahl"),
      dueDate: z
        .string()
        .optional()
        .describe("Fälligkeitsdatum im Format YYYY-MM-DD"),
      tags: z.array(z.string()).optional().describe("Schlagwörter"),
      summary: z
        .string()
        .optional()
        .describe("Kurze Zusammenfassung des Dokuments"),
      ocrText: z
        .string()
        .optional()
        .describe("Vollständiger erkannter Text (OCR)"),
      targetPath: z
        .string()
        .optional()
        .describe("Relativer Zielordner im Archiv (z. B. '2026/Rechnungen')"),
    },
    MCP_ANNOTATIONS.write,
    async ({ pendingId, ...metadata }) => {
      try {
        const archived = await archivePendingScan(pendingId, metadata);
        if (!archived) {
          return mcpError(
            `Pending-Scan '${pendingId}' nicht gefunden oder leer`,
          );
        }
        return mcpJson({ archived: true, document: archived });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Archivierung fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "scanmate_delete_pending",
    "Verwirft einen offenen Roh-Scan aus der Agent-Inbox ohne Archivierung.",
    {
      id: z.string().min(1).describe("ID des Pending-Scans"),
    },
    MCP_ANNOTATIONS.destructive,
    async ({ id }) => {
      try {
        const deleted = await deletePendingScan(id);
        if (!deleted) {
          return mcpError(`Pending-Scan '${id}' nicht gefunden`);
        }
        return mcpJson({ deleted: true, id });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Löschen fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "scanmate_list_documents",
    "Listet oder durchsucht archivierte Dokumente via MiniSearch (Titel, Absender & Tags geboostet; ohne vollen OCR-Text).",
    {
      query: z
        .string()
        .optional()
        .describe(
          "Optionaler Suchbegriff (MiniSearch über Titel, Absender, Tags, Zusammenfassung, OCR-Text)",
        ),
      category: z.string().optional().describe("Filter nach Kategorie"),
      folder: z
        .string()
        .optional()
        .describe("Filter nach Zielordner (targetPath)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(50)
        .describe("Maximale Anzahl Ergebnisse"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ query, category, folder, limit }) => {
      try {
        if (query && query.trim().length > 0) {
          const hits = await searchDocuments(query, {
            category,
            folder,
            limit,
          });
          const documents = hits.map(
            ({ ocrText: _ocr, ...summary }) => summary,
          );
          return mcpJson({
            total: documents.length,
            returned: documents.length,
            documents,
          });
        }

        let docs = await listAllDocuments();

        if (category) {
          const catLower = category.toLowerCase();
          docs = docs.filter((d) => d.category.toLowerCase() === catLower);
        }

        if (folder !== undefined) {
          docs = docs.filter((d) => (d.targetPath || "") === folder);
        }

        const sliced = docs
          .slice(0, limit)
          .map(({ ocrText: _ocr, ...summary }) => summary);
        return mcpJson({
          total: docs.length,
          returned: sliced.length,
          documents: sliced,
        });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Auflisten der Dokumente",
        );
      }
    },
  );

  server.tool(
    "scanmate_get_document",
    "Lädt alle Metadaten inklusive vollständigem OCR-Text eines archivierten Dokuments.",
    {
      id: z.string().min(1).describe("Dokument-ID"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ id }) => {
      try {
        const doc = await getDocumentById(id);
        if (!doc) {
          return mcpError(`Dokument '${id}' nicht gefunden`);
        }
        return mcpJson(doc);
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden des Dokuments",
        );
      }
    },
  );

  server.tool(
    "scanmate_update_document",
    "Aktualisiert Metadaten (z. B. Titel, Kategorie, Tags, Betrag, Zusammenfassung) eines bereits archivierten Dokuments und speichert als .yaml.",
    {
      id: z.string().min(1).describe("Dokument-ID"),
      title: z.string().min(1).optional().describe("Neuer Dokumenttitel"),
      category: z.string().optional().describe("Neue Kategorie"),
      date: z.string().optional().describe("Dokumentdatum YYYY-MM-DD"),
      sender: z.string().optional().describe("Absender / Aussteller"),
      recipient: z.string().optional().describe("Empfänger"),
      totalAmount: z.number().optional().describe("Gesamtbetrag"),
      dueDate: z.string().optional().describe("Fälligkeitsdatum YYYY-MM-DD"),
      tags: z
        .array(z.string())
        .optional()
        .describe("Neue Tag-Liste (ersetzt bisherige Tags)"),
      summary: z.string().optional().describe("Aktualisierte Zusammenfassung"),
      ocrText: z.string().optional().describe("Aktualisierter OCR-Text"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ id, ...updates }) => {
      try {
        const cleanUpdates = Object.fromEntries(
          Object.entries(updates).filter(([, v]) => v !== undefined),
        );
        const updated = await updateDocumentMetadata(id, cleanUpdates);
        if (!updated) {
          return mcpError(`Dokument '${id}' nicht gefunden`);
        }
        return mcpJson({ updated: true, document: updated });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Aktualisierung fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "scanmate_list_folders",
    "Listet alle vorhandenen Zielordner im ScanMate-Archiv auf.",
    {},
    MCP_ANNOTATIONS.readOnly,
    async () => {
      try {
        const folders = await listFolderPaths();
        return mcpJson({ folders });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden der Ordner",
        );
      }
    },
  );

  server.tool(
    "scanmate_create_folder",
    "Legt einen neuen Zielordner im ScanMate-Archiv an.",
    {
      path: z
        .string()
        .min(1)
        .describe("Relativer Ordnerpfad (z. B. '2026/Steuer')"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path }) => {
      try {
        const created = await createFolder(path);
        if (!created) {
          return mcpError("Ungültiger Ordnerpfad");
        }
        return mcpJson({ created: true, path: created });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Ordner konnte nicht erstellt werden",
        );
      }
    },
  );

  return server;
}
