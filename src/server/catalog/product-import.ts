import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import {
  getDefaultCompany,
  majorToMinor,
  normalizeCode,
} from "@/server/catalog/products";
import type {
  ProductImportCommitPayload,
  ProductImportRow,
  ProductSpecificationField,
  ProductSpecifications,
  TrackingModeOption,
} from "@/server/catalog/types";
import { db } from "@/server/db/client";
import {
  brands,
  productCategories,
  productPurchaseTaxes,
  productSaleTaxes,
  products,
  taxes,
  unitsOfMeasure,
} from "@/server/db/schema";

const productTemplateHeaders = [
  "item_code",
  "product_name",
  "category",
  "brand",
  "model",
  "unit",
  "tracking_mode",
  "sales_unit_price",
  "purchase_unit_cost",
  "sales_taxes",
  "purchase_taxes",
  "description",
  "specifications",
];

export const productImportTemplateCsv = `${productTemplateHeaders.join(",")}
,Hydraulic Filter,Parts,Perkins,HF-204,Each,none,1950,1200,VAT15,VAT15,Standard replacement filter,"{""Type"":""Filter""}"
,Engine Oil 20W-50,Consumables,,20W-50,Liter,lot,650,450,VAT15,VAT15,Lot tracked engine oil,"{""Type"":""Engine Oil"",""Viscosity"":""20W-50""}"
,Mini Excavator 320,Machinery,Caterpillar,320,Each,serial,4200000,3500000,VAT15,VAT15,Serial tracked machine,"{""Power"":""52 kW"",""Voltage"":""220V""}"
`;

type ParsedProductCsvRow = {
  rowNumber: number;
  sku: string;
  productName: string;
  category: string;
  brand: string;
  model: string;
  unit: string;
  trackingMode: string;
  salesUnitPrice: string;
  purchaseUnitCost: string;
  salesTaxes: string;
  purchaseTaxes: string;
  description: string;
  specifications: ProductSpecifications;
  specificationParseError?: string;
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

function parseCsv(text: string): ParsedProductCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));
  const specificationHeaders = headers
    .map((header, index) => ({ header, index }))
    .filter(({ header }) => header.startsWith("spec_"));

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);
      const row = {
        rowNumber: index + 2,
        sku: values[headerIndex.item_code] ?? values[headerIndex.sku] ?? "",
        productName: values[headerIndex.product_name] ?? values[headerIndex.name] ?? "",
        category: values[headerIndex.category] ?? "",
        brand: values[headerIndex.brand] ?? "",
        model: values[headerIndex.model] ?? "",
        unit: values[headerIndex.unit] ?? "",
        trackingMode: values[headerIndex.tracking_mode] ?? "",
        salesUnitPrice: values[headerIndex.sales_unit_price] ?? "",
        purchaseUnitCost: values[headerIndex.purchase_unit_cost] ?? "",
        salesTaxes: values[headerIndex.sales_taxes] ?? "",
        purchaseTaxes: values[headerIndex.purchase_taxes] ?? "",
        description: values[headerIndex.description] ?? "",
        ...parseSpecificationColumns(
          values[headerIndex.specifications] ?? "",
          specificationHeaders.map(({ header, index }) => [
            header.slice(5),
            values[index]?.trim() || null,
          ]),
        ),
      };

      return row;
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "rowNumber" && String(value).trim()),
    );
}

function parseJsonSpecifications(value: string): {
  specifications: ProductSpecifications;
  error?: string;
} {
  const text = value.trim();

  if (!text) {
    return { specifications: {} };
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        specifications: {},
        error: "Specifications JSON must be an object like {\"Power\":\"3.2 kW\"}.",
      };
    }

    return {
      specifications: Object.fromEntries(
        Object.entries(parsed).map(([key, parsedValue]) => [
          key.trim(),
          parsedValue === null || parsedValue === undefined ? null : String(parsedValue).trim() || null,
        ]),
      ),
    };
  } catch {
    return {
      specifications: {},
      error: "Specifications JSON is invalid.",
    };
  }
}

