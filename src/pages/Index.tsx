import { Child } from "hono/jsx";
import { proxyRedirect } from "../lib/utils.ts";

interface PageProps {
  title?: string;
  content: Child;
}

export const Index = ({ title = "Corvus Corax", content }: PageProps) => {
  return (
    <html data-theme="corvus" lang="de">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />
        <link href="./static/styles.css" rel="stylesheet" />

        <script defer src="./static/vendor/htmx.min.js"></script>

        <script defer src="./static/vendor/alpine-collapse.min.js"></script>
        <script defer src="./static/vendor/alpine-focus.min.js"></script>
        <script defer src="./static/vendor/alpine-mask.min.js"></script>
        <script defer src="./static/alpine-cookie-persist.js"></script>
        <script defer src="./static/vendor/alpine-persist.min.js"></script>
        <script defer src="./static/vendor/alpine.min.js"></script>

        <script type="module" src="./static/client.js"></script>
        <script dangerouslySetInnerHTML={{ __html: `(${proxyRedirect})();` }} />
        <title>{title}</title>
      </head>

      <body class="bg-base-200 min-h-screen flex items-center justify-center">
        <div
          id="alert-zone"
          class="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
        >
        </div>

        {content}
      </body>
    </html>
  );
};
