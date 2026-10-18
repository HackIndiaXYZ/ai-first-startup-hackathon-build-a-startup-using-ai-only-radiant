import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AddSaleAction,
  RecordPaymentAction,
  AdjustStockAction,
  AddCustomerAction,
} from "../src/lib/agents/types";
import { RECORDED_GEMINI_FIXTURES } from "./fixtures/gemini-fixtures";

export interface HinglishSentenceTestCase {
  id: number;
  input: string;
  expectedAction: "add_sale" | "record_payment" | "adjust_stock" | "add_customer";
  expectedCustomer?: string;
  expectedAmount?: number;
  expectedPaid?: number;
  wordAmountDescription?: string;
}

export const HINGLISH_SENTENCE_TEST_CASES: HinglishSentenceTestCase[] = [
  {
    id: 1,
    input: "Ramesh ne 500 ka saaman liya, 200 abhi diye",
    expectedAction: "add_sale",
    expectedCustomer: "Ramesh",
    expectedAmount: 500,
    expectedPaid: 200,
  },
  {
    id: 2,
    input: "Ramesh ne 300 de diye",
    expectedAction: "record_payment",
    expectedCustomer: "Ramesh",
    expectedAmount: 300,
  },
  {
    id: 3,
    input: "Sunil bhaiya ko do kilo chini aur ek packet tel diya, paanch sau rupaye baaki hai",
    expectedAction: "add_sale",
    expectedCustomer: "Sunil",
    expectedAmount: 500,
    expectedPaid: 0,
    wordAmountDescription: "'paanch sau' = 500",
  },
  {
    id: 4,
    input: "Suresh ji ne do sau pachas rupaye jama karwaye",
    expectedAction: "record_payment",
    expectedCustomer: "Suresh",
    expectedAmount: 250,
    wordAmountDescription: "'do sau pachas' = 250",
  },
  {
    id: 5,
    input: "Mahesh ne paanch sau ka rashan liya pura udhar",
    expectedAction: "add_sale",
    expectedCustomer: "Mahesh",
    expectedAmount: 500,
    expectedPaid: 0,
    wordAmountDescription: "'paanch sau' = 500",
  },
  {
    id: 6,
    input: "Anita didi ko teen packet doodh diya saath rupaye naye diye",
    expectedAction: "add_sale",
    expectedCustomer: "Anita",
    expectedAmount: 60,
    expectedPaid: 60,
    wordAmountDescription: "'saath' = 60",
  },
  {
    id: 7,
    input: "Ramesh bhai ne purana hisab me se ek hazaar rupaye diye",
    expectedAction: "record_payment",
    expectedCustomer: "Ramesh",
    expectedAmount: 1000,
    wordAmountDescription: "'ek hazaar' = 1000",
  },
  {
    id: 8,
    input: "Vikram ne dedh sau ka saaman liya aur sau rupaye diye",
    expectedAction: "add_sale",
    expectedCustomer: "Vikram",
    expectedAmount: 150,
    expectedPaid: 100,
    wordAmountDescription: "'dedh sau' = 150, 'sau' = 100",
  },
  {
    id: 9,
    input: "Pooja ne dhai sau rupaye diye",
    expectedAction: "record_payment",
    expectedCustomer: "Pooja",
    expectedAmount: 250,
    wordAmountDescription: "'dhai sau' = 250",
  },
  {
    id: 10,
    input: "Aashirvaad aata ka stock 10 packet badha do",
    expectedAction: "adjust_stock",
    expectedAmount: 10,
  },
  {
    id: 11,
    input: "Tata namak 5 packet kam ho gaya",
    expectedAction: "adjust_stock",
    expectedAmount: -5,
  },
  {
    id: 12,
    input: "Naya customer jodo Rahul Verma phone number 9876543210",
    expectedAction: "add_customer",
    expectedCustomer: "Rahul Verma",
  },
  {
    id: 13,
    input: "Kishore uncle ne 1200 ka saaman liya aadha paisa diya aadha baaki",
    expectedAction: "add_sale",
    expectedCustomer: "Kishore",
    expectedAmount: 1200,
    expectedPaid: 600,
  },
  {
    id: 14,
    input: "Deepak ko 400 ka maal diya cash de diya pura",
    expectedAction: "add_sale",
    expectedCustomer: "Deepak",
    expectedAmount: 400,
    expectedPaid: 400,
  },
  {
    id: 15,
    input: "Pawan ji ne char sau rupaye cash diye",
    expectedAction: "record_payment",
    expectedCustomer: "Pawan",
    expectedAmount: 400,
    wordAmountDescription: "'char sau' = 400",
  },
  {
    id: 16,
    input: "Amit ne 750 ka samaan liya aur bola kal dunga",
    expectedAction: "add_sale",
    expectedCustomer: "Amit",
    expectedAmount: 750,
    expectedPaid: 0,
  },
  {
    id: 17,
    input: "Geeta ne teen sau rupaye udhar chukta kiya",
    expectedAction: "record_payment",
    expectedCustomer: "Geeta",
    expectedAmount: 300,
    wordAmountDescription: "'teen sau' = 300",
  },
  {
    id: 18,
    input: "Maggi noodles 20 packet add karo",
    expectedAction: "adjust_stock",
    expectedAmount: 20,
  },
  {
    id: 19,
    input: "Naya grahak Manoj Kumar mobile 9811223344",
    expectedAction: "add_customer",
    expectedCustomer: "Manoj Kumar",
  },
  {
    id: 20,
    input: "Mohan ne do hazaar ka saaman liya, ek hazaar cash diya",
    expectedAction: "add_sale",
    expectedCustomer: "Mohan",
    expectedAmount: 2000,
    expectedPaid: 1000,
    wordAmountDescription: "'do hazaar' = 2000, 'ek hazaar' = 1000",
  },
  {
    id: 21,
    input: "Rajesh bhaiya ne sava sau rupaye diye",
    expectedAction: "record_payment",
    expectedCustomer: "Rajesh",
    expectedAmount: 125,
    wordAmountDescription: "'sava sau' = 125",
  },
  {
    id: 22,
    input: "Sunil ne assi rupaye ka biscuit liya udhar me",
    expectedAction: "add_sale",
    expectedCustomer: "Sunil",
    expectedAmount: 80,
    expectedPaid: 0,
    wordAmountDescription: "'assi' = 80",
  },
];

