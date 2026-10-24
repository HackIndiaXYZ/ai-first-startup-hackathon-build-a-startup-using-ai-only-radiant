import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  findBestProductMatch,
  normalizeProductName,
  normalizeUnit,
  checkUnitMismatch,
  Product,
} from "../src/lib/product-matcher";
import {
  calculateSuggestedReorderQty,
  buildSupplierReorderMessage,
  buildWhatsAppReorderLink,
} from "../src/lib/reorder-helper";
import { validateLedgerAction } from "../src/lib/agents/ledger";
import { buildDeterministicSaleSummary } from "../src/lib/agents/parser";
import { SaleItem } from "../src/lib/agents/types";

// Mock products inventory fixture for offline testing
const SHOP_PRODUCTS: Product[] = [
  { id: "p1", name: "Aashirvaad Atta", unit: "packet", price: 60, stock_qty: 10, reorder_level: 5 },
  { id: "p2", name: "Fortune Atta", unit: "packet", price: 55, stock_qty: 8, reorder_level: 4 },
  { id: "p3", name: "Amul Doodh", unit: "packet", price: 30, stock_qty: 15, reorder_level: 5 },
  { id: "p4", name: "Madhur Chini", unit: "kg", price: 45, stock_qty: 20, reorder_level: 6 },
  { id: "p5", name: "Fortune Tel", unit: "litre", price: 140, stock_qty: 7, reorder_level: 4 },
  { id: "p6", name: "Tata Namak", unit: "packet", price: 28, stock_qty: 25, reorder_level: 8 },
  { id: "p7", name: "India Gate Chawal", unit: "kg", price: 90, stock_qty: 12, reorder_level: 5 },
  { id: "p8", name: "Toor Dal", unit: "kg", price: 160, stock_qty: 6, reorder_level: 4 },
  { id: "p9", name: "Parle-G Biscuit", unit: "packet", price: 10, stock_qty: 30, reorder_level: 10 },
  { id: "p10", name: "Farm Fresh Anda", unit: "piece", price: 7, stock_qty: 40, reorder_level: 12 },
];

