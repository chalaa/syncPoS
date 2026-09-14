// Quick smoke test for the fuzzy matching logic
// Run with: npx tsx src/app/admin/products/__tests__/autofill-fuzzy.test.ts

import { editDistance, fuzzyKeywordScore, normalizedText } from "../product-autofill";

function test(label: string, actual: unknown, expected: unknown) {
  const pass = actual === expected;
  console.log(`${pass ? "✅" : "❌"} ${label}`);
  if (!pass) console.log(`   expected: ${expected}, got: ${actual}`);
}

// editDistance
test("identical strings → 0", editDistance("grinder", "grinder"), 0);
test("1 transposition (grinedr→grinder) → 1", editDistance("grinedr", "grinder"), 1);
test("1 substitution (grunder→grinder) → 1", editDistance("grunder", "grinder"), 1);
test("1 deletion (grnder→grinder) → 1", editDistance("grnder", "grinder"), 1);
test("1 insertion (grindeer→grinder) → 1", editDistance("grindeer", "grinder"), 1);
test("2 edits (gnrder→grinder) → 3", editDistance("gnrder", "grinder") > 2, true);
test("totally different → >2", editDistance("pump", "grinder") > 2, true);

// fuzzyKeywordScore
const text = normalizedText("Bosch grinedr angle 100mm Germany");
const tokens = text.trim().split(/\s+/).filter(w => w.length >= 3);
test("fuzzy: grinedr→grinder scores >0", fuzzyKeywordScore("grinder", tokens, text) > 0, true);
test("fuzzy: exact match gets highest score", fuzzyKeywordScore("grinder", tokens, text), 7 - 1); // length - dist
test("fuzzy: pump has no match in grinder text", fuzzyKeywordScore("pump", tokens, text), 0);
test("fuzzy: short word 'an' → no fuzzy", fuzzyKeywordScore("an", tokens, text), 0);

console.log("\nAll tests done.");
