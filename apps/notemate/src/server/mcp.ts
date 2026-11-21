/**
 * @project Sleipnir Stack / Notemate MCP
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import type { NoteStorage } from "./services/storage.ts";

import { MCP_ANNOTATIONS, mcpError, mcpJson, McpServer, z } from "@sleipnir/core/mcp";

/**
 * Creates a configured NoteMate MCP server bound to the given NoteStorage instance.
 */
export function createNotemateMcpServer(storage: NoteStorage): McpServer {
  const server = new McpServer({
    name: "notemate",
    version: "1.0.0",
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
        return mcpError(err instanceof Error ? err.message : "Fehler beim Laden des Baums");
      }
    },
  );

  server.tool(
    "notemate_read_note",
    "Liest den vollständigen Markdown-Inhalt einer Notiz anhand ihres relativen Pfads.",
    {
      path: z.string().min(1).describe("Relativer Pfad zur Notiz (z. B. 'Rezepte/Pasta.md')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ path }) => {
      try {
        const note = await storage.getNote(path);
        return mcpJson(note);
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Notiz nicht gefunden");
      }
    },
  );

  server.tool(
    "notemate_write_note",
    "Erstellt oder aktualisiert eine Markdown-Notiz unter dem angegebenen Pfad.",
    {
      path: z.string().min(1).describe("Relativer Pfad zur Notiz (z. B. 'Ideen/Architektur.md')"),
      content: z.string().describe("Vollständiger Markdown-Inhalt der Notiz"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path, content }) => {
      try {
        const note = await storage.saveNote(path, content);
        return mcpJson({ saved: true, note });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Fehler beim Speichern");
      }
    },
  );

  server.tool(
    "notemate_search",
    "Gerankte MiniSearch-Volltextsuche über alle Notizen (Titel und Tags werden höher gewichtet).",
    {
      query: z.string().min(1).describe("Suchbegriff(e)"),
      limit: z.number().int().min(1).max(100).default(20).describe("Maximale Anzahl Ergebnisse"),
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
        return mcpError(err instanceof Error ? err.message : "Ordner konnte nicht erstellt werden");
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
        return mcpError(err instanceof Error ? err.message : "Umbenennen fehlgeschlagen");
      }
    },
  );

  server.tool(
    "notemate_delete_item",
    "Löscht eine Notiz oder einen Ordner rekursiv.",
    {
      path: z.string().min(1).describe("Relativer Pfad des zu löschenden Elements"),
    },
    MCP_ANNOTATIONS.destructive,
    async ({ path }) => {
      try {
        await storage.deleteItem(path);
        return mcpJson({ deleted: true, path });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Löschen fehlgeschlagen");
      }
    },
  );

  server.tool(
    "notemate_list_untagged",
    "Listet alle Notizen/Rezepte ohne YAML-Frontmatter-Tags auf (optional auf einen Ordner wie 'Rezepte' eingegrenzt).",
    {
      folder: z.string().optional().describe("Optionaler Unterordner (z. B. 'Rezepte')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ folder }) => {
      try {
        const notes = await storage.listUntaggedNotes(folder);
        return mcpJson({ count: notes.length, notes });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Fehler beim Laden ungetaggter Notizen");
      }
    },
  );

  server.tool(
    "notemate_list_tags",
    "Listet alle vordefinierten, erlaubten Tags (inkl. Kategorie & aktueller Nutzungsanzahl) auf.",
    {
      folder: z.string().optional().describe("Optionaler Unterordner für die Zählung (z. B. 'Rezepte')"),
    },
    MCP_ANNOTATIONS.readOnly,
    async ({ folder }) => {
      try {
        const tags = await storage.listAllTags(folder);
        return mcpJson({ count: tags.length, tags });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Fehler beim Laden der Tags");
      }
    },
  );

  server.tool(
    "notemate_add_tags",
    "Fügt einer Notiz/einem Rezept erlaubte Tags aus notemate_list_tags im YAML-Frontmatter hinzu.",
    {
      path: z.string().min(1).describe("Relativer Pfad zur Notiz (z. B. 'Rezepte/Pasta.md')"),
      tags: z.array(z.string().min(1)).min(1).describe("Erlaubte Tags aus notemate_list_tags"),
    },
    MCP_ANNOTATIONS.writeIdempotent,
    async ({ path, tags }) => {
      try {
        const result = await storage.addNoteTags(path, tags);
        return mcpJson({ updated: true, ...result });
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : "Tags konnten nicht hinzugefügt werden");
      }
    },
  );

  return server;
}
