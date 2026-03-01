import { AlpineCounterFragment } from "../components/AllpineCounter.tsx";
import { HtmxCounterFragment } from "../components/HtmxCounter.tsx";
import { getSessionData } from "../server/session.ts";
import { ContentParameter } from "./Content.ts";

interface CounterParameter extends ContentParameter {}

export const CounterPage = async ({ context }: CounterParameter) => {
  const data = await getSessionData(context);
  const counter = data.counter;

  return (
    <div class="card bg-base-100 shadow-2xl p-10 border border-primary/20 ">
      <h1 class="text-4xl font-black text-primary mb-4">Corvus Phrygian</h1>

      <p class="text-lg opacity-80">Server-Side-Counter</p>
      <div class="card-actions justify-center mt-6">
        <HtmxCounterFragment initial={counter ?? 0} />
      </div>

      <p class="text-lg opacity-80 mt-10">Client-Side-Counter</p>
      <div class="card-actions justify-center mt-6">
        <AlpineCounterFragment />
      </div>

      <div class="card-actions justify-between mt-6">
        <button
          type="button"
          class="btn btn-secondary"
          hx-get="./api/alert"
          hx-target="#alert-zone"
          hx-swap="afterbegin"
        >
          Abbrechen
        </button>

        <button type="button" class="btn btn-primary" hx-on:click="hello()">
          Ok
        </button>
      </div>
    </div>
  );
};
