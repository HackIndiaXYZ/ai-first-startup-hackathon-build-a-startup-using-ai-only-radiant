export interface Product {
  id: string;
  name: string;
  unit: string;
  price?: number;
  stock_qty: number;
  reorder_level?: number;
}

export interface ProductCandidate {
  product: Product;
  score: number;
}

export type ProductMatchStatus = "matched" | "ambiguous" | "unmatched";

export interface ProductMatchResult {
  status: ProductMatchStatus;
  matched: Product | null;
  candidates: ProductCandidate[];
  score: number;
  originalQuery: string;
  normalizedQuery: string;
  unitMismatch?: {
    spokenUnit: string;
    productUnit: string;
  };
}

/**
 * Normalizes common grocery measurement units to a canonical string
 */
export function normalizeUnit(rawUnit?: string | null): string {
  if (!rawUnit) return "";
  const clean = rawUnit.trim().toLowerCase();

  if (["kg", "kilo", "kilos", "kilogram", "kilograms"].includes(clean)) return "kg";
  if (["pkt", "packet", "packets", "pouch", "pouches", "pack", "packs"].includes(clean)) return "packet";
  if (["ltr", "litre", "litres", "liter", "liters"].includes(clean)) return "litre";
  if (["pc", "pcs", "piece", "pieces", "darjan", "dozen"].includes(clean)) return "piece";
  if (["gm", "gms", "gram", "grams", "g"].includes(clean)) return "gram";
  if (["dabba", "box", "can"].includes(clean)) return "box";

  return clean;
}

/**
 * Normalizes product query or name for comparison:
 * lowercase, alphanumeric tokens, single whitespace
 */
