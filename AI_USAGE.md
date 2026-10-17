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