function parseSpecificationColumns(
  jsonValue: string,
  dynamicSpecifications: [string, string | null][],
): Pick<ParsedProductCsvRow, "specifications" | "specificationParseError"> {
  const parsedJson = parseJsonSpecifications(jsonValue);

  return {
    specifications: {
      ...parsedJson.specifications,
      ...Object.fromEntries(dynamicSpecifications),
    },
    specificationParseError: parsedJson.error,
  };
}

function nonNegativeDecimal(value: string) {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function splitRefs(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function mapReference<T extends { code: string; name: string }>(rows: T[]) {
  const map = new Map<string, T>();

  for (const row of rows) {
    map.set(row.code.trim().toUpperCase(), row);
    map.set(row.name.trim().toUpperCase(), row);
  }

  return map;
}

function formatSpecLabel(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeImportedSpecifications(
  input: ProductSpecifications,
  schema: ProductSpecificationField[],
  errors: string[],
) {
  const normalized: ProductSpecifications = {};
  const schemaByRef = new Map<string, ProductSpecificationField>();

  for (const field of schema) {
    schemaByRef.set(field.key.trim().toUpperCase(), field);
    schemaByRef.set(field.label.trim().toUpperCase(), field);
  }

  for (const [key, value] of Object.entries(input)) {
    const schemaField = schemaByRef.get(key.trim().toUpperCase());

    if (!schemaField) {
      errors.push(`Specification ${formatSpecLabel(key)} is not configured for this category.`);
      continue;
    }

    const text = value === null || value === undefined ? "" : String(value).trim();
    normalized[schemaField.key] = text || null;
  }

  return normalized;
}

function importToken(rows: ProductImportRow[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.sku,
          row.productName,
          row.category,
          row.brand,
          row.model,
          row.unit,
          row.trackingMode,
          row.salesUnitPrice,
          row.purchaseUnitCost,
          row.salesTaxes,
          row.purchaseTaxes,
          row.description,
          row.specifications,
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

async function generateNextProductSku(
  companyId: string,
  usedSkus: Set<string>,
) {
  let sku = await generateProductSku(companyId);

  while (usedSkus.has(sku.toUpperCase())) {
    const match = sku.match(/^ITEM-(\d+)$/);
    const next = match ? Number(match[1]) + 1 : usedSkus.size + 1;
    sku = `ITEM-${String(next).padStart(5, "0")}`;
  }

  usedSkus.add(sku.toUpperCase());
  return sku;
}

export async function previewProductImportCsv(text: string) {
  const company = await getDefaultCompany();
  const parsedRows = parseCsv(text);

  if (parsedRows.length === 0) {
    return {
      rows: [],
      importToken: undefined,
    };
  }

  const [
    categoryRows,
    brandRows,
    unitRows,
    taxRows,
    productRows,
  ] = await Promise.all([
    db.select({
      id: productCategories.id,
      code: productCategories.code,
      name: productCategories.name,
      specificationSchema: productCategories.specificationSchema,
    })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
    db.select({ id: brands.id, code: brands.code, name: brands.name })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt))),
    db.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
      .from(unitsOfMeasure)
      .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt))),
    db.select({ id: taxes.id, code: taxes.code, name: taxes.name, scope: taxes.scope })
      .from(taxes)
      .where(and(eq(taxes.companyId, company.id), isNull(taxes.deletedAt), eq(taxes.isActive, true))),
    db.select({ id: products.id, sku: products.sku })
      .from(products)
      .where(and(eq(products.companyId, company.id), isNull(products.deletedAt))),
  ]);

  const categoriesByRef = mapReference(categoryRows);
  const brandsByRef = mapReference(brandRows);
  const unitsByRef = mapReference(unitRows);
  const taxesByRef = mapReference(taxRows);
  const productsBySku = new Map(productRows.map((product) => [product.sku.toUpperCase(), product]));
  const explicitSkusSeen = new Set<string>();

  const rows = parsedRows.map((row): ProductImportRow => {
    const sku = normalizeCode(row.sku);
    const productName = row.productName.trim();
    const categoryRef = row.category.trim();
    const brandRef = row.brand.trim();
    const unitRef = row.unit.trim();
    const trackingMode = row.trackingMode.trim().toLowerCase();
    const salesUnitPrice = row.salesUnitPrice.trim() || "0";
    const purchaseUnitCost = row.purchaseUnitCost.trim() || "0";
    const salesPrice = nonNegativeDecimal(salesUnitPrice);
    const purchaseCost = nonNegativeDecimal(purchaseUnitCost);
    const category = categoryRef ? categoriesByRef.get(categoryRef.toUpperCase()) : undefined;
    const brand = brandRef ? brandsByRef.get(brandRef.toUpperCase()) : undefined;
    const unit = unitRef ? unitsByRef.get(unitRef.toUpperCase()) : undefined;
    const saleTaxRefs = splitRefs(row.salesTaxes);
    const purchaseTaxRefs = splitRefs(row.purchaseTaxes);
    const saleTaxRows = saleTaxRefs.map((taxRef) => taxesByRef.get(taxRef.toUpperCase()));
    const purchaseTaxRows = purchaseTaxRefs.map((taxRef) => taxesByRef.get(taxRef.toUpperCase()));
    const errors: string[] = [];

    if (!productName) {
      errors.push("Product name is required.");
    }

    if (sku) {
      if (explicitSkusSeen.has(sku)) {
        errors.push("Duplicate item code in import file.");
      }

      explicitSkusSeen.add(sku);
    }

    if (categoryRef && !category) {
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

    if (salesPrice === undefined) {
      errors.push("Sales unit price must be 0 or greater.");
    }

    if (purchaseCost === undefined) {
      errors.push("Purchase unit cost must be 0 or greater.");
    }

    if (row.specificationParseError) {
      errors.push(row.specificationParseError);
    }

    for (const [index, tax] of saleTaxRows.entries()) {
      if (!tax) {
        errors.push(`Sales tax ${saleTaxRefs[index]} does not exist.`);
      } else if (tax.scope === "purchase") {
        errors.push(`Sales tax ${saleTaxRefs[index]} is not valid for sales.`);
      }
    }

    for (const [index, tax] of purchaseTaxRows.entries()) {
      if (!tax) {
        errors.push(`Purchase tax ${purchaseTaxRefs[index]} does not exist.`);
      } else if (tax.scope === "sale") {
        errors.push(`Purchase tax ${purchaseTaxRefs[index]} is not valid for purchases.`);
      }
    }
    const specifications = category
      ? normalizeImportedSpecifications(row.specifications, category.specificationSchema, errors)
      : {};

    return {
      rowNumber: row.rowNumber,
      sku,
      productName,
      category: categoryRef,
      categoryName: category?.name ?? "",
      brand: brandRef,
      brandName: brand?.name ?? "",
      model: row.model.trim(),
      unit: unitRef,
      unitName: unit?.name ?? "",
      trackingMode: trackingMode as TrackingModeOption | "",
      salesUnitPrice,
      purchaseUnitCost,
      listPriceMinor: salesPrice === undefined ? 0 : majorToMinor(String(salesPrice)),
      standardCostMinor: purchaseCost === undefined ? 0 : majorToMinor(String(purchaseCost)),
      salesTaxes: row.salesTaxes.trim(),
      purchaseTaxes: row.purchaseTaxes.trim(),
      saleTaxIds: saleTaxRows.filter((tax): tax is NonNullable<typeof tax> => Boolean(tax)).map((tax) => tax.id),
      purchaseTaxIds: purchaseTaxRows.filter((tax): tax is NonNullable<typeof tax> => Boolean(tax)).map((tax) => tax.id),
      description: row.description.trim(),
      specifications,
      action: sku && productsBySku.has(sku) ? "update" : "create",
      existingProductId: sku ? productsBySku.get(sku)?.id ?? null : null,
      errors,
    };
  });

  return {
    rows,
    importToken: importToken(rows),
  };
}

