/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

import type { AlertDetail, AlertItem, AlertLevel } from "./types.ts";

export const alertPaths: Record<AlertLevel, string> = {
  info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  warning: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  error: "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
  default: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

export function showAlert(
  message: string,
  level: AlertLevel = "info",
  timeout: number = 5000,
): void {
  globalThis.dispatchEvent(
    new CustomEvent<AlertDetail>("showSystemAlert", {
      detail: { message, level, timeout },
    }),
  );
}

export function createDialogSystem(): {
  alerts: AlertItem[];
  init(): void;
  removeAlert(id: number): void;
} {
  return {
    alerts: [],
    init() {
      const onAlert = (event: Event) => {
        const customEvent = event as CustomEvent<AlertDetail>;
        const id = Date.now() + Math.random();
        const level: AlertLevel = customEvent.detail?.level || "info";
        const message = customEvent.detail?.message || "";
        const timeout = typeof customEvent.detail?.timeout === "number" ? customEvent.detail.timeout : 5000;
        const lines = typeof message === "string" ? message.split("\n").map((s) => s.trim()).filter(Boolean) : [];

        this.alerts.push({
          id,
          level,
          path: alertPaths[level] || alertPaths.default,
          message,
          items: lines.length > 1 ? lines : null,
        });

        if (timeout > 0) {
          setTimeout(() => {
            this.removeAlert(id);
          }, timeout);
        }
      };

      globalThis.addEventListener("showSystemAlert", onAlert);
    },
    removeAlert(id: number) {
      this.alerts = this.alerts.filter((a) => a.id !== id);
    },
  };
}
