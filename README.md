# AirAlly: GenAI smog & air-pollution assistant

Personalised daily routines, indoor air hacks and sustainable swaps for families facing severe winter smog, each with its **direct impact** explained.

**Live demo:** _add Vercel URL_ · **Video:** _add unlisted link_

## How it works
1. `lib/air.ts`: live PM2.5/AQI + hourly forecast (Open-Meteo, no key); demo fallback.
2. `lib/impact.ts`: deterministic maths (AQI band, cigarette-equivalent, cleanest window). The LLM never invents numbers.
3. `lib/llm.ts`: multi-model router **Gemini → Kimi → Groq**, schema-validated JSON (Zod), automatic fallback.
4. `app/page.tsx`: accessible, mobile-first UI (keyboard, aria-live, dark mode, text + colour AQI).

## Run locally
```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY, GROQ_API_KEY, KIMI_API_KEY
npm run dev            # http://localhost:3000
npm run check          # typecheck + tests
```
Set `DEMO_MODE=true` to use built-in severe-smog data.

## Deploy (Vercel)
Import the repo, add the three keys as environment variables, deploy.

## Security
Keys server-side only · Zod input validation · per-IP rate limit · user text treated as data · no raw HTML rendering.

> General guidance only, not medical advice.
