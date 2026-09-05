import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, normalizeCode } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  catalogAttributes,
  catalogAttributeValues,
  productCategories,
  productCategoryAttributes,
} from "@/server/db/schema";
import type {
  CategoryAttributeImportCommitPayload,
  CategoryAttributeImportRow,
} from "@/server/catalog/types";

const headers = [
  "category_code",
  "category_name",
  "attribute_code",
  "attribute_name",
  "value",
  "required",
  "sequence",
];

export const categoryAttributeImportTemplateCsv = `${headers.join(",")}
GEN,Generators,POWER,Power,3.2 kW,false,10
GEN,Generators,POWER,Power,5 kW,false,10
GEN,Generators,FUEL,Fuel Type,Gasoline,false,20
GEN,Generators,FUEL,Fuel Type,Diesel,false,20
GEN,Generators,MODEL,Model,R6000ISER,true,30
WELD,Welding Machines,MODEL,Model,BX1400,true,10
WELD,Welding Machines,WELDING-TYPE,Welding Type,Arc Welding,false,20
`;

type ParsedRow = {
  rowNumber: number;
  categoryCode: string;
  categoryName: string;
  attributeCode: string;
  attributeName: string;
  value: string;
  required: string;
  sequence: string;
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
        categoryCode: values[headerIndex.category_code] ?? "",
        categoryName: values[headerIndex.category_name] ?? "",
        attributeCode: values[headerIndex.attribute_code] ?? "",
        attributeName: values[headerIndex.attribute_name] ?? "",
        value: values[headerIndex.value] ?? "",
        required: values[headerIndex.required] ?? "",
        sequence: values[headerIndex.sequence] ?? "",
      };
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "rowNumber" && String(value).trim()),
    );
}

function boolValue(value: string) {
  return ["1", "true", "yes", "y", "on"].includes(value.trim().toLowerCase());
}

function rowKey(row: Pick<CategoryAttributeImportRow, "categoryCode" | "attributeCode" | "value">) {
  return `${row.categoryCode}:${row.attributeCode}:${row.value.trim().toUpperCase()}`;
}

function importToken(rows: CategoryAttributeImportRow[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.categoryCode,
          row.categoryName,
          row.attributeCode,
          row.attributeName,
          row.value,
          row.isRequired,
          row.sortOrder,
        ]),
      ),
    )
    .digest("hex");
}

export async function previewCategoryAttributeImportCsv(text: string) {
  const company = await getDefaultCompany();
  const parsedRows = parseCsv(text);

  if (parsedRows.length === 0) {
    return {
      rows: [],
      importToken: undefined,
    };
  }

  const [categoryRows, attributeRows, valueRows] = await Promise.all([
    db
      .select({ code: productCategories.code })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
    db
      .select({ code: catalogAttributes.code })
      .from(catalogAttributes)
      .where(and(eq(catalogAttributes.companyId, company.id), isNull(catalogAttributes.deletedAt))),
    db
      .select({
        attributeCode: catalogAttributes.code,
        value: catalogAttributeValues.value,
      })
      .from(catalogAttributeValues)
      .innerJoin(catalogAttributes, eq(catalogAttributeValues.attributeId, catalogAttributes.id))
      .where(and(eq(catalogAttributeValues.companyId, company.id), isNull(catalogAttributeValues.deletedAt))),
  ]);

  const categories = new Set(categoryRows.map((category) => category.code.toUpperCase()));
  const attributes = new Set(attributeRows.map((attribute) => attribute.code.toUpperCase()));
  const values = new Set(valueRows.map((value) => `${value.attributeCode.toUpperCase()}:${value.value.trim().toUpperCase()}`));
  const seen = new Set<string>();

  const rows = parsedRows.map((row): CategoryAttributeImportRow => {
    const categoryCode = normalizeCode(row.categoryCode);
    const categoryName = row.categoryName.trim();
    const attributeCode = normalizeCode(row.attributeCode);
    const attributeName = row.attributeName.trim();
    const value = row.value.trim();
    const sortOrder = Number(row.sequence || "0");
    const errors: string[] = [];

    if (!categoryCode) {
      errors.push("Category code is required.");
    }

    if (!categoryName) {
      errors.push("Category name is required.");
    }

    if (!attributeCode) {
      errors.push("Attribute code is required.");
    }

    if (!attributeName) {
      errors.push("Attribute name is required.");
    }

    if (!value) {
      errors.push("Value is required.");
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      errors.push("Sequence must be a whole number greater than or equal to 0.");
    }

    const normalizedRow = {
      rowNumber: row.rowNumber,
      categoryCode,
      categoryName,
      attributeCode,
      attributeName,
      value,
      isRequired: boolValue(row.required),
      sortOrder: Number.isInteger(sortOrder) && sortOrder >= 0 ? sortOrder : 0,
      action:
        categories.has(categoryCode) &&
        attributes.has(attributeCode) &&
        values.has(`${attributeCode}:${value.toUpperCase()}`)
          ? "update"
          : "create",
      errors,
    } satisfies CategoryAttributeImportRow;

    const key = rowKey(normalizedRow);
    if (seen.has(key)) {
      normalizedRow.errors.push("Duplicate category, attribute, and value in import file.");
    }
    seen.add(key);

    return normalizedRow;
  });

  return {
    rows,
    importToken: importToken(rows),
  };
}

