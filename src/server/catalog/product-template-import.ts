import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, normalizeCode } from "@/server/catalog/products";
import { generateCompanyCode } from "@/server/db/code-generator";
import type {
  ProductTemplateImportCommitPayload,
  ProductTemplateImportRow,
  TrackingModeOption,
} from "@/server/catalog/types";
import { db } from "@/server/db/client";
import {
  brands,
  catalogAttributes,
  catalogAttributeValues,
  productCategories,
  productCategoryAttributes,
  productTemplates,
  productTemplateAttributeValues,
  productVariantAttributeValues,
  products,
  unitsOfMeasure,
} from "@/server/db/schema";

const headers = [
  "product_template",
  "category",
  "brand",
  "unit",
  "tracking_mode",
  "description",
  "is_active",
  "attribute_values",
];

export const productTemplateImportTemplateCsv = `${headers.join(",")}
Gasoline Generator,Generators,Rato,Pcs,none,Portable gasoline generator family,true,"Power=3.2 kW, 5 kW; Fuel Type=Gasoline, Inverter; Model=R6000ISER, VK15500"
Arc Welding Machine,Welding Machines,,Pcs,none,MMA/stick welding machine family,true,"Model=BX1400; Welding Type=Arc Welding"
`;

type ParsedRow = {
  rowNumber: number;
  productTemplate: string;
  category: string;
  brand: string;
  unit: string;
  trackingMode: string;
  description: string;
  isActive: string;
  attributeValuesText: string;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      current += "\"";
      index += 1;
      continue;
    }

    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): ParsedRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const parsedHeaders = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = Object.fromEntries(parsedHeaders.map((header, index) => [header, index]));

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);

      return {
        rowNumber: index + 2,
        productTemplate: values[headerIndex.product_template] ?? values[headerIndex.name] ?? "",
        category: values[headerIndex.category] ?? "",
        brand: values[headerIndex.brand] ?? "",
        unit: values[headerIndex.unit] ?? "",
        trackingMode: values[headerIndex.tracking_mode] ?? "",
        description: values[headerIndex.description] ?? "",
        isActive: values[headerIndex.is_active] ?? "true",
        attributeValuesText: values[headerIndex.attribute_values] ?? "",
      };
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "rowNumber" && String(value).trim()),
    );
}

function mapReference<T extends { code: string; name: string }>(rows: T[]) {
  const map = new Map<string, T>();

  for (const row of rows) {
    map.set(row.code.trim().toUpperCase(), row);
    map.set(row.name.trim().toUpperCase(), row);
  }

  return map;
}

function boolValue(value: string) {
  return !["0", "false", "no", "n", "off"].includes(value.trim().toLowerCase());
}

