import type { CategorySelectOption, SelectOption } from "@/server/catalog/types";

// Curated domain keywords & synonyms for hardware, industrial tools, electronics, and machinery.
export const categoryKeywords: Record<string, string[]> = {
  "Air Compressors": ["compressor", "air pump", "pneumatic"],
  "Automotive & Tyre": ["tyre", "wheel", "balancer", "changer", "tire"],
  "Blades & Cutting Discs": ["blade", "cutting disc", "diamond disc", "grinding disc", "abrasive"],
  Chainsaws: ["chain saw", "chainsaw", "guide bar"],
  Chemicals: ["paint", "thinner", "chemical", "silicone", "coolant", "sealant", "epoxy", "primer"],
  "Concrete Equipment": ["vibrator", "concrete mixer", "compactor", "trowel", "screed", "rammer"],
  Consumables: ["oil", "grease", "thread", "belt", "lubricant", "wire rod"],
  "Drill Bits & Accessories": ["drill bit", "sds max", "sds plus", "hss bit", "auger bit", "core bit", "chisel"],
  "Drills & Hammers": ["rotary hammer", "demolition", "hammer drill", "impact drill", "drill machine", "cordless drill", "impact wrench"],
  "Electric Motors": ["electric motor", "alternator", "dynamo", "induction motor"],
  "Electrical Accessories": ["battery", "avr", "capacitor", "inverter", "charger", "socket"],
  Engines: ["engine", "gx390", "gx200", "gx160", "diesel engine", "petrol engine", "gasoline engine"],
  Generators: ["generator", "generetor", "genrator", "genset", "silent generator"],
  "Grinders & Polishers": ["grinder", "angle grinder", "polisher", "bench grinder", "die grinder"],
  "Hand Tools & Sets": ["tool set", "spanner", "wrench", "plier", "pliers", "socket set", "screwdriver", "hammer"],
  "Hoists & Lifting": ["hoist", "winch", "jack", "pallet truck", "chain block", "lever block", "crane"],
  "Hoses & Fittings": ["hose", "fitting", "coupler", "connector", "pipe"],
  "Lawn & Garden": ["lawn", "mower", "trimmer", "brush cutter", "hedge trimmer", "grass cutter"],
  "Lubrication Equipment": ["oil pump", "grease pump", "grease gun", "lubricator"],
  "Measuring Tools": ["scale", "multimeter", "laser", "level", "tape", "caliper", "gage", "gauge", "measuring"],
  Mixers: ["mixer", "concrete mixer", "mortar mixer", "paint mixer"],
  "Nailers Guns & Sprayers": ["nailer", "stapler", "spray gun", "sprayer", "airbrush", "paint sprayer"],
  "Planers & Woodworking": ["planer", "sander", "router", "jointer", "woodworking", "wood lathe"],
  "Pressure Washers": ["pressure washer", "washer machine", "car washer", "high pressure cleaner"],
  "Safety Equipment": ["glove", "boot", "safety", "helmet", "mask", "goggles", "vest", "earmuff"],
  Saws: ["circular saw", "table saw", "jigsaw", "band saw", "cut off", "mitre saw", "miter saw", "reciprocating saw"],
  "Solar Power": ["solar", "power station", "solar panel", "photovoltaic", "pv module"],
  "Spare Parts": ["spare part", "filter", "bearing", "gasket", "carburetor", "piston", "spark plug"],
  "Vacuum Cleaners": ["vacuum", "cleaner", "dust extractor", "wet dry vacuum"],
  "Water Pumps": ["water pump", "submersible", "sewage", "centrifugal", "jet pump", "deep well pump", "booster pump"],
  "Welding Accessories": ["welding mask", "electrode holder", "welding cable", "earth clamp", "welding helmet"],
  "Welding Machines": ["welding", "welder", "arc welding", "mma", "mig", "tig", "mag", "plasma cutter", "inverter welder"],
};

export const brandCountryFallbacks: Record<string, string> = {
  bosch: "Germany",
  makita: "Japan",
  dewalt: "USA",
  diwalt: "USA",
  milwaukee: "USA",
  ingco: "China",
  total: "China",
  crown: "China",
  honda: "Japan",
  hyundai: "South Korea",
  yamaha: "Japan",
  still: "Germany",
  stihl: "Germany",
  apple: "USA",
  samsung: "South Korea",
};

