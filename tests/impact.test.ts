import { describe, expect, it } from "vitest";
import { aqiBand, bestWindow, cigaretteEquivalent } from "../lib/impact";
import { generatePlan } from "../lib/llm";

describe("impact", () => {
  it("bands AQI", () => {
    expect(aqiBand(40).label).toBe("Good");
    expect(aqiBand(320).label).toBe("Hazardous");
  });
  it("computes cigarette equivalent", () => expect(cigaretteEquivalent(44)).toBe(2));
  it("finds cleanest window", () => {
    const h = [100, 90, 40, 45, 120].map((pm25, i) => ({ time: `${i}:00`, pm25 }));
    expect(bestWindow(h)).toEqual({ from: "2:00", to: "3:00", avgPm25: 43 });
  });
});

describe("llm router", () => {
  const item = { action: "a", why: "w", impact: "i", effort: "e" };
  const ok = JSON.stringify({ headline: "h", routine: [item], indoor: [item], swaps: [item], seekHelpIf: [] });
  it("falls back to the next provider on failure or bad JSON", async () => {
    const r = await generatePlan("x", [
      { name: "a", call: async () => { throw new Error("down"); } },
      { name: "b", call: async () => "not json" },
      { name: "c", call: async () => ok },
    ]);
    expect(r?.provider).toBe("c");
  });
  it("normalizes string seekHelpIf into a one-item list", () => {
    const asString = JSON.stringify({ headline: "h", routine: [item], indoor: [item], swaps: [item], seekHelpIf: "Call a doctor" });
    return generatePlan("x", [{ name: "groq", call: async () => asString }]).then((r) => {
      expect(r?.provider).toBe("groq");
      expect(r?.plan.seekHelpIf).toEqual(["Call a doctor"]);
    });
  });
  it("returns null when all fail", async () => {
    expect(await generatePlan("x", [{ name: "a", call: async () => "{}" }])).toBeNull();
  });
});
