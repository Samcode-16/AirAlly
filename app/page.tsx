"use client";
import { FormEvent, useMemo, useState } from "react";
import { aqiBand, type Hour } from "@/lib/impact";
import type { Plan } from "@/lib/llm";
import type { ChatProfile } from "@/lib/chat";
import ChatPanel from "@/components/ChatPanel";

type Result = {
  air: { place: string; pm25: number; pm10: number; aqi: number; hours: Hour[]; demo: boolean };
  facts: { band: string; cigarettes: number; window: { from: string; to: string; avgPm25: number } | null };
  plan: Plan | null;
  provider: string | null;
};

type TabKey = "all" | "routine" | "indoor" | "swaps";

const QUICK_CITIES = ["Delhi", "Bengaluru", "Mumbai", "Lahore", "Beijing", "London"];

const MEMBERS = [
  ["child", "Young child"],
  ["elderly", "Elderly"],
  ["respiratory", "Asthma / heart / lung"],
  ["adult", "Healthy adult"],
] as const;

const RADIOS: { name: string; label: string; options: [string, string][] }[] = [
  {
    name: "commute",
    label: "Main commute",
    options: [
      ["walk", "Walk"],
      ["two-wheeler", "Two-wheeler"],
      ["car", "Car"],
      ["public-transit", "Public transit"],
    ],
  },
  {
    name: "cooking",
    label: "Cooking fuel",
    options: [
      ["lpg", "LPG gas"],
      ["induction", "Induction"],
      ["biomass", "Biomass / wood"],
    ],
  },
  {
    name: "budget",
    label: "Budget for air fixes",
    options: [
      ["low", "Low / free"],
      ["medium", "Medium"],
      ["high", "High"],
    ],
  },
  {
    name: "language",
    label: "Plan language",
    options: [
      ["English", "English"],
      ["Hindi", "हिन्दी (Hindi)"],
      ["Kannada", "ಕನ್ನಡ (Kannada)"],
    ],
  },
];

function severityColor(level: number) {
  return `var(--aqi-${Math.min(5, Math.max(0, level))})`;
}

function barColor(pm25: number, inBestWindow: boolean) {
  if (inBestWindow) return "var(--accent)";
  if (pm25 <= 12) return "var(--aqi-0)";
  if (pm25 <= 35.4) return "var(--aqi-1)";
  if (pm25 <= 55.4) return "var(--aqi-2)";
  if (pm25 <= 150.4) return "var(--aqi-3)";
  return "var(--aqi-4)";
}

