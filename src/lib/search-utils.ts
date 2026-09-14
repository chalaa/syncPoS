/**
 * Search Utilities with Word-Order Independence and Typo Tolerance (Fuzzy Matching)
 * 
 * Handles:
 * 1. Word Order Independence: "drill hammer" matches "Bosch Roteri Hammer Drill 830W"
 * 2. Typo Tolerance: "bosh" matches "Bosch", "hamer" matches "Hammer", "dril" matches "Drill"
 * 3. Token Stemming: Plurals and common suffixes standardized
 * 4. Relevance Ranking: Exact matches prioritized over fuzzy matches
 */

/**
 * Calculates Damerau-Levenshtein distance between two strings.
 * Accounts for insertions, deletions, substitutions, and adjacent character transpositions.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  // Initialize matrix of size (al + 2) x (bl + 2)
  const maxDist = al + bl;
  const da: Record<string, number> = {};

  const d: number[][] = Array.from({ length: al + 2 }, () => new Array(bl + 2).fill(0));

  d[0][0] = maxDist;
  for (let i = 0; i <= al; i++) {
    d[i + 1][0] = maxDist;
    d[i + 1][1] = i;
  }
  for (let j = 0; j <= bl; j++) {
    d[0][j + 1] = maxDist;
    d[1][j + 1] = j;
  }

  for (let i = 1; i <= al; i++) {
    let db = 0;
    for (let j = 1; j <= bl; j++) {
      const k = da[b[j - 1]] ?? 0;
      const l = db;
      let cost = 1;
      if (a[i - 1] === b[j - 1]) {
        cost = 0;
        db = j;
      }

      d[i + 1][j + 1] = Math.min(
        d[i][j + 1] + 1, // deletion
        d[i + 1][j] + 1, // insertion
        d[i][j] + cost,  // substitution
        d[k][l] + (i - k - 1) + 1 + (j - l - 1), // transposition
      );
    }
    da[a[i - 1]] = i;
  }

  return d[al + 1][bl + 1];
}

/**
 * Strips common English plural endings for robust stem comparison.
 */
export function stemWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("es") && (w.endsWith("shes") || w.endsWith("ches") || w.endsWith("sses") || w.endsWith("xes"))) {
    return w.slice(0, -2);
  }
  if (w.endsWith("s") && !w.endsWith("ss") && !w.endsWith("us") && !w.endsWith("is")) {
    return w.slice(0, -1);
  }
  return w;
}

/**
 * Splits text into normalized alphanumeric keyword tokens.
 */
export function tokenizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9.+/'-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export type TokenMatchResult = {
  matches: boolean;
  score: number;
  matchedIndex?: number;
};

/**
 * Matches a single query token against a list of target tokens and full target text.
 */
