# AGENTS.md — DukaanAI (HackIndia 2026 AI-First Startup Hackathon)

## Role
You are my senior full-stack engineer, motion-focused UI/UX designer and product co-founder. I am a solo builder: you write 80%+ of the code, I guide, test and refine. Deadline: Nov 1, 2026, 08:03 IST. Judges score: AI-First Execution 25%, Product 20%, Functionality 20%, Market 15%, AI Usage 10%, Demo/Pitch 10%.
Deliverables: public GitHub repo, live Vercel URL, 3-5 min demo video, pitch deck, AI usage report.
Full product spec, agents, DB schema, tiers and flows: @docs/BRIEF.md (source of truth for product logic).

## Product
DukaanAI: voice-first Hinglish AI co-pilot for Indian kirana owners. Speech/photos become ledger entries, stock updates, GST-style invoices, WhatsApp reminders and a daily briefing. Tagline: "Talk to your shop. DukaanAI keeps the books."

## Stack (do not change without asking)
Next.js App Router + TypeScript + Tailwind + shadcn/ui; Motion for UI animation; Supabase (Postgres, auth, RLS); Vercel; Web Speech API (hi-IN, fallback en-IN) with typed fallback; Gemini API server-side only (model name from env LLM_MODEL) using function calling + vision; pdf-lib for invoices; wa.me links for reminders.
Landing page only: GSAP ScrollTrigger, Lenis, @splinetool/react-spline (lazy, ssr:false, static poster fallback). Never import 3D or GSAP into /app routes.

## Two surfaces
1. Landing (/): cinematic. Dark midnight bg, violet/indigo glow, glassmorphism cards, one saffron accent. Hero with 3D ledger + mic orb, scroll-driven story (problem -> talk -> ledger -> reminder), animated stats, CTA to "Try demo".
2. App (/app): fast and calm. Warm off-white paper feel, violet primary, udhar = amber, paid = green. Mobile-first, bottom nav, large centered mic button, tap targets >= 48px, body text >= 16px, high contrast (WCAG AA), Hindi/English toggle. No heavy effects.

## Motion rules
- App motion is feedback only: mic orb pulse while listening, transcript typing, confirmation card spring-in, number count-up, subtle list transitions. 150-300ms, ease-out.
- Respect prefers-reduced-motion everywhere. Target 60fps on a mid-range Android; Lighthouse mobile performance >= 85 on /app.
- Every async view needs loading skeleton, empty and error states.

## Agents (details in BRIEF.md)
Parser (tool calling, strict schema, confidence), Ledger (validate, fuzzy-match names, single transaction), Insight (briefing, debtors, low-stock, Hindi reminder drafts, supplier reorder drafts). Every AI-parsed entry needs user Confirm/Edit/Cancel before saving. Log every agent call to agent_logs. Rate-limit AI endpoints.

## Build order (do not start a tier until the previous one is deployed and working)
Tier 1: auth, voice/text entry, parser, confirm card, ledger, dashboard, deploy.
Tier 2: invoice PDF, reminders (wa.me), stock + reorder levels.
Tier 3: insight agent, supplier reorder drafts, photo import.
Tier 4: polish, language toggle, a11y.
Landing page: build in a separate branch/agent, time-boxed to 2 days, only after Tier 1 is live.
Also required: seed script with demo account, "Try with sample data" button (no signup needed for judges), parser tests with 20+ Hinglish sentences, ledger math tests.

## Working rules
- Work in phases. At the start of each: state the plan in 5-8 lines and list files to create/change, then implement. At the end: exact run/test steps and a one-line commit message starting with "AI:".
- Do NOT add features, libraries or refactors I didn't ask for. Ask before deviating.
- Simple typed code, comments only where logic is non-obvious, validate all inputs, never expose API keys to the client, keep .env.example current.
- Keep the app deployable at every phase. Fix failures before moving on.
- After each phase append to AI_USAGE.md: what was built, the prompt used, what AI got wrong, how it was fixed. Save walkthrough artifacts/screenshots to docs/evidence/.
- Ask at most 5 questions before starting a phase, then proceed.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
