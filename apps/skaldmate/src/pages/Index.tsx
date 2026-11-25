/**
 * @project Sleipnir Stack / Skaldmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { AlertZone, LOGO, proxyRedirect, themeInit } from "@sleipnir/core";
import type { Child } from "hono/jsx";

interface PageProps {
  title?: string;
  basePath?: string;
  content: Child;
}

export const Index = ({
  title = "Skaldmate | Storytelling & Gruppenchat",
  basePath = "",
  content,
}: PageProps) => {
  return (
    <html data-theme="corvus" lang="de">
      <head>
        <base href={basePath || "."} />
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/svg+xml" href={LOGO} />
        <link href="./static/styles.css" rel="stylesheet" />

        <script defer src="./static/sleipnir-client.min.js"></script>
        <script defer src="./static/client.js"></script>
        <script defer src="./static/vendor/alpine.min.js"></script>

        <script
          dangerouslySetInnerHTML={{
            __html: `(${proxyRedirect})();(${themeInit})();`,
          }}
        />
        <title>{title}</title>
      </head>

      <body class="bg-base-300 text-base-content min-h-screen flex flex-col relative antialiased">
        <AlertZone />
        {content}
      </body>
    </html>
  );
};
