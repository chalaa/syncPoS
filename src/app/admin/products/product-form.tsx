"use client";

import { minorToDisplay } from "@/lib/catalog-utils";
import { trackingModeOptions } from "@/server/catalog/types";
import type { CategorySelectOption, ProductFormRecord, SelectOption } from "@/server/catalog/types";
import { createProduct, updateProduct } from "./actions";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink } from "@/components/ui/button";
import { CountrySelectField } from "@/components/ui/country-select-field";
import { ManyToManyTags } from "@/components/ui/many-to-many-tags";
import { Notebook } from "@/components/ui/notebook";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import { useMemo, useState } from "react";

type ProductFormProps = {
  mode: "create" | "edit";
  product?: ProductFormRecord;
  initialProductName?: string;
  categories: CategorySelectOption[];
  brands: SelectOption[];
  units: SelectOption[];
  taxes: { id: string; label: string; scope: "purchase" | "sale" | "both" }[];
  notice?: string;
  error?: string;
};

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";
const readonlyInputClass = "h-10 rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground";
const textareaClass = "min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm";

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

export function ProductForm({
  mode,
  product,
  initialProductName,
  categories,
  brands,
  units,
  taxes,
  notice,
  error,
}: ProductFormProps) {
  const action = mode === "create" ? createProduct : updateProduct;
  const title = mode === "create" ? "New Product" : product?.name ?? "Edit Product";
  const submitLabel = mode === "create" ? "Create product" : "Save changes";
  const [saleTaxIds, setSaleTaxIds] = useState(product?.saleTaxIds ?? []);
  const [purchaseTaxIds, setPurchaseTaxIds] = useState(product?.purchaseTaxIds ?? []);
  const [productName, setProductName] = useState(product?.name ?? initialProductName ?? "");
  const [brandId, setBrandId] = useState(product?.brandId ?? "");
  const [country, setCountry] = useState(product?.country ?? "");
  const [model, setModel] = useState(product?.model ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [manualFields, setManualFields] = useState({
    brand: Boolean(product?.brandId),
    category: Boolean(product?.categoryId),
    country: Boolean(product?.country),
    model: Boolean(product?.model),
  });
  const [manualSpecificationKeys, setManualSpecificationKeys] = useState<Set<string>>(new Set());
  const [specificationValues, setSpecificationValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(product?.specifications ?? {}).map(([key, value]) => [
        key,
        value === null || value === undefined ? "" : String(value),
      ]),
    ),
  );
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId),
    [categories, categoryId],
  );
  const selectedBrand = useMemo(
    () => brands.find((brand) => brand.id === brandId),
    [brands, brandId],
  );
  const specificationFields = useMemo(
    () => selectedCategory?.specificationSchema ?? [],
    [selectedCategory?.specificationSchema],
  );
  const generatedStandardName = useMemo(() => {
    const parts = [
      selectedBrand?.name,
      model.trim(),
      selectedCategory?.name,
      ...specificationFields.map((field) => specificationValues[field.key]?.trim()).filter(Boolean),
    ].filter(Boolean);

    return parts.join(" ");
  }, [model, selectedBrand?.name, selectedCategory?.name, specificationFields, specificationValues]);
  const standardName = generatedStandardName || product?.standardName || "";
  const saleTaxOptions = useMemo(
    () => taxes.filter((tax) => tax.scope === "sale" || tax.scope === "both").map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );
  const purchaseTaxOptions = useMemo(
    () => taxes.filter((tax) => tax.scope === "purchase" || tax.scope === "both").map((tax) => ({ id: tax.id, label: tax.label })),
    [taxes],
  );

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

    const fields = nextCategory?.specificationSchema ?? specificationFields;
    if (fields.length > 0) {
      setSpecificationValues((current) => {
        const next = { ...current };

        fields.forEach((field) => {
          if (manualSpecificationKeys.has(field.key) || next[field.key]) {
            return;
          }

          const value = extractSpecificationValue(field.key, nextProductName);

          if (value) {
            next[field.key] = value;
          }
        });

        return next;
      });
    }
  }

  function changeProductName(nextProductName: string) {
    setProductName(nextProductName);
    applyProductNameSuggestions(nextProductName);
  }

  return (
    <PageShell maxWidth="max-w-6xl">
      <PageHeader
        eyebrow="Product"
        title={title}
        actions={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/products" variant="outline">
              Back
            </ButtonLink>
            {product ? (
              <ButtonLink href={`/admin/products/${product.id}`} variant="outline">
                Open
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      {notice ? <Alert kind="success">{notice}</Alert> : null}
      {error ? <Alert kind="error">{error}</Alert> : null}
      {units.length === 0 ? (
        <Alert kind="warning">Create at least one unit of measure before creating a product.</Alert>
      ) : null}

      <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-5">
        {product ? <input type="hidden" name="id" value={product.id} /> : null}
        <input type="hidden" name="isActive" value="on" />
        <input type="hidden" name="standardName" value={standardName} />

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Product Name
            <input
              name="name"
              value={productName}
              onChange={(event) => changeProductName(event.target.value)}
              maxLength={200}
              required
              className={inputClass}
            />
          </label>
          {standardName ? (
            <div className="grid gap-1 rounded-md border border-border bg-muted/60 px-3 py-2 text-sm">
              <span className="text-xs font-semibold uppercase text-muted-foreground">Standard Name</span>
              <span className="min-h-6 break-words text-base font-semibold text-foreground">{standardName}</span>
            </div>
          ) : null}
          {mode === "edit" ? (
            <label className="grid gap-1 text-sm font-medium">
              Item Code
              <input
                name="sku"
                defaultValue={product?.sku}
                maxLength={60}
                readOnly
                className={readonlyInputClass}
              />
            </label>
          ) : null}
        </div>

        <Notebook
          defaultValue="general"
          items={[
            {
              value: "general",
              label: "General Information",
              content: (
                <div className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
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
                      emptyLabel="No categories found."
                    />
                    <RelatedModelSelect
                      name="brandId"
                      label="Brand"
                      options={brands}
                      value={brandId}
                      onValueChange={changeBrand}
                      placeholder="Select brand"
                      emptyLabel="No brands found."
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium">
                      Model
                      <input
                        name="model"
                        value={model}
                        onChange={(event) => {
                          setModel(event.target.value);
                          setManualFields((current) => ({ ...current, model: true }));
                        }}
                        maxLength={100}
                        className={inputClass}
                      />
                    </label>
                    <RelatedModelSelect
                      name="unitId"
                      label="Unit"
                      options={units}
                      defaultValue={product?.unitId ?? units[0]?.id ?? ""}
                      required
                      placeholder="Select unit"
                      emptyLabel="No units found."
                    />
                  </div>

                  <CountrySelectField
                    name="country"
                    label="Country"
                    value={country}
                    onValueChange={(nextCountry) => {
                      setCountry(nextCountry);
                      setManualFields((current) => ({ ...current, country: true }));
                    }}
                  />

                  <label className="grid gap-1 text-sm font-medium">
                    Description
                    <textarea name="description" defaultValue={product?.description ?? ""} className={textareaClass} />
                  </label>
                </div>
              ),
            },
            {
              value: "inventory",
              label: "Inventory",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="grid gap-1 text-sm font-medium">
                    Tracking Mode
                    <select
                      name="trackingMode"
                      defaultValue={product?.trackingMode ?? "none"}
                      className={inputClass}
                    >
                      {trackingModeOptions.map((modeOption) => (
                        <option key={modeOption} value={modeOption}>
                          {modeOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              ),
            },
            {
              value: "sales",
              label: "Sales",
              content: (
                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm font-medium">
                    Sales Unit Price
                    <input
                      name="listPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={product ? minorToDisplay(product.listPriceMinor) : "0.00"}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Customer Taxes
                    <ManyToManyTags
                      name="saleTaxIds"
                      options={saleTaxOptions}
                      value={saleTaxIds}
                      onChange={setSaleTaxIds}
                      placeholder="Select sale tax"
                    />
                  </label>
                </div>
              ),
            },
            {
              value: "purchase",
              label: "Purchase",
              content: (
                <div className="grid gap-4">
                  <label className="grid gap-1 text-sm font-medium">
                    Purchase Unit Cost
                    <input
                      name="standardCost"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={product ? minorToDisplay(product.standardCostMinor) : "0.00"}
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium">
                    Vendor Taxes
                    <ManyToManyTags
                      name="purchaseTaxIds"
                      options={purchaseTaxOptions}
                      value={purchaseTaxIds}
                      onChange={setPurchaseTaxIds}
                      placeholder="Select purchase tax"
                    />
                  </label>
                </div>
              ),
            },
            {
              value: "specifications",
              label: "Specifications",
              content: (
                <div className="grid gap-4 md:grid-cols-2">
                  {specificationFields.map((field) => {
                    const value = product?.specifications?.[field.key];

                    return (
                      <label key={field.key} className="grid gap-1 text-sm font-medium">
                        <span>{field.label}</span>
                        <input type="hidden" name="specificationKey" value={field.key} />
                        <input
                          name={`specificationValue:${field.key}`}
                          value={specificationValues[field.key] ?? (value === null || value === undefined ? "" : String(value))}
                          onChange={(event) => {
                            setManualSpecificationKeys((current) => new Set(current).add(field.key));
                            setSpecificationValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }));
                          }}
                          className={inputClass}
                        />
                      </label>
                    );
                  })}
                  {specificationFields.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Select a category with configured specifications to fill product details.
                    </p>
                  ) : null}
                </div>
              ),
            },
          ]}
        />

        <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
          <ButtonLink href="/admin/products" variant="outline">
            Cancel
          </ButtonLink>
          <Button disabled={units.length === 0}>{submitLabel}</Button>
        </div>
      </form>
    </PageShell>
  );
}
