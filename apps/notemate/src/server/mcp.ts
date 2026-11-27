/**
 * @project Sleipnir Stack / Notemate MCP
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { VERSION } from "../../../../packages/sleipnir/src/version.g.ts";
import type { KanbanStorage } from "./services/kanban.ts";
import type { NoteStorage } from "./services/storage.ts";

import { MCP_ANNOTATIONS, mcpError, mcpJson, McpServer, z } from "@sleipnir/core/mcp";

/**
 * Creates a configured NoteMate MCP server bound to the given NoteStorage and KanbanStorage instances.
 */
export function createNotemateMcpServer(
  storage: NoteStorage,
  kanban?: KanbanStorage,
): McpServer {
  const server = new McpServer({
    name: "notemate",
    version: VERSION,
  });

  server.tool(
    "notemate_get_tree",
    "Gibt die vollständige Ordner- und Notiz-Hierarchie von NoteMate zurück.",
    {},
    MCP_ANNOTATIONS.readOnly,
    async () => {
      try {
        const tree = await storage.getTree();
        return mcpJson({ tree });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden des Baums",
        );
      }
    },
  );

  server.tool(
    "notemate_read_note",
    "Liest den vollständigen Markdown-Inhalt einer Notiz anhand ihres relativen Pfads.",
    {
      path: z
        .string()
        .min(1)
        .describe("Relativer Pfad zur Notiz (z. B. 'Rezepte/Pasta.md')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ path }) => {
      try {
        const note = await storage.getNote(path);
        return mcpJson(note);
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Notiz nicht gefunden",
        );
      }
    },
  );

  server.tool(
    "notemate_write_note",
    "Erstellt oder aktualisiert eine Markdown-Notiz unter dem angegebenen Pfad.",
    {
      path: z
        .string()
        .min(1)
        .describe("Relativer Pfad zur Notiz (z. B. 'Ideen/Architektur.md')"),
      content: z.string().describe("Vollständiger Markdown-Inhalt der Notiz"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path, content }) => {
      try {
        const note = await storage.saveNote(path, content);
        return mcpJson({ saved: true, note });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Speichern",
        );
      }
    },
  );

  server.tool(
    "notemate_search",
    "Gerankte MiniSearch-Volltextsuche über alle Notizen (Titel und Tags werden höher gewichtet).",
    {
      query: z.string().min(1).describe("Suchbegriff(e)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(20)
        .describe("Maximale Anzahl Ergebnisse"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ query, limit }) => {
      try {
        const results = await storage.searchNotes(query, limit);
        return mcpJson({ count: results.length, results });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Suchfehler");
      }
    },
  );

  server.tool(
    "notemate_create_folder",
    "Legt einen neuen Ordner (inkl. verschachtelter Unterordner) in NoteMate an.",
    {
      path: z.string().min(1).describe("Relativer Ordnerpfad"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path }) => {
      try {
        await storage.createFolder(path);
        return mcpJson({ created: true, path });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Ordner konnte nicht erstellt werden",
        );
      }
    },
  );

  server.tool(
    "notemate_rename_item",
    "Benennt eine Notiz oder einen Ordner um bzw. verschiebt das Element.",
    {
      oldPath: z.string().min(1).describe("Aktueller relativer Pfad"),
      newPath: z.string().min(1).describe("Neuer relativer Pfad"),
    },
    MCP_ANNOTATIONS.write,
    async ({ oldPath, newPath }) => {
      try {
        await storage.renameItem(oldPath, newPath);
        return mcpJson({ renamed: true, oldPath, newPath });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Umbenennen fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "notemate_move_item",
    "Verschiebt eine einzelne Notiz (.md) inklusive zugehöriger Attachments in einen anderen Zielordner.",
    {
      sourcePath: z
        .string()
        .min(1)
        .describe(
          "Aktueller relativer Pfad der Notiz (z. B. 'NotesEncryption.md')",
        ),
      targetFolder: z
        .string()
        .default("")
        .describe("Zielordner (z. B. 'Konzepte' oder '' für Stammverzeichnis)"),
    },
    MCP_ANNOTATIONS.write,
    async ({ sourcePath, targetFolder }) => {
      try {
        const cleanSource = sourcePath.trim().replace(/^\/+|\/+$/g, "");
        if (!cleanSource.endsWith(".md")) {
          return mcpError(
            "Es können nur einzelne Notizen (.md) verschoben werden.",
          );
        }
        const cleanFolder = targetFolder.trim().replace(/^\/+|\/+$/g, "");
        const fileName = cleanSource.split("/").pop() || cleanSource;
        const newPath = cleanFolder ? `${cleanFolder}/${fileName}` : fileName;
        if (cleanSource === newPath) {
          return mcpJson({ moved: false, oldPath: cleanSource, newPath });
        }
        await storage.renameItem(cleanSource, newPath);
        return mcpJson({ moved: true, oldPath: cleanSource, newPath });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Verschieben fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "notemate_delete_item",
    "Löscht eine Notiz oder einen Ordner rekursiv.",
    {
      path: z
        .string()
        .min(1)
        .describe("Relativer Pfad des zu löschenden Elements"),
    },
    MCP_ANNOTATIONS.destructive,
    async ({ path }) => {
      try {
        await storage.deleteItem(path);
        return mcpJson({ deleted: true, path });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Löschen fehlgeschlagen",
        );
      }
    },
  );

  server.tool(
    "notemate_list_untagged",
    "Listet alle Notizen/Rezepte ohne YAML-Frontmatter-Tags auf (optional auf einen Ordner wie 'Rezepte' eingegrenzt).",
    {
      folder: z
        .string()
        .optional()
        .describe("Optionaler Unterordner (z. B. 'Rezepte')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ folder }) => {
      try {
        const notes = await storage.listUntaggedNotes(folder);
        return mcpJson({ count: notes.length, notes });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden ungetaggter Notizen",
        );
      }
    },
  );

  server.tool(
    "notemate_list_tags",
    "Listet alle vordefinierten, erlaubten Tags (inkl. Kategorie & aktueller Nutzungsanzahl) auf.",
    {
      folder: z
        .string()
        .optional()
        .describe("Optionaler Unterordner für die Zählung (z. B. 'Rezepte')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ folder }) => {
      try {
        const tags = await storage.listAllTags(folder);
        return mcpJson({ count: tags.length, tags });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Fehler beim Laden der Tags",
        );
      }
    },
  );

  server.tool(
    "notemate_add_tags",
    "Fügt einer Notiz/einem Rezept erlaubte Tags aus notemate_list_tags im YAML-Frontmatter hinzu.",
    {
      path: z
        .string()
        .min(1)
        .describe("Relativer Pfad zur Notiz (z. B. 'Rezepte/Pasta.md')"),
      tags: z
        .array(z.string().min(1))
        .min(1)
        .describe("Erlaubte Tags aus notemate_list_tags"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path, tags }) => {
      try {
        const result = await storage.addNoteTags(path, tags);
        return mcpJson({ updated: true, ...result });
      } catch (err) {
        return mcpError(
          err instanceof Error ? err.message : "Tags konnten nicht hinzugefügt werden",
        );
      }
    },
  );

  if (kanban) {
    server.tool(
      "kanban_list_boards",
      "Listet alle verfügbaren Kanban-Boards (YAML-Dateien) inklusive Spalten und Kartenanzahl auf.",
      {},
      MCP_ANNOTATIONS.readOnly,
      async () => {
        try {
          const boards = await kanban.listBoards();
          return mcpJson({ boards });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Boards konnten nicht geladen werden",
          );
        }
      },
    );

    server.tool(
      "kanban_create_board",
      "Legt ein neues Kanban-Board als YAML-Datei an (Standard-Spalten: Eingang, Zurückgestellt, In Bearbeitung, Fertiggestellt).",
      {
        title: z.string().min(1).describe("Titel des Boards"),
        id: z
          .string()
          .optional()
          .describe(
            "Optionale URL-/Dateiname-ID (wird sonst aus Titel erzeugt)",
          ),
        columns: z
          .array(z.string().min(1))
          .optional()
          .describe("Optionale benutzerdefinierte Spaltenliste"),
      },
      MCP_ANNOTATIONS.write,
      async ({ title, id, columns }) => {
        try {
          const board = await kanban.createBoard(title, id, columns);
          return mcpJson({ created: true, board });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Board konnte nicht erstellt werden",
          );
        }
      },
    );

    server.tool(
      "kanban_get_board",
      "Lädt ein Kanban-Board inklusive Karten, optional gefiltert nach Suchbegriff oder Tag.",
      {
        boardId: z.string().min(1).describe("Board-ID (z. B. 'projekte')"),
        query: z
          .string()
          .optional()
          .describe(
            "Optionaler Suchbegriff in Titel, Beschreibung, Tags oder ID",
          ),
        tag: z.string().optional().describe("Optionaler Tag-Filter"),
      },
      MCP_ANNOTATIONS.readOnly,
      async ({ boardId, query, tag }) => {
        try {
          const result = await kanban.getBoard(boardId, {
            includeNsfw: true,
            query,
            tag,
          });
          return mcpJson(result.board);
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Board nicht gefunden",
          );
        }
      },
    );

    server.tool(
      "kanban_add_card",
      "Erstellt eine neue Karte auf einem Kanban-Board (Standard-Spalte: Eingang).",
      {
        boardId: z.string().min(1).describe("Board-ID"),
        title: z.string().min(1).describe("Kurzer Kartentitel"),
        column: z
          .string()
          .optional()
          .describe("Zielspalte (Default: erste Spalte, z. B. 'Eingang')"),
        tags: z
          .array(z.string().min(1))
          .optional()
          .describe("Optionale Tags zur Eingrenzung"),
        description: z
          .string()
          .optional()
          .describe(
            "Optionale Markdown-Beschreibung (inkl. Links wie [Notiz](?note=Pfad.md))",
          ),
        dueDate: z
          .string()
          .optional()
          .describe("Optionales Fälligkeitsdatum im Format YYYY-MM-DD"),
        recurrence: z
          .enum(["weekly", "monthly", "quarterly", "yearly"])
          .nullable()
          .optional()
          .describe("Optionale Wiederholung (weekly, monthly, quarterly, yearly)"),
      },
      MCP_ANNOTATIONS.write,
      async ({ boardId, title, column, tags, description, dueDate, recurrence }) => {
        try {
          const card = await kanban.addCard(boardId, {
            title,
            column,
            tags,
            description,
            dueDate,
            recurrence,
          });
          return mcpJson({ created: true, card });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Karte konnte nicht erstellt werden",
          );
        }
      },
    );

    server.tool(
      "kanban_move_card",
      "Verschiebt eine Kanban-Karte anhand ihrer ID in eine andere Spalte (und optional an eine Position).",
      {
        boardId: z.string().min(1).describe("Board-ID"),
        cardId: z.string().min(1).describe("Karten-ID (z. B. 'k_a1b2c3')"),
        targetColumn: z
          .string()
          .min(1)
          .describe("Zielspalte (z. B. 'In Bearbeitung')"),
        order: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Optionale Zielposition (0-basiert)"),
      },
      MCP_ANNOTATIONS.writeIdempotent,
      async ({ boardId, cardId, targetColumn, order }) => {
        try {
          const card = await kanban.moveCard(
            boardId,
            cardId,
            targetColumn,
            order,
          );
          return mcpJson({ moved: true, card });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Karte konnte nicht verschoben werden",
          );
        }
      },
    );

    server.tool(
      "kanban_update_card",
      "Aktualisiert Titel, Beschreibung, Tags, Fälligkeitsdatum oder Spalte einer Kanban-Karte.",
      {
        boardId: z.string().min(1).describe("Board-ID"),
        cardId: z.string().min(1).describe("Karten-ID"),
        title: z.string().min(1).optional().describe("Neuer Titel"),
        column: z.string().min(1).optional().describe("Neue Spalte"),
        tags: z
          .array(z.string().min(1))
          .optional()
          .describe("Neue Tag-Liste (ersetzt bestehende Tags)"),
        description: z
          .string()
          .optional()
          .describe("Neue Markdown-Beschreibung"),
        dueDate: z
          .string()
          .nullable()
          .optional()
          .describe(
            "Fälligkeitsdatum YYYY-MM-DD (oder null / '' zum Entfernen)",
          ),
        recurrence: z
          .enum(["weekly", "monthly", "quarterly", "yearly"])
          .nullable()
          .optional()
          .describe("Wiederholung (weekly, monthly, quarterly, yearly oder null zum Entfernen)"),
      },
      MCP_ANNOTATIONS.writeIdempotent,
      async ({
        boardId,
        cardId,
        title,
        column,
        tags,
        description,
        dueDate,
        recurrence,
      }) => {
        try {
          const card = await kanban.updateCard(boardId, cardId, {
            title,
            column,
            tags,
            description,
            dueDate,
            recurrence,
          });
          return mcpJson({ updated: true, card });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Karte konnte nicht aktualisiert werden",
          );
        }
      },
    );

    server.tool(
      "kanban_list_overdue",
      "Listet alle überfälligen Kanban-Aufgaben auf (Fälligkeitsdatum vor heute, noch nicht in 'Fertiggestellt').",
      {
        boardId: z
          .string()
          .optional()
          .describe(
            "Optional auf eine Board-ID eingrenzen (sonst über alle Boards)",
          ),
      },
      MCP_ANNOTATIONS.readOnly,
      async ({ boardId }) => {
        try {
          const result = await kanban.listOverdueCards({ boardId });
          return mcpJson({
            today: result.today,
            count: result.items.length,
            tasks: result.items.map((item) => ({
              boardId: item.boardId,
              boardTitle: item.boardTitle,
              ...item.card,
            })),
          });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Überfällige Aufgaben konnten nicht geladen werden",
          );
        }
      },
    );

    server.tool(
      "kanban_delete_card",
      "Löscht eine Kanban-Karte dauerhaft aus dem Board.",
      {
        boardId: z.string().min(1).describe("Board-ID"),
        cardId: z.string().min(1).describe("Karten-ID"),
      },
      MCP_ANNOTATIONS.destructive,
      async ({ boardId, cardId }) => {
        try {
          await kanban.deleteCard(boardId, cardId);
          return mcpJson({ deleted: true, cardId });
        } catch (err) {
          return mcpError(
            err instanceof Error ? err.message : "Karte konnte nicht gelöscht werden",
          );
        }
      },
    );
  }

  return server;
}
