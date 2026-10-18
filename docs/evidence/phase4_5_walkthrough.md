# Phase 4+5 (Tier 1 UI) Verification & Walkthrough

## 1. Automated Test Suite (`npm test`)
- **Total Tests**: 89 passing across 22 suites (0 failed, 0 skipped, duration ~440ms).
- **Test Suites**:
  1. `20+ Hinglish Sentences Offline Test Suite`: 22 recorded cases covering `add_sale`, `record_payment`, `adjust_stock`, and `add_customer` with number words (paanch sau, dedh sau, dhai sau, sava sau, ek hazaar).
  2. `Ledger Business Validation Rules`: Validates `paid <= total`, stock not negative, payment vs current udhar balance, and rejection of overpayment.
  3. `Customer Name Matcher`: Disambiguation tests with identical first names (Ramesh Kumar vs Ramesh Patel), honorific stripping (`ji`, `bhai`, `sahab`, etc.), surname preservation, and "ambiguous"/"new" status handling.
  4. `Pure Helpers & IST Calculations (src/lib)`:
     - Exact Asia/Kolkata (UTC+5:30) day range calculations.
     - Midnight IST boundary tests (23:59:59.999 IST vs 00:00:00.000 IST vs 00:00:00.001 IST).
     - UUID v4 idempotency key generator.
     - Low-confidence score checker (<0.70 threshold).
     - Confirmation payload builder.
     - Friendly API error formatter.
  5. `Rate Limiting & Daily Quota Protection (DB-backed)`: User limit (20/min), IP limit (15/min), and global daily cap handling.
  6. `Tier 1 UI (/app) & Demo Auth Visitor Safety`: Checks visitor-friendly messages, no server credential/seed exposure, layout server-side `getUser()` verification, `<Suspense>` wrapping, and zero 3D/GSAP in `/app`.

## 2. Live Gemini API Smoke Test (`npm run smoke:ai`)
Executed 3 live calls to Gemini:
- **Call 1**: "Ramesh ne 500 ka saaman liya, 200 abhi diye" → `add_sale`, Confidence 0.98, Model `gemini-3.5-flash-lite`, 1267ms.
- **Call 2**: "Ramesh ne 300 de diye" → `record_payment`, Confidence 0.95, Model `gemini-3.5-flash-lite`, 1222ms.
- **Call 3**: "Suresh ji ne do sau pachas rupaye jama karwaye" → `record_payment`, Confidence 0.98, Model `gemini-3.5-flash-lite`, 1229ms.

## 3. Database Seed (`npm run seed`)
- Seeded 15 customers.
- Seeded 30 products, with 4 low-stock items (`stock_qty <= reorder_level`):
  - Fortune Sunlite Refined Oil 1L (3 / 6)
  - Amul Butter Pasteurized 100g (2 / 5)
  - Taj Mahal Tea Leaves 250g (2 / 4)
  - Toor Dal Desi 1kg (4 / 8)
- Generated 30 transactions, including 4 transactions strictly dated today in Asia/Kolkata (IST):
  - Ramesh Kumar (Sale)
  - Sunita Devi (Payment)
  - Priya Patel (Sale)
  - Sanjay Mishra (Sale)
- Calculated top debtors via `customer_balances` view:
  - Ramesh Kumar: ₹428.00 udhar
  - Sanjay Mishra: ₹415.00 udhar
  - Suresh Verma: ₹275.00 udhar
  - Deepak Yadav: ₹260.00 udhar
  - Amit Joshi: ₹230.00 udhar

## 4. Server Route & Layout Auth Verification
- `POST /api/auth/demo`: HTTP 200, signs in demo account, returns `redirectTo: "/app"`.
- `GET /app` (unauthenticated): HTTP 307 redirect to `/`.
- `GET /app` (authenticated with cookie): HTTP 200 OK.
- `GET /`: HTTP 200 OK.

## 5. Build & Lint Verification
- `npm run lint`: 0 errors, 0 warnings.
- `npm run build`: Compiled with Turbopack, Cache Components and Partial Prefetching enabled. 12 routes generated cleanly.
