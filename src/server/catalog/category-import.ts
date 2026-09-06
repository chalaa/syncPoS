import "server-only";

import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import { getDefaultCompany, normalizeCode } from "@/server/catalog/products";
import type {
  CategoryImportCommitPayload,
  CategoryImportRow,
  ProductSpecificationField,
} from "@/server/catalog/types";
import { db } from "@/server/db/client";
import { productCategories } from "@/server/db/schema";

const categoryTemplateHeaders = [
  "code",
  "name",
  "description",
  "specifications",
];

export const categoryImportTemplateCsv = `${categoryTemplateHeaders.join(",")}
PARTS,Parts,Spare parts and consumables,"[""Type"",""Size"",""Material""]"
MACH,Machinery,Machines and equipment,"[""Power"",""Voltage"",""Fuel Type""]"
`;

type ParsedCategoryCsvRow = {
  rowNumber: number;
  code: string;
  name: string;
  description: string;
  specificationSchema: ProductSpecificationField[];
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

function specificationKey(label: string) {
  return normalizeCode(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeSpecificationFields(labels: string[]) {
  const usedKeys = new Set<string>();
  const fields: ProductSpecificationField[] = [];

  for (const rawLabel of labels) {
    const label = rawLabel.trim();

    if (!label) {
      continue;
    }

    const baseKey = specificationKey(label);
    if (!baseKey) {
      continue;
    }

    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) {
      key = `${baseKey}_${suffix}`;
      suffix += 1;
    }

    usedKeys.add(key);
    fields.push({ key, label });
  }

  return fields;
}

function parseSpecificationSchema(value: string): {
  fields: ProductSpecificationField[];
  error?: string;
} {
  const text = value.trim();

  if (!text) {
    return { fields: [] };
  }

  try {
    const parsed: unknown = JSON.parse(text);

    if (Array.isArray(parsed)) {
      const labels = parsed
        .map((item) => {
          if (typeof item === "string") {
            return item;
          }

          if (item && typeof item === "object" && "label" in item) {
            return String(item.label);
          }

          return "";
        })
        .filter(Boolean);

      return { fields: normalizeSpecificationFields(labels) };
    }

    if (parsed && typeof parsed === "object") {
      return { fields: normalizeSpecificationFields(Object.keys(parsed)) };
    }

    return {
      fields: [],
      error: "Specifications JSON must be an array like [\"Power\",\"Voltage\"].",
    };
  } catch {
    return {
      fields: [],
      error: "Specifications JSON is invalid.",
    };
  }
}

function parseCsv(text: string): ParsedCategoryCsvRow[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const headerIndex = Object.fromEntries(headers.map((header, index) => [header, index]));

  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);
      const parsedSpecifications = parseSpecificationSchema(values[headerIndex.specifications] ?? "");

      return {
        rowNumber: index + 2,
        code: values[headerIndex.code] ?? "",
        name: values[headerIndex.name] ?? "",
        description: values[headerIndex.description] ?? "",
        specificationSchema: parsedSpecifications.fields,
        specificationParseError: parsedSpecifications.error,
      };
    })
    .filter((row) =>
      Object.entries(row).some(([key, value]) => key !== "rowNumber" && key !== "specificationParseError" && String(value).trim()),
    );
}

function importToken(rows: CategoryImportRow[]) {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => [
          row.code,
          row.name,
          row.description,
          row.specificationSchema,
        ]),
      ),
    )
    .digest("hex");
}

async function generateCategoryCode(companyId: string) {
  const [row] = await db.execute(sql`
    select (
      'CAT'
      || '-'
      || lpad(
        (coalesce(max((substring(code from '^CAT-([0-9]+)$'))::int), 0) + 1)::text,
        5,
        '0'
      )
    ) as "code"
    from product_categories
    where company_id = ${companyId}
      and deleted_at is null
      and code ~ '^CAT-[0-9]+$'
  `);
  const code = typeof row === "object" && row && "code" in row ? row.code : undefined;

  return typeof code === "string" ? code : "CAT-00001";
}

