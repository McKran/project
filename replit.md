# AgriAssist

AI-powered smart farming platform for Filipino farmers, built exclusively for the Philippines using official PSGC (Philippine Standard Geographic Code) location data.

## Run & Operate

- `bash scripts/start-api-server.sh` — start Ollama + API server (port 8080)
- `PORT=5000 BASE_PATH=/ pnpm --filter @workspace/agri-assistant run dev` — run the frontend (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- AI: DeepSeek-R1:1.5b via Ollama (local, no external API)
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React 19 + Vite + Wouter + TanStack Query

## Where things live

- `artifacts/agri-assistant/` — React frontend (port 5000)
- `artifacts/api-server/` — Express backend (port 8080)
- `artifacts/api-server/src/routes/chat.ts` — AI chat route (DeepSeek via Ollama)
- `artifacts/api-server/src/routes/farming-plan.ts` — PSGC-strict farm planning
- `lib/db/src/schema/` — Drizzle DB schema (conversations, messages, farming_plans, ph-crops)
- `lib/integrations-openrouter-ai/` — OpenRouter client (used for dashboard/market AI)
- `scripts/start-api-server.sh` — Ollama startup + API server launcher

## Architecture decisions

- **DeepSeek via Ollama only for chat**: All AI chat uses DeepSeek-R1:1.5b running locally through Ollama. No external API calls for chat. OpenRouter (free models) is still used for dashboard summaries and market insights.
- **PSGC-strict location**: Farm planner and AI chat context are always tied to PSGC region/province/city codes. Free-text location input is rejected. If location is missing, users are redirected to onboarding/settings.
- **Conversation memory in PostgreSQL**: Chat conversations and messages are stored in the `conversations` and `messages` tables with cascading deletes.
- **Cache key = PSGC code**: Farm plans are cached in PostgreSQL using the city/province PSGC code as the key, not a free-text string.
- **DeepSeek-R1 think-block filtering**: The `<think>...</think>` chain-of-thought blocks from DeepSeek-R1 are stripped on both the backend (before DB save) and frontend (before display), showing a "reasoning…" indicator while in progress.

## Product

- **Dashboard**: Overview with weather, market prices, AI-generated summaries
- **Weather**: Live + forecast weather for the farmer's PSGC location  
- **Crops**: Philippine crop database (DA Philippines data)
- **Market**: Live commodity prices with AI market insights
- **Farm Planner**: GDD-based farming schedules using real climate data (Open-Meteo ERA5). PSGC-locked.
- **AI Chat** (`/chat`): DeepSeek-R1 agriculture specialist. Answers questions about crops, pests, fertilizers, weather, and market prices. Conversation memory stored in PostgreSQL.
- **Settings**: PSGC location management, crop profile, theme

## User preferences

- Philippines/PSGC-specific only (no other countries)
- DeepSeek via Ollama for all AI chat (never external AI for chat)
- No free-text location input anywhere
- Conversation memory persisted in PostgreSQL (not in-memory)

## Gotchas

- Ollama must be running before the API server starts. The `scripts/start-api-server.sh` handles this automatically.
- DeepSeek model pull takes ~2 minutes on first run (1.1 GB download). The model is stored at `$OLLAMA_MODELS` (defaults to `/tmp/ollama-models`).
- The Agri Assistant workflow at port 5000 proxies all `/api/*` calls to the API server at port 8080.
- Farm plan generation is blocked if `regionCode` and `provinceCode` are missing from the request body (returns HTTP 422 with `code: "PSGC_MISSING"`).
- DeepSeek-R1 reasoning tokens (`<think>...</think>`) are filtered from both the DB and the UI.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- PSGC API: `https://psgc.gitlab.io/api` — used for region/province/city data during onboarding
- Open-Meteo API: `https://api.open-meteo.com` + `https://archive-api.open-meteo.com` — weather data (free, no key)