export function normalizedText(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9.+/"'°-]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

/**
 * Strips common English plural endings for robust stem matching.
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
 * Damerau-Levenshtein edit distance (handles transpositions like "grinedr" → "grinder").
 * Uses an optimised two-row DP so it allocates very little memory even for large word lists.
 * Returns the number of single-character edits (insert, delete, substitute, transpose) needed.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Keep the shorter string in `a` to minimise row length
  if (a.length > b.length) {
    [a, b] = [b, a];
  }

  const al = a.length;
  const bl = b.length;
  let prev2 = new Array<number>(al + 1);
  let prev1 = new Array<number>(al + 1);
  let curr  = new Array<number>(al + 1);

  for (let i = 0; i <= al; i++) prev1[i] = i;

  for (let j = 1; j <= bl; j++) {
    curr[0] = j;
    for (let i = 1; i <= al; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(
        prev1[i] + 1,        // deletion
        curr[i - 1] + 1,     // insertion
        prev1[i - 1] + cost, // substitution
      );
      // Damerau transposition
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[i] = Math.min(curr[i], prev2[i - 2] + cost);
      }
    }
    [prev2, prev1, curr] = [prev1, curr, prev2];
  }

  return prev1[al];
}

/**
 * Returns the maximum edit-distance to still be considered a "fuzzy match".
 * Short words (≤3 chars) need exact matches to avoid false positives.
 * Words of 4–6 chars tolerate 1 edit; 7+ chars tolerate 2 edits.
 */
function fuzzyTolerance(wordLen: number): number {
  if (wordLen <= 3) return 0;
  if (wordLen <= 6) return 1;
  return 2;
}

/**
 * Extracts the individual lowercase words from already-normalised text (padded with spaces).
 */
function textWords(normalised: string): string[] {
  return normalised.trim().split(/\s+/).filter((w) => w.length >= 3);
}

/**
 * Checks whether any word in `textTokens` is a fuzzy match for `keyword`.
 * Returns a score > 0 when a match is found:
 *   • exact word-boundary hit → keyword.length * 3   (highest)
 *   • substring hit           → keyword.length * 2
 *   • fuzzy hit (≤ tolerance) → keyword.length – distance  (lower bonus)
 */
export function fuzzyKeywordScore(keyword: string, textTokens: string[], exactText: string): number {
  if (keyword.length < 3) return 0;

  // Exact word boundary (already checked upstream, but included for completeness)
  if (exactText.includes(` ${keyword} `)) {
    return keyword.length * 3;
  }
  // Substring match
  if (exactText.includes(keyword)) {
    return keyword.length * 2;
  }

  const tol = fuzzyTolerance(keyword.length);
  if (tol === 0) return 0; // short word – no fuzzy

  let bestScore = 0;
  for (const token of textTokens) {
    if (Math.abs(token.length - keyword.length) > tol) continue; // fast pre-filter
    const dist = editDistance(keyword, token);
    if (dist > 0 && dist <= tol) {
      // Scale score: longer keyword with small distance → higher confidence
      const score = keyword.length - dist;
      if (score > bestScore) bestScore = score;
    }
  }
  return bestScore;
}

/**
 * Extracts searchable keyword tokens from any entity name (brand, category, spec).
 * Automatically generates stems so that ANY newly added category or brand is matched instantly.
 */
export function extractKeywordsFromText(text: string): string[] {
  const stopWords = new Set(["and", "&", "of", "for", "the", "in", "with", "a", "an", "etc", "to"]);
  const cleaned = text
    .toLowerCase()
    .replace(/[&/\\(),.+_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length >= 2 && !stopWords.has(w));
  const stems = new Set<string>();

  // Full cleaned phrase
  if (cleaned.length >= 3) {
    stems.add(cleaned);
  }

  // Individual words and their stems
  for (const w of words) {
    stems.add(w);
    const stem = stemWord(w);
    if (stem.length >= 3) {
      stems.add(stem);
    }
  }

  return Array.from(stems);
}

export function optionScore(option: SelectOption, text: string): number {
  const tokens = textWords(text);
  return [option.name, option.code].filter(Boolean).reduce((score, value) => {
    const normalizedValue = value.toLowerCase().trim();
    if (!normalizedValue) return score;

    // Exact word boundary match gets maximum weight
    if (text.includes(` ${normalizedValue} `)) {
      return Math.max(score, normalizedValue.length * 3 + 20);
    }

    // Substring match
    if (text.includes(normalizedValue)) {
      return Math.max(score, normalizedValue.length * 2);
    }

    // Fuzzy match — per-word comparison against individual tokens of the option name
    const optionWords = normalizedValue.split(/\s+/).filter((w) => w.length >= 3);
    for (const ow of optionWords) {
      const fuzzy = fuzzyKeywordScore(ow, tokens, text);
      if (fuzzy > 0) {
        // Give a modest bonus; penalise proportionally to keep below exact matches
        return Math.max(score, fuzzy + 3);
      }
    }

    return score;
  }, 0);
}

/**
 * Dynamic Brand Matching:
 * Evaluates any brand (existing or dynamically created) against the product name.
 * Respects whole-word boundaries and prioritizes longer specific brand names.
 */
export function bestMatchingOption<TOption extends SelectOption>(
  options: TOption[],
  productName: string,
): TOption | undefined {
  if (!productName.trim() || options.length === 0) return undefined;
  const text = normalizedText(productName);

  const scored = options
    .map((option) => {
      let score = optionScore(option, text);

      // Check tokens if multi-word brand (e.g. "Genius Brothers", "Atlas Copco")
      const tokens = extractKeywordsFromText(option.name);
      for (const token of tokens) {
        if (token.length >= 3 && text.includes(` ${token} `)) {
          score = Math.max(score, token.length * 2 + 10);
        }
      }

      return { option, score };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.option;
}

/**
 * Dynamic Category Matching:
 * Matches ANY category (current or newly created) by intelligently analyzing:
 * 1. Exact & partial name matches
 * 2. Generated stems and keyword tokens from the category name
 * 3. Static/curated domain synonyms (if available)
 * 4. Contextual hints from the category's specification schema
 */
export function bestMatchingCategory(
  options: CategorySelectOption[],
  productName: string,
): CategorySelectOption | undefined {
  if (!productName.trim() || options.length === 0) return undefined;
  const text = normalizedText(productName);

  const scored = options
    .map((option) => {
      let score = 0;
      const normCatName = option.name.toLowerCase().trim();

      // 1. Direct full category name match (e.g. "Air Compressors" in "Industrial Air Compressors 50L")
      if (text.includes(` ${normCatName} `)) {
        score += normCatName.length * 4 + 40;
      } else if (text.includes(normCatName)) {
        score += normCatName.length * 3 + 20;
      }

      // 2. Dynamic tokens & stems generated from the category name
      const dynamicTokens = extractKeywordsFromText(option.name);
      const inputTokens = textWords(text);
      for (const token of dynamicTokens) {
        if (text.includes(` ${token} `)) {
          score += token.length * 2 + 10;
        } else if (token.length >= 4 && text.includes(token)) {
          score += token.length;
        } else {
          // Fuzzy fallback for each dynamic token
          const fuzzy = fuzzyKeywordScore(token, inputTokens, text);
          if (fuzzy > 0) score += fuzzy + 3;
        }
      }

      // 3. Curated domain keywords & synonyms (if configured for this category name)
      const curatedKeywords = categoryKeywords[option.name] ?? [];
      for (const keyword of curatedKeywords) {
        const normKeyword = normalizedText(keyword).trim();
        if (text.includes(` ${normKeyword} `)) {
          score += normKeyword.length * 3 + 25;
        } else if (text.includes(normKeyword)) {
          score += normKeyword.length * 2 + 10;
        } else {
          // Fuzzy per-word check against the curated keyword tokens
          const kwTokens = normKeyword.split(/\s+/).filter((w) => w.length >= 4);
          for (const kwt of kwTokens) {
            const fuzzy = fuzzyKeywordScore(kwt, inputTokens, text);
            if (fuzzy > 0) score += fuzzy + 5;
          }
        }
      }

      // 4. Contextual specification schema hints (e.g. category has blade_size_mm and title has "blade")
      if (option.specificationSchema && option.specificationSchema.length > 0) {
        for (const spec of option.specificationSchema) {
          const specTokens = extractKeywordsFromText(spec.label || spec.key);
          for (const st of specTokens) {
            if (st.length >= 4 && text.includes(` ${st} `)) {
              score += 4;
            }
          }
        }
      }

      // 5. Code match (e.g. CAT-0001)
      if (option.code && text.includes(option.code.toLowerCase())) {
        score += 30;
      }

      return { option, score };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);

  return scored[0]?.option;
}

/**
 * Extracts ONLY the actual manufacturer product model code from the product name.
 * Strips all engineering specification values (e.g. 100L, 2.2kW, 750W, 18V, 220V, 4.0Ah, 11000rpm, etc.),
 * category words, descriptors, and origin countries so specifications NEVER leak into the model field.
 */
export function extractModel(
  productName: string,
  brand?: SelectOption | null,
  category?: SelectOption | null,
): string {
  if (!productName.trim()) return "";

  // Common stop words, tool types, and descriptors that should NEVER be considered model codes
  const toolAndDescriptorWords = new Set([
    // Tool Types & Generic Nouns
    "drill", "drills", "hammer", "hammers", "grinder", "grinders", "saw", "saws",
    "compressor", "compressors", "pump", "pumps", "engine", "engines", "generator", "generators",
    "motor", "motors", "wrench", "wrenches", "driver", "drivers", "polisher", "polishers",
    "planer", "planers", "router", "routers", "sander", "sanders", "blower", "blowers",
    "cutter", "cutters", "cleaner", "cleaners", "vacuum", "vacuums", "jack", "jacks",
    "hoist", "hoists", "winch", "winches", "scale", "scales", "inverter", "inverters",
    "welder", "welders", "welding", "machine", "machines", "tool", "tools", "equipment",
    "accessory", "accessories", "set", "sets", "kit", "kits", "blade", "blades",
    "disc", "discs", "bit", "bits", "hose", "hoses", "fitting", "fittings",
    "battery", "batteries", "charger", "chargers", "pipe", "pipes", "valve", "valves",
    "sewing", "closer", "closers", "sprayer", "sprayers", "spray", "gun", "guns",
    "stapler", "staplers", "nailer", "nailers", "mixer", "mixers", "measuring",
    "gauge", "gauges", "gage", "wheel", "tyre", "tire", "bearing", "bearings",

    // Adjectives & Features
    "cordless", "brushless", "silent", "soundproof", "quiet", "low", "noise",
    "oil", "free", "oilless", "portable", "handheld", "compact", "rotary", "impact",
    "demolition", "angle", "bench", "table", "circular", "jig", "jigsaw", "band", "miter",
    "mitre", "cut", "off", "reciprocating", "submersible", "centrifugal", "jet", "sewage",
    "heavy", "duty", "industrial", "professional", "commercial", "standard", "original",
    "electric", "electronic", "manual", "automatic", "digital", "laser", "guide",
    "gasoline", "petrol", "diesel", "solar", "recoil", "air", "water", "cooled", "cooling",
    "start", "starting", "starter", "single", "three", "phase", "stroke", "speed",

    // Common Origin Countries
    "japan", "germany", "china", "usa", "italy", "korea", "taiwan", "spain", "india", "turkey",
    "ethiopia", "uae", "dubai", "uk", "france",

    // Finishes & Materials
    "black", "white", "silver", "gold", "blue", "red", "yellow", "green", "orange",
    "grey", "gray", "titanium", "desert", "natural", "stainless", "steel", "iron", "aluminum", "brass",
  ]);

  // 1. Remove brand name from title
  let textWithoutBrand = productName.trim();
  if (brand?.name) {
    textWithoutBrand = textWithoutBrand.replace(
      new RegExp(`\\b${brand.name.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "ig"),
      " ",
    );
  }

  // 2. Remove category name and constituent keywords
  if (category?.name) {
    const catWords = category.name.split(/[&/\\(),.+_\s-]+/).filter((w) => w.length >= 3);
    for (const cw of [category.name, ...catWords]) {
      textWithoutBrand = textWithoutBrand.replace(
        new RegExp(`\\b${cw.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}s?\\b`, "ig"),
        " ",
      );
    }
  }

  // 3. Match all specification quantity tokens with units and strip them
  // e.g. 100L, 2.2kW, 750W, 115mm, 18V, 220V, 4.0Ah, 4A, 11000rpm, 500Nm, 1/2", 13HP, 389cc, 50Hz, 180bar, 15LPM, 256GB, 1TB
  const specUnitRegex =
    /\b\d+(?:[.,]\d+)?\s*(?:kw|kva|hp|w|watts?|v|volts?|ah|a|hz|rpm|bar|psi|l|liters?|litres?|ml|gal|gallons?|cc|kg|ton|tons|t|mm|cm|m|meters?|wh|gb|tb|mb|nm|lpm|cfm|deg|degree|°|pcs|pc|pieces?)\b/gi;
  const inchRegex = /\b\d+(?:[ -]\d+\/\d+)?\s*(?:"|inch\b|in\b)/gi;
  const fractionRegex = /\b\d+\/\d+\s*(?:"|inch\b|in\b)?/gi;

  const cleaned = textWithoutBrand
    .replace(specUnitRegex, " ")
    .replace(inchRegex, " ")
    .replace(fractionRegex, " ")
    .replace(/[,;:/()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Split into candidate tokens
  const rawTokens = cleaned.split(" ").filter(Boolean);
  const candidateTokens: string[] = [];

  for (let i = 0; i < rawTokens.length; i++) {
    const token = rawTokens[i];
    const lower = token.toLowerCase();

    // Skip descriptors
    if (toolAndDescriptorWords.has(lower)) {
      continue;
    }

    // Check if token is a number
    if (/^\d+$/.test(token)) {
      // Standalone catalog numbers like 190108 (5+ digits) are valid models
      if (token.length >= 5) {
        candidateTokens.push(token);
        continue;
      }

      // Check if preceded or followed by an alphanumeric model prefix/suffix (e.g. 'GSB 13 RE' or 'iPhone 16 Pro Max')
      const prev = rawTokens[i - 1]?.toLowerCase();
      const next = rawTokens[i + 1]?.toLowerCase();
      const isPartOfModelChain =
        (prev && !toolAndDescriptorWords.has(prev) && /[A-Za-z]/.test(prev)) ||
        (next && !toolAndDescriptorWords.has(next) && /[A-Za-z]/.test(next));

      if (isPartOfModelChain) {
        candidateTokens.push(token);
      }
      continue;
    }

    // Token with letters or hyphens
    if (/[A-Za-z]/.test(token) || /\d+-\d+/.test(token)) {
      candidateTokens.push(token);
    }
  }

  if (candidateTokens.length === 0) {
    return "";
  }

  // Model codes are typically 1 to 4 words (e.g. 'iPhone 16 Pro Max', 'SIW 6AT-A22', 'GWS 750-115')
  return candidateTokens.slice(0, 4).join(" ");
}

function withUnit(match: RegExpMatchArray | null, unit: string): string {
  return match?.[1] ? `${match[1].replace(",", ".")}${unit}` : "";
}

/**
 * Comprehensive Dynamic Specification Extractor:
 * Supports ANY specification field, whether existing or newly added by an administrator.
 *
 * It automatically inspects the specification `key` and `label`:
 * 1. Dynamic unit & dimension detection (kW, kVA, HP, W, V, A, Hz, RPM, bar, psi, L, mL, cc, kg, ton, mm, cm, m, inch, Ah, Wh, GB, TB, Nm, etc.)
 * 2. Common engineering options & booleans (silent, cordless, oil_free, portable, fuel_type, phase, starting_system, etc.)
 * 3. Color & material detection
 * 4. Title pattern matching (e.g. `Label: Value` or `Key Value`)
 */
export function extractSpecificationValue(
  fieldOrKey: { key: string; label?: string } | string,
  productName: string,
): string {
  if (!productName.trim()) return "";
  const key = typeof fieldOrKey === "string" ? fieldOrKey : fieldOrKey.key;
  const label = typeof fieldOrKey === "object" ? fieldOrKey.label ?? "" : "";

  const text = normalizedText(productName);
  const rawText = productName.trim();
  const normalizedKey = key.toLowerCase().trim();
  const normalizedLabel = label.toLowerCase().trim();
  const combinedMeta = `${normalizedKey} ${normalizedLabel}`;

  // ==========================================
  // 1. DYNAMIC UNIT & DIMENSION RESOLUTION
  // ==========================================

  // Power: kVA
  if (combinedMeta.includes("kva")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*kva\b/);
    if (match) return withUnit(match, "kVA");
  }

  // Power: kW
  if (combinedMeta.includes("kw")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*kw\b/);
    if (match) return withUnit(match, "kW");
  }

  // Power: HP
  if (combinedMeta.includes("hp") || combinedMeta.includes("horsepower")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*hp\b/);
    if (match) return withUnit(match, "HP");
  }

  // Power: W (Watts)
  if (combinedMeta.includes("power_w") || combinedMeta.includes("_w") || combinedMeta.includes("watt")) {
    const match = text.match(/(\d{2,5})\s*(?:w|watts|watt)\b/);
    if (match) return withUnit(match, "W");
  }

  // Voltage: V (Volts)
  if (combinedMeta.includes("voltage") || combinedMeta.includes("volt") || combinedMeta.includes("_v") || combinedMeta.includes("battery_v")) {
    const match = text.match(/(\d{1,3})\s*(?:v|volt|volts)\b/);
    if (match) return withUnit(match, "V");
  }

  // Current: A (Amperes)
  if (combinedMeta.includes("current") || combinedMeta.includes("amp") || combinedMeta.includes("_a")) {
    const match = text.match(/(\d{2,4})\s*(?:a|amp|amps|amperes)\b/);
    if (match) return withUnit(match, "A");
  }

  // Frequency: Hz
  if (combinedMeta.includes("frequency") || combinedMeta.includes("hz")) {
    const match = text.match(/(\d{2,3})\s*hz\b/);
    if (match) return withUnit(match, "Hz");
  }

  // Speed / RPM
  if (combinedMeta.includes("rpm") || combinedMeta.includes("speed")) {
    const match = text.match(/(\d{3,5})\s*rpm\b/);
    if (match) return withUnit(match, "RPM");
  }

  // Pressure: Bar
  if (combinedMeta.includes("bar") || combinedMeta.includes("pressure_bar")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*bar\b/);
    if (match) return withUnit(match, "bar");
  }

  // Pressure: PSI
  if (combinedMeta.includes("psi")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*psi\b/);
    if (match) return withUnit(match, "psi");
  }

  // Liquid / Tank Capacity: L (Liters)
  if (
    combinedMeta.includes("capacity_l") ||
    combinedMeta.includes("tank_l") ||
    combinedMeta.includes("liter") ||
    combinedMeta.includes("litre") ||
    combinedMeta.endsWith("_l")
  ) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|liters|litre|litres)\b/);
    if (match) return withUnit(match, "L");
  }

  // Volume: mL
  if (combinedMeta.includes("ml") || combinedMeta.includes("milliliter")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*ml\b/);
    if (match) return withUnit(match, "mL");
  }

  // Volume: Gallon
  if (combinedMeta.includes("gallon") || combinedMeta.includes("gal")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:gallon|gallons|gal)\b/);
    if (match) return withUnit(match, "Gal");
  }

  // Engine Displacement: cc
  if (combinedMeta.includes("displacement") || combinedMeta.includes("cc")) {
    const match = text.match(/(\d{2,4})\s*cc\b/);
    if (match) return withUnit(match, "cc");
  }

  // Weight / Load Capacity: kg
  if (combinedMeta.includes("weight") || combinedMeta.includes("capacity_kg") || combinedMeta.includes("_kg")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*kg\b/);
    if (match) return withUnit(match, "kg");
  }

  // Capacity / Weight: Ton
  if (combinedMeta.includes("ton") || combinedMeta.includes("capacity_ton")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:ton|tons|t)\b/);
    if (match) return withUnit(match, "Ton");
  }

  // Dimension / Diameter / Chuck / Blade: mm
  if (combinedMeta.includes("mm") || combinedMeta.includes("diameter_mm") || combinedMeta.includes("size_mm")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*mm\b/);
    if (match) return withUnit(match, "mm");
  }

  // Dimension: cm
  if (combinedMeta.includes("cm") || combinedMeta.includes("size_cm")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*cm\b/);
    if (match) return withUnit(match, "cm");
  }

  // Length / Height / Depth: m (meters)
  if (
    combinedMeta.includes("height_m") ||
    combinedMeta.includes("length_m") ||
    combinedMeta.includes("range_m") ||
    combinedMeta.includes("max_head_m")
  ) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:m|meter|meters)\b/);
    if (match) return withUnit(match, "m");
  }

  // Dimension / Drive / Blade: Inch (supports fractions like 1/2", 3/8", 1/4", 3/4", 7-1/4", etc.)
  if (combinedMeta.includes("inch") || combinedMeta.includes("blade_size_inch") || combinedMeta.includes("disc_size_inch") || combinedMeta.includes("drive_size")) {
    // Fraction match (e.g. 1/2", 3/8", 7-1/4")
    const fractionMatch = rawText.match(/\b(\d+(?:[ -]\d+\/\d+)?|\d+\/\d+)\s*(?:"|inch\b|in\b)/i);
    if (fractionMatch?.[1]) return `${fractionMatch[1]}"`;

    // Decimal or integer match (e.g. 7", 9", 4")
    const decimalMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:"|inch\b|in\b)/);
    if (decimalMatch) return withUnit(decimalMatch, "\"");
  }

  // Battery Energy / Capacity: Ah (or described by 'A' only, e.g. 4A, 2A, 5.0A, 4Ah)
  if (combinedMeta.includes("capacity_ah") || combinedMeta.includes("battery_ah") || combinedMeta.includes("_ah")) {
    // 1. Explicit 'Ah' match: e.g. 4.0Ah, 5Ah, 2Ah
    const ahMatch = text.match(/(\d+(?:[.,]\d+)?)\s*ah\b/);
    if (ahMatch) return withUnit(ahMatch, "Ah");

    // 2. 'A' only match: e.g. '18V 4A', '20V 2A', '12V 1.5A', '5.0A'
    const aMatch = text.match(/(?:battery|cordless|\bv\b|\d+v|\bvoltage\b)[\s\w-]*?(\d+(?:[.,]\d+)?)\s*a\b/);
    if (aMatch?.[1]) {
      const val = parseFloat(aMatch[1].replace(",", "."));
      if (val >= 0.5 && val <= 20) {
        return `${aMatch[1].replace(",", ".")}Ah`;
      }
    }

    // Generic fallback for standalone small amperage in battery contexts (e.g. "4A", "2A", "5.0A")
    const genericAMatch = text.match(/\b([1-9](?:[.,]\d+)?|1[0-5](?:[.,]\d+)?)\s*a\b/);
    if (genericAMatch?.[1]) {
      return `${genericAMatch[1].replace(",", ".")}Ah`;
    }
  }

  // Battery Storage: Wh
  if (combinedMeta.includes("capacity_wh") || combinedMeta.includes("wh")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*wh\b/);
    if (match) return withUnit(match, "Wh");
  }

  // Digital Storage / RAM: GB / TB
  if (combinedMeta.includes("storage") || combinedMeta.includes("ram") || combinedMeta.includes("gb") || combinedMeta.includes("tb")) {
    const tbMatch = text.match(/(\d+)\s*tb\b/);
    if (tbMatch) return `${tbMatch[1]}TB`;

    const gbMatch = text.match(/(\d+)\s*gb\b/);
    if (gbMatch) return `${gbMatch[1]}GB`;
  }

  // Torque: Nm
  if (combinedMeta.includes("torque") || combinedMeta.includes("nm")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*nm\b/);
    if (match) return withUnit(match, "Nm");
  }

  // Flow rate: LPM (Liters per minute)
  if (combinedMeta.includes("lpm") || combinedMeta.includes("flow")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*(?:lpm|l\/min)\b/);
    if (match) return withUnit(match, "L/min");
  }

  // Airflow: CFM
  if (combinedMeta.includes("cfm")) {
    const match = text.match(/(\d+(?:[.,]\d+)?)\s*cfm\b/);
    if (match) return withUnit(match, "CFM");
  }

  // Angle: degrees
  if (combinedMeta.includes("degree") || combinedMeta.includes("deg") || combinedMeta.includes("_d")) {
    const match = text.match(/(\d+)\s*(?:deg|degree|degrees|°)\b/);
    if (match) return `${match[1]}°`;
  }

  // Pieces / Set Quantity: pcs
  if (combinedMeta.includes("pieces") || combinedMeta.includes("pcs") || combinedMeta.includes("set_size")) {
    const match = text.match(/(\d+)\s*(?:pcs|pc|pieces|piece)\b/);
    if (match) return match[1];
  }

  // ==========================================
  // 2. COMMON DOMAIN OPTIONS & FEATURE FLAGS
  // ==========================================

  // Fuel Type
  if (combinedMeta.includes("fuel")) {
    if (/\bdiesel\b/.test(text)) return "diesel";
    if (/\bgasoline\b|\bpetrol\b/.test(text)) return "gasoline";
    if (/\belectric\b/.test(text)) return "electric";
    if (/\bsolar\b/.test(text)) return "solar";
    if (/\blpg\b|\bgas\b/.test(text)) return "gas";
  }

  // Phase
  if (combinedMeta.includes("phase")) {
    if (/\b(?:three|3)\s*phase\b|\b3ph\b/.test(text)) return "three";
    if (/\b(?:single|1)\s*phase\b|\b1ph\b/.test(text)) return "single";
  }

  // Starting System
  if (combinedMeta.includes("starting")) {
    if (/\b(?:electric|key)\s*start\b/.test(text)) return "electric";
    if (/\b(?:recoil|manual)\s*start\b/.test(text)) return "recoil";
  }

  // Cooling Type
  if (combinedMeta.includes("cooling")) {
    if (/\bair\s*cool(?:ed|ing)?\b/.test(text)) return "air";
    if (/\bwater\s*cool(?:ed|ing)?\b|\bliquid\s*cool(?:ed|ing)?\b/.test(text)) return "water";
  }

  // Booleans / Features
  if (combinedMeta.includes("silent") && /\b(?:silent|soundproof|quiet|low\s*noise)\b/.test(text)) {
    return "true";
  }
  if (combinedMeta.includes("cordless") && /\b(?:cordless|battery)\b/.test(text)) {
    return "true";
  }
  if (combinedMeta.includes("brushless") && /\bbrushless\b/.test(text)) {
    return "true";
  }
  if ((combinedMeta.includes("laser") || combinedMeta.includes("laser_guide")) && /\blaser\b/.test(text)) {
    return "true";
  }
  if (combinedMeta.includes("oil_free") && /\b(?:oil[\s-]*free|oilless)\b/.test(text)) {
    return "true";
  }
  if (combinedMeta.includes("portable") && /\b(?:portable|compact|handheld|mobile)\b/.test(text)) {
    return "true";
  }
  if (combinedMeta.includes("panel_included") && /\b(?:with\s*panel|panel\s*included)\b/.test(text)) {
    return "true";
  }

  // Welding Process
  if (combinedMeta.includes("welding_process")) {
    if (/\bmma\b|\barc\b/.test(text)) return "MMA";
    if (/\bmig\b|\bmag\b/.test(text)) return "MIG";
    if (/\btig\b/.test(text)) return "TIG";
    if (/\bplasma\b/.test(text)) return "Plasma";
    if (/\binverter\b/.test(text)) return "Inverter";
  }

  // Saw Type
  if (combinedMeta.includes("saw_type")) {
    if (/\bcircular\b/.test(text)) return "circular";
    if (/\bjig\s*saw\b|\bjigsaw\b/.test(text)) return "jigsaw";
    if (/\btable\s*saw\b/.test(text)) return "table saw";
    if (/\bband\s*saw\b/.test(text)) return "band saw";
    if (/\bmit[er]{2}\s*saw\b/.test(text)) return "miter saw";
    if (/\bcut\s*off\b/.test(text)) return "cut off";
    if (/\breciprocating\b/.test(text)) return "reciprocating";
  }

  // Pump Type
  if (combinedMeta.includes("pump_type")) {
    if (/\bsubmersible\b/.test(text)) return "submersible";
    if (/\bcentrifugal\b/.test(text)) return "centrifugal";
    if (/\bjet\b/.test(text)) return "jet";
    if (/\bsewage\b/.test(text)) return "sewage";
    if (/\bdeep\s*well\b/.test(text)) return "deep well";
  }

  // ==========================================
  // 3. COLOR & MATERIAL DETECTION
  // ==========================================

  // Colors (e.g. Desert Titanium, Natural Titanium, Black, White, etc.)
  if (combinedMeta.includes("color") || combinedMeta.includes("colour")) {
    const specialColors = [
      "desert titanium",
      "natural titanium",
      "white titanium",
      "black titanium",
      "space gray",
      "space grey",
      "rose gold",
      "midnight blue",
    ];
    for (const sc of specialColors) {
      if (text.includes(sc)) {
        return sc.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }

    const simpleColors = [
      "black", "white", "silver", "gold", "gray", "grey", "red", "blue",
      "green", "yellow", "orange", "titanium",
    ];
    for (const color of simpleColors) {
      if (text.includes(` ${color} `)) {
        return color.charAt(0).toUpperCase() + color.slice(1);
      }
    }
  }

  // Materials
  if (combinedMeta.includes("material")) {
    if (/\bstainless\s*steel\b/.test(text)) return "Stainless Steel";
    if (/\bcast\s*iron\b/.test(text)) return "Cast Iron";
    if (/\baluminum\b|\baluminium\b/.test(text)) return "Aluminum";
    if (/\bcarbon\s*steel\b/.test(text)) return "Carbon Steel";
    if (/\bbrass\b/.test(text)) return "Brass";
    if (/\bcopper\b/.test(text)) return "Copper";
    if (/\bpvc\b/.test(text)) return "PVC";
  }

  // ==========================================
  // 4. DYNAMIC KEY: VALUE PATTERN IN TITLE
  // ==========================================
  // If the product title explicitly mentions the key or label: e.g. "RAM: 16GB", "Storage: 256GB"
  const cleanKey = normalizedKey.replace(/_/g, " ").trim();
  if (cleanKey.length >= 3) {
    const kvMatch = rawText.match(new RegExp(`\\b${cleanKey}[:\\s]+([A-Za-z0-9.+/'-]+)`, "i"));
    if (kvMatch?.[1]) {
      return kvMatch[1].trim();
    }
  }

  return "";
}

/**
 * Extracts all specification values for an array of fields from the product title.
 */
export function autoExtractAllSpecifications(
  fields: { key: string; label?: string }[],
  productName: string,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!productName.trim() || fields.length === 0) return result;

  for (const field of fields) {
    const extracted = extractSpecificationValue(field, productName);
    if (extracted) {
      result[field.key] = extracted;
    }
  }

  return result;
}
