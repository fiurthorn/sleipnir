import { Sleipnir } from "../sleipnir.ts";

export function alertApi(app: Sleipnir, path: string) {
  app.get(path, (c) =>
    c.html(
      <div
        x-show="show"
        x-data="autoHide(5000)"
        x-transition:leave="transition ease-in duration-500"
        x-transition:leave-start="opacity-100 scale-100"
        x-transition:leave-end="opacity-0 scale-90"
        role="alert"
        class="alert alert-info shadow-lg mb-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          class="stroke-current h-6 w-6 shrink-0"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          >
          </path>
        </svg>
        <span>Corvus Corax: System bereit.</span>
        <button
          type="button"
          x-on:click="show=false"
          class="btn btn-ghost btn-xs"
        >
          X
        </button>
      </div>,
    ));
}
