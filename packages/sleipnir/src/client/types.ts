/**
 * @project Sleipnir Stack / Client
 * @authors Stefan & Sam (AI Peer)
 * @collaboration Erarbeitet im gemeinschaftlichen Dialog.
 * Architektur & Review: Stefan | Implementation & Synthese: Sam
 */

/// <reference lib="dom" />

export type AlertLevel = "info" | "success" | "warning" | "error" | "default";

export interface AlertDetail {
  message: string;
  level?: AlertLevel;
  timeout?: number;
}

export interface AlertItem {
  id: number;
  level: AlertLevel;
  path: string;
  message: string;
  items: string[] | null;
}

export type ThemeMode = "light" | "dark";

export interface ThemeStore {
  mode: ThemeMode;
  init(): void;
  toggle(): void;
  apply(): void;
}

export interface AlpineInstance {
  data(
    name: string,
    callback: (...args: unknown[]) => Record<string, unknown>,
  ): void;
  store(name: string, value: unknown): unknown;
  store(name: "theme"): ThemeStore;
  directive(
    name: string,
    callback: (
      el: HTMLElement,
      directive: { expression: string; modifiers: string[] },
      utilities: {
        effect: (fn: () => void) => void;
        evaluateLater: (expr: string) => (cb: (value: unknown) => void) => void;
      },
    ) => void,
  ): void;
  plugin(plugin: (alpine: unknown) => void): void;
  mutateDom(callback: () => void): void;
  $persist: unknown;
}

export interface SleipnirWindow {
  showAlert(message: string, level?: AlertLevel, timeout?: number): void;
  blurOut(scope: { show: boolean }, el: HTMLElement, timeout?: number): void;
  hello(): void;
  Alpine?: AlpineInstance;
}