function parseAttributeValues(text: string) {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  const dedupe = (pairs: { attribute: string; value: string }[]) => {
    const seen = new Set<string>();

    return pairs.filter((pair) => {
      const key = `${pair.attribute.toUpperCase()}:${pair.value.toUpperCase()}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
  };

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;

      return dedupe(Object.entries(parsed).flatMap(([attribute, rawValues]) => {
        const values = Array.isArray(rawValues) ? rawValues : [rawValues];

        return values
          .map((value) => ({
            attribute: attribute.trim(),
            value: String(value).trim(),
          }))
          .filter((pair) => pair.attribute && pair.value);
      }));
    } catch {
      return [];
    }
  }

  return dedupe(trimmed
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      const separator = part.includes("=") ? "=" : ":";
      const [attributeName, rawValues = ""] = part.split(separator);

      const delimiter = rawValues.includes("|") ? "|" : ",";

      return rawValues
        .split(delimiter)
        .map((value) => ({
          attribute: attributeName.trim(),
          value: value.trim(),
        }))
        .filter((pair) => pair.attribute && pair.value);
    }));
}

function importToken(rows: ProductTemplateImportRow[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.productTemplate,
          row.category,
          row.brand,
          row.unit,
          row.trackingMode,
          row.description,
          row.isActive,
          row.attributeValuesText,
          row.variantAttributes.map((attribute) => `${attribute.attribute}:${attribute.value}`).sort(),
        ]),
      ),
    )
    .digest("hex");
}

async function generateProductSku(companyId: string) {
  const [row] = await db.execute(sql`
    select (
      'ITEM'
      || '-'
      || lpad(
        (coalesce(max((substring(sku from '^ITEM-([0-9]+)$'))::int), 0) + 1)::text,
        5,
        '0'
      )
    ) as "sku"
    from products
    where company_id = ${companyId}
      and deleted_at is null
      and sku ~ '^ITEM-[0-9]+$'
  `);
  const sku = typeof row === "object" && row && "sku" in row ? row.sku : undefined;

  return typeof sku === "string" ? sku : "ITEM-00001";
}

async function generateNextProductSku(companyId: string, usedSkus: Set<string>) {
  let sku = await generateProductSku(companyId);

  while (usedSkus.has(sku.toUpperCase())) {
    const match = sku.match(/^ITEM-(\d+)$/);
    const next = match ? Number(match[1]) + 1 : usedSkus.size + 1;
    sku = `ITEM-${String(next).padStart(5, "0")}`;
  }

  usedSkus.add(sku.toUpperCase());
  return sku;
}

export async function previewProductTemplateImportCsv(text: string) {
  const company = await getDefaultCompany();
  const parsedRows = parseCsv(text);

  if (parsedRows.length === 0) {
    return {
      rows: [],
      importToken: undefined,
    };
  }

  const [categoryRows, brandRows, unitRows, templateRows] = await Promise.all([
    db.select({ id: productCategories.id, code: productCategories.code, name: productCategories.name })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
    db.select({ id: brands.id, code: brands.code, name: brands.name })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt))),
    db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt))),
    db.select({ id: productTemplates.id, name: productTemplates.name })
      .from(productTemplates)
      .where(and(eq(productTemplates.companyId, company.id), isNull(productTemplates.deletedAt))),
  ]);

  const categoriesByRef = mapReference(categoryRows);
  const brandsByRef = mapReference(brandRows);
  const unitsByRef = mapReference(unitRows);
  const templatesByName = new Set(templateRows.map((template) => template.name.trim().toUpperCase()));
  const templatesSeen = new Set<string>();

  const rows = parsedRows.map((row): ProductTemplateImportRow => {
    const productTemplate = row.productTemplate.trim();
    const categoryRef = row.category.trim();
    const brandRef = row.brand.trim();
    const unitRef = row.unit.trim();
    const trackingMode = row.trackingMode.trim().toLowerCase();
    const category = categoryRef ? categoriesByRef.get(categoryRef.toUpperCase()) : undefined;
    const brand = brandRef ? brandsByRef.get(brandRef.toUpperCase()) : undefined;
    const unit = unitRef ? unitsByRef.get(unitRef.toUpperCase()) : undefined;
    const variantAttributes = parseAttributeValues(row.attributeValuesText);
    const errors: string[] = [];

    if (!productTemplate) {
      errors.push("Product template is required.");
    }

    if (productTemplate && templatesSeen.has(productTemplate.toUpperCase())) {
      errors.push("Duplicate product template in import file.");
    }
    templatesSeen.add(productTemplate.toUpperCase());

    if (!categoryRef) {
      errors.push("Category is required.");
    } else if (!category) {
      errors.push("Category must match an existing category code or name.");
    }

    if (brandRef && !brand) {
      errors.push("Brand must match an existing brand code or name.");
    }

    if (!unitRef) {
      errors.push("Unit is required.");
    } else if (!unit) {
      errors.push("Unit must match an existing unit code or name.");
    }

    if (!["none", "lot", "serial"].includes(trackingMode)) {
      errors.push("Tracking mode must be none, lot, or serial.");
    }

    if (variantAttributes.length === 0) {
      errors.push("Attribute values are required.");
    }

    return {
      rowNumber: row.rowNumber,
      productTemplate,
      category: categoryRef,
      categoryName: category?.name ?? "",
      brand: brandRef,
      brandName: brand?.name ?? "",
      unit: unitRef,
      unitName: unit?.name ?? "",
      trackingMode: trackingMode as TrackingModeOption | "",
      description: row.description.trim(),
      isActive: boolValue(row.isActive),
      attributeValuesText: row.attributeValuesText.trim(),
      variantAttributes,
      action: productTemplate && templatesByName.has(productTemplate.toUpperCase()) ? "update" : "create",
      errors,
    };
  });

  return {
    rows,
    importToken: importToken(rows),
  };
}

export async function commitProductTemplateImport(payload: ProductTemplateImportCommitPayload) {
  const company = await getDefaultCompany();
  const expectedToken = importToken(payload.rows);

  if (expectedToken !== payload.importToken) {
    throw new Error("Import preview is stale. Please validate the file again.");
  }

  if (payload.rows.length === 0 || payload.rows.some((row) => row.errors.length > 0)) {
    throw new Error("Only a valid preview can be imported.");
  }

  return db.transaction(async (tx) => {
    const [categoryRows, brandRows, unitRows, templateRows, attributeRows, attributeValueRows, categoryAttributeRows] = await Promise.all([
      tx.select({ id: productCategories.id, code: productCategories.code, name: productCategories.name })
        .from(productCategories)
        .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
      tx.select({ id: brands.id, code: brands.code, name: brands.name })
        .from(brands)
        .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt))),
      tx.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
        .from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt))),
      tx.select({ id: productTemplates.id, name: productTemplates.name })
        .from(productTemplates)
        .where(and(eq(productTemplates.companyId, company.id), isNull(productTemplates.deletedAt))),
      tx.select({ id: catalogAttributes.id, code: catalogAttributes.code, name: catalogAttributes.name })
        .from(catalogAttributes)
        .where(and(eq(catalogAttributes.companyId, company.id), isNull(catalogAttributes.deletedAt))),
      tx.select({
        id: catalogAttributeValues.id,
        attributeId: catalogAttributeValues.attributeId,
        value: catalogAttributeValues.value,
      })
        .from(catalogAttributeValues)
        .where(and(eq(catalogAttributeValues.companyId, company.id), isNull(catalogAttributeValues.deletedAt))),
      tx.select({
        id: productCategoryAttributes.id,
        categoryId: productCategoryAttributes.categoryId,
        attributeId: productCategoryAttributes.attributeId,
      })
        .from(productCategoryAttributes)
        .where(and(eq(productCategoryAttributes.companyId, company.id), isNull(productCategoryAttributes.deletedAt))),
    ]);
    const categoriesByRef = mapReference(categoryRows);
    const brandsByRef = mapReference(brandRows);
    const unitsByRef = mapReference(unitRows);
    const templatesByName = new Map(templateRows.map((template) => [template.name.trim().toUpperCase(), template]));
    const attributesByRef = mapReference(attributeRows);
    const valuesByAttributeAndValue = new Map(
      attributeValueRows.map((value) => [`${value.attributeId}:${value.value.trim().toUpperCase()}`, value]),
    );
    const categoryAttributesByCategoryAndAttribute = new Map(
      categoryAttributeRows.map((row) => [`${row.categoryId}:${row.attributeId}`, row]),
    );
    const usedSkus = new Set<string>();
    let created = 0;
    let updated = 0;
    let variantsCreated = 0;

    async function saveTemplate(row: ProductTemplateImportRow, categoryId: string, brandId: string | null, unitId: string) {
      const existing = templatesByName.get(row.productTemplate.toUpperCase());
      if (existing) {
        await tx
          .update(productTemplates)
          .set({
            categoryId,
            brandId,
            unitId,
            trackingMode: row.trackingMode || "none",
            description: row.description || null,
            isActive: row.isActive,
            updatedAt: sql`now()`,
          })
          .where(eq(productTemplates.id, existing.id));
        updated += 1;

        return existing.id;
      }

      const [template] = await tx
        .insert(productTemplates)
        .values({
          companyId: company.id,
          name: row.productTemplate,
          categoryId,
          brandId,
          unitId,
          trackingMode: row.trackingMode || "none",
          description: row.description || null,
          isActive: row.isActive,
        })
        .returning({ id: productTemplates.id, name: productTemplates.name });
      templatesByName.set(template.name.toUpperCase(), template);
      created += 1;

      return template.id;
    }

    async function ensureAttribute(name: string) {
      const existing = attributesByRef.get(name.toUpperCase());
      if (existing) {
        return existing;
      }

      const [attribute] = await tx
        .insert(catalogAttributes)
        .values({
          companyId: company.id,
          code: await generateCompanyCode(tx, {
            companyId: company.id,
            table: "catalog_attributes",
            prefix: normalizeCode(name).replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "ATTR",
          }),
          name,
          isActive: true,
        })
        .returning({
          id: catalogAttributes.id,
          code: catalogAttributes.code,
          name: catalogAttributes.name,
        });

      attributesByRef.set(attribute.code.toUpperCase(), attribute);
      attributesByRef.set(attribute.name.toUpperCase(), attribute);
      return attribute;
    }

    async function ensureAttributeValue(attributeId: string, value: string) {
      const key = `${attributeId}:${value.toUpperCase()}`;
      const existing = valuesByAttributeAndValue.get(key);

      if (existing) {
        return existing;
      }

      const [attributeValue] = await tx
        .insert(catalogAttributeValues)
        .values({
          companyId: company.id,
          attributeId,
          value,
          sortOrder: 0,
          isActive: true,
        })
        .returning({
          id: catalogAttributeValues.id,
          attributeId: catalogAttributeValues.attributeId,
          value: catalogAttributeValues.value,
        });

      valuesByAttributeAndValue.set(key, attributeValue);
      return attributeValue;
    }

    async function ensureCategoryAttribute(categoryId: string, attributeId: string) {
      const key = `${categoryId}:${attributeId}`;

      if (categoryAttributesByCategoryAndAttribute.has(key)) {
        return;
      }

      const [categoryAttribute] = await tx
        .insert(productCategoryAttributes)
        .values({
          companyId: company.id,
          categoryId,
          attributeId,
          isRequired: false,
          sortOrder: 0,
        })
        .returning({
          id: productCategoryAttributes.id,
          categoryId: productCategoryAttributes.categoryId,
          attributeId: productCategoryAttributes.attributeId,
        });

      categoryAttributesByCategoryAndAttribute.set(key, categoryAttribute);
    }

    for (const row of payload.rows) {
      const category = categoriesByRef.get(row.category.toUpperCase());
      const brand = row.brand ? brandsByRef.get(row.brand.toUpperCase()) : undefined;
      const unit = unitsByRef.get(row.unit.toUpperCase());

      if (!category || !unit) {
        throw new Error(`Row ${row.rowNumber}: category or unit no longer exists.`);
      }

      const templateId = await saveTemplate(row, category.id, brand?.id ?? null, unit.id);
      const selectedValues = [];

      for (const variantAttribute of row.variantAttributes) {
        const attribute = await ensureAttribute(variantAttribute.attribute);
        const attributeValue = await ensureAttributeValue(attribute.id, variantAttribute.value);
        await ensureCategoryAttribute(category.id, attribute.id);

        selectedValues.push({ attribute, attributeValue, rawValue: variantAttribute.value });
      }

      await tx.delete(productTemplateAttributeValues).where(eq(productTemplateAttributeValues.templateId, templateId));

      if (selectedValues.length > 0) {
        await tx.insert(productTemplateAttributeValues).values(
          selectedValues.map(({ attribute, attributeValue }) => ({
            companyId: company.id,
            templateId,
            attributeId: attribute.id,
            attributeValueId: attributeValue.id,
          })),
        );
      }

      for (const { attribute, attributeValue, rawValue } of selectedValues) {
        const productName = `${attribute.name} ${row.productTemplate} ${rawValue}`;
        const existingProduct = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.templateId, templateId), eq(products.name, productName), isNull(products.deletedAt)))
          .limit(1);

        if (existingProduct.length > 0) {
          continue;
        }

        const [product] = await tx
          .insert(products)
          .values({
            companyId: company.id,
            templateId,
            sku: await generateNextProductSku(company.id, usedSkus),
            name: productName,
            categoryId: category.id,
            brandId: brand?.id ?? null,
            model: rawValue,
            description: row.description || null,
            unitId: unit.id,
            trackingMode: row.trackingMode || "none",
            standardCostMinor: 0,
            listPriceMinor: 0,
            currencyCode: company.baseCurrencyCode,
            isActive: row.isActive,
          })
          .returning({ id: products.id });

        await tx.insert(productVariantAttributeValues).values({
          companyId: company.id,
          productId: product.id,
          attributeId: attribute.id,
          attributeValueId: attributeValue.id,
        });
        variantsCreated += 1;
      }
    }

    return { created, updated, variantsCreated };
  });
}
