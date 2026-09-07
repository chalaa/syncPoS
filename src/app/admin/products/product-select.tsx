"use client";

import { useMemo, useState, useTransition } from "react";

import { createProductFromSelector } from "@/app/admin/products/actions";
import { Button } from "@/components/ui/button";
import { CountrySelectField } from "@/components/ui/country-select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RelatedModelSelect, type RelatedModelOption } from "@/components/ui/related-model-select";
import { trackingModeOptions } from "@/server/catalog/types";
import type { CategorySelectOption, SelectOption, TrackingModeOption } from "@/server/catalog/types";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

const categoryKeywords: Record<string, string[]> = {
  "Air Compressors": ["compressor", "air pump"],
  "Automotive & Tyre": ["tyre", "wheel"],
  "Blades & Cutting Discs": ["blade", "cutting disc", "diamond disc"],
  Chainsaws: ["chain saw", "chainsaw"],
  Chemicals: ["paint", "thinner", "chemical", "silicone", "coolant"],
  "Concrete Equipment": ["vibrator", "concrete mixer", "compactor"],
  Consumables: ["oil", "grease", "thread", "belt"],
  "Drill Bits & Accessories": ["drill bit", "sds max", "hss bit"],
  "Drills & Hammers": ["rotary hammer", "demolition", "hammer drill", "impact drill", "drill machine"],
  "Electric Motors": ["electric motor", "alternator", "dynamo"],
  "Electrical Accessories": ["battery", "avr", "capacitor", "inverter"],
  Engines: ["engine", "gx390"],
  Generators: ["generator", "generetor", "genrator"],
  "Grinders & Polishers": ["grinder", "polisher"],
  "Hand Tools & Sets": ["tool set", "spanner", "wrench", "plier"],
  "Hoists & Lifting": ["hoist", "winch", "jack", "pallet truck"],
  "Hoses & Fittings": ["hose", "fitting"],
  "Lawn & Garden": ["lawn", "mower", "trimmer", "brush cutter"],
  "Lubrication Equipment": ["oil pump", "grease pump"],
  "Measuring Tools": ["scale", "multimeter", "laser", "level", "tape"],
  Mixers: ["mixer"],
  "Nailers Guns & Sprayers": ["nailer", "stapler", "spray gun", "sprayer"],
  "Planers & Woodworking": ["planer", "sander", "router"],
  "Pressure Washers": ["pressure washer", "washer machine"],
  "Safety Equipment": ["glove", "boot", "safety", "helmet", "mask"],
  Saws: ["circular saw", "table saw", "jigsaw", "band saw", "cut off"],
  "Solar Power": ["solar", "power station"],
  "Spare Parts": ["spare part", "filter", "bearing", "gasket", "carburetor"],
  "Vacuum Cleaners": ["vacuum", "cleaner"],
  "Water Pumps": ["water pump", "submersible", "sewage", "centrifugal", "jet pump"],
  "Welding Accessories": ["welding mask", "electrode holder", "welding cable"],
  "Welding Machines": ["welding", "welder", "arc welding", "mma", "mig", "tig"],
};

const brandCountryFallbacks: Record<string, string> = {
  bosch: "Germany",
  makita: "Japan",
};

function normalizedText(value: string) {
  return ` ${value.toLowerCase().replace(/[^a-z0-9.+/"-]+/g, " ").replace(/\s+/g, " ").trim()} `;
}

function optionScore(option: SelectOption, text: string) {
  return [option.name, option.code].filter(Boolean).reduce((score, value) => {
    const normalizedValue = value.toLowerCase();

    if (text.includes(` ${normalizedValue} `)) {
      return Math.max(score, normalizedValue.length + 10);
    }

    if (text.includes(normalizedValue)) {
      return Math.max(score, normalizedValue.length);
    }

    return score;
  }, 0);
}

