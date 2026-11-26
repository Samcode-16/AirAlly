"use client";
import { FormEvent, useRef, useState } from "react";
import type { ChatProfile, Turn } from "@/lib/chat";

const SUGGESTIONS = [
  "Can my child play outside this evening?",
  "When should I open the windows?",
  "What's the cheapest way to clean our indoor air?",
];

export default function ChatPanel({ profile }: { profile: ChatProfile }) {
  const [turns, setTurns] = useState<(Turn & { provider?: string })[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    const history = turns.map(({ role, content }) => ({ role, content }));
    setTurns((t) => [...t, { role: "user", content: message }]);
    setInput(""); setErr(""); setBusy(true);
    const r = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, history, message }),
    }).catch(() => null);
    setBusy(false);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j?.reply) setTurns((t) => [...t, { role: "assistant", content: j.reply, provider: j.provider }]);
    else setErr(j?.error ?? "Network error. Please try again.");
    setTimeout(() => endRef.current?.scrollIntoView({ block: "nearest" }), 0);
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void send(input); }

  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <h2 id="chat-title">Ask AirAlly</h2>
      <p className="chat-hint">Answers use today's live data for {profile.city} and your household profile.</p>
      <div className="chat-log" role="log" aria-live="polite" aria-label="Conversation">
        {turns.map((t, i) => (
          <p key={i} className={`chat-msg ${t.role}`}>
            <strong>{t.role === "user" ? "You" : "AirAlly"}:</strong> {t.content}
            {t.provider && <small> · via {t.provider}</small>}
          </p>
        ))}
        {busy && <p className="chat-msg assistant">AirAlly is thinking…</p>}
        <div ref={endRef} />
      </div>
      {err && <p role="alert" className="alert-banner">{err}</p>}
      {turns.length === 0 && (
        <div className="chat-suggest">
          {SUGGESTIONS.map((s) => <button key={s} type="button" className="chat-chip" onClick={() => send(s)}>{s}</button>)}
        </div>
      )}
      <form onSubmit={onSubmit} className="chat-form">
        <label htmlFor="chat-input" className="sr-only">Your question</label>
        <input id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500}
          placeholder="Ask about today's air, e.g. “Is a morning walk okay?”" />
        <button type="submit" disabled={busy || !input.trim()}>Send</button>
      </form>
      <small>General guidance only, not medical advice.</small>
    </section>
  );
}
