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
});