function ActionSection({
  id,
  title,
  items,
  done,
  onToggle,
}: {
  id: string;
  title: string;
  items: Plan["routine"];
  done: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <section className="section-block" aria-labelledby={id}>
      <h3 className="section-title" id={id}>
        {title}
        <span className="field-hint">({items.length})</span>
      </h3>
      {items.map((item, idx) => {
        const key = `${id}:${idx}:${item.action}`;
        const isDone = !!done[key];
        return (
          <article className="action-card" data-done={isDone} key={key}>
            <button
              type="button"
              className="tick-btn no-print"
              aria-pressed={isDone}
              aria-label={`Mark "${item.action}" as ${isDone ? "not done" : "done"}`}
              onClick={() => onToggle(key)}
            >
              {isDone ? "✓" : ""}
            </button>
            <div>
              <h4 className="action-title">{item.action}</h4>
              <div className="action-details">
                <div className="detail-row">
                  <strong>Why:</strong>
                  <span>{item.why}</span>
                </div>
                <div className="impact-callout">
                  <strong>Direct impact:</strong> {item.impact}
                </div>
              </div>
              <span className="effort-tag">Effort / cost: {item.effort}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}

export default function Home() {
  const [city, setCity] = useState("Delhi");
  const [notesLen, setNotesLen] = useState(0);
  const [res, setRes] = useState<Result | null>(null);
  const [profile, setProfile] = useState<ChatProfile | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<TabKey>("all");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<"auto" | "light" | "dark">("auto");

  function cycleTheme() {
    const next = theme === "auto" ? "dark" : theme === "dark" ? "light" : "auto";
    setTheme(next);
    if (next === "auto") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", next);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      city: f.get("city"),
      members: f.getAll("members"),
      commute: f.get("commute"),
      cooking: f.get("cooking"),
      budget: f.get("budget"),
      language: f.get("language"),
    } as ChatProfile;
    setBusy(true);
    setErr("");
    setRes(null);
    setProfile(null);
    setDone({});
    setTab("all");
    setSelectedHour(null);
    const r = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, notes: f.get("notes") || undefined }),
    }).catch(() => null);
    setBusy(false);
    if (!r) return setErr("Network error — please check your connection and try again.");
    const j = await r.json().catch(() => null);
    if (r.ok && j) { setRes(j); setProfile(payload); }
    else setErr(j?.error ?? "Something went wrong.");
  }

  function toggleDone(key: string) {
    setDone((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const totalActions = useMemo(() => {
    if (!res?.plan) return 0;
    return res.plan.routine.length + res.plan.indoor.length + res.plan.swaps.length;
  }, [res]);

  const completedCount = useMemo(
    () => Object.values(done).filter(Boolean).length,
    [done],
  );

  async function copyPlan() {
    if (!res?.plan) return;
    const fmt = (title: string, items: Plan["routine"]) =>
      `${title}\n` + items.map((i) => `- ${i.action}\n  Why: ${i.why}\n  Impact: ${i.impact} (${i.effort})`).join("\n");
    const text = [
      `AirAlly Plan — ${res.air.place} (AQI ${res.air.aqi}: ${res.facts.band}, PM2.5 ${res.air.pm25} µg/m³)`,
      res.plan.headline,
      fmt("Daily routine", res.plan.routine),
      fmt("Indoor air hacks", res.plan.indoor),
      fmt("Sustainable swaps", res.plan.swaps),
      res.plan.seekHelpIf.length ? `Seek medical help if: ${res.plan.seekHelpIf.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    await navigator.clipboard.writeText(text).catch(() => null);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const bandInfo = res ? aqiBand(res.air.aqi) : null;
  const maxPm25 = res?.air.hours?.length ? Math.max(...res.air.hours.map((h) => h.pm25), 25) : 100;
  const gaugePct = res ? Math.min(100, Math.round((res.air.aqi / 400) * 100)) : 0;
  const gaugeCirc = 2 * Math.PI * 28;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" />
              </svg>
            </div>
            <div>
              <h1>AirAlly</h1>
              <p className="brand-sub">Smog-smart household action planner</p>
            </div>
          </div>
          <div className="topbar-actions">
            <span className="pill-badge">Live PM2.5 + AI</span>
            <button type="button" className="icon-btn" onClick={cycleTheme} aria-label="Switch color theme">
              {theme === "dark" ? "Dark" : theme === "light" ? "Light" : "Auto"} theme
            </button>
          </div>
        </div>
      </header>

      <main className="shell">
        <section className="panel sticky-panel" aria-label="Household profile">
          <div className="panel-head">
            <h2>Your household today</h2>
            <p>Tailored around who is at home, your commute, cooking fuel, and budget.</p>
          </div>

          <form onSubmit={submit}>
            <div className="field">
              <label className="field-label" htmlFor="city">
                City
                <span className="field-hint">Live Open-Meteo lookup</span>
              </label>
              <div className="input-wrap">
                <span className="input-icon" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </span>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                  minLength={2}
                  maxLength={60}
                  placeholder="Enter a city name…"
                />
              </div>
              <div className="chip-row" aria-label="Quick city presets">
                {QUICK_CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="city-chip"
                    data-active={city.trim().toLowerCase() === c.toLowerCase()}
                    onClick={() => setCity(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <fieldset>
              <legend>
                Who is at home?
                <span className="field-hint">Select all that apply</span>
              </legend>
              <div className="choice-grid">
                {MEMBERS.map(([val, label]) => (
                  <label key={val} className="choice-pill">
                    <input type="checkbox" name="members" value={val} className="sr-only" />
                    <span className="choice-check" aria-hidden="true">✓</span>
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            {RADIOS.map((group) => (
              <fieldset key={group.name}>
                <legend>{group.label}</legend>
                <div className="choice-pills">
                  {group.options.map(([val, label], i) => (
                    <label key={val} className="choice-pill">
                      <input
                        type="radio"
                        name={group.name}
                        value={val}
                        defaultChecked={i === 0}
                        className="sr-only"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}

            <div className="field">
              <label className="field-label" htmlFor="notes">
                Anything else? (optional)
                <span className="field-hint tabular">{notesLen}/200</span>
              </label>
              <textarea
                id="notes"
                name="notes"
                maxLength={200}
                rows={2}
                placeholder="e.g. ground-floor flat, morning school run at 7:30…"
                onChange={(e) => setNotesLen(e.target.value.length)}
              />
            </div>

            <button type="submit" className="primary-btn" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Building your smog-smart plan…
                </>
              ) : (
                "Get my smog-smart plan"
              )}
            </button>
          </form>
        </section>

        <section className="results-stack" aria-live="polite" aria-label="Air quality and action plan">
          {err && (
            <div role="alert" className="alert-banner">
              <strong>Could not generate plan:</strong> {err}
            </div>
          )}

          {busy && (
            <div className="skeleton-card" aria-label="Loading plan">
              <div className="shimmer" style={{ width: "42%", height: 26, marginBottom: 14 }} />
              <div className="shimmer" style={{ width: "100%", height: 76, marginBottom: 14 }} />
              <div className="shimmer" style={{ width: "100%", height: 96, marginBottom: 14 }} />
              <div className="shimmer" style={{ width: "78%", height: 20 }} />
            </div>
          )}

          {!busy && !res && !err && (
            <div className="empty-hero">
              <h2>Breathe smarter on high-smog days</h2>
              <p>
                Pick your city and household details to get live air telemetry, your cleanest 2-hour window to
                ventilate or commute, and practical zero-to-low-cost actions ranked by real impact.
              </p>
              <div className="steps-grid">
                <div className="step-card">
                  <span className="step-num">1</span>
                  <h3>Live PM2.5 &amp; AQI</h3>
                  <p>Pulls current particulate readings and a 24-hour hourly forecast for any city.</p>
                </div>
                <div className="step-card">
                  <span className="step-num">2</span>
                  <h3>Deterministic maths</h3>
                  <p>Computes US AQI band, cigarette analogy, and your cleanest 2-hour window locally.</p>
                </div>
                <div className="step-card">
                  <span className="step-num">3</span>
                  <h3>Personalised plan</h3>
                  <p>Turns those facts into routines, indoor air hacks, and swaps in your chosen language.</p>
                </div>
              </div>
            </div>
          )}

          {res && bandInfo && (
            <>
              <div className="aqi-card">
                <div className="aqi-top">
                  <div>
                    <h2 className="place-title">
                      {res.air.place}
                      {res.air.demo && <span className="demo-tag">Demo sample</span>}
                    </h2>
                    <span className={`aqi-band-pill aqi-level-${bandInfo.level}`}>
                      US AQI {res.air.aqi} · {res.facts.band}
                    </span>
                  </div>

                  <div className="gauge-box" aria-label={`US AQI ${res.air.aqi} out of 400 scale`}>
                    <svg className="gauge-svg" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r="28" fill="none" stroke="var(--surface-2)" strokeWidth="7" />
                      <circle
                        cx="36"
                        cy="36"
                        r="28"
                        fill="none"
                        stroke={severityColor(bandInfo.level)}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={gaugeCirc}
                        strokeDashoffset={gaugeCirc * (1 - gaugePct / 100)}
                        transform="rotate(-90 36 36)"
                      />
                      <text
                        x="36"
                        y="39"
                        textAnchor="middle"
                        fill="currentColor"
                        fontSize="15"
                        fontWeight="800"
                        className="tabular"
                      >
                        {res.air.aqi}
                      </text>
                    </svg>
                  </div>
                </div>

                <div className="metrics-grid">
                  <div className="metric-tile">
                    <span className="metric-k">PM2.5</span>
                    <span className="metric-v">{res.air.pm25} µg/m³</span>
                    <span className="metric-sub">Fine particulates</span>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-k">PM10</span>
                    <span className="metric-v">{res.air.pm10} µg/m³</span>
                    <span className="metric-sub">Coarse dust</span>
                  </div>
                  <div className="metric-tile">
                    <span className="metric-k">24h Analogy</span>
                    <span className="metric-v">≈ {res.facts.cigarettes} cigs</span>
                    <span className="metric-sub">Berkeley Earth rule</span>
                  </div>
                  <div className="metric-tile highlight">
                    <span className="metric-k">Cleanest 2h window</span>
                    <span className="metric-v">
                      {res.facts.window ? `${res.facts.window.from}–${res.facts.window.to}` : "—"}
                    </span>
                    <span className="metric-sub">
                      {res.facts.window ? `≈ ${res.facts.window.avgPm25} µg/m³ avg` : "Forecast unavailable"}
                    </span>
                  </div>
                </div>

                {res.air.hours?.length > 0 && (
                  <div className="chart-box">
                    <div className="chart-head">
                      <strong>
                        Next 24h PM2.5 forecast
                        {selectedHour !== null && res.air.hours[selectedHour] && (
                          <span className="field-hint tabular">
                            {" "}
                            · {res.air.hours[selectedHour].time}: {res.air.hours[selectedHour].pm25} µg/m³
                          </span>
                        )}
                      </strong>
                      <span className="chart-legend">
                        <span>
                          <span className="dot" style={{ background: "var(--accent)" }} />
                          Cleanest window
                        </span>
                        <span>
                          <span className="dot" style={{ background: "var(--aqi-3)" }} />
                          Peak smog
                        </span>
                      </span>
                    </div>
                    <div className="chart-bars" role="group" aria-label="Hourly PM2.5 forecast bars">
                      {res.air.hours.slice(0, 24).map((h, i) => {
                        const inWin =
                          !!res.facts.window &&
                          (h.time === res.facts.window.from || h.time === res.facts.window.to);
                        const pct = Math.max(8, Math.round((h.pm25 / maxPm25) * 100));
                        return (
                          <button
                            key={`${h.time}-${i}`}
                            type="button"
                            className="bar-btn"
                            data-selected={selectedHour === i}
                            aria-label={`${h.time}: ${h.pm25} µg/m³${inWin ? " (cleanest window)" : ""}`}
                            title={`${h.time} — ${h.pm25} µg/m³`}
                            onMouseEnter={() => setSelectedHour(i)}
                            onFocus={() => setSelectedHour(i)}
                            onClick={() => setSelectedHour(i)}
                          >
                            <span
                              className="bar-fill"
                              style={{
                                height: `${pct}%`,
                                background: barColor(h.pm25, inWin),
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                    <div className="chart-axis">
                      <span>{res.air.hours[0]?.time}</span>
                      <span>{res.air.hours[Math.floor(res.air.hours.length / 2)]?.time}</span>
                      <span>{res.air.hours[Math.min(23, res.air.hours.length - 1)]?.time}</span>
                    </div>
                  </div>
                )}
              </div>

              {res.plan ? (
                <>
                  <div className="plan-header">
                    <h2 className="plan-headline">{res.plan.headline}</h2>
                    <div className="plan-meta-row">
                      <div className="progress-wrap">
                        <div className="progress-track" aria-hidden="true">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${totalActions ? Math.round((completedCount / totalActions) * 100) : 0}%`,
                            }}
                          />
                        </div>
                        <span className="tabular">
                          {completedCount} of {totalActions} done today
                        </span>
                      </div>
                      <div className="topbar-actions no-print">
                        <button type="button" className="icon-btn" onClick={copyPlan}>
                          {copied ? "Copied!" : "Copy plan"}
                        </button>
                        <button type="button" className="icon-btn" onClick={() => window.print()}>
                          Print / PDF
                        </button>
                      </div>
                    </div>

                    <div className="tabs-row no-print" role="tablist" aria-label="Plan sections">
                      {(
                        [
                          ["all", `All (${totalActions})`],
                          ["routine", `Daily routine (${res.plan.routine.length})`],
                          ["indoor", `Indoor hacks (${res.plan.indoor.length})`],
                          ["swaps", `Sustainable swaps (${res.plan.swaps.length})`],
                        ] as [TabKey, string][]
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          role="tab"
                          aria-selected={tab === k}
                          className="tab-btn"
                          onClick={() => setTab(k)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(tab === "all" || tab === "routine") && (
                    <ActionSection
                      id="routine"
                      title="Daily routine"
                      items={res.plan.routine}
                      done={done}
                      onToggle={toggleDone}
                    />
                  )}
                  {(tab === "all" || tab === "indoor") && (
                    <ActionSection
                      id="indoor"
                      title="Indoor air hacks"
                      items={res.plan.indoor}
                      done={done}
                      onToggle={toggleDone}
                    />
                  )}
                  {(tab === "all" || tab === "swaps") && (
                    <ActionSection
                      id="swaps"
                      title="Sustainable swaps"
                      items={res.plan.swaps}
                      done={done}
                      onToggle={toggleDone}
                    />
                  )}

                  {res.plan.seekHelpIf.length > 0 && (
                    <div className="alert-banner">
                      <strong>Seek medical help if:</strong> {res.plan.seekHelpIf.join("; ")}.
                    </div>
                  )}

                  <footer className="footer-note">
                    <span>Generated via {res.provider ?? "AI"} · Live data via Open-Meteo</span>
                    <span>General guidance only, not medical advice.</span>
                  </footer>
                </>
              ) : (
                <div role="alert" className="alert-banner">
                  <strong>AI plan unavailable right now.</strong> Live air metrics are shown above; add or verify your API
                  keys in <code>.env</code> and try again.
                </div>
              )}
              {profile && <ChatPanel profile={profile} />}
            </>
          )}
        </section>
      </main>
    </>
  );
}