function bestMatchingOption<TOption extends SelectOption>(options: TOption[], productName: string) {
  const text = normalizedText(productName);

  return options
    .map((option) => ({ option, score: optionScore(option, text) }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.option;
}

function bestMatchingCategory(options: CategorySelectOption[], productName: string) {
  const text = normalizedText(productName);

  return options
    .map((option) => {
      const keywordScore = (categoryKeywords[option.name] ?? []).reduce((score, keyword) => {
        const normalizedKeyword = normalizedText(keyword).trim();

        return text.includes(normalizedKeyword) ? Math.max(score, normalizedKeyword.length + 20) : score;
      }, 0);

      return { option, score: Math.max(optionScore(option, text), keywordScore) };
    })
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.option;
}

function extractModel(productName: string, brand?: SelectOption) {
  const withoutBrand = brand
    ? productName.replace(new RegExp(brand.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), " ")
    : productName;
  const tokens = withoutBrand.match(/\b[A-Z]*\d+[A-Z0-9-]*\b|\b[A-Z]{2,}\d*[A-Z0-9-]*\b/g) ?? [];
  const ignored = new Set(["KW", "KVA", "HP", "V", "W", "MM", "HZ", "RPM", "PCS", "PC", "KG", "L"]);

  return tokens.find((token) => !ignored.has(token.toUpperCase()) && !/^\d+$/.test(token)) ?? "";
}

function withUnit(match: RegExpMatchArray | null, unit: string) {
  return match?.[1] ? `${match[1].replace(",", ".")}${unit}` : "";
}

function extractSpecificationValue(key: string, productName: string) {
  const text = normalizedText(productName).trim();
  const normalizedKey = key.toLowerCase();

  if (normalizedKey.includes("power_kva")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*kva\b/), "kVA");
  if (normalizedKey.includes("power_kw")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*kw\b/), "kW");
  if (normalizedKey.includes("power_hp")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*hp\b/), "HP");
  if (normalizedKey.includes("power_w")) return withUnit(text.match(/(\d{2,5})\s*w\b/), "W");
  if (normalizedKey.includes("voltage") || normalizedKey.includes("battery")) return withUnit(text.match(/(\d{2,3})\s*v\b/), "V");
  if (normalizedKey.includes("current")) return withUnit(text.match(/(\d{2,4})\s*a\b/), "A");
  if (normalizedKey.includes("frequency")) return withUnit(text.match(/(\d{2})\s*hz\b/), "Hz");
  if (normalizedKey.includes("rpm") || normalizedKey.includes("speed")) return withUnit(text.match(/(\d+)\s*rpm\b/), "RPM");
  if (normalizedKey.includes("bar") || normalizedKey.includes("pressure")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*bar\b/), "bar");
  if (normalizedKey.includes("cc") || normalizedKey.includes("displacement")) return withUnit(text.match(/(\d+)\s*cc\b/), "cc");
  if (normalizedKey.includes("kg") || normalizedKey.includes("weight")) return withUnit(text.match(/(\d+)\s*kg\b/), "kg");
  if (normalizedKey.includes("liter") || normalizedKey.includes("litre") || normalizedKey.includes("capacity_l")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*(?:l|liter|litre)\b/), "L");
  if (normalizedKey.includes("mm")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*mm\b/), "mm");
  if (normalizedKey.includes("inch")) return withUnit(text.match(/(\d+(?:[.,]\d+)?)\s*(?:inch|in)\b/), "\"");
  if (normalizedKey.includes("fuel")) {
    if (/\bdiesel\b/.test(text)) return "diesel";
    if (/\bgasoline\b|\bpetrol\b/.test(text)) return "gasoline";
  }
  if (normalizedKey.includes("phase")) {
    if (/\b(three|3)\s*phase\b|\b3ph\b/.test(text)) return "three";
    if (/\b(single|1)\s*phase\b|\b1ph\b/.test(text)) return "single";
  }
  if (normalizedKey.includes("silent") && /\bsilent\b/.test(text)) return "true";
  if (normalizedKey.includes("portable") && /\bportable\b/.test(text)) return "true";
  if (normalizedKey.includes("cordless") && /\bcordless\b|\bbattery\b/.test(text)) return "true";

  return "";
}

export type ProductSelectOption = RelatedModelOption & {
  listPriceMinor?: number;
  standardCostMinor?: number;
  saleTaxIds?: string[];
  purchaseTaxIds?: string[];
};

type ProductSelectProps = {
  name?: string;
  value?: string | null;
  options: ProductSelectOption[];
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  placeholder?: string;
  emptyLabel?: string;
  inputClassName?: string;
  error?: string;
  onValueChange?: (value: string) => void;
  onOptionsChange?: (options: ProductSelectOption[]) => void;
};

