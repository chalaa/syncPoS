import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db/client";
import { brands, productCategories, products } from "@/server/db/schema";
import { minorToDisplay } from "@/lib/catalog-utils";

export type DuplicateCheckInput = {
  name: string;
  brandId?: string | null;
  categoryId?: string | null;
  model?: string | null;
  standardName?: string | null;
};

export type DuplicateMatch = {
  id: string;
  sku: string;
  name: string;
  standardName: string | null;
  brandName?: string | null;
  categoryName?: string | null;
  model?: string | null;
  listPrice: string;
  standardCost: string;
  similarityScore: number; // 0 - 100
  matchReason: string;
  riskLevel: "high" | "medium";
};

/**
 * Strips plural suffixes and standardizes word stems.
 */
function stemWord(word: string): string {
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
 * Normalizes title text:
 * 1. Standardizes common unit abbreviations (liters -> l, watts -> w, volts -> v, etc.)
 * 2. Removes punctuation
 * 3. Extracts cleaned tokens and stems
 */
export function extractComparableTokens(text: string): { tokens: Set<string>; normalized: string } {
  const stopWords = new Set(["and", "&", "of", "for", "the", "in", "with", "a", "an", "etc", "to", "by"]);

  // Standardize common unit variations
  const preCleaned = text
    .toLowerCase()
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:liters?|litres?)\b/g, "$1l")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*watts?\b/g, "$1w")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*volts?\b/g, "$1v")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:inch|inches|in)\b/g, '$1"')
    .replace(/\b(\d+(?:[.,]\d+)?)\s*kilowatts?\b/g, "$1kw")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*horsepower\b/g, "$1hp")
    .replace(/\b(\d+(?:[.,]\d+)?)\s*(?:amps?|amperes?)\b/g, "$1a");

  // Strip punctuation and isolate words
  const words = preCleaned
    .replace(/[^a-z0-9.+/"'-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter((w) => w.length > 0 && !stopWords.has(w));

  const tokens = new Set<string>();
  for (const word of words) {
    tokens.add(word);
    const stem = stemWord(word);
    if (stem.length >= 3) {
      tokens.add(stem);
    }
  }

  const normalized = Array.from(tokens).sort().join(" ");
  return { tokens, normalized };
}

/**
 * Standard Levenshtein distance for fuzzy string comparison.
 */
export function levenshteinDistance(a: string, b: string): number {
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  const row = new Array(bl + 1);
  for (let j = 0; j <= bl; j++) row[j] = j;

  for (let i = 1; i <= al; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= bl; j++) {
      const temp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }

  return row[bl];
}

export function levenshteinSimilarity(a: string, b: string): number {
  const s1 = a.trim().toLowerCase();
  const s2 = b.trim().toLowerCase();
  if (s1 === s2) return 1.0;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  const distance = levenshteinDistance(s1, s2);
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Computes Jaccard Similarity and Containment Overlap between two token sets.
 * This is strictly order-independent!
 */
export function tokenSetSimilarity(setA: Set<string>, setB: Set<string>): {
  jaccard: number;
  overlap: number;
  intersectionSize: number;
} {
  if (setA.size === 0 || setB.size === 0) {
    return { jaccard: 0, overlap: 0, intersectionSize: 0 };
  }

  let intersectionSize = 0;
  for (const item of setA) {
    if (setB.has(item)) {
      intersectionSize++;
    }
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  const jaccard = unionSize > 0 ? intersectionSize / unionSize : 0;
  const overlap = intersectionSize / Math.min(setA.size, setB.size);

  return { jaccard, overlap, intersectionSize };
}

/**
 * Evaluates candidate product details against all active products in the company catalog.
 * Flags duplicates caused by:
 * 1. Different word order (e.g. "Makita 18V Hammer Drill" vs "Hammer Drill 18V Makita")
 * 2. Different spelling or minor typos (e.g. "Ingco" vs "Inco", "GSB 13 RE" vs "GSB13RE")
 * 3. Identical Brand and Model combination
 * 4. Identical Standard Catalog Name
 */
export async function findPotentialDuplicates(
  candidate: DuplicateCheckInput,
  companyId: string,
): Promise<DuplicateMatch[]> {
  if (!candidate.name.trim()) {
    return [];
  }

  // Fetch all existing active products with Brand and Category joins
  const existingProducts = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      standardName: products.standardName,
      brandId: products.brandId,
      brandName: brands.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      model: products.model,
      listPriceMinor: products.listPriceMinor,
      standardCostMinor: products.standardCostMinor,
    })
    .from(products)
    .leftJoin(brands, and(eq(products.brandId, brands.id), isNull(brands.deletedAt)))
    .leftJoin(productCategories, and(eq(products.categoryId, productCategories.id), isNull(productCategories.deletedAt)))
    .where(and(eq(products.companyId, companyId), isNull(products.deletedAt)));

  const candidateComparable = extractComparableTokens(candidate.name);
  const candidateNormModel = candidate.model?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  const candidateNormStandard = candidate.standardName?.trim().toLowerCase();

  const matches: DuplicateMatch[] = [];

  for (const existing of existingProducts) {
    const existingComparable = extractComparableTokens(existing.name);
    const existingNormModel = existing.model?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
    const existingNormStandard = existing.standardName?.trim().toLowerCase();

    // 1. Check exact Brand + Model Match (Highest Confidence)
    const isSameBrand =
      Boolean(candidate.brandId && existing.brandId && candidate.brandId === existing.brandId);
    const isSameModel =
      Boolean(candidateNormModel && existingNormModel && candidateNormModel === existingNormModel);

    if (isSameBrand && isSameModel) {
      matches.push({
        id: existing.id,
        sku: existing.sku,
        name: existing.name,
        standardName: existing.standardName,
        brandName: existing.brandName,
        categoryName: existing.categoryName,
        model: existing.model,
        listPrice: minorToDisplay(existing.listPriceMinor),
        standardCost: minorToDisplay(existing.standardCostMinor),
        similarityScore: 99,
        matchReason: `Identical Brand & Model: ${existing.brandName ?? ""} ${existing.model ?? ""}`,
        riskLevel: "high",
      });
      continue;
    }

    // 2. Check Standard Catalog Name match
    if (
      candidateNormStandard &&
      existingNormStandard &&
      (candidateNormStandard === existingNormStandard ||
        levenshteinSimilarity(candidateNormStandard, existingNormStandard) >= 0.9)
    ) {
      matches.push({
        id: existing.id,
        sku: existing.sku,
        name: existing.name,
        standardName: existing.standardName,
        brandName: existing.brandName,
        categoryName: existing.categoryName,
        model: existing.model,
        listPrice: minorToDisplay(existing.listPriceMinor),
        standardCost: minorToDisplay(existing.standardCostMinor),
        similarityScore: 96,
        matchReason: "Identical Standard Catalog Title",
        riskLevel: "high",
      });
      continue;
    }

    // 3. Word-Order Independent Token Matching
    const { jaccard, overlap } = tokenSetSimilarity(
      candidateComparable.tokens,
      existingComparable.tokens,
    );

    // Exact same words in different order (e.g. "Air Compressor 50L 2.2kW" vs "50L 2.2kW Air Compressor")
    if (jaccard >= 0.85) {
      matches.push({
        id: existing.id,
        sku: existing.sku,
        name: existing.name,
        standardName: existing.standardName,
        brandName: existing.brandName,
        categoryName: existing.categoryName,
        model: existing.model,
        listPrice: minorToDisplay(existing.listPriceMinor),
        standardCost: minorToDisplay(existing.standardCostMinor),
        similarityScore: Math.round(jaccard * 100),
        matchReason: `Exact same product words in different order (${Math.round(jaccard * 100)}% match)`,
        riskLevel: "high",
      });
      continue;
    }

    // High overlap / substring containment (e.g. "Makita DHP482Z Hammer Drill" vs "Makita DHP482Z Cordless Hammer Drill 18V Japan")
    if (overlap >= 0.8 && jaccard >= 0.55) {
      const score = Math.round(overlap * 60 + jaccard * 40);
      matches.push({
        id: existing.id,
        sku: existing.sku,
        name: existing.name,
        standardName: existing.standardName,
        brandName: existing.brandName,
        categoryName: existing.categoryName,
        model: existing.model,
        listPrice: minorToDisplay(existing.listPriceMinor),
        standardCost: minorToDisplay(existing.standardCostMinor),
        similarityScore: score,
        matchReason: `High keyword overlap (${score}% similarity)`,
        riskLevel: score >= 80 ? "high" : "medium",
      });
      continue;
    }

    // 4. Fuzzy Levenshtein Distance (Typos, Minor Spelling Differences)
    const spellingSimilarity = levenshteinSimilarity(
      candidateComparable.normalized,
      existingComparable.normalized,
    );
    const rawSpellingSimilarity = levenshteinSimilarity(candidate.name, existing.name);
    const bestSpellingSim = Math.max(spellingSimilarity, rawSpellingSimilarity);

    if (bestSpellingSim >= 0.78) {
      const score = Math.round(bestSpellingSim * 100);
      matches.push({
        id: existing.id,
        sku: existing.sku,
        name: existing.name,
        standardName: existing.standardName,
        brandName: existing.brandName,
        categoryName: existing.categoryName,
        model: existing.model,
        listPrice: minorToDisplay(existing.listPriceMinor),
        standardCost: minorToDisplay(existing.standardCostMinor),
        similarityScore: score,
        matchReason: `Similar spelling / minor typo detected (${score}% match)`,
        riskLevel: score >= 85 ? "high" : "medium",
      });
      continue;
    }
  }

  // Sort by highest similarity score first, capped at top 5 most relevant matches
  return matches.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
}
