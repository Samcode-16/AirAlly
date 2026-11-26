import { z } from "zod";

const StringList = z.union([
  z.array(z.string()),
  z.string().transform((s) => (s.trim() ? [s.trim()] : [])),
]);

const Item = z.object({ action: z.string(), why: z.string(), impact: z.string(), effort: z.string() });
export const PlanSchema = z.object({
  headline: z.string(),
  routine: z.array(Item).min(1),
  indoor: z.array(Item).min(1),
  swaps: z.array(Item).min(1),
  seekHelpIf: StringList,
});
export type Plan = z.infer<typeof PlanSchema>;

type Provider = { name: string; call: (prompt: string) => Promise<string> };
const TIMEOUT = 12_000;

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const openAiStyle = (name: string, url: string, key?: string, model?: string): Provider | null =>
  key ? {
    name,
    call: async (prompt) => {
      // Moonshot K3/K3.1 models reject non-1 temperature values with HTTP 400.
      const body: Record<string, unknown> = {
        model,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      };
      if (!model?.startsWith("kimi-k3")) body.temperature = 0.3;
      const j = await post(url, { Authorization: `Bearer ${key}` }, body);
      return j.choices[0].message.content;
    },
  } : null;

const geminiProvider = (key: string, model: string): Provider => ({
  name: "gemini",
  call: async (prompt) => {
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      temperature: 0.3,
    };
    // Gemini 4 models default to HIGH thinking, which can exceed the 25s timeout on structured JSON plans.
    if (model.startsWith("gemini-4")) generationConfig.thinkingConfig = { thinkingLevel: "LOW" };
    const j = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      { "x-goog-api-key": key },
      { contents: [{ parts: [{ text: prompt }] }], generationConfig },
    );
    const parts: { thought?: boolean; text?: string }[] = j.candidates?.[0]?.content?.parts ?? [];
    return parts.find((part) => !part.thought && part.text)?.text ?? parts[0]?.text ?? "";
  },
});

/** Provider order: Gemini (structured plan) → Kimi (reasoning) → Groq (speed). Missing keys are skipped. */
export function buildProviders(env = process.env): Provider[] {
  const geminiModel = env.GEMINI_MODEL || "gemini-4-hydrogen";
  const gemini = env.GEMINI_API_KEY ? geminiProvider(env.GEMINI_API_KEY, geminiModel) : null;
  const kimi = openAiStyle("kimi", "https://api.moonshot.ai/v1/chat/completions", env.KIMI_API_KEY, env.KIMI_MODEL || "kimi-k3.1-pro-highspeed");
  const groq = openAiStyle("groq", "https://api.groq.com/openai/v1/chat/completions", env.GROQ_API_KEY, env.GROQ_MODEL || "openai/gpt-oss-120b");
  return [gemini, kimi, groq].filter((p): p is Provider => p !== null);
}

/** Tries each provider until one returns schema-valid JSON. */
export async function generatePlan(prompt: string, providers = buildProviders()) {
  for (const p of providers) {
    try {
      const raw = (await p.call(prompt)).replace(/```json|```/g, "").trim();
      return { plan: PlanSchema.parse(JSON.parse(raw)), provider: p.name };
    } catch (err) {
      console.warn(`[llm] ${p.name} failed:`, err instanceof Error ? err.message : err);
      continue;
    }
  }
  return null;
}
