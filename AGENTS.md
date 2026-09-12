# Orbe Operating System (Orbe OS)

Internal ops platform for Orbe Marketing (a Brazilian digital marketing agency).
Replaces Notion + spreadsheets + WhatsApp for day-to-day agency management:
clients, tasks, financials, sales pipeline, and AI tooling all live here.

Production: https://studio.agenciaorbe.co · repo: `orbe-project-manager` · auto-deploys
to Vercel on every push to `main`.

## Stack

- React 19 + TypeScript + Vite + Tailwind CSS, hash-based routing (`#dashboard`, `#financeiro`, ...)
- Supabase: Postgres + Auth + Row Level Security + Edge Functions (no local migration files —
  schema changes are applied directly via the Supabase Management API, not tracked in `supabase/migrations`)
- AI: **Claude (Anthropic), not Groq** — every AI feature (Orbe AI chat, Copy IA, Relatórios,
  per-client AI chat, Super Agente) calls a server-side proxy at
  `supabase/functions/orbe-ai-chat/index.ts`, which re-shapes Anthropic's SSE into an
  OpenAI-delta-compatible stream so the frontend's SSE parsing code didn't need to change.
  Super Agente uses Anthropic's native tool-calling protocol directly (not OpenAI-style).
- Deploy: `git push origin main` → Vercel builds and publishes automatically. No manual deploy step.

## Security model (read before touching anything financial)

Victor (the owner) is emphatic that **no one but him** (and whoever he explicitly grants
access to) can see what a client pays. This is enforced at the database level, not just hidden
in the UI:

- The real `clients` table lives in a `private` schema (`private.clients`), not `public`.
- `public.clients` is a VIEW (`security_invoker = true`) over `private.clients` that returns
  `NULL` for `monthly_fee`/`monthly_investment` unless the requesting user's
  `profiles.can_view_financials` is `true`. `INSTEAD OF` triggers forward writes back to the
  base table.
- `financial_records`, `payables`, `payees`, and every table under the "Torre de Controle
  Financeira" (see below) carry the same `can_view_financials`-gated RLS policy.
- The UI additionally hides the Financeiro/ROI Day nav sections for users without that flag
  (`src/lib/permissions.ts`, `FINANCIAL_ONLY_SECTIONS`), but the DB-level masking is the real
  control — assume the UI hiding can be bypassed and don't rely on it alone.
- As of Sep 2026, only Victor and Beatriz (his wife, also `role: admin`) have
  `can_view_financials = true`.

If you add a new table that stores a client fee, investment amount, team/vendor payment
amount, or contract value, gate it with the same RLS pattern.

## Main areas

- **Dashboard** — MRR, health flags, overdue tasks, pipeline snapshot (financial tiles hidden
  per the rule above).
- **Tarefas / Clientes** — task and client management, health flags, contract status.
- **Financeiro** — now a full "Torre de Controle Financeira" with sub-tabs: Contas a Receber,
  Contas a Pagar (`payees`/`payables` tables, mirrors receivables for team/vendors), Fiscal
  (Simples Nacional Anexo III DAS simulator + Fator R, in `src/lib/fiscal.ts`), Ferramentas
  (subscriptions), Investimentos, Rentabilidade (cost-per-person/client margin), Contratos,
  Reserva (cash reserve + profit withdrawal log), Visão Geral (simplified DRE + cash flow
  projection), and Alertas (aggregates upcoming/overdue items across all of the above). Code
  lives in `src/components/financeiro/*Tab.tsx`, hooks in `src/hooks/useTorreControle.ts`.
- **ROI Day** — month-by-month client performance tracking, restricted to registered clients,
  with a custom period-filter dropdown (presets + compare mode). `src/components/RoiDayView.tsx`.
- **Pipeline** — sales kanban.
- **Central / Processos** — internal playbooks and rituals.
- **Meeting routing** — a separate Google Apps Script (not in this repo) auto-files Google
  Meet/Gemini meeting notes + recordings into per-client Drive folders based on a
  `[ORBE / CODE] - Tema` calendar-event naming convention. Destination folders are tracked in
  the `meeting_routing` table. `[ORBE]` alone (no client code) routes to an internal
  "Gestão Orbe" folder.

## Brand & visual identity

Full brand manual lives outside the repo (PDF Victor supplied); the platform implements it as:

- Colors: accent = Azul Órbita `#0085C2` (light) / Azul Médio `#00A3DC` (dark), tint = Branco
  Gelo `#F2F7FA`. Defined as CSS custom properties in `src/index.css` (`--accent`, `--accent-tint`,
  etc.) — theme-aware via `:root` (dark default) and `:root[data-theme="light"]`. Don't hardcode
  hex colors in components; use the CSS vars so light/dark theming keeps working.
- Fonts: Outfit (display/wordmark, `font-display` Tailwind class) + Instrument Sans (body,
  default `font-sans`) + JetBrains Mono (technical/numeric data).
- Logo: `src/components/OrbeMark.tsx` — an SVG built from the brand manual's exact construction
  grid (core 0.58x, inner orbit 1.00x, outer orbit 1.52x radii). Supports `animated` (rings
  rotate via SMIL `animateTransform`, respects `prefers-reduced-motion`) and `glow` props.
- Ambient background system: `.orbe-ambient` / `.orbe-ambient-bold` CSS classes layer accent
  glow blooms + a faint concentric-ring field; `useMouseGlow` hook drives a cursor-following
  spotlight via `--mx`/`--my` CSS vars. Applied to `<main>` and the login page.

## Conventions worth knowing before editing

- Dropdown menus inside tables need `createPortal(..., document.body)` + `position: fixed`
  computed from `getBoundingClientRect()` — tables live inside `overflow-hidden` rounded
  containers that otherwise clip absolutely-positioned menus. See `StatusDropdown` in
  `FinanceiroView.tsx` or `TasksView.tsx` for the pattern.
- Flex layouts need explicit `min-w-0`/`min-h-0` on intermediate containers, or a wide
  table/long content silently stretches the whole page instead of scrolling internally.
- Views using the shared `<Footer/>` need `min-h-full` on their root + `flex-1` on the content
  region above the footer, or the footer floats up under short content instead of sticking to
  the bottom of the viewport.
- No local Supabase migration files — DB schema changes are applied ad hoc via the Management
  API. If you add tables, there's no `supabase/migrations/*.sql` history to check; ask what
  exists via the Supabase dashboard or Management API instead of assuming.
- `package.json`'s `version` field is bumped on every shippable change (1.0 → 1.1 → 1.2 ... → 2.0)
  and shown live in the footer (`v{X.Y} · Atualizado em <build date/time>`), via
  `__APP_VERSION__`/`__BUILD_TIME__` constants injected by `vite.config.ts`. Bump it as part of
  any commit that goes to production.