export function matchTokenAgainstTarget(
  queryToken: string,
  targetTokens: string[],
  normalizedTarget: string,
): TokenMatchResult {
  const q = queryToken.toLowerCase().trim();
  if (!q) return { matches: true, score: 0 };

  const qStem = stemWord(q);
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < targetTokens.length; i++) {
    const t = targetTokens[i];
    const tStem = stemWord(t);

    // 1. Exact token match
    if (t === q) {
      return { matches: true, score: 100, matchedIndex: i };
    }

    // 2. Stem match (e.g. "drills" -> "drill", "batteries" -> "battery")
    if (tStem === qStem) {
      const score = 95;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
      continue;
    }

    // 3. Prefix match (e.g. "hamm" -> "hammer", "bosc" -> "bosch")
    if (t.startsWith(q)) {
      const score = 80 + Math.min(15, Math.round((q.length / t.length) * 15));
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
      continue;
    }

    // 4. Substring match for tokens of length >= 3
    if (q.length >= 3 && t.includes(q)) {
      const score = 70;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
      continue;
    }

    // 5. Code / Number matching (e.g. "81" matching "ITEM-00081")
    if (/^\d+$/.test(q)) {
      const cleanNumT = t.replace(/^0+/, "");
      const cleanNumQ = q.replace(/^0+/, "");
      if (cleanNumT === cleanNumQ || t.endsWith(q)) {
        const score = 85;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
        continue;
      }
    }

    // 6. Fuzzy Typo Matching (Levenshtein / Damerau-Levenshtein)
    // Avoid fuzzy false positives for very short words
    if (q.length >= 3 && t.length >= 3) {
      const maxLen = Math.max(q.length, t.length);
      const dist = damerauLevenshteinDistance(q, t);

      let allowedDistance = 0;
      if (q.length >= 3 && q.length <= 4) {
        // Allow 1 edit distance if same starting character or length is 4
        allowedDistance = q[0] === t[0] || q.length === 4 ? 1 : 0;
      } else if (q.length >= 5) {
        // Allow up to 2 edit distances for words with 5+ letters
        allowedDistance = 2;
      }

      if (dist <= allowedDistance) {
        const similarity = 1 - dist / maxLen;
        // Require at least 65% similarity
        if (similarity >= 0.65) {
          const score = Math.round(similarity * 75);
          if (score > bestScore) {
            bestScore = score;
            bestIndex = i;
          }
        }
      }
    }
  }

  // 7. Check if query token is contained anywhere in the raw target string
  if (bestScore === 0 && q.length >= 3 && normalizedTarget.includes(q)) {
    bestScore = 60;
  }

  return {
    matches: bestScore > 0,
    score: bestScore,
    matchedIndex: bestIndex >= 0 ? bestIndex : undefined,
  };
}

export type FuzzyMatchResult = {
  matches: boolean;
  score: number;
};

/**
 * Evaluates whether a query matches target text regardless of word order and allowing typos.
 * 
 * Returns:
 * - matches: true if all query tokens find an acceptable match in target
 * - score: numerical ranking of how relevant and precise the match is
 */
export function fuzzyMatch(query: string, targetText: string): FuzzyMatchResult {
  const qTrim = query.trim().toLowerCase();
  if (!qTrim) {
    return { matches: true, score: 1 };
  }

  const normalizedTarget = targetText.toLowerCase();
  const queryTokens = tokenizeText(qTrim);
  if (queryTokens.length === 0) {
    return { matches: true, score: 1 };
  }

  const targetTokens = tokenizeText(normalizedTarget);
  if (targetTokens.length === 0) {
    return { matches: false, score: 0 };
  }

  // Exact phrase match bonus
  let baseBonus = 0;
  if (normalizedTarget.includes(qTrim)) {
    // If it's a full prefix or word boundary match
    if (normalizedTarget.startsWith(qTrim) || normalizedTarget.includes(` ${qTrim}`)) {
      baseBonus += 500;
    } else {
      baseBonus += 300;
    }
  }

  let totalScore = baseBonus;
  let matchedCount = 0;
  let prevMatchIndex = -1;
  let inOrderBonus = 0;

  for (const qToken of queryTokens) {
    const res = matchTokenAgainstTarget(qToken, targetTokens, normalizedTarget);
    if (res.matches) {
      matchedCount++;
      totalScore += res.score;
      if (res.matchedIndex !== undefined) {
        if (res.matchedIndex > prevMatchIndex) {
          inOrderBonus += 15;
        }
        prevMatchIndex = res.matchedIndex;
      }
    }
  }

  // All query tokens must match!
  // Exception: for long queries (>= 4 words), tolerate 1 missing token if others match strongly
  const minRequiredMatches = queryTokens.length >= 4 ? queryTokens.length - 1 : queryTokens.length;

  if (matchedCount < minRequiredMatches) {
    return { matches: false, score: 0 };
  }

  totalScore += inOrderBonus;

  return {
    matches: true,
    score: totalScore,
  };
}

/**
 * Filters and sorts an array of items using word-order independent fuzzy matching.
 * Highest relevance matches appear first.
 */
export function filterAndSortByFuzzy<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [...items];
  }

  const scored: { item: T; score: number }[] = [];

  for (const item of items) {
    const text = getText(item);
    const result = fuzzyMatch(trimmed, text);
    if (result.matches) {
      scored.push({ item, score: result.score });
    }
  }

  // Sort descending by match score
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.item);
}
