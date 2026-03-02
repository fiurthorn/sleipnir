document.addEventListener("alpine:init", () => {
  Alpine.data("autoHide", (timeout = 5000) => ({
    show: true,
    init() {
      setTimeout(() => (this.show = false), timeout);
    },
  }));

  Alpine.data("globalActions", () => ({
    hello: globalThis.hello,
  }));
});
