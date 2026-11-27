/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ins",
  "mark",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "a",
  "img",
  "div",
  "span",
  "input",
  "button",
  "details",
  "summary",
  "sup",
  "sub",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "id",
  "title",
  "alt",
  "href",
  "src",
  "type",
  "checked",
  "disabled",
  "data-task-index",
  "data-copy-code",
  "target",
  "rel",
  "colspan",
  "rowspan",
  "align",
]);

function isSafeUrl(raw: string): boolean {
  const val = raw.trim().toLowerCase();
  if (!val) return true;
  if (val.startsWith("#") || val.startsWith("/") || val.startsWith("./") || val.startsWith("../")) {
    return true;
  }
  if (val.startsWith("http:") || val.startsWith("https:") || val.startsWith("mailto:")) {
    return true;
  }
  if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(val)) {
    return true;
  }
  return !/^[a-z0-9+.-]+:/i.test(val);
}

function sanitizeNode(node: Node): void {
  const children = Array.from(node.childNodes);
  for (const child of children) {
    if (child.nodeType !== 1) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tag)) {
      el.remove();
      continue;
    }

    if (tag === "input" && el.getAttribute("type")?.toLowerCase() !== "checkbox") {
      el.remove();
      continue;
    }

    if (tag === "button" && el.getAttribute("type")?.toLowerCase() !== "button") {
      el.setAttribute("type", "button");
    }

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || !ALLOWED_ATTRS.has(name)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && !isSafeUrl(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }

    if (tag === "a" && el.getAttribute("target") === "_blank") {
      el.setAttribute("rel", "noopener noreferrer");
    }

    sanitizeNode(el);
  }
}

/**
 * Sanitizes an HTML string against XSS before inserting into innerHTML.
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof document === "undefined") return "";
  const template = document.createElement("template");
  template.innerHTML = html;
  sanitizeNode(template.content);
  return template.innerHTML;
}
