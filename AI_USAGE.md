# AI Usage Log

## Phase 1: Next.js Scaffold, Design System Tokens, and Mobile Home Screen

### What was built
- Next.js 16 (App Router, TypeScript, Turbopack) scaffold configured cleanly without overwriting existing repo files (`AGENTS.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `docs/`, `.env.example`).
- Tailwind CSS v4 design system tokens configured in `src/app/globals.css` using the standard shadcn `oklch` color format with `@theme inline` mappings (`--color-udhar`, `--color-paid`, warm off-white surface, violet primary).
- Font loading via `next/font/google` for `Inter` (latin) and `Noto_Sans_Devanagari` (devanagari + latin) with `display: 'swap'` in `src/app/layout.tsx`.
- Installed `shadcn/ui` button component and `motion/react`.
- Extracted accessible, mobile-first `MicButton` component (`src/components/mic-button.tsx`) with 96px tap target:
  - Static when idle (no pulse rings or animations).
  - Only animates pulse rings when `listening` prop is true.
  - Full respect for `prefers-reduced-motion` using `useReducedMotion` from `motion/react`.
- Mobile-first home page (`src/app/page.tsx`) with top branding ("DukaanAI", "Beta"), status indicators ("बोलने के लिए टैप करें" / "सुन रहा है... बोलिए"), sample sales/udhar metric cards, and bottom navigation bar.
- `.gitignore` verified to ignore `.env.local` while keeping `.env.example` tracked (avoiding blanket `.env*` pattern).
- Verification passes cleanly: `npm run lint` (0 errors) and `npm run build` (successful compilation).

### Prompt used
> /plan Read AGENTS.md and docs/BRIEF.md. Phase 1 only: scaffold Next.js (App Router, TypeScript, Tailwind) in this repo, add shadcn/ui and Motion, set up theme tokens for the app surface (warm off-white, violet primary, amber for udhar, green for paid, Noto Sans Devanagari + a clean Latin font), make a simple mobile-first home page with a placeholder big mic button, confirm .env.local is gitignored, and keep .env.example. Do not add anything else... Approve with changes: Tailwind v4 globals.css @theme inline mappings in oklch format, next/font/google Inter + Noto Sans Devanagari, skip scaffold overwrite of existing files, static mic button when idle with pulse only when listening=true using useReducedMotion from motion/react, specific .env gitignore entries.

### What AI got wrong
1. **Tailwind v4 vs v3 config assumption**: Initially planned a `tailwind.config.ts`, whereas Next.js 16 + Tailwind v4 utilizes CSS-first configuration (`@theme inline` in `globals.css`).
2. **Reduced motion hook linting**: A custom `usePrefersReducedMotion` hook triggered `react-hooks/set-state-in-effect` during `npm run lint`.
3. **Mic button pulse condition**: The initial placeholder mic button was continuously pulsing in idle mode rather than being static until activated.

### How it was fixed
1. Configured theme tokens exclusively within `src/app/globals.css` using native Tailwind v4 `@theme inline` mappings and `oklch(...)` variables matching shadcn specifications.
2. Replaced the custom stateful hook with `useReducedMotion()` directly imported from `motion/react`, eliminating the cascading re-render lint error.
3. Created `src/components/mic-button.tsx` with a `listening` prop and rendered the animated pulse rings conditionally only when `listening && !shouldReduceMotion`.

## Phase 2: Supabase Schema, RLS, Auth Helpers, Seed & Demo Sign-in

### What was built
- Installed `@supabase/supabase-js`, `@supabase/ssr`, and `tsx` for script execution.
- Database migration file (`supabase/migrations/001_init.sql`) defining the full schema from `docs/BRIEF.md`:
  - 6 tables: `shops`, `customers`, `products`, `transactions`, `transaction_items`, `agent_logs`.
  - Performance indexes on `owner_id`, `shop_id`, `customer_id`, `transaction_id`, and `created_at`.
  - Security definer helper `public.is_shop_owner(p_shop_id uuid)` and granular RLS policies for `select`, `insert`, `update`, `delete`.
  - `customer_balances` view defined with `security_invoker = true` calculating net customer udhar ($total - paid$).
- Supabase client helpers in `src/lib/supabase/`:
  - `client.ts`: Browser client using `@supabase/ssr`.
  - `server.ts`: Server client using `@supabase/ssr` with Next.js App Router `cookies()`.
  - `admin.ts`: Service role client strictly isolated to server/script environments.
- Database seed script (`scripts/seed.ts` via `npm run seed`):
  - Provisions demo user in Supabase `auth.users` (`demo@dukaanai.in`).
  - Creates "Sharma Kirana Store" with GSTIN and Hindi language setting.
  - Seeds 15 realistic Indian customers with phone numbers and localized notes.
  - Seeds 30 realistic grocery products with Hindi/English names, units, prices, and low-stock triggers.
  - Generates 90 days of transactions (credit sales, repayments, cash sales) with Hinglish voice transcripts and item links.
- Demo auth route handlers:
  - `src/app/api/auth/demo/route.ts`: signs in as the demo user and sets session cookies.
  - `src/app/api/auth/signout/route.ts`: signs out and clears session cookies.
- Updated `src/app/page.tsx`:
  - "Try demo" ("डेमो आज़माएँ") button with loading feedback.
  - User status & shop name badge when authenticated.
  - Live dynamic queries for today's sales and total udhar.
- Updated `.env.example` with `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD`.
- Verification: `npm run lint` (0 errors) and `npm run build` (successful compilation).

### Prompt used
> /plan Phase 2. Read AGENTS.md, docs/BRIEF.md and the existing code first, and reuse the existing Supabase helpers instead of duplicating them. Write supabase/migrations/001_init.sql with all tables from docs/BRIEF.md, RLS so users only access their own shop's rows, and the customer_balances view. I will paste the SQL into the Supabase SQL Editor myself, so give me exact steps. Then add Supabase auth (email + password) with a server-side client helper. Add scripts/seed.ts: 15 realistic Indian customers, 30 grocery products, 3 months of transactions, and a demo account. Add a "Try demo" button that signs in as the demo user through a server route. Read secrets only from .env.local, never print or commit them, and never use the service role key in client code. Tell me exactly which env vars the seed needs. Show the plan first and append to AI_USAGE.md.

### What AI got wrong
1. **Postgres View RLS bypass**: Standard Postgres views default to `security definer` behavior, which would bypass customer table RLS for unprivileged users.
2. **Shell pathing for `tsx`**: In this environment, global `npx` was not on standard system PATH because Node v22 is in `~/.nvm/versions/node/v22.23.3/bin`.
3. **Demo route client-only expectation**: Early draft only anticipated JSON requests, which would fail if invoked directly via browser redirect.

### How it was fixed
1. Specified `WITH (security_invoker = true)` on the `customer_balances` view so that all queries against the view strictly honor underlying row-level security.
2. Added `tsx` to `devDependencies` and created `"seed": "tsx scripts/seed.ts"` in `package.json`, ensuring standalone script execution works out of the box with `npm run seed`.
3. Added dual handling in `/api/auth/demo` and `/api/auth/signout` to return JSON for `fetch` requests or 302 redirect for browser navigations.

echo "- Phase 2 bug: AI created is_shop_owner() before the shops table existed (Postgres error 42P01). Fixed by adding 'set check_function_bodies = off;' at the top of 001_init.sql." >> AI_USAGE.md

cat >> AI_USAGE.md <<'EOF'
- Phase 2 bug 2: AI hardcoded a demo password in a public repo; replaced with env vars and a random password.
- Phase 2 bug 3: live demo returned "fetch failed" because the Supabase URL stored on Vercel was bad (local was fine). Fixed by re-adding the env var from the working .env.local. The UI error message blamed the seed, which was misleading.
EOF
git add -A && git commit -m "AI: log Phase 2 bugs" && git push- Phase 2 bug 2: AI hardcoded a demo password in a public repo; replaced with env vars and a random password.
- Phase 2 bug 3: live demo returned "fetch failed" because the Supabase URL stored on Vercel was bad (local was fine). Fixed by re-adding the env var from the working .env.local. The UI error message blamed the seed, which was misleading.
