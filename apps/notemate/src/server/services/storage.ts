/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import {
  basename,
  extname,
  join,
  normalize,
  relative,
  resolve,
} from "@std/path";

export interface TreeNode {
  name: string;
  path: string; // Relative path, e.g. "Projekte/Architektur.md"
  type: "file" | "directory";
  children?: TreeNode[];
  updatedAt?: number;
  size?: number;
}

export interface NoteDetail {
  path: string;
  title: string;
  content: string;
  updatedAt: number;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  matchCount: number;
}

export interface StorageConfig {
  dataDir?: string;
}

export class NoteStorage {
  private baseDir: string;
  private attachmentsDir: string;

  constructor(config?: StorageConfig) {
    const rawDir = config?.dataDir ||
      Deno.env.get("NOTEMATE_DATA_DIR") ||
      "./data/notes";
    this.baseDir = resolve(rawDir);
    this.attachmentsDir = join(this.baseDir, ".attachments");
    this.ensureBaseDirs();
  }

  private ensureBaseDirs(): void {
    try {
      Deno.mkdirSync(this.baseDir, { recursive: true });
      Deno.mkdirSync(this.attachmentsDir, { recursive: true });

      // Create welcome note if directory is empty
      const entries = [...Deno.readDirSync(this.baseDir)];
      const visibleEntries = entries.filter((e) => !e.name.startsWith("."));
      if (visibleEntries.length === 0) {
        this.createWelcomeNote();
      }
    } catch (e) {
      console.error("Failed to initialize storage directories:", e);
    }
  }

  private createWelcomeNote(): void {
    const welcomeContent = `# Willkommen bei Notemate 📝

Notemate ist deine **hierarchische, ablenkungsfreie Markdown-Ablage** – direkt auf deinem Dateisystem.

## 🚀 Kernfunktionen:
- 📁 **Echte Ordner:** Organisiere Notizen in beliebig tiefen Verzeichnissen.
- 🖼️ **Bilder per Paste:** Drücke einfach \`Strg+V\` oder \`Cmd+V\` im Editor, um Screenshots direkt einzufügen!
- ⚡ **Zero Database:** Alle Notizen liegen als reine \`.md\`-Dateien vor. Keine proprietären Silos.
- 🔍 **Schnellsuche:** Durchsuche alle Notizen und Ordner in Echtzeit.

---
*Viel Spaß beim Organisieren deiner Gedanken!*
`;
    this.saveNote("Willkommen.md", welcomeContent);
  }

  /**
   * Resolves and verifies that a relative path stays within the base directory.
   * Throws Error if path escapes the sandbox (Path Traversal Protection).
   */
  private resolveSafePath(relPath: string): string {
    if (!relPath || typeof relPath !== "string") {
      throw new Error("Invalid relative path");
    }

    // Strip leading slashes to treat as relative
    const cleanRel = relPath.replace(/^(\/|\\)+/, "");
    const targetPath = resolve(this.baseDir, normalize(cleanRel));

    // Guard Clause: Path must be strictly within baseDir
    if (!targetPath.startsWith(this.baseDir)) {
      throw new Error("Access denied: Path escapes notes directory");
    }

    return targetPath;
  }

  /**
   * Recursively reads the notes directory and produces a hierarchical tree.
   */
  async getTree(): Promise<TreeNode[]> {
    return await this.scanDirectory(this.baseDir);
  }

