import { NextResponse } from "next/server";
import { z } from "zod";
import { getAir } from "@/lib/air";
import { generatePlan } from "@/lib/llm";
import { buildFacts, buildPrompt } from "@/lib/prompt";

const Body = z.object({
  city: z.string().trim().min(2).max(60),
  members: z.array(z.enum(["child", "elderly", "respiratory", "adult"])).max(4),
  commute: z.enum(["walk", "two-wheeler", "car", "public-transit"]),
  cooking: z.enum(["lpg", "induction", "biomass"]),
  budget: z.enum(["low", "medium", "high"]),
  language: z.enum(["English", "Hindi", "Kannada"]),
  notes: z.string().max(200).optional(),
});

// Simple per-IP limiter (resets on cold start; fine for a demo).
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) { hits.set(ip, { n: 1, t: now }); return false; }
  return ++h.n > 8;
}

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many requests, try again in a minute." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });

  const air = await getAir(parsed.data.city);
  const facts = buildFacts(air);
  const result = await generatePlan(buildPrompt(air, parsed.data));
  return NextResponse.json({ air, facts, plan: result?.plan ?? null, provider: result?.provider ?? null });
}