export function ProductSelect({
  name,
  value,
  options,
  categories,
  brands,
  units,
  placeholder = "Select product",
  emptyLabel = "No products found.",
  inputClassName,
  error,
  onValueChange,
  onOptionsChange,
}: ProductSelectProps) {
  const [items, setItems] = useState(options);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [initialName, setInitialName] = useState("");
  const selectedProductId = value ?? "";

  function updateItems(nextItems: ProductSelectOption[]) {
    setItems(nextItems);
    onOptionsChange?.(nextItems);
  }

  function addCreatedProduct(product: ProductSelectOption) {
    const nextItems = [...items.filter((item) => item.id !== product.id), product].sort((left, right) =>
      left.name.localeCompare(right.name),
    );

    updateItems(nextItems);
    onValueChange?.(product.id);
  }

  return (
    <>
      <RelatedModelSelect
        name={name}
        value={selectedProductId}
        options={items}
        onValueChange={onValueChange}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        inputClassName={inputClassName}
        error={error}
        createLabel="Create and Edit..."
        onCreateAndEdit={(query) => {
          setInitialName(query);
          setIsDialogOpen(true);
        }}
        editHrefFor={(productId) => `/admin/products/${productId}/edit`}
      />
      {isDialogOpen ? (
        <ProductCreateDialog
          open={isDialogOpen}
          initialName={initialName}
          categories={categories}
          brands={brands}
          units={units}
          onOpenChange={setIsDialogOpen}
          onCreated={addCreatedProduct}
        />
      ) : null}
    </>
  );
}