  private async scanDirectory(currentDir: string): Promise<TreeNode[]> {
    const nodes: TreeNode[] = [];

    try {
      for await (const entry of Deno.readDir(currentDir)) {
        // Skip hidden files and the .attachments directory
        if (entry.name.startsWith(".")) {
          continue;
        }

        const fullPath = join(currentDir, entry.name);
        const relPath = relative(this.baseDir, fullPath).replace(/\\/g, "/");

        if (entry.isDirectory) {
          const children = await this.scanDirectory(fullPath);
          nodes.push({
            name: entry.name,
            path: relPath,
            type: "directory",
            children,
          });
        } else if (entry.isFile && entry.name.endsWith(".md")) {
          const fileInfo = await Deno.stat(fullPath);
          nodes.push({
            name: entry.name.replace(/\.md$/, ""),
            path: relPath,
            type: "file",
            updatedAt: fileInfo.mtime?.getTime() ?? Date.now(),
            size: fileInfo.size,
          });
        }
      }
    } catch (e) {
      console.error(`Error scanning directory ${currentDir}:`, e);
    }

    // Sort: directories first, then files alphabetically
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "directory" ? -1 : 1;
      }
      return a.name.localeCompare(b.name, "de", { sensitivity: "base" });
    });

    return nodes;
  }

  /**
   * Reads a single note's content and metadata.
   */
  async getNote(relPath: string): Promise<NoteDetail> {
    const fullPath = this.resolveSafePath(relPath);
    const content = await Deno.readTextFile(fullPath);
    const stat = await Deno.stat(fullPath);

    return {
      path: relPath.replace(/\\/g, "/"),
      title: basename(relPath, ".md"),
      content,
      updatedAt: stat.mtime?.getTime() ?? Date.now(),
    };
  }

  /**
   * Saves or creates a note. Automatically creates parent directories.
   */
  async saveNote(relPath: string, content: string): Promise<NoteDetail> {
    let normalizedRel = relPath.replace(/\\/g, "/");
    if (!normalizedRel.endsWith(".md")) {
      normalizedRel += ".md";
    }

    const fullPath = this.resolveSafePath(normalizedRel);
    const parentDir = resolve(fullPath, "..");

    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.writeTextFile(fullPath, content);
    const stat = await Deno.stat(fullPath);

    return {
      path: normalizedRel,
      title: basename(normalizedRel, ".md"),
      content,
      updatedAt: stat.mtime?.getTime() ?? Date.now(),
    };
  }

  /**
   * Creates a directory.
   */
  async createFolder(relPath: string): Promise<void> {
    const fullPath = this.resolveSafePath(relPath);
    await Deno.mkdir(fullPath, { recursive: true });
  }

  /**
   * Deletes a note or folder recursively.
   */
  async deleteItem(relPath: string): Promise<void> {
    const fullPath = this.resolveSafePath(relPath);
    if (fullPath === this.baseDir) {
      throw new Error("Cannot delete root directory");
    }
    await Deno.remove(fullPath, { recursive: true });
  }

  /**
   * Renames or moves a file or directory.
   */
  async renameItem(oldRelPath: string, newRelPath: string): Promise<void> {
    const oldFull = this.resolveSafePath(oldRelPath);
    const newFull = this.resolveSafePath(newRelPath);

    const parentDir = resolve(newFull, "..");
    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.rename(oldFull, newFull);
  }

  /**
   * Saves an attachment (e.g. pasted image) into .attachments/
   * and returns the public asset URL.
   */
  async saveAttachment(
    suggestedName: string,
    bytes: Uint8Array,
  ): Promise<{ filename: string; url: string }> {
    const ext = extname(suggestedName) || ".png";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).substring(2, 7);
    const cleanFilename = `img_${timestamp}_${rand}${ext}`;

    const filePath = join(this.attachmentsDir, cleanFilename);
    await Deno.writeFile(filePath, bytes);

    return {
      filename: cleanFilename,
      url: `/attachments/${cleanFilename}`,
    };
  }

  /**
   * Retrieves an attachment file for serving.
   */
  async getAttachment(
    filename: string,
  ): Promise<{ data: Uint8Array; contentType: string } | null> {
    // Sanitize filename: alphanumeric, dashes, dots, underscores only
    const safeName = basename(filename);
    const filePath = join(this.attachmentsDir, safeName);

    try {
      const data = await Deno.readFile(filePath);
      const ext = extname(safeName).toLowerCase();
      let contentType = "application/octet-stream";

      if (ext === ".png") contentType = "image/png";
      else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      else if (ext === ".webp") contentType = "image/webp";
      else if (ext === ".gif") contentType = "image/gif";
      else if (ext === ".svg") contentType = "image/svg+xml";

      return { data, contentType };
    } catch {
      return null;
    }
  }

  /**
   * Full-text search across all notes in the hierarchy.
   */
  async searchNotes(query: string): Promise<SearchResult[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const results: SearchResult[] = [];
    await this.searchRecursive(this.baseDir, trimmed, results);
    return results;
  }

  private async searchRecursive(
    dir: string,
    query: string,
    results: SearchResult[],
  ): Promise<void> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.name.startsWith(".")) continue;

        const fullPath = join(dir, entry.name);
        if (entry.isDirectory) {
          await this.searchRecursive(fullPath, query, results);
          continue;
        }

        if (entry.isFile && entry.name.endsWith(".md")) {
          const content = await Deno.readTextFile(fullPath);
          const lower = content.toLowerCase();
          const relPath = relative(this.baseDir, fullPath).replace(/\\/g, "/");

          if (lower.includes(query) || relPath.toLowerCase().includes(query)) {
            // Find snippet around first match
            const index = lower.indexOf(query);
            let snippet = "";
            if (index !== -1) {
              const start = Math.max(0, index - 40);
              const end = Math.min(content.length, index + query.length + 60);
              snippet = (start > 0 ? "..." : "") +
                content.substring(start, end).replace(/\n/g, " ") +
                (end < content.length ? "..." : "");
            } else {
              snippet = content.slice(0, 100).replace(/\n/g, " ") + "...";
            }

            // Count occurrences
            const matches = lower.split(query).length - 1;

            results.push({
              path: relPath,
              title: basename(relPath, ".md"),
              snippet,
              matchCount: Math.max(1, matches),
            });
          }
        }
      }
    } catch (e) {
      console.error(`Search error in ${dir}:`, e);
    }
  }
}
