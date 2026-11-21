/**
 * @project Sleipnir Stack / Notemate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { PersistentSearchIndex } from "@sleipnir/core/search";
import { basename, extname, join, normalize, relative, resolve } from "@std/path";
import { formatMarkdown } from "./formatter.ts";
import { addTagsToMarkdown, ALLOWED_TAG_DEFINITIONS, extractTagsFromMarkdown, resolveAllowedTags, setTagsInMarkdown } from "./tags.ts";

export interface TreeNode {
  name: string;
  path: string; // Relative path, e.g. "Projekte/Architektur.md"
  type: "file" | "directory";
  children?: TreeNode[];
  updatedAt?: number;
  size?: number;
  tags?: string[];
}

export interface NoteDetail {
  path: string;
  title: string;
  content: string;
  updatedAt: number;
  tags: string[];
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  matchCount: number;
  tags?: string[];
  score?: number;
}

interface NoteSearchDoc {
  id: string;
  title: string;
  tags: string;
  path: string;
  content: string;
  tagList: string[];
  snippet: string;
}

export interface StorageConfig {
  dataDir?: string;
}

export class NoteStorage {
  private baseDir: string;
  private attachmentsDir: string;
  private searchIndex: PersistentSearchIndex<NoteSearchDoc>;

  constructor(config?: StorageConfig) {
    const rawDir = config?.dataDir || Deno.env.get("NOTEMATE_DATA_DIR") ||
      "./data/notes";
    this.baseDir = resolve(rawDir);
    this.attachmentsDir = join(this.baseDir, ".attachments");
    this.ensureBaseDirs();
    this.searchIndex = new PersistentSearchIndex<NoteSearchDoc>({
      fields: ["title", "tags", "path", "content"],
      storeFields: ["title", "path", "tagList", "snippet"],
      boost: { title: 4, tags: 3, path: 2, content: 1 },
      persistPath: join(this.baseDir, ".search-index.json"),
    });
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
    const targetPath = join(this.baseDir, "Willkommen.md");
    try {
      Deno.writeTextFileSync(targetPath, welcomeContent);
    } catch (e) {
      console.warn("Could not create initial welcome note:", e);
    }
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
        // Skip hidden files and the attachments directory
        if (entry.name.startsWith(".") || entry.name === "attachments") {
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
          const [fileInfo, content] = await Promise.all([
            Deno.stat(fullPath),
            Deno.readTextFile(fullPath).catch(() => ""),
          ]);
          nodes.push({
            name: entry.name.replace(/\.md$/, ""),
            path: relPath,
            type: "file",
            updatedAt: fileInfo.mtime?.getTime() ?? Date.now(),
            size: fileInfo.size,
            tags: extractTagsFromMarkdown(content),
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
      tags: extractTagsFromMarkdown(content),
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

    const formattedContent = await formatMarkdown(content);

    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.writeTextFile(fullPath, formattedContent);
    const stat = await Deno.stat(fullPath);

    return {
      path: normalizedRel,
      title: basename(normalizedRel, ".md"),
      content: formattedContent,
      updatedAt: stat.mtime?.getTime() ?? Date.now(),
      tags: extractTagsFromMarkdown(formattedContent),
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
   * Computes the hierarchical attachments subdirectory for a note.
   * Example: "Hallo Welt.md" -> "Hallo_Welt"
   * Example: "Rezepte/Pasta/Carbonara.md" -> "Rezepte/Pasta/Carbonara"
   */
  getAttachmentSubdir(notePath?: string): string {
    if (!notePath || typeof notePath !== "string") {
      return "default";
    }
    const clean = notePath.replace(/^(\/|\\)+/, "").replace(/\.md$/i, "");
    return clean
      .split("/")
      .map((part) => part.trim().replace(/\s+/g, "_"))
      .filter(Boolean)
      .join("/");
  }

  /**
   * Deletes a note or folder recursively.
   * Also cleans up associated attachments subdirectory if a note is deleted.
   */
  async deleteItem(relPath: string): Promise<void> {
    const fullPath = this.resolveSafePath(relPath);
    if (fullPath === this.baseDir) {
      throw new Error("Cannot delete root directory");
    }
    await Deno.remove(fullPath, { recursive: true });

    // Clean up note-specific attachments folder if it exists
    const attachSubdir = this.getAttachmentSubdir(relPath);
    const attachFolder = join(this.attachmentsDir, attachSubdir);
    try {
      await Deno.remove(attachFolder, { recursive: true });
    } catch {
      // Ignore if folder does not exist
    }
  }

  /**
   * Renames or moves a file or directory.
   * Also renames any associated attachments subdirectory and updates references inside note.
   */
  async renameItem(oldRelPath: string, newRelPath: string): Promise<void> {
    const oldFull = this.resolveSafePath(oldRelPath);
    const newFull = this.resolveSafePath(newRelPath);

    const parentDir = resolve(newFull, "..");
    await Deno.mkdir(parentDir, { recursive: true });
    await Deno.rename(oldFull, newFull);

    // Also rename note-specific attachments folder if it exists
    const oldAttachSubdir = this.getAttachmentSubdir(oldRelPath);
    const newAttachSubdir = this.getAttachmentSubdir(newRelPath);
    if (oldAttachSubdir !== newAttachSubdir) {
      const oldAttachFolder = join(this.attachmentsDir, oldAttachSubdir);
      const newAttachFolder = join(this.attachmentsDir, newAttachSubdir);
      try {
        const stat = await Deno.stat(oldAttachFolder);
        if (stat.isDirectory) {
          await Deno.mkdir(resolve(newAttachFolder, ".."), { recursive: true });
          await Deno.rename(oldAttachFolder, newAttachFolder);
        }
      } catch {
        // Ignore if old attachments directory does not exist
      }

      // Update markdown references inside the renamed file if it is a note
      if (newRelPath.endsWith(".md")) {
        try {
          let content = await Deno.readTextFile(newFull);
          const oldRef = `attachments/${oldAttachSubdir}`;
          const newRef = `attachments/${newAttachSubdir}`;
          if (content.includes(oldRef)) {
            content = content.replaceAll(oldRef, newRef);
            await Deno.writeTextFile(newFull, content);
          }
        } catch {
          // Ignore
        }
      }
    }
  }

  /**
   * Saves an attachment (e.g. pasted image) into attachments/<noteSubdir>/
   * and returns the public asset URL.
   */
  async saveAttachment(
    suggestedName: string,
    bytes: Uint8Array,
    notePath?: string,
  ): Promise<{ filename: string; url: string; relPath: string }> {
    const ext = extname(suggestedName) || ".png";
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rand = Math.random().toString(36).substring(2, 7);
    const cleanFilename = `img_${timestamp}_${rand}${ext}`;

    const subDir = this.getAttachmentSubdir(notePath);
    const targetDir = join(this.attachmentsDir, subDir);
    await Deno.mkdir(targetDir, { recursive: true });

    const filePath = join(targetDir, cleanFilename);
    await Deno.writeFile(filePath, bytes);

    const relUrlPath = subDir ? `${subDir}/${cleanFilename}` : cleanFilename;

    return {
      filename: cleanFilename,
      relPath: relUrlPath,
      url: `./attachments/${relUrlPath}`,
    };
  }

  /**
   * Retrieves an attachment file for serving.
   * Supports nested paths (e.g. "Rezepte/Pasta/Carbonara/img_123.png")
   * and falls back to the legacy .attachments/ directory.
   */
  async getAttachment(
    relPath: string,
  ): Promise<{ data: Uint8Array; contentType: string } | null> {
    if (!relPath || typeof relPath !== "string") {
      return null;
    }

    const clean = relPath.replace(/^(\/|\\)+/, "");
    const filePath = resolve(this.attachmentsDir, normalize(clean));

    // Guard Clause: Prevent path traversal outside attachmentsDir
    if (!filePath.startsWith(this.attachmentsDir)) {
      return null;
    }

    try {
      const data = await Deno.readFile(filePath);
      const ext = extname(filePath).toLowerCase();
      return { data, contentType: this.getContentType(ext) };
    } catch {
      // Fallback: check legacy .attachments directory in baseDir
      const legacyBase = join(this.baseDir, ".attachments");
      const legacyPath = resolve(legacyBase, normalize(clean));
      if (legacyPath.startsWith(legacyBase)) {
        try {
          const data = await Deno.readFile(legacyPath);
          const ext = extname(legacyPath).toLowerCase();
          return { data, contentType: this.getContentType(ext) };
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  private getContentType(ext: string): string {
    if (ext === ".png") return "image/png";
    if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
    if (ext === ".webp") return "image/webp";
    if (ext === ".gif") return "image/gif";
    if (ext === ".svg") return "image/svg+xml";
    return "application/octet-stream";
  }

  /**
   * Full-text search across all notes using MiniSearch (title & tags boosted).
   */
  async searchNotes(query: string, limit = 25): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const files = await this.collectMarkdownFiles(this.baseDir);
    const entries = await Promise.all(
      files.map(async (fullPath) => {
        const relPath = relative(this.baseDir, fullPath).replace(/\\/g, "/");
        const stat = await Deno.stat(fullPath).catch(() => null);
        const mtimeMs = stat?.mtime?.getTime() ?? 0;
        return {
          id: relPath,
          mtimeMs,
          load: async (): Promise<NoteSearchDoc | null> => {
            try {
              const content = await Deno.readTextFile(fullPath);
              const tagList = extractTagsFromMarkdown(content);
              const cleanSnippet = content
                .replace(/^---[\s\S]*?---\s*/, "")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 140);
              return {
                id: relPath,
                title: basename(relPath, ".md"),
                tags: tagList.join(" "),
                path: relPath,
                content,
                tagList,
                snippet: cleanSnippet ? `${cleanSnippet}...` : "",
              };
            } catch {
              return null;
            }
          },
        };
      }),
    );

    await this.searchIndex.syncFromEntries(entries);
    const hits = this.searchIndex.search(trimmed, limit);

    return hits.map((hit) => ({
      path: hit.id,
      title: hit.doc.title || basename(hit.id, ".md"),
      snippet: hit.doc.snippet || "",
      matchCount: hit.terms.length,
      tags: hit.doc.tagList ?? [],
      score: Number(hit.score.toFixed(2)),
    }));
  }

  private async collectMarkdownFiles(dir: string, out: string[] = []): Promise<string[]> {
    try {
      for await (const entry of Deno.readDir(dir)) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory) {
          await this.collectMarkdownFiles(fullPath, out);
          continue;
        }
        if (entry.isFile && entry.name.endsWith(".md")) {
          out.push(fullPath);
        }
      }
    } catch {
      // Verzeichnis existiert ggf. noch nicht
    }
    return out;
  }

  /**
   * Lists all markdown notes without frontmatter tags (optionally scoped to a subfolder).
   */
  async listUntaggedNotes(folder?: string): Promise<Array<{ path: string; title: string }>> {
    const startDir = folder ? this.resolveSafePath(folder) : this.baseDir;
    const files = await this.collectMarkdownFiles(startDir);
    const untagged: Array<{ path: string; title: string }> = [];

    for (const fullPath of files) {
      const content = await Deno.readTextFile(fullPath);
      if (extractTagsFromMarkdown(content).length > 0) continue;
      const relPath = relative(this.baseDir, fullPath).replace(/\\/g, "/");
      untagged.push({
        path: relPath,
        title: basename(relPath, ".md"),
      });
    }

    return untagged.sort((a, b) => a.path.localeCompare(b.path));
  }

  /**
   * Lists the predefined allowed tags along with their category and current usage counts.
   */
  async listAllTags(
    folder?: string,
  ): Promise<Array<{ tag: string; category: string; count: number }>> {
    const startDir = folder ? this.resolveSafePath(folder) : this.baseDir;
    const files = await this.collectMarkdownFiles(startDir);
    const usage = new Map<string, number>();

    for (const fullPath of files) {
      const content = await Deno.readTextFile(fullPath);
      for (const tag of extractTagsFromMarkdown(content)) {
        const key = tag.toLowerCase();
        usage.set(key, (usage.get(key) ?? 0) + 1);
      }
    }

    return ALLOWED_TAG_DEFINITIONS.map((def) => ({
      tag: def.tag,
      category: def.category,
      count: usage.get(def.tag.toLowerCase()) ?? 0,
    }));
  }

  /**
   * Validates tags against the predefined vocabulary and adds them to the note's YAML frontmatter.
   */
  async addNoteTags(
    relPath: string,
    tags: string[],
  ): Promise<{ path: string; tags: string[] }> {
    const allowedTags = resolveAllowedTags(tags);
    if (allowedTags.length === 0) {
      throw new Error("Mindestens ein gültiger Tag erforderlich.");
    }
    const note = await this.getNote(relPath);
    const updated = addTagsToMarkdown(note.content, allowedTags);
    const saved = await this.saveNote(note.path, updated.content);
    return {
      path: saved.path,
      tags: saved.tags,
    };
  }

  /**
   * Replaces the note's YAML frontmatter tags with the validated tag list.
   */
  async setNoteTags(relPath: string, tags: string[]): Promise<NoteDetail> {
    const allowedTags = tags.length > 0 ? resolveAllowedTags(tags) : [];
    const note = await this.getNote(relPath);
    const updated = setTagsInMarkdown(note.content, allowedTags);
    return await this.saveNote(note.path, updated.content);
  }
}