async function generateNextCategoryCode(companyId: string, usedCodes: Set<string>) {
  let code = await generateCategoryCode(companyId);

  while (usedCodes.has(code.toUpperCase())) {
    const match = code.match(/^CAT-(\d+)$/);
    const next = match ? Number(match[1]) + 1 : usedCodes.size + 1;
    code = `CAT-${String(next).padStart(5, "0")}`;
  }

  usedCodes.add(code.toUpperCase());
  return code;
}

export async function previewCategoryImportCsv(text: string) {
  const company = await getDefaultCompany();
  const parsedRows = parseCsv(text);

  if (parsedRows.length === 0) {
    return {
      rows: [],
      importToken: undefined,
    };
  }

  const categoryRows = await db
    .select({ id: productCategories.id, code: productCategories.code, name: productCategories.name })
    .from(productCategories)
    .where(and(eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt)));

  const categoriesByCode = new Map(categoryRows.map((category) => [category.code.toUpperCase(), category]));
  const categoriesByName = new Map(categoryRows.map((category) => [category.name.toUpperCase(), category]));
  const codesSeen = new Set<string>();
  const namesSeen = new Set<string>();

  const rows = parsedRows.map((row): CategoryImportRow => {
    const code = normalizeCode(row.code);
    const name = row.name.trim();
    const errors: string[] = [];
    const existingCategory = code
      ? categoriesByCode.get(code.toUpperCase()) ?? null
      : categoriesByName.get(name.toUpperCase()) ?? null;

    if (code) {
      if (codesSeen.has(code.toUpperCase())) {
        errors.push("Duplicate category code in import file.");
      }

      codesSeen.add(code.toUpperCase());
    }

    if (!name) {
      errors.push("Category name is required.");
    } else {
      if (namesSeen.has(name.toUpperCase())) {
        errors.push("Duplicate category name in import file.");
      }

      namesSeen.add(name.toUpperCase());
    }

    if (row.specificationParseError) {
      errors.push(row.specificationParseError);
    }

    return {
      rowNumber: row.rowNumber,
      code,
      name,
      description: row.description.trim(),
      specificationSchema: row.specificationSchema,
      action: existingCategory ? "update" : "create",
      existingCategoryId: existingCategory?.id ?? null,
      errors,
    };
  });

  return {
    rows,
    importToken: importToken(rows),
  };
}

export async function commitCategoryImport(payload: CategoryImportCommitPayload) {
  const company = await getDefaultCompany();
  const expectedToken = importToken(payload.rows);

  if (expectedToken !== payload.importToken) {
    throw new Error("Import preview is stale. Please validate the file again.");
  }

  if (payload.rows.length === 0 || payload.rows.some((row) => row.errors.length > 0)) {
    throw new Error("Only a valid preview can be imported.");
  }

  return db.transaction(async (tx) => {
    const usedCodes = new Set<string>();
    let created = 0;
    let updated = 0;

    for (const row of payload.rows) {
      const code = row.code || await generateNextCategoryCode(company.id, usedCodes);
      const values = {
        code,
        name: row.name,
        description: row.description || null,
        specificationSchema: row.specificationSchema,
        isActive: true,
        updatedAt: sql`now()`,
      };

      const category = row.existingCategoryId
        ? await tx
            .update(productCategories)
            .set(values)
            .where(and(eq(productCategories.id, row.existingCategoryId), eq(productCategories.companyId, company.id), isNull(productCategories.deletedAt)))
            .returning({ id: productCategories.id })
            .then((rows) => rows[0])
        : await tx
            .insert(productCategories)
            .values({
              companyId: company.id,
              ...values,
            })
            .returning({ id: productCategories.id })
            .then((rows) => rows[0]);

      if (!category) {
        throw new Error(`Row ${row.rowNumber}: category could not be saved.`);
      }

      if (row.existingCategoryId) {
        updated += 1;
      } else {
        created += 1;
      }
    }

    return { created, updated };
  });
}
