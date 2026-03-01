const persistStoreKey = "global-counter";

export const AlpineCounterFragment = () => {
  return (
    <div
      id="counter-ui"
      class={`flex items-center gap-4 p-4 bg-base-200 rounded-xl shadow-inner`}
      x-data={`{ count: $persist(0).as('${persistStoreKey}') }`}
    >
      <button
        type="button"
        x-on:click="count--"
        class="btn btn-circle btn-outline btn-primary"
      >
        -
      </button>

      <span class="text-4xl font-mono min-w-[3ch] text-center" x-text="count">
      </span>

      <button
        type="button"
        x-on:click="count++"
        class="btn btn-circle btn-outline btn-primary"
      >
        +
      </button>
    </div>
  );
};
