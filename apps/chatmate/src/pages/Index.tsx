/**
 * @project Sleipnir Stack / Chatmate
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

import { Child } from "hono/jsx";
import { AlertZone, LOGO, proxyRedirect, themeInit } from "@sleipnir/core";

interface PageProps {
  title?: string;
  content: Child;
}

export const Index = (
  { title = "Chatmate | NextGen AI", content }: PageProps,
) => {
  return (
    <html data-theme="corvus" lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <link rel="icon" type="image/x-icon" href={LOGO}></link>
        <link href="./static/styles.css" rel="stylesheet" />
        <link href="./static/vendor/nord.min.css" rel="stylesheet" />

        <script defer src="./static/vendor/alpine-collapse.min.js"></script>
        <script defer src="./static/vendor/alpine-focus.min.js"></script>
        <script defer src="./static/vendor/alpine-mask.min.js"></script>
        <script defer src="./static/vendor/alpine-persist.min.js"></script>
        <script defer src="./static/sleipnir-client.min.js"></script>
        <script defer src="./static/vendor/marked.min.js"></script>
        <script defer src="./static/vendor/highlight.min.js"></script>
        <script defer src="./static/chatmate.js"></script>
        <script defer src="./static/vendor/alpine.min.js"></script>

        <script
          dangerouslySetInnerHTML={{
            __html: `(${proxyRedirect})();(${themeInit})();`,
          }}
        />
        <title>{title}</title>
      </head>

      <body class="bg-base-300 text-base-content min-h-screen flex flex-col relative">
        <AlertZone />
        {content}
      </body>
    </html>
  );
};
