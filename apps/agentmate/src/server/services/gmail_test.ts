/**
 * @project Sleipnir Stack / Agentmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { assertEquals, assertRejects } from "@std/assert";
import { base64UrlToStandardBase64, collectAttachments, importGmailLabelToScanmate } from "./gmail.ts";

Deno.test("collectAttachments - skips inline images and unsupported extensions", () => {
  const payload = {
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "text/plain",
        filename: "",
        body: { size: 100 },
      },
      {
        mimeType: "image/png",
        filename: "logo.png",
        headers: [
          { name: "Content-Disposition", value: 'inline; filename="logo.png"' },
          { name: "Content-ID", value: "<logo@example.com>" },
        ],
        body: { attachmentId: "att-inline-1" },
      },
      {
        mimeType: "image/jpeg",
        filename: "pixel.jpg",
        headers: [{ name: "Content-ID", value: "<pixel@example.com>" }],
        body: { attachmentId: "att-cid-only" },
      },
      {
        mimeType: "application/pdf",
        filename: "Rechnung_2026.pdf",
        headers: [{ name: "Content-Disposition", value: 'attachment; filename="Rechnung_2026.pdf"' }],
        body: { attachmentId: "att-pdf-1" },
      },
      {
        mimeType: "text/html",
        filename: "malware.html",
        headers: [{ name: "Content-Disposition", value: 'attachment; filename="malware.html"' }],
        body: { attachmentId: "att-html-1" },
      },
    ],
  };

  const acc: Array<{ filename: string; mimeType: string; attachmentId: string }> = [];
  collectAttachments(payload, acc);
  assertEquals(acc.length, 1);
  assertEquals(acc[0].filename, "Rechnung_2026.pdf");
  assertEquals(acc[0].attachmentId, "att-pdf-1");
});

Deno.test("base64UrlToStandardBase64 - normalizes URL-safe base64 and padding", () => {
  assertEquals(base64UrlToStandardBase64("SGVsbG8td29ybGRf"), "SGVsbG8td29ybGRf");
  assertEquals(base64UrlToStandardBase64("SGVsbG8td29ybGQ"), "SGVsbG8td29ybGQ=");
});

Deno.test("importGmailLabelToScanmate - rejects missing token or label", async () => {
  await assertRejects(
    () => importGmailLabelToScanmate({ accessToken: "  ", labelName: "ScanMate" }),
    Error,
    "Google Access-Token fehlt",
  );
  await assertRejects(
    () => importGmailLabelToScanmate({ accessToken: "ya29.testtoken123", labelName: " " }),
    Error,
    "Gmail-Label fehlt",
  );
});
