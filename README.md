# 🎙️ DukaanAI (दुकानAI)
> **"Talk to your shop. DukaanAI keeps the books."**  
> *A voice-first Hinglish AI co-pilot for 13M+ Indian kirana shopkeepers.*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-dukaanai--two.vercel.app-7c3aed?style=for-the-badge&logo=vercel)](https://dukaanai-two.vercel.app)
[![Built for](https://img.shields.io/badge/HackIndia%202026-AI--First%20Startup-ff9933?style=for-the-badge)](https://dukaanai-two.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js%2016-App%20Router-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-3.5%20Flash-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20RLS-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)

---

## 🌐 Live Application Links

| Destination | URL | Description |
| :--- | :--- | :--- |
| **🚀 Main Live Website** | [https://dukaanai-two.vercel.app](https://dukaanai-two.vercel.app) | Landing page with interactive hero, audio samples, and feature breakdown |
| **📱 Direct App Access** | [https://dukaanai-two.vercel.app/app](https://dukaanai-two.vercel.app/app) | Mobile-first kirana shopkeeper dashboard, voice input, ledger & stock |
| **🔑 Sign In / Demo** | [https://dukaanai-two.vercel.app/login](https://dukaanai-two.vercel.app/login) | Google OAuth Sign-In or 1-Click Instant Demo Login (no signup needed) |
| **🔄 Alternate Production Alias** | [https://dukaanai-himanshu-rawat.vercel.app](https://dukaanai-himanshu-rawat.vercel.app) | Verified Vercel alias |

---

## 💡 The Problem
India has over **13 million kirana (mom-and-pop) grocery stores**. 
- Shopkeepers work 14–16 hour days with their hands constantly busy weighing, packing, and serving customers.
- **₹3.5 Lakhs+** is typically tied up in untracked informal credit (*udhar*).
- Existing software (Khatabook, OkCredit, Vyapar) requires **manual typing, dropdowns, and screen-hunting** — which gets abandoned during evening rush hours.
- **DukaanAI solves this by letting shopkeepers talk naturally in Hinglish.**

---

## ✨ Key Features

1. **🎙️ Voice-First Hinglish Ledger Entry**
   - Tap the mic and speak naturally: *"Ramesh ko 2 kilo chini udhar di assi rupaye"* or *"Sharma ji ne paanch sau jama karwaye"*.
   - Uses Web Speech API (hi-IN with en-IN fallback) + Gemini 3.5 structured function-calling.
   - AI extracts: customer name, transaction type (udhar/jama/cash), itemized products, quantities, prices, and confidence scores.

2. **🛡️ 3-Way AI Confirmation Card**
   - No silent hallucinations. Every parsed transaction displays a high-contrast confirmation card: **Confirm (स्वीकार करें)**, **Edit (संशोधन करें)**, or **Cancel (रद्द करें)**.

3. **📒 Digital Khata (Customer Ledger) & Balances**
   - Real-time customer balances calculated directly in PostgreSQL views with Row Level Security (RLS).
   - Instant search, customer transaction history, and balance cards.

4. **💬 1-Click WhatsApp Reminders**
   - Generate polite, localized Hindi payment reminder messages with deep-linked `wa.me` URLs with pre-filled message text.

5. **🧾 GST-Compliant Instant PDF Invoices**
   - Generate and download clean PDF receipts on-device using `pdf-lib` in under 1 second.

6. **📦 Smart Inventory & Low-Stock Alerts**
   - Automatic stock deductions on sales and visual low-stock trigger warnings with instant reorder draft lists.

7. **🌅 AI Daily Morning Briefing**
   - Insight Agent computes today's collections, total market udhar, top debtors to follow up with, and stock needing reorders.

8. **⚡ Zero Friction for Hackathon Judges**
   - **1-Click Demo Login** pre-loaded with "Sharma Kirana Store" (15 customers, 30 grocery products, 90 days of ledger entries).
   - **Load Sample Data Button** for judges signing in via their own Google accounts to explore with 1 click.

---

## 🏗️ Architecture & Tech Stack

```
           ┌──────────────────────────────────────────────┐
           │            Client (Next.js 16 PWA)           │
           │  • Web Speech API (hi-IN / en-IN)            │
           │  • Motion animations (reduced-motion aware)  │
           │  • Tailwind CSS v4 + shadcn/ui               │
           └──────────────────────┬───────────────────────┘
                                  │ Voice Audio / Transcript
                                  ▼
           ┌──────────────────────────────────────────────┐
           │         Server-Side Agent Pipeline           │
           │  • Parser Agent: Gemini 3.5 function calling │
           │  • Ledger Agent: fuzzy matching & validation │
           │  • Insight Agent: briefings & drafts         │
           └──────────────────────┬───────────────────────┘
                                  │ Normalized Actions
                                  ▼
           ┌──────────────────────────────────────────────┐
           │             Supabase (PostgreSQL)            │
           │  • Row-Level Security (RLS) enforcement      │
           │  • 6 tables + customer_balances view         │
           │  • Security-definer & security-invoker RPCs  │
           └──────────────────────┬───────────────────────┘
```

- **Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Styling & Motion:** Tailwind CSS v4, shadcn/ui, Motion (Framer Motion)
- **AI Core:** Google Gemini 3.5 Flash (`gemini-3.5-flash-lite` with fallback to `gemini-3.1-flash-lite`)
- **Database & Auth:** Supabase (PostgreSQL, Row Level Security, Google OAuth)
- **PDF Engine:** `pdf-lib` (client-side zero-latency invoice generation)
- **Deployment:** Vercel Edge Network

---

## 🚀 Quickstart for Local Development

### Prerequisites
- Node.js 20+
- Supabase account & project
- Google Gemini API key

### 1. Clone the repository
```bash
git clone https://github.com/HackIndiaXYZ/ai-first-startup-hackathon-build-a-startup-using-ai-only-radiant.git dukaanai
cd dukaanai
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup environment variables
Copy `.env.example` to `.env.local` and fill in your keys:
```bash
cp .env.example .env.local
```
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
LLM_MODEL=gemini-3.5-flash-lite
LLM_FALLBACK_MODEL=gemini-3.1-flash-lite
DEMO_USER_EMAIL=demo@dukaanai.in
DEMO_USER_PASSWORD=your_demo_password
```

### 4. Run database migrations & seed demo data
Apply SQL files in `supabase/migrations/` via the Supabase SQL Editor, then seed:
```bash
npm run seed
```

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

The codebase includes comprehensive unit, integration, and security test suites:
```bash
# Run all 220+ automated tests (parser, ledger math, auth, security)
npm test

# Run ESLint validation
npm run lint

# Run production build validation
npm run build

# Run AI smoke test against Gemini API
npm run smoke:ai
```

---

## 👥 Hackathon Team: RADIANT
- Built for **HackIndia 2026 AI-First Startup Hackathon**
- **Track:** Build a Startup Using AI Only
- **Live URL:** [https://dukaanai-two.vercel.app](https://dukaanai-two.vercel.app)
