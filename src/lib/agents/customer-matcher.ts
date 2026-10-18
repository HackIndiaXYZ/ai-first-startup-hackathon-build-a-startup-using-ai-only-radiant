import { Customer, CustomerMatchResult, CustomerCandidate } from "./types";

// Strip ONLY cultural honorifics. Surnames (Kumar, Singh, Sharma, etc.) must NEVER be stripped!
const HONORIFICS = new Set([
  "ji",
  "bhai",
  "bhaiya",
  "uncle",
  "aunty",
  "didi",
  "sahab",
  "seth",
]);

/**
 * Normalizes an Indian name by trimming, lowercasing, and stripping
 * strictly cultural honorifics (ji, bhai, bhaiya, uncle, aunty, didi, sahab, seth).
 * Surnames like Kumar, Singh, Sharma are preserved completely.
 */
export function normalizeName(name: string): {
  clean: string;
  stem: string;
  tokens: string[];
  stemTokens: string[];
} {
  const clean = name
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u097F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = clean.split(" ").filter(Boolean);
  const stemTokens = tokens.filter((t) => !HONORIFICS.has(t));
  const stem = stemTokens.join(" ");

  return { clean, stem: stem || clean, tokens, stemTokens };
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
 * Matches a customer query name against existing shop customers.
 *
 * Rules:
 * 1. Strip only honorifics (ji, bhai, bhaiya, uncle, aunty, didi, sahab, seth).
 * 2. Never strip surnames (Kumar, Singh, Sharma etc).
 * 3. If multiple candidates or similarity is weak, return status "ambiguous" with candidates so the user picks.
 * 4. If no match, return status "new" proposing to create a new customer.
 * 5. Never auto-merge.
 */
export function findBestCustomerMatch(
  query: string,
  customers: Customer[]
): CustomerMatchResult {
  const trimmed = query ? query.trim() : "";
  if (!trimmed || customers.length === 0) {
    return {
      status: "new",
      matched: null,
      candidates: [],
      score: 0,
      originalQuery: query,
      normalizedQuery: "",
      proposedName: trimmed || undefined,
    };
  }

  const normQuery = normalizeName(trimmed);
  const candidates: CustomerCandidate[] = [];

  for (const customer of customers) {
    const normCust = normalizeName(customer.name);
    let score = 0;

    // 1. Exact clean match (including full surname if present)
    if (normQuery.clean === normCust.clean) {
      score = 1.0;
    }
    // 2. Exact stem match (honorific stripped from query or customer)
    else if (normQuery.stem === normCust.stem) {
      score = 0.98;
    }
    // 3. Token containment (e.g. query "Ramesh" matching "Ramesh Kumar" or "Ramesh Patel")
    else {
      const qTokens = normQuery.stemTokens;
      const cTokens = normCust.stemTokens;

      if (qTokens.length > 0 && cTokens.length > 0) {
        const isSubset = qTokens.every((qt) => cTokens.includes(qt));
        if (isSubset) {
          // If query is only first name and customer has full name with surname,
          // score is good (0.85) but leaves room for disambiguation if multiple customers share first name
          score = qTokens.length === 1 && cTokens.length > 1 ? 0.85 : 0.90;
        } else {
          const isSuperset = cTokens.every((ct) => qTokens.includes(ct));
          if (isSuperset) {
            score = 0.86;
          }
        }
      }

      // 4. Levenshtein similarity on stems if no token match
      if (score === 0) {
        const maxLen = Math.max(normQuery.stem.length, normCust.stem.length);
        if (maxLen > 2) {
          const dist = levenshteinDistance(normQuery.stem, normCust.stem);
          const sim = 1 - dist / maxLen;
          if (sim >= 0.70) {
            score = Number((sim * 0.82).toFixed(2));
          }
        }
      }
    }

    if (score >= 0.65) {
      candidates.push({ customer, score });
    }
  }

  // Sort descending by match score
  candidates.sort((a, b) => b.score - a.score);

  // If no candidates found
  if (candidates.length === 0) {
    return {
      status: "new",
      matched: null,
      candidates: [],
      score: 0,
      originalQuery: trimmed,
      normalizedQuery: normQuery.stem,
      proposedName: trimmed,
    };
  }

  const top = candidates[0];

  // If exact match (1.0 or 0.98), and no runner-up with identical score
  if (top.score >= 0.95) {
    const ties = candidates.filter((c) => c.score >= 0.95);
    if (ties.length === 1) {
      return {
        status: "matched",
        matched: top.customer,
        candidates: [top],
        score: top.score,
        originalQuery: trimmed,
        normalizedQuery: normQuery.stem,
      };
    }
  }

  // Disambiguation check:
  // If multiple candidates match (e.g. query "Ramesh" with "Ramesh Kumar" and "Ramesh Patel"),
  // return ambiguous so user picks between them
  if (candidates.length > 1) {
    const second = candidates[1];
    if (top.score - second.score < 0.15 || top.score < 0.92) {
      return {
        status: "ambiguous",
        matched: null,
        candidates,
        score: top.score,
        originalQuery: trimmed,
        normalizedQuery: normQuery.stem,
        proposedName: trimmed,
      };
    }
  }

  // Exactly one candidate with solid match (score >= 0.80)
  if (top.score >= 0.80) {
    return {
      status: "matched",
      matched: top.customer,
      candidates: [top],
      score: top.score,
      originalQuery: trimmed,
      normalizedQuery: normQuery.stem,
    };
  }

  // If score is weak (< 0.80), mark as ambiguous so user picks or chooses new
  return {
    status: "ambiguous",
    matched: null,
    candidates,
    score: top.score,
    originalQuery: trimmed,
    normalizedQuery: normQuery.stem,
    proposedName: trimmed,
  };
}
