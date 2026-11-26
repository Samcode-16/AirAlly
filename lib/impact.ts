// Deterministic impact maths: the LLM never invents these numbers.
const BANDS = [
  [50, "Good"], [100, "Moderate"], [150, "Unhealthy for sensitive groups"],
  [200, "Unhealthy"], [300, "Very unhealthy"], [Infinity, "Hazardous"],
] as const;

export function aqiBand(aqi: number) {
  const i = BANDS.findIndex(([max]) => aqi <= max);
  return { label: BANDS[i][1], level: i };
}

/** Rough analogy (Berkeley Earth): ~22 µg/m³ PM2.5 over 24h ≈ 1 cigarette/day. */
export const cigaretteEquivalent = (pm25: number) => Math.round((pm25 / 22) * 10) / 10;

export type Hour = { time: string; pm25: number };

/** Finds the `len`-hour stretch with the lowest average PM2.5. */
export function bestWindow(hours: Hour[], len = 2) {
  if (hours.length < len) return null;
  let best = { start: 0, avg: Infinity };
  for (let i = 0; i <= hours.length - len; i++) {
    const avg = hours.slice(i, i + len).reduce((s, h) => s + h.pm25, 0) / len;
    if (avg < best.avg) best = { start: i, avg };
  }
  return { from: hours[best.start].time, to: hours[best.start + len - 1].time, avgPm25: Math.round(best.avg) };
}
