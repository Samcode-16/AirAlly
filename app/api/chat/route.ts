import { NextResponse } from "next/server";
import { z } from "zod";
import { getAir } from "@/lib/air";
import { buildChatPrompt, ChatProfile, generateReply, Turn } from "@/lib/chat";

const Body = z.object({
  profile: ChatProfile,
  history: z.array(Turn).max(12),
  message: z.string().trim().min(1).max(500),
});

// Per-IP limiter (resets on cold start; fine for a demo).
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  return ++h.n > 20;
}

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many messages, try again in a minute." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  // Air data is re-fetched server-side (cached), so the client cannot spoof the grounding facts.
  const { profile, history, message } = parsed.data;
  const air = await getAir(profile.city);
  const result = await generateReply(buildChatPrompt(air, profile, history, message));
  if (!result) return NextResponse.json({ error: "AI is unavailable right now. Check your API keys and try again." }, { status: 503 });
  return NextResponse.json(result);
}