function ProductCreateDialog({
  open,
  initialName,
  categories,
  brands,
  units,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  onOpenChange: (open: boolean) => void;
  onCreated: (product: ProductSelectOption) => void;
}) {
  const initialBrand = bestMatchingOption(brands, initialName);
  const initialCategory = bestMatchingCategory(categories, initialName);
  const initialModel = extractModel(initialName, initialBrand);
  const [productName, setProductName] = useState(initialName);
  const [categoryId, setCategoryId] = useState(initialCategory?.id ?? "");
  const [brandId, setBrandId] = useState(initialBrand?.id ?? "");
  const [country, setCountry] = useState(initialBrand?.country ?? brandCountryFallbacks[initialBrand?.name.toLowerCase() ?? ""] ?? "");
  const [model, setModel] = useState(initialModel);
  const [trackingMode, setTrackingMode] = useState<TrackingModeOption>("none");
  const [manualFields, setManualFields] = useState({
    brand: false,
    category: false,
    country: false,
    model: false,
  });
  const [manualSpecificationKeys, setManualSpecificationKeys] = useState<Set<string>>(new Set());
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>(() => {
    const values: Record<string, string> = {};

    for (const field of initialCategory?.specificationSchema ?? []) {
      values[field.key] = extractSpecificationValue(field.key, initialName);
    }

    return values;
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedBrand = useMemo(() => brands.find((brand) => brand.id === brandId), [brandId, brands]);
  const selectedCategory = useMemo(() => categories.find((category) => category.id === categoryId), [categories, categoryId]);
  const specificationFields = selectedCategory?.specificationSchema ?? [];
  const standardName = [
    selectedBrand?.name,
    model.trim(),
    selectedCategory?.name,
    ...specificationFields.map((field) => specificationValues[field.key]?.trim()).filter(Boolean),
  ].filter(Boolean).join(" ");

  function changeBrand(nextBrandId: string) {
    setBrandId(nextBrandId);
    setManualFields((current) => ({ ...current, brand: true }));
    const brand = brands.find((item) => item.id === nextBrandId);

    if (brand?.country) {
      setCountry(brand.country);
    }
  }

  function applyProductNameSuggestions(nextProductName: string) {
    const matchedBrand = bestMatchingOption(brands, nextProductName);
    const nextBrand = matchedBrand ?? selectedBrand;
    const matchedCategory = bestMatchingCategory(categories, nextProductName);
    const nextCategory = matchedCategory ?? selectedCategory;

    if (matchedBrand && (!manualFields.brand || !brandId)) {
      setBrandId(matchedBrand.id);
    }

    if (matchedCategory && (!manualFields.category || !categoryId)) {
      setCategoryId(matchedCategory.id);
    }

    const nextCountry = nextBrand?.country || brandCountryFallbacks[nextBrand?.name.toLowerCase() ?? ""];
    if (nextCountry && (!manualFields.country || !country)) {
      setCountry(nextCountry);
    }

    const nextModel = extractModel(nextProductName, nextBrand);
    if (nextModel && (!manualFields.model || !model)) {
      setModel(nextModel);
    }

    setSpecificationValues((current) => {
      const next = { ...current };

      for (const field of nextCategory?.specificationSchema ?? specificationFields) {
        if (manualSpecificationKeys.has(field.key) || next[field.key]) {
          continue;
        }

        const value = extractSpecificationValue(field.key, nextProductName);

        if (value) {
          next[field.key] = value;
        }
      }

      return next;
    });
  }

  function changeProductName(nextProductName: string) {
    setProductName(nextProductName);
    applyProductNameSuggestions(nextProductName);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-3xl">
        <form
          className="grid gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            const formData = new FormData(event.currentTarget);

            startTransition(async () => {
              try {
                const product = await createProductFromSelector({
                  name: String(formData.get("name") ?? ""),
                  categoryId: String(formData.get("categoryId") ?? ""),
                  brandId: String(formData.get("brandId") ?? ""),
                  model: String(formData.get("model") ?? ""),
                  country: String(formData.get("country") ?? ""),
                  standardName: String(formData.get("standardName") ?? ""),
                  unitId: String(formData.get("unitId") ?? ""),
                  trackingMode: trackingMode,
                  standardCost: String(formData.get("standardCost") ?? "0"),
                  listPrice: String(formData.get("listPrice") ?? "0"),
                  specifications: Object.fromEntries(
                    specificationFields.map((field) => [field.key, String(formData.get(`specificationValue:${field.key}`) ?? "") || null]),
                  ),
                });

                onCreated(product);
                onOpenChange(false);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not create product.");
              }
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Create Product</DialogTitle>
            <DialogDescription>Create a product and select it on this line.</DialogDescription>
          </DialogHeader>

          {error ? <p className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <input type="hidden" name="standardName" value={standardName} />
            <label className="grid gap-1 text-sm font-medium md:col-span-2">
              Product Name
              <input name="name" value={productName} onChange={(event) => changeProductName(event.target.value)} required className={inputClass} />
            </label>
            {standardName ? (
              <div className="grid gap-1 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm md:col-span-2">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Standard Name</span>
                <span className="min-h-6 break-words text-base font-semibold text-foreground">{standardName}</span>
              </div>
            ) : null}
            <RelatedModelSelect
              name="categoryId"
              label="Category"
              options={categories}
              value={categoryId}
              onValueChange={(nextCategoryId) => {
                setCategoryId(nextCategoryId);
                setManualFields((current) => ({ ...current, category: true }));
              }}
              placeholder="Select category"
            />
            <RelatedModelSelect name="brandId" label="Brand" options={brands} value={brandId} onValueChange={changeBrand} placeholder="Select brand" />
            <label className="grid gap-1 text-sm font-medium">
              Model
              <input
                name="model"
                value={model}
                onChange={(event) => {
                  setModel(event.target.value);
                  setManualFields((current) => ({ ...current, model: true }));
                }}
                className={inputClass}
              />
            </label>
            <CountrySelectField
              name="country"
              label="Country"
              value={country || selectedBrand?.country || ""}
              onValueChange={(nextCountry) => {
                setCountry(nextCountry);
                setManualFields((current) => ({ ...current, country: true }));
              }}
            />
            <RelatedModelSelect name="unitId" label="Unit" options={units} defaultValue={units[0]?.id ?? ""} required placeholder="Select unit" />
            <label className="grid gap-1 text-sm font-medium">
              Tracking Mode
              <select name="trackingMode" value={trackingMode} onChange={(event) => setTrackingMode(event.target.value as TrackingModeOption)} className={inputClass}>
                {trackingModeOptions.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Sales Unit Price
              <input name="listPrice" type="number" min="0" step="0.01" defaultValue="0.00" className={inputClass} />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Purchase Unit Cost
              <input name="standardCost" type="number" min="0" step="0.01" defaultValue="0.00" className={inputClass} />
            </label>
            {specificationFields.length > 0 ? (
              <div className="grid gap-4 border-t border-border pt-4 md:col-span-2 md:grid-cols-2">
                {specificationFields.map((field) => (
                  <label key={field.key} className="grid gap-1 text-sm font-medium">
                    <span>{field.label}</span>
                    <input
                      name={`specificationValue:${field.key}`}
                      value={specificationValues[field.key] ?? ""}
                      onChange={(event) => {
                        setManualSpecificationKeys((current) => new Set(current).add(field.key));
                        setSpecificationValues((current) => ({ ...current, [field.key]: event.target.value }));
                      }}
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || units.length === 0}>
              {isPending ? "Creating..." : "Create Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
