import { Hour } from "./impact";

export type Air = { place: string; pm25: number; pm10: number; aqi: number; hours: Hour[]; demo: boolean };

const DEMO: Air = {
  place: "Delhi, India (demo data)", pm25: 210, pm10: 330, aqi: 290, demo: true,
  hours: Array.from({ length: 24 }, (_, h) => ({
    time: `${String(h).padStart(2, "0")}:00`,
    pm25: Math.round(210 + 60 * Math.cos(((h - 6) / 24) * 2 * Math.PI)),
  })),
};

type NextFetchInit = RequestInit & { next?: { revalidate?: number } };

async function getJson(url: string) {
  const init: NextFetchInit = { signal: AbortSignal.timeout(8000), next: { revalidate: 900 } };
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getAir(city: string): Promise<Air> {
  if (process.env.DEMO_MODE === "true") return DEMO;
  try {
    const geo = await getJson(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`,
    );
    const g = geo.results?.[0];
    if (!g) throw new Error("City not found");
    const d = await getJson(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${g.latitude}&longitude=${g.longitude}` +
        `&current=pm2_5,pm10,us_aqi&hourly=pm2_5&forecast_days=2&timezone=auto`,
    );
    const now = d.current.time as string;
    const hours: Hour[] = d.hourly.time
      .map((t: string, i: number) => ({ time: t, pm25: d.hourly.pm2_5[i] as number }))
      .filter((h: Hour) => h.time >= now && h.pm25 != null)
      .slice(0, 24)
      .map((h: Hour) => ({ time: h.time.slice(11, 16), pm25: Math.round(h.pm25) }));
    return {
      place: `${g.name}, ${g.country ?? ""}`, pm25: Math.round(d.current.pm2_5),
      pm10: Math.round(d.current.pm10), aqi: Math.round(d.current.us_aqi), hours, demo: false,
    };
  } catch {
    return DEMO; // never break the user flow
  }
}
