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
  if (["pc", "pcs", "piece", "pieces"].includes(clean)) return "piece";
  if (["darjan", "dozen", "doz"].includes(clean)) return "dozen";
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

// Only spelling and language synonyms (no variants)
const ALIAS_GROUPS: string[][] = [
  ["atta", "aata"],
  ["doodh", "dudh", "milk"],
  ["chini", "cheeni", "sugar"],
  ["namak", "salt"],
  ["chawal", "rice"],
  ["tel", "oil", "tail"],
  ["dal", "daal", "dhal"],
  ["chai", "tea"],
  ["anda", "ande", "egg", "eggs"],
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

// Generic category words where bare terms without variant words must be treated as ambiguous
const GENERIC_CATEGORY_TERMS = new Set([
  "dal",
  "daal",
  "dhal",
  "tel",
  "oil",
  "tail",
  "chawal",
  "rice",
]);

export function isDozenUnit(unit?: string | null): boolean {
  if (!unit) return false;
  const clean = unit.trim().toLowerCase();
  return ["dozen", "darjan", "doz", "dozens"].includes(clean);
}

export function resolveEffectiveItemQty(
  qty: number,
  spokenUnit?: string | null,
  productUnit?: string | null
): number {
  if (isDozenUnit(spokenUnit) && normalizeUnit(productUnit) === "piece") {
    return qty * 12;
  }
  return qty;
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
 * 'dozen': 12 only when the product unit is piece, otherwise a mismatch.
 */
export function checkUnitMismatch(
  spokenUnit?: string | null,
  productUnit?: string | null
): { spokenUnit: string; productUnit: string } | undefined {
  if (!spokenUnit || !productUnit) return undefined;

  const normSpoken = normalizeUnit(spokenUnit);
  const normProduct = normalizeUnit(productUnit);

  // 'dozen': 12 only when the product unit is piece, otherwise a mismatch
  if (normSpoken === "dozen") {
    if (normProduct === "piece") {
      return undefined;
    }
    return {
      spokenUnit: spokenUnit.trim(),
      productUnit: productUnit.trim(),
    };
  }

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
 * 1. Normalize query and product names.
 * 2. Pure spelling and language synonyms only.
 * 3. Generic terms ("dal", "tel/oil", "chawal/rice") return ambiguous if multiple variants are stocked.
 * 4. Brand/variant words in the query narrow the match, never widen it.
 * 5. Return status: "matched", "ambiguous", or "unmatched".
 * 6. NEVER auto-create products!
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

  // Check if query is purely a generic category word
  const isBareGeneric =
    qCanonTokens.length > 0 &&
    qCanonTokens.every((token) => GENERIC_CATEGORY_TERMS.has(token));

  // Extract non-generic tokens (brand / variant words)
  const queryVariantTokens = qCanonTokens.filter(
    (token) => !GENERIC_CATEGORY_TERMS.has(token)
  );

  const candidates: ProductCandidate[] = [];

  for (const product of products) {
    const normProd = normalizeProductName(product.name);
    const pCanonTokens = normProd.tokens.map(getCanonicalProductTerm);
    const pCanonString = pCanonTokens.join(" ");

    // Brand/variant words in the product name must narrow the match, never widen it.
    // If the query specified variant/brand words, product MUST contain all of them!
    if (queryVariantTokens.length > 0) {
      const hasAllVariants = queryVariantTokens.every((vt) =>
        pCanonTokens.some(
          (pt) =>
            pt === vt ||
            (pt.length > 3 && vt.length > 3 && levenshteinDistance(pt, vt) <= 1)
        )
      );
      if (!hasAllVariants) {
        continue; // Exclude products that do not match the specified variant/brand
      }
    }

    let score = 0;

    // 1. Exact raw match
    if (normQuery.clean === normProd.clean) {
      score = 1.0;
    }
    // 2. Exact canonical alias string match
    else if (qCanonString === pCanonString) {
      score = 0.98;
    }
    // 3. Token containment
    else if (qCanonTokens.length > 0 && pCanonTokens.length > 0) {
      const isQuerySubset = qCanonTokens.every((qt) =>
        pCanonTokens.some(
          (pt) =>
            pt === qt ||
            (pt.length > 3 && qt.length > 3 && levenshteinDistance(pt, qt) <= 1)
        )
      );

      if (isQuerySubset) {
        score = isBareGeneric
          ? 0.85
          : qCanonTokens.length === pCanonTokens.length
          ? 0.96
          : 0.92;
      } else {
        const isProdSubset = pCanonTokens.every((pt) =>
          qCanonTokens.some(
            (qt) =>
              qt === pt ||
              (pt.length > 3 && qt.length > 3 && levenshteinDistance(qt, pt) <= 1)
          )
        );
        if (isProdSubset) {
          score = 0.89;
        }
      }

      if (score === 0 && !isBareGeneric && queryVariantTokens.length === 0) {
        const overlapCount = qCanonTokens.filter((qt) =>
          pCanonTokens.includes(qt)
        ).length;
        if (overlapCount > 0) {
          score = Number(
            (
              0.60 +
              (overlapCount / Math.max(qCanonTokens.length, pCanonTokens.length)) *
                0.25
            ).toFixed(2)
          );
        }
      }
    }

    // 4. Fuzzy Levenshtein similarity on normalized stems only if non-generic
    if (score === 0 && !isBareGeneric && queryVariantTokens.length === 0) {
      const maxLen = Math.max(normQuery.clean.length, normProd.clean.length);
      if (maxLen > 2) {
        const dist = levenshteinDistance(normQuery.clean, normProd.clean);
        const sim = 1 - dist / maxLen;
        if (sim >= 0.75) {
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

  // Bare generic word ("dal", "tel/oil", "chawal/rice") with several stocked variants:
  // MUST return ambiguous with candidate picker among the stocked variants
  if (isBareGeneric && candidates.length > 1) {
    return {
      status: "ambiguous",
      matched: null,
      candidates,
      score: candidates[0].score,
      originalQuery: trimmed,
      normalizedQuery: normQuery.clean,
    };
  }

  const top = candidates[0];

  // Disambiguation check for close score ties
  if (candidates.length > 1) {
    const second = candidates[1];
    if (Math.abs(top.score - second.score) < 0.10 || top.score < 0.85) {
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

  return {
    status: "ambiguous",
    matched: null,
    candidates,
    score: top.score,
    originalQuery: trimmed,
    normalizedQuery: normQuery.clean,
  };
}