export async function commitCategoryAttributeImport(payload: CategoryAttributeImportCommitPayload) {
  const company = await getDefaultCompany();
  const expectedToken = importToken(payload.rows);

  if (expectedToken !== payload.importToken) {
    throw new Error("Import preview is stale. Please validate the file again.");
  }

  if (payload.rows.length === 0 || payload.rows.some((row) => row.errors.length > 0)) {
    throw new Error("Only a valid preview can be imported.");
  }

  return db.transaction(async (tx) => {
    const [categoryRows, attributeRows, valueRows, categoryAttributeRows] = await Promise.all([
      tx
        .select({ id: productCategories.id, code: productCategories.code })
        .from(productCategories)
        .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt))),
      tx
        .select({ id: catalogAttributes.id, code: catalogAttributes.code })
        .from(catalogAttributes)
        .where(and(eq(catalogAttributes.companyId, company.id), isNull(catalogAttributes.deletedAt))),
      tx
        .select({
          id: catalogAttributeValues.id,
          attributeId: catalogAttributeValues.attributeId,
          value: catalogAttributeValues.value,
        })
        .from(catalogAttributeValues)
        .where(and(eq(catalogAttributeValues.companyId, company.id), isNull(catalogAttributeValues.deletedAt))),
      tx
        .select({
          id: productCategoryAttributes.id,
          categoryId: productCategoryAttributes.categoryId,
          attributeId: productCategoryAttributes.attributeId,
        })
        .from(productCategoryAttributes)
        .where(and(eq(productCategoryAttributes.companyId, company.id), isNull(productCategoryAttributes.deletedAt))),
    ]);
    const categories = new Map(categoryRows.map((category) => [category.code.toUpperCase(), category]));
    const attributes = new Map(attributeRows.map((attribute) => [attribute.code.toUpperCase(), attribute]));
    const values = new Map(valueRows.map((value) => [`${value.attributeId}:${value.value.trim().toUpperCase()}`, value]));
    const categoryAttributes = new Map(
      categoryAttributeRows.map((row) => [`${row.categoryId}:${row.attributeId}`, row]),
    );
    let categoriesCreated = 0;
    let attributesCreated = 0;
    let valuesCreated = 0;
    let linksCreated = 0;
    let linksUpdated = 0;

    for (const row of payload.rows) {
      let category = categories.get(row.categoryCode.toUpperCase());
      if (!category) {
        [category] = await tx
          .insert(productCategories)
          .values({
            companyId: company.id,
            code: row.categoryCode,
            name: row.categoryName,
            description: null,
            isActive: true,
          })
          .returning({ id: productCategories.id, code: productCategories.code });
        categories.set(row.categoryCode.toUpperCase(), category);
        categoriesCreated += 1;
      } else {
        await tx
          .update(productCategories)
          .set({ name: row.categoryName, isActive: true, updatedAt: sql`now()` })
          .where(eq(productCategories.id, category.id));
      }

      let attribute = attributes.get(row.attributeCode.toUpperCase());
      if (!attribute) {
        [attribute] = await tx
          .insert(catalogAttributes)
          .values({
            companyId: company.id,
            code: row.attributeCode,
            name: row.attributeName,
            isActive: true,
          })
          .returning({ id: catalogAttributes.id, code: catalogAttributes.code });
        attributes.set(row.attributeCode.toUpperCase(), attribute);
        attributesCreated += 1;
      } else {
        await tx
          .update(catalogAttributes)
          .set({ name: row.attributeName, isActive: true, updatedAt: sql`now()` })
          .where(eq(catalogAttributes.id, attribute.id));
      }

      const valueKey = `${attribute.id}:${row.value.toUpperCase()}`;
      let value = values.get(valueKey);
      if (!value) {
        [value] = await tx
          .insert(catalogAttributeValues)
          .values({
            companyId: company.id,
            attributeId: attribute.id,
            value: row.value,
            sortOrder: row.sortOrder,
            isActive: true,
          })
          .returning({
            id: catalogAttributeValues.id,
            attributeId: catalogAttributeValues.attributeId,
            value: catalogAttributeValues.value,
          });
        values.set(valueKey, value);
        valuesCreated += 1;
      } else {
        await tx
          .update(catalogAttributeValues)
          .set({ sortOrder: row.sortOrder, isActive: true, updatedAt: sql`now()` })
          .where(eq(catalogAttributeValues.id, value.id));
      }

      const categoryAttributeKey = `${category.id}:${attribute.id}`;
      const categoryAttribute = categoryAttributes.get(categoryAttributeKey);
      if (!categoryAttribute) {
        const [createdLink] = await tx
          .insert(productCategoryAttributes)
          .values({
            companyId: company.id,
            categoryId: category.id,
            attributeId: attribute.id,
            isRequired: row.isRequired,
            sortOrder: row.sortOrder,
          })
          .returning({
            id: productCategoryAttributes.id,
            categoryId: productCategoryAttributes.categoryId,
            attributeId: productCategoryAttributes.attributeId,
          });
        categoryAttributes.set(categoryAttributeKey, createdLink);
        linksCreated += 1;
      } else {
        await tx
          .update(productCategoryAttributes)
          .set({
            isRequired: row.isRequired,
            sortOrder: row.sortOrder,
            updatedAt: sql`now()`,
          })
          .where(eq(productCategoryAttributes.id, categoryAttribute.id));
        linksUpdated += 1;
      }
    }

    return {
      categoriesCreated,
      attributesCreated,
      valuesCreated,
      linksCreated,
      linksUpdated,
    };
  });
}
