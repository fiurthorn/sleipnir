document.addEventListener("alpine:init", () => {
  /**
   * Alpine.js component for auto-hiding elements after a specified timeout.
   * The component manages the visibility of the element and removes it from the DOM after hiding.
   *
   * usage in HTML:
   * <div x-data="autoHide(5000)" x-show="show" …></div>
   *
   * @param {number} timeout - The duration in milliseconds before the element is hidden and removed.
   * @returns {object} - An object containing the component's state and initialization logic.
   */
  Alpine.data("autoHide", (timeout = 5000) => ({
    show: true,
    init() {
      setTimeout(() => {
        this.show = false;
        setTimeout(() => this.$el.remove(), 100);
      }, timeout);
    },
  }));

  Alpine.data("globalActions", () => ({
    hello: globalThis.hello,
  }));

  /**
   * Safe x-html directive for the Alpine.js CSP build.
   * Re-enables innerHTML binding without unsafe-eval or recursive template scanning.
   */
  Alpine.directive("html", (el, { expression }, { effect, evaluateLater }) => {
    const evaluate = evaluateLater(expression);
    effect(() => {
      evaluate((value) => {
        Alpine.mutateDom(() => {
          el.innerHTML = value ?? "";
        });
      });
    });
  });

  /**
   * System Alert / Toast Event Bus & Component
   */
  const paths = {
    info: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    success: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
    warning:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    error:
      "M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z",
    default: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  };

  window.showAlert = (message, level = "info", timeout = 5000) => {
    window.dispatchEvent(
      new CustomEvent("showSystemAlert", {
        detail: { message, level, timeout },
      }),
    );
  };

  Alpine.data("dialogSystem", () => ({
    alerts: [],

    init() {
      const onAlert = (event) => {
        const id = Date.now() + Math.random();
        const level = event.detail?.level || "info";
        const message = event.detail?.message || "";
        const timeout = typeof event.detail?.timeout === "number"
          ? event.detail.timeout
          : 5000;
        const lines = typeof message === "string"
          ? message.split("\n").map((s) => s.trim()).filter(Boolean)
          : [];

        this.alerts.push({
          id,
          level,
          path: paths[level] || paths.default,
          message,
          items: lines.length > 1 ? lines : null,
        });

        if (timeout > 0) {
          setTimeout(() => {
            this.removeAlert(id);
          }, timeout);
        }
      };

      window.addEventListener("showSystemAlert", onAlert);
    },

    removeAlert(id) {
      this.alerts = this.alerts.filter((a) => a.id !== id);
    },
  }));
});