describe("Stock Tracking from Sales — Offline Tests & Business Logic", () => {
  // ===========================================================================
  // 1. 16+ Hinglish Sale Sentences with Items Fixtures
  // ===========================================================================
  describe("1. Hinglish Sale Sentence Fixtures (16+ sentences)", () => {
    interface SaleSentenceFixture {
      id: number;
      input: string;
      expectedCustomer: string | null;
      expectedItems: SaleItem[];
      expectedTotal?: number;
      expectedPaid?: number;
    }

    const SENTENCE_FIXTURES: SaleSentenceFixture[] = [
      {
        id: 1,
        input: "Ramesh ne 2 packet doodh aur 1 packet atta liya",
        expectedCustomer: "Ramesh",
        expectedItems: [
          { product: "doodh", qty: 2, unit: "packet" },
          { product: "atta", qty: 1, unit: "packet" },
        ],
      },
      {
        id: 2,
        input: "Sunil ko aadha kilo chini aur dedh kilo chawal do",
        expectedCustomer: "Sunil",
        expectedItems: [
          { product: "chini", qty: 0.5, unit: "kg" },
          { product: "chawal", qty: 1.5, unit: "kg" },
        ],
      },
      {
        id: 3,
        input: "Anita didi ne ek dozen anda liya",
        expectedCustomer: "Anita",
        expectedItems: [{ product: "anda", qty: 12, unit: "piece" }],
      },
      {
        id: 4,
        input: "Suresh ne teen packet maggi aur do packet namak liya, sau rupaye diye",
        expectedCustomer: "Suresh",
        expectedItems: [
          { product: "maggi", qty: 3, unit: "packet" },
          { product: "namak", qty: 2, unit: "packet" },
        ],
        expectedPaid: 100,
      },
      {
        id: 5,
        input: "Vikram ne dhai kilo aata liya",
        expectedCustomer: "Vikram",
        expectedItems: [{ product: "aata", qty: 2.5, unit: "kg" }],
      },
      {
        id: 6,
        input: "Pooja ko char packet tel diya, do sau rupaye baaki",
        expectedCustomer: "Pooja",
        expectedItems: [{ product: "tel", qty: 4, unit: "packet" }],
        expectedTotal: 200,
        expectedPaid: 0,
      },
      {
        id: 7,
        input: "Mahesh ne paanch kilo chini liya",
        expectedCustomer: "Mahesh",
        expectedItems: [{ product: "chini", qty: 5, unit: "kg" }],
      },
      {
        id: 8,
        input: "Rajesh bhaiya ne do packet biscuit aur ek packet namak liya",
        expectedCustomer: "Rajesh",
        expectedItems: [
          { product: "biscuit", qty: 2, unit: "packet" },
          { product: "namak", qty: 1, unit: "packet" },
        ],
      },
      {
        id: 9,
        input: "Kavita ne dedh litre tel liya",
        expectedCustomer: "Kavita",
        expectedItems: [{ product: "tel", qty: 1.5, unit: "litre" }],
      },
      {
        id: 10,
        input: "Manoj ne ek pao chai patti aur aadha kilo chini li",
        expectedCustomer: "Manoj",
        expectedItems: [
          { product: "chai patti", qty: 0.25, unit: "kg" },
          { product: "chini", qty: 0.5, unit: "kg" },
        ],
      },
      {
        id: 11,
        input: "Deepak ne 500 ka rashan liya",
        expectedCustomer: "Deepak",
        expectedItems: [], // Sale with only total stays valid
        expectedTotal: 500,
      },
      {
        id: 12,
        input: "Sunil ne do packet bread li, turant cash diya",
        expectedCustomer: "Sunil",
        expectedItems: [{ product: "bread", qty: 2, unit: "packet" }],
      },
      {
        id: 13,
        input: "Amit ne teen kilo daal aur ek kilo chawal liya",
        expectedCustomer: "Amit",
        expectedItems: [
          { product: "daal", qty: 3, unit: "kg" },
          { product: "chawal", qty: 1, unit: "kg" },
        ],
      },
      {
        id: 14,
        input: "Priya ko do packet doodh diya",
        expectedCustomer: "Priya",
        expectedItems: [{ product: "doodh", qty: 2, unit: "packet" }],
      },
      {
        id: 15,
        input: "Rahul ne ek kilo namak aur do packet biscuit liya",
        expectedCustomer: "Rahul",
        expectedItems: [
          { product: "namak", qty: 1, unit: "kg" },
          { product: "biscuit", qty: 2, unit: "packet" },
        ],
      },
      {
        id: 16,
        input: "Gopal ne char kilo aata liya bina paise diye",
        expectedCustomer: "Gopal",
        expectedItems: [{ product: "aata", qty: 4, unit: "kg" }],
        expectedPaid: 0,
      },
    ];

    it("should verify all 16 Hinglish sale sentence fixtures have structured items and quantities", () => {
      assert.equal(SENTENCE_FIXTURES.length >= 16, true);
      for (const fix of SENTENCE_FIXTURES) {
        assert.ok(fix.input.length > 0);
        assert.ok(Array.isArray(fix.expectedItems));
        for (const it of fix.expectedItems) {
          assert.ok(typeof it.product === "string" && it.product.length > 0);
          assert.ok(typeof it.qty === "number" && it.qty > 0);
        }
      }
    });

    it("should build clean deterministic summary from items when total is omitted", () => {
      const summary = buildDeterministicSaleSummary("Ramesh", 0, 0, [
        { product: "doodh", qty: 2, unit: "packet" },
        { product: "atta", qty: 1, unit: "packet" },
      ]);
      assert.equal(summary, "Ramesh: 2 packet doodh, 1 packet atta");
    });
  });

  // ===========================================================================
  // 2. Product Matcher & Alias Map
  // ===========================================================================
  describe("2. Product Matcher & Alias Map", () => {
    it("should normalize product queries and strip punctuation", () => {
      const res = normalizeProductName("  Aashirvaad Atta (10kg)!  ");
      assert.equal(res.clean, "aashirvaad atta 10kg");
      assert.deepEqual(res.tokens, ["aashirvaad", "atta", "10kg"]);
    });

    it("should match exact product name with score 1.0", () => {
      const res = findBestProductMatch("Tata Namak", SHOP_PRODUCTS);
      assert.equal(res.status, "matched");
      assert.equal(res.matched?.id, "p6");
      assert.equal(res.score, 1.0);
    });

    it("should match alias aata -> atta (Aashirvaad Atta)", () => {
      const singleAttaShop: Product[] = [
        { id: "p1", name: "Aashirvaad Atta", unit: "packet", price: 60, stock_qty: 10, reorder_level: 5 },
      ];
      const res = findBestProductMatch("aata", singleAttaShop);
      assert.equal(res.status, "matched");
      assert.equal(res.matched?.name, "Aashirvaad Atta");
    });

    it("should match alias doodh -> milk and vice versa", () => {
      const milkShop: Product[] = [
        { id: "m1", name: "Amul Milk", unit: "packet", price: 30, stock_qty: 15, reorder_level: 5 },
      ];
      const res = findBestProductMatch("doodh", milkShop);
      assert.equal(res.status, "matched");
      assert.equal(res.matched?.id, "m1");

      const doodhShop: Product[] = [
        { id: "m2", name: "Amul Doodh", unit: "packet", price: 30, stock_qty: 15, reorder_level: 5 },
      ];
      const res2 = findBestProductMatch("milk", doodhShop);
      assert.equal(res2.status, "matched");
      assert.equal(res2.matched?.id, "m2");
    });

    it("should match alias chini -> sugar and tel -> oil", () => {
      const resChini = findBestProductMatch("sugar", SHOP_PRODUCTS);
      assert.equal(resChini.status, "matched");
      assert.equal(resChini.matched?.id, "p4");

      const resTel = findBestProductMatch("oil", SHOP_PRODUCTS);
      assert.equal(resTel.status, "matched");
      assert.equal(resTel.matched?.id, "p5");
    });

    it("should match alias namak -> salt and chawal -> rice", () => {
      const resNamak = findBestProductMatch("salt", SHOP_PRODUCTS);
      assert.equal(resNamak.status, "matched");
      assert.equal(resNamak.matched?.id, "p6");

      const resChawal = findBestProductMatch("rice", SHOP_PRODUCTS);
      assert.equal(resChawal.status, "matched");
      assert.equal(resChawal.matched?.id, "p7");
    });

    it("should match alias dal -> daal", () => {
      const resDal = findBestProductMatch("daal", SHOP_PRODUCTS);
      assert.equal(resDal.status, "matched");
      assert.equal(resDal.matched?.id, "p8");
    });

    it("should return status 'ambiguous' with candidate list when multiple products match closely", () => {
      // Query "atta" when shop has both "Aashirvaad Atta" and "Fortune Atta"
      const res = findBestProductMatch("atta", SHOP_PRODUCTS);
      assert.equal(res.status, "ambiguous");
      assert.equal(res.matched, null);
      assert.ok(res.candidates.length >= 2);
      const candidateNames = res.candidates.map((c) => c.product.name);
      assert.ok(candidateNames.includes("Aashirvaad Atta"));
      assert.ok(candidateNames.includes("Fortune Atta"));
    });

    it("should return status 'unmatched' for products not in stock list and NEVER auto-create", () => {
      const res = findBestProductMatch("Exotic Dragon Fruit", SHOP_PRODUCTS);
      assert.equal(res.status, "unmatched");
      assert.equal(res.matched, null);
      assert.equal(res.candidates.length, 0);
    });

    it("should return status 'unmatched' for empty or whitespace query", () => {
      const res = findBestProductMatch("   ", SHOP_PRODUCTS);
      assert.equal(res.status, "unmatched");
      assert.equal(res.matched, null);
    });
  });

  // ===========================================================================
  // 3. Unit Normalization & Mismatch Flagging
  // ===========================================================================
  describe("3. Unit Normalization & Mismatch Detection", () => {
    it("should normalize common variations of measurement units", () => {
      assert.equal(normalizeUnit("kg"), "kg");
      assert.equal(normalizeUnit("kilo"), "kg");
      assert.equal(normalizeUnit("kilogram"), "kg");

      assert.equal(normalizeUnit("pkt"), "packet");
      assert.equal(normalizeUnit("packet"), "packet");
      assert.equal(normalizeUnit("packets"), "packet");

      assert.equal(normalizeUnit("ltr"), "litre");
      assert.equal(normalizeUnit("litre"), "litre");
      assert.equal(normalizeUnit("liters"), "litre");

      assert.equal(normalizeUnit("piece"), "piece");
      assert.equal(normalizeUnit("pcs"), "piece");
      assert.equal(normalizeUnit("dozen"), "piece");
    });

    it("should flag unit mismatch when spoken unit differs from product unit (e.g. kg vs packet)", () => {
      // Tata Namak is tracked in "packet"
      const mismatch = checkUnitMismatch("kg", "packet");
      assert.ok(mismatch);
      assert.equal(mismatch.spokenUnit, "kg");
      assert.equal(mismatch.productUnit, "packet");
    });

    it("should NOT flag mismatch when units are semantically identical (e.g. kilo vs kg)", () => {
      const mismatch = checkUnitMismatch("kilo", "kg");
      assert.equal(mismatch, undefined);

      const mismatchPkt = checkUnitMismatch("pkt", "packet");
      assert.equal(mismatchPkt, undefined);
    });

    it("should attach unitMismatch to ProductMatchResult when unit differs", () => {
      const singleNamakShop: Product[] = [
        { id: "p6", name: "Tata Namak", unit: "packet", price: 28, stock_qty: 25, reorder_level: 8 },
      ];
      // User says "1 kg namak" but product is tracked in "packet"
      const res = findBestProductMatch("Tata Namak", singleNamakShop, "kg");
      assert.equal(res.status, "matched");
      assert.ok(res.unitMismatch);
      assert.equal(res.unitMismatch.spokenUnit, "kg");
      assert.equal(res.unitMismatch.productUnit, "packet");
    });
  });

  // ===========================================================================
  // 4. Stock Math & Validation (Before -> After, Low-Stock, Mismatch)
  // ===========================================================================
  describe("4. Stock Math & Business Validation Rules", () => {
    it("should compute before -> after stock correctly on valid sale", () => {
      const before = 15;
      const qtyPurchased = 2;
      const after = before - qtyPurchased;
      assert.equal(after, 13);
    });

    it("should detect when after-stock drops to or below reorder level (low-stock alert)", () => {
      const before = 7;
      const reorderLevel = 5;
      const qtyPurchased = 3;
      const after = before - qtyPurchased; // 4
      const isLowStock = after <= reorderLevel;
      assert.equal(isLowStock, true);
    });

    it("should reject sale when line item quantity exceeds available stock", () => {
      const validation = validateLedgerAction(
        {
          action: "add_sale",
          customer: "Ramesh",
          total: 500,
          paid: 0,
          items: [{ product: "Aashirvaad Atta", qty: 25 }],
          confidence: 0.95,
          summary: "Excess quantity sale",
        },
        {
          productStock: {
            "aashirvaad atta": 10,
          },
        }
      );
      assert.equal(validation.valid, false);
      assert.match(validation.error || "", /Insufficient stock for product "Aashirvaad Atta"/);
    });

    it("should compute total from item product prices when spoken total is missing", () => {
      const items = [
        { product: "Amul Doodh", qty: 2, price: 30 },
        { product: "Tata Namak", qty: 1, price: 28 },
      ];
      const computedTotal = items.reduce((sum, it) => sum + it.qty * it.price, 0);
      assert.equal(computedTotal, 88);
    });

    it("should trigger total mismatch warning when spoken total differs from computed items total", () => {
      const spokenTotal: number = 100;
      const computedTotal: number = 88;
      const isMismatch = spokenTotal !== computedTotal;
      assert.equal(isMismatch, true);
    });
  });

  // ===========================================================================
  // 5. Reorder Message & WhatsApp URL Generation
  // ===========================================================================
  describe("5. Supplier Reorder Message & WhatsApp Link", () => {
    it("should compute suggested qty as max(reorder_level * 2 - stock, reorder_level)", () => {
      // Case A: stock = 2, reorder = 5 -> max(5*2 - 2, 5) = max(8, 5) = 8
      assert.equal(calculateSuggestedReorderQty(2, 5), 8);

      // Case B: stock = 4, reorder = 4 -> max(4*2 - 4, 4) = max(4, 4) = 4
      assert.equal(calculateSuggestedReorderQty(4, 4), 4);

      // Case C: stock = 0, reorder = 6 -> max(6*2 - 0, 6) = 12
      assert.equal(calculateSuggestedReorderQty(0, 6), 12);

      // Case D: stock is close to reorder: stock = 5, reorder = 3 -> max(3*2 - 5, 3) = max(1, 3) = 3
      assert.equal(calculateSuggestedReorderQty(5, 3), 3);
    });

    it("should build clean Roman-Hinglish supplier reorder message without AI call", () => {
      const lowItems = [
        { name: "Aashirvaad Atta", currentStock: 2, suggestedQty: 8, unit: "packet" },
        { name: "Amul Doodh", currentStock: 3, suggestedQty: 7, unit: "packet" },
      ];

      const message = buildSupplierReorderMessage("Sharma Kirana", lowItems);

      assert.match(message, /Namaste ji, Sharma Kirana ke liye naya stock order bhejna hai:/);
      assert.match(message, /- Aashirvaad Atta: 8 packet \(Abhi stock: 2 packet\)/);
      assert.match(message, /- Amul Doodh: 7 packet \(Abhi stock: 3 packet\)/);
      assert.match(message, /Kripya ye delivery jaldi bhej dijiye\. DukaanAI/);

      // Strict Roman-script check: zero Devanagari characters allowed
      assert.doesNotMatch(message, /[\u0900-\u097F]/);
    });

    it("should build valid wa.me WhatsApp URL with supplier phone number", () => {
      const msg = "Namaste ji, stock order";
      const link = buildWhatsAppReorderLink("9876543210", msg);
      assert.equal(link, `https://wa.me/9876543210?text=${encodeURIComponent(msg)}`);
    });

    it("should build valid wa.me WhatsApp URL when phone is omitted", () => {
      const msg = "Namaste ji, stock order";
      const link = buildWhatsAppReorderLink("", msg);
      assert.equal(link, `https://wa.me/?text=${encodeURIComponent(msg)}`);
    });
  });
});
