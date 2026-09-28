/**
 * Blurs out an element after a timeout and removes it from the DOM.
 * Designed to be used with Alpine.js for auto-hiding alerts or notifications.
 *
 * Usage in HTML:
 *   <div x-data="{ show: true }" x-init="blurOut($data, $el);" …></div>
 *
 * @param {{show:boolean}} scope
 * @param {HTMLElement} el
 * @param {number} timeout
 */
function blurOut(scope, el, timeout = 5000) {
  setTimeout(() => {
    scope.show = false;
    setTimeout(() => el.remove(), 100);
  }, timeout);
}

function hello() {
  alert("Corvus Corax");
}

Object.assign(window, { hello, blurOut });
