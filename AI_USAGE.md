# AI Usage Log

## Tools
- **Claude Code** running **Nemotron 3 Ultra** via **Ollama Cloud** for building
- Same model as runtime LLM for the app's agents

## Phase Log

### Phase 1: Setup + deploy blank app
**What was built:**
- Next.js 15 app with TypeScript, Tailwind CSS, ESLint, App Router
- Base layout with custom CSS variables (light/dark mode)
- Home page with centered layout, emoji, app name, tagline, subtitle, three disabled buttons (Speak an entry, Udhar ledger, Dashboard), and "App is live" status
- Health check API route at `/api/health` returning JSON with env var presence checks
- Supabase client helpers (browser and server) using `@supabase/ssr`
- `.env.example` with all required environment variables
- `.env.local` created from example (gitignored)
- Updated `.gitignore` to allow `.env.example` commit
- Updated README.md with project description and run instructions

**Prompt used:** PROJECT_BRIEF.md + Phase 1 prompt (this conversation)

**What AI got wrong / fixed:** (to fill in after testing)