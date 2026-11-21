/**
 * @project Sleipnir Stack / Scanmate
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
  title = "Scanmate | Mobile Document & Receipt Scanner",
  basePath = "",
  content,
}: PageProps) => {
  return (
    <html data-theme="corvus" lang="de">
      <head>
        <base href={basePath || "."} />
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <link rel="icon" type="image/x-icon" href={LOGO}></link>
        <link href="./static/styles.css" rel="stylesheet" />
        <link href="./static/vendor/nord.min.css" rel="stylesheet" />

        {/* OpenCV & jscanify Scanner Engine */}
        <script async src="./static/vendor/opencv.js"></script>
        <script defer src="./static/vendor/jscanify.min.js"></script>

        {/* Alpine & Plugins */}
        <script defer src="./static/vendor/alpine-collapse.min.js"></script>
        <script defer src="./static/vendor/alpine-focus.min.js"></script>
        <script defer src="./static/vendor/alpine-mask.min.js"></script>
        <script defer src="./static/vendor/alpine-persist.min.js"></script>
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

      <body class="bg-base-300 text-base-content min-h-screen flex flex-col relative">
        <AlertZone />
        {content}
      </body>
    </html>
  );
};