describe("20+ Hinglish Sentences Offline Test Suite", () => {
  it("should contain at least 20 comprehensive Hinglish kirana test sentences", () => {
    assert.ok(
      HINGLISH_SENTENCE_TEST_CASES.length >= 20,
      `Expected >= 20 test cases, found ${HINGLISH_SENTENCE_TEST_CASES.length}`
    );
  });

  it("should cover all four core shop actions across the test cases", () => {
    const actions = new Set(HINGLISH_SENTENCE_TEST_CASES.map((tc) => tc.expectedAction));
    assert.ok(actions.has("add_sale"), "Must contain add_sale test cases");
    assert.ok(actions.has("record_payment"), "Must contain record_payment test cases");
    assert.ok(actions.has("adjust_stock"), "Must contain adjust_stock test cases");
    assert.ok(actions.has("add_customer"), "Must contain add_customer test cases");
  });

  it("should include words-based amounts in Hindi/Hinglish (paanch sau, do sau pachas, etc.)", () => {
    const wordAmountCases = HINGLISH_SENTENCE_TEST_CASES.filter(
      (tc) => tc.wordAmountDescription
    );
    assert.ok(
      wordAmountCases.length >= 8,
      `Expected at least 8 word-amount test cases, found ${wordAmountCases.length}`
    );
  });

  describe("Offline Recorded Fixtures Verification", () => {
    for (const testCase of HINGLISH_SENTENCE_TEST_CASES) {
      it(`[Case #${testCase.id}] should match recorded fixture: "${testCase.input}"`, () => {
        const fixture = RECORDED_GEMINI_FIXTURES[testCase.input];
        assert.ok(fixture, `Missing recorded fixture for: "${testCase.input}"`);
        assert.equal(fixture.action, testCase.expectedAction);
        assert.ok(fixture.confidence >= 0.8, "Confidence must be >= 0.8");
        assert.ok(fixture.summary.length > 0, "Summary must be non-empty");

        if (testCase.expectedAction === "add_sale") {
          const data = fixture.data as Omit<AddSaleAction, "action">;
          assert.equal(data.total, testCase.expectedAmount);
          if (testCase.expectedPaid !== undefined) {
            assert.equal(data.paid, testCase.expectedPaid);
          }
          if (testCase.expectedCustomer) {
            assert.match(data.customer || "", new RegExp(testCase.expectedCustomer, "i"));
          }
        } else if (testCase.expectedAction === "record_payment") {
          const data = fixture.data as Omit<RecordPaymentAction, "action">;
          assert.equal(data.amount, testCase.expectedAmount);
          if (testCase.expectedCustomer) {
            assert.match(data.customer || "", new RegExp(testCase.expectedCustomer, "i"));
          }
        } else if (testCase.expectedAction === "adjust_stock") {
          const data = fixture.data as Omit<AdjustStockAction, "action">;
          assert.equal(data.qty_change, testCase.expectedAmount);
        } else if (testCase.expectedAction === "add_customer") {
          const data = fixture.data as Omit<AddCustomerAction, "action">;
          if (testCase.expectedCustomer) {
            assert.match(data.name, new RegExp(testCase.expectedCustomer, "i"));
          }
        }
      });
    }
  });
});
