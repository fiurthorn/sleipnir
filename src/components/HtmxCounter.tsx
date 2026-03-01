export interface Counter {
  initial: number;
}

const bgClass = (() => {
  const map: Record<string, string> = {
    purple: "bg-nord-aurora-purple",
    green: "bg-nord-aurora-green",
    red: "bg-nord-aurora-red",
    orange: "bg-nord-aurora-orange",
    neutral: "bg-base-200",
  };
  return (count: number) => {
    if (count < -10) {
      return map.red;
    }

    if (count < 0) {
      return map.orange;
    }

    if (count > 10) {
      return map.purple;
    }

    if (count > 0) {
      return map.green;
    }

    return map["neutral"];
  };
})();

export const HtmxCounterFragment = ({ initial: count }: Counter) => {
  // Wichtig: hx-target="this" bedeutet, dass der Button-Container sich selbst ersetzt
  return (
    <div
      id="counter-ui"
      class={`flex items-center gap-4 p-4 ${
        bgClass(count)
      } rounded-xl shadow-inner`}
    >
      <button
        type="button"
        hx-get="./api/counter/decrement"
        hx-target="#counter-ui"
        hx-swap="outerHTML"
        class="btn btn-circle btn-outline btn-primary"
      >
        -
      </button>

      <span class="text-4xl font-mono min-w-[3ch] text-center">{count}</span>

      <button
        type="button"
        hx-get="./api/counter/increment"
        hx-target="#counter-ui"
        hx-swap="outerHTML"
        class="btn btn-circle btn-outline btn-primary"
      >
        +
      </button>
    </div>
  );
};