export async function commitProductImport(payload: ProductImportCommitPayload) {
  const company = await getDefaultCompany();
  const expectedToken = importToken(payload.rows);

  if (expectedToken !== payload.importToken) {
    throw new Error("Import preview is stale. Please validate the file again.");
  }

  if (payload.rows.length === 0 || payload.rows.some((row) => row.errors.length > 0)) {
    throw new Error("Only a valid preview can be imported.");
  }

  return db.transaction(async (tx) => {
    const [categoryRows, brandRows, unitRows] = await Promise.all([
      tx.select({ id: productCategories.id, code: productCategories.code, name: productCategories.name })
        .from(productCategories)
        .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
      tx.select({ id: brands.id, code: brands.code, name: brands.name })
        .from(brands)
        .where(and(eq(brands.companyId, company.id), isNull(brands.deletedAt))),
      tx.select({ id: unitsOfMeasure.id, code: unitsOfMeasure.code, name: unitsOfMeasure.name })
        .from(unitsOfMeasure)
        .where(and(eq(unitsOfMeasure.companyId, company.id), isNull(unitsOfMeasure.deletedAt))),
    ]);
    const categoriesByRef = mapReference(categoryRows);
    const brandsByRef = mapReference(brandRows);
    const unitsByRef = mapReference(unitRows);
    const usedSkus = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const row of payload.rows) {
      const category = row.category ? categoriesByRef.get(row.category.toUpperCase()) : undefined;
      const brand = row.brand ? brandsByRef.get(row.brand.toUpperCase()) : undefined;
      const unit = unitsByRef.get(row.unit.toUpperCase());

      if (!unit) {
        throw new Error(`Row ${row.rowNumber}: unit no longer exists.`);
      }

      const sku = row.sku || await generateNextProductSku(company.id, usedSkus);
      const values = {
        sku,
        name: row.productName,
        categoryId: category?.id ?? null,
        brandId: brand?.id ?? null,
        model: row.model || null,
        description: row.description || null,
        specifications: row.specifications,
        unitId: unit.id,
        trackingMode: row.trackingMode || "none",
        standardCostMinor: row.standardCostMinor,
        listPriceMinor: row.listPriceMinor,
        currencyCode: company.baseCurrencyCode,
        isActive: true,
        updatedAt: sql`now()`,
      };

      const existingId = row.existingProductId;
      const product = existingId
        ? await tx
            .update(products)
            .set(values)
            .where(and(eq(products.id, existingId), eq(products.companyId, company.id), isNull(products.deletedAt)))
            .returning({ id: products.id })
            .then((rows) => rows[0])
        : await tx
            .insert(products)
            .values({
              companyId: company.id,
              ...values,
            })
            .returning({ id: products.id })
            .then((rows) => rows[0]);

      if (!product) {
        throw new Error(`Row ${row.rowNumber}: product could not be saved.`);
      }

      await tx.delete(productSaleTaxes).where(eq(productSaleTaxes.productId, product.id));
      await tx.delete(productPurchaseTaxes).where(eq(productPurchaseTaxes.productId, product.id));

      if (row.saleTaxIds.length > 0) {
        await tx.insert(productSaleTaxes).values(row.saleTaxIds.map((taxId) => ({ productId: product.id, taxId })));
      }

      if (row.purchaseTaxIds.length > 0) {
        await tx.insert(productPurchaseTaxes).values(row.purchaseTaxIds.map((taxId) => ({ productId: product.id, taxId })));
      }

      if (existingId) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated };
  });
}
