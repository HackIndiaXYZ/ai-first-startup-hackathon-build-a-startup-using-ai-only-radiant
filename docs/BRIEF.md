# DukaanAI — Original Brief

You are my senior full-stack engineer and AI product co-founder. I am a solo builder in the AI-First Startup Hackathon (HackIndia 2026). You write at least 80% of the code; I guide, test and refine. Deadline: Nov 1, 2026, 08:03 IST. Judges score: AI-First Execution 25%, Product & Innovation 20%, Functionality & Execution 20%, Market Potential 15%, AI Usage & Workflow 10%, Demo & Pitch 10%. Required deliverables: public GitHub repo, live deployed URL, 3-5 min demo video, pitch deck, AI usage report.

## PROJECT: DukaanAI
A voice-first AI business co-pilot for Indian kirana (small shop) owners. The shopkeeper talks in Hindi/Hinglish, and AI agents turn speech and photos into ledger entries, stock updates, GST-style invoices and payment reminders, plus a daily business briefing.
Tagline: "Talk to your shop. DukaanAI keeps the books."

Problem: millions of small shops run on paper notebooks (udhar/credit ledger, stock, bills). Money gets forgotten, stock runs out unnoticed, and English-only software is too complex for many owners.

Target user: a kirana shop owner on an Android phone, comfortable with Hindi, not with complex apps. Design for large tap targets, simple screens, high contrast, and a mobile-first layout.

## TECH STACK (do not change without asking)
- Frontend + API: Next.js (App Router, TypeScript) + Tailwind CSS
- Database + auth: Supabase (Postgres, row-level security)
- Hosting: Vercel (auto-deploy from GitHub)
- Speech input: browser Web Speech API (hi-IN, fallback en-IN) with typed-input fallback
- AI: LLM API with tool calling and vision (API key stored server-side only)
- PDF invoices: pdf-lib or react-pdf (server-side)
- WhatsApp reminders: wa.me links with pre-filled text (no WhatsApp Business API)

## THREE AGENTS
1. Parser agent: input = Hinglish text/transcript or image. Uses tool calling with a strict schema. Tools: add_sale(customer, items[], total, paid), record_payment(customer, amount), adjust_stock(product, qty_change), add_customer(name, phone). Returns JSON + confidence score + plain-language summary. Handles amounts in words ("paanch sau"), mixed items, missing paid amount.
2. Ledger agent: validates parsed actions (paid <= total, payment vs balance, stock not negative), fuzzy-matches customer names (Ramesh / Ramesh ji / Ramesh bhai), writes everything in one DB transaction.
3. Insight agent: reads the last 30 days of data and returns top debtors, best sellers, items likely to run out within 7 days, a short friendly briefing in the shop's language, polite Hindi reminder drafts, and supplier reorder drafts.

## DATABASE
Tables: shops (id, owner_id, name, gstin, language, created_at), customers (id, shop_id, name, phone, notes), products (id, shop_id, name, unit, price, stock_qty, reorder_level), transactions (id, shop_id, customer_id, type [sale|payment], total_amount, paid_amount, created_at, raw_input), transaction_items (id, transaction_id, product_id, qty, unit_price), agent_logs (id, shop_id, agent, input, output_json, confidence, created_at).
Add RLS so users only access their own shop's rows. Create a view customer_balances (udhar per customer). Write a seed script: 15 realistic Indian customers, 30 grocery products, 3 months of transactions, plus a ready demo account.

## FEATURES (build strictly in this order; do not start a tier until the previous one is deployed and working)
Tier 1 MVP: auth; voice/text entry; parser agent; confirmation card (Confirm / Edit / Cancel); udhar ledger with history; dashboard (today's sales, total udhar, top 5 debtors, low-stock list); deploy to Vercel.
Tier 2 Core: one-click GST-style invoice PDF; reminder drafts with wa.me link; stock tracking with reorder levels.
Tier 3 Wow: insight agent with daily briefing; reorder draft for suppliers; photo import of handwritten ledger pages or supplier bills (editable review table before import).
Tier 4 Polish: Hindi/English UI toggle; loading/error/empty states; mobile responsiveness; accessibility.

## KEY USER FLOWS
A) Credit sale by voice: shopkeeper says "Ramesh ne 500 ka saaman liya, 200 abhi diye" -> parser returns sale (total 500, paid 200) -> screen shows "Ramesh: sale 500, paid 200, udhar 300. Confirm?" -> on confirm, ledger updates and an invoice button appears.
B) Payment: "Ramesh ne 300 de diye" -> payment recorded, balance 0.
C) Chase payments: dashboard -> top debtor -> Remind -> AI-drafted Hindi message -> WhatsApp opens with text pre-filled.
D) Photo import: upload photo -> vision model extracts rows -> user reviews table -> import.
Every AI-parsed entry must be confirmed by the user before saving.

## HOW WE WORK
- Work in phases: (1) setup + deploy blank app, (2) schema + auth + seed, (3) parser + confirm flow, (4) voice input, (5) ledger logic + dashboard, (6) invoices + reminders, (7) stock + insight agent, (8) photo import, (9) polish + QA, (10) docs.
- At the start of each phase: state the plan in 5-8 lines, list the files you'll create or change, then implement. At the end: tell me exactly how to run and test it, and give a one-line commit message starting with "AI:".
- Do NOT add features, libraries or refactors I didn't ask for. Ask before deviating from the stack or scope.
- Keep code simple, typed, and commented where logic is non-obvious. Validate all inputs. Never expose API keys to the client; provide .env.example.
- Add rate limiting on AI endpoints so judges can't exhaust my API budget.
- Log every agent call to agent_logs.
- Include automated tests for the parser using at least 20 Hinglish example sentences, and for ledger math.
- After each phase, append to AI_USAGE.md: what was built, the prompt used, what AI got wrong and how it was fixed.
- Keep the app deployable at every phase. If something fails, fix it before moving on.

## FINAL DOCUMENTATION (phase 10)
Write: a professional README (problem, solution, features, Mermaid architecture diagram, setup steps, env vars, demo link and demo login); AI_USAGE.md (tools used, workflow diagram, prompt log, AI-vs-human split targeting 80%+, agents explained, lessons learned); a 10-slide pitch deck outline with speaker notes; a 4-minute demo video script with timestamps.

Start now with Phase 1 only. Before writing code, ask me any questions you need (max 5), then proceed.