export function normalizeProductName(name: string): {
  clean: string;
  tokens: string[];
} {
  const clean = (name || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(" ").filter(Boolean);
  return { clean, tokens };
}

// Small alias map of staple Indian grocery terms in Roman Hinglish
const ALIAS_GROUPS: string[][] = [
  ["atta", "aata", "wheat flour", "flour", "gehu ka atta"],
  ["doodh", "milk", "dudh"],
  ["chini", "sugar", "cheeni", "shakkar"],
  ["tel", "oil", "tail", "sarson tel", "mustard oil", "refined oil"],
  ["namak", "salt", "tata namak"],
  ["chawal", "rice", "basmati", "chawal rice"],
  ["dal", "daal", "dhal", "pulses", "toor dal", "moong dal", "chana dal", "urad dal"],
  ["chai", "tea", "chai patti"],
  ["anda", "egg", "eggs", "ande"],
  ["biscuit", "biscuits"],
];

// Build bidirectional alias mapping to canonical root
const CANONICAL_ALIAS_MAP: Record<string, string> = {};
for (const group of ALIAS_GROUPS) {
  const canonical = group[0];
  for (const synonym of group) {
    CANONICAL_ALIAS_MAP[synonym.toLowerCase()] = canonical;
  }
}

/**
 * Returns canonical alias if term exists in dictionary, else returns term itself
 */
export function getCanonicalProductTerm(term: string): string {
  const lower = term.toLowerCase().trim();
  return CANONICAL_ALIAS_MAP[lower] || lower;
}

function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks whether spoken unit matches product unit.
 * If units differ, returns the mismatch object, otherwise undefined.
 */
export function checkUnitMismatch(
  spokenUnit?: string | null,
  productUnit?: string | null
): { spokenUnit: string; productUnit: string } | undefined {
  if (!spokenUnit || !productUnit) return undefined;

  const normSpoken = normalizeUnit(spokenUnit);
  const normProduct = normalizeUnit(productUnit);

  if (normSpoken && normProduct && normSpoken !== normProduct) {
    return {
      spokenUnit: spokenUnit.trim(),
      productUnit: productUnit.trim(),
    };
  }

  return undefined;
}

/**
 * Matches an item product name spoken or typed by the user against existing shop inventory.
 *
 * Rules:
 * 1. Normalize query and product names (trim, lower, remove punctuation).
 * 2. Check small alias map (atta/aata, doodh/milk, chini/sugar, tel/oil, namak/salt, chawal/rice, dal).
 * 3. Calculate fuzzy score.
 * 4. Return status: "matched", "ambiguous", or "unmatched".
 * 5. NEVER auto-create products!
 * 6. If spoken unit differs from product unit, flag it instead of guessing.
 */
export function findBestProductMatch(
  query: string,
  products: Product[],
  spokenUnit?: string | null
): ProductMatchResult {
  const trimmed = (query || "").trim();
  if (!trimmed || products.length === 0) {
    return {
      status: "unmatched",
      matched: null,
      candidates: [],
      score: 0,
      originalQuery: query,
      normalizedQuery: "",
    };
  }

  const normQuery = normalizeProductName(trimmed);
  const qCanonTokens = normQuery.tokens.map(getCanonicalProductTerm);
  const qCanonString = qCanonTokens.join(" ");

  const candidates: ProductCandidate[] = [];

  for (const product of products) {
    const normProd = normalizeProductName(product.name);
    const pCanonTokens = normProd.tokens.map(getCanonicalProductTerm);
    const pCanonString = pCanonTokens.join(" ");

    let score = 0;

    // 1. Exact raw match
    if (normQuery.clean === normProd.clean) {
      score = 1.0;
    }
    // 2. Exact canonical alias string match (e.g. query "milk" == product "doodh" -> both canonical "doodh")
    else if (qCanonString === pCanonString) {
      score = 0.98;
    }
    // 3. Token containment with alias resolution
    else if (qCanonTokens.length > 0 && pCanonTokens.length > 0) {
      // Check if all query tokens are present in product name
      // e.g. query "atta" in product "Aashirvaad Atta" -> query is subset
      const isQuerySubset = qCanonTokens.every((qt) => pCanonTokens.includes(qt));
      if (isQuerySubset) {
        // If single token query in a multi-token product name (e.g. "atta" in "Aashirvaad Atta")
        score = qCanonTokens.length === 1 && pCanonTokens.length > 1 ? 0.88 : 0.94;
      } else {
        // Check if all product tokens are present in query
        const isProdSubset = pCanonTokens.every((pt) => qCanonTokens.includes(pt));
        if (isProdSubset) {
          score = 0.89;
        }
      }

      // Check for partial token overlap if no full subset
      if (score === 0) {
        const overlapCount = qCanonTokens.filter((qt) => pCanonTokens.includes(qt)).length;
        if (overlapCount > 0) {
          score = Number((0.60 + (overlapCount / Math.max(qCanonTokens.length, pCanonTokens.length)) * 0.25).toFixed(2));
        }
      }
    }

    // 4. Fuzzy Levenshtein similarity on normalized stems if score still 0
    if (score === 0) {
      const maxLen = Math.max(normQuery.clean.length, normProd.clean.length);
      if (maxLen > 2) {
        const dist = levenshteinDistance(normQuery.clean, normProd.clean);
        const sim = 1 - dist / maxLen;
        if (sim >= 0.70) {
          score = Number((sim * 0.80).toFixed(2));
        }
      }
    }

    if (score >= 0.65) {
      candidates.push({ product, score });
    }
  }

  // Sort candidates descending by match score
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length === 0) {
    return {
      status: "unmatched",
      matched: null,
      candidates: [],
      score: 0,
      originalQuery: trimmed,
      normalizedQuery: normQuery.clean,
    };
  }

  const top = candidates[0];

  // Disambiguation check:
  // If multiple candidates have similar high scores (e.g. query "atta" with "Aashirvaad Atta" and "Fortune Atta")
  if (candidates.length > 1) {
    const second = candidates[1];
    // If top candidates are tied or score difference is tight (< 0.12)
    if (Math.abs(top.score - second.score) < 0.12 || top.score < 0.85) {
      return {
        status: "ambiguous",
        matched: null,
        candidates,
        score: top.score,
        originalQuery: trimmed,
        normalizedQuery: normQuery.clean,
      };
    }
  }

  // Single clear candidate with solid score (>= 0.85)
  if (top.score >= 0.85) {
    const unitMismatch = checkUnitMismatch(spokenUnit, top.product.unit);
    return {
      status: "matched",
      matched: top.product,
      candidates: [top],
      score: top.score,
      originalQuery: trimmed,
      normalizedQuery: normQuery.clean,
      unitMismatch,
    };
  }

  // Weak score (< 0.85) is marked ambiguous for shopkeeper confirmation
  return {
    status: "ambiguous",
    matched: null,
    candidates,
    score: top.score,
    originalQuery: trimmed,
    normalizedQuery: normQuery.clean,
  };
}
