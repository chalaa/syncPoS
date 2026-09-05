"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/session";
import {
  commitCategoryAttributeImport,
  previewCategoryAttributeImportCsv,
} from "@/server/catalog/category-attribute-import";
import type {
  CategoryAttributeImportCommitPayload,
  CategoryAttributeImportPreviewState,
} from "@/server/catalog/types";

export async function validateCategoryAttributeImport(
  _previousState: CategoryAttributeImportPreviewState,
  formData: FormData,
): Promise<CategoryAttributeImportPreviewState> {
  await requirePermission("product.manage");

  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Choose a CSV file before validating.",
      rows: [],
    };
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return {
      status: "error",
      message: "Only CSV files are supported in this step. The template opens cleanly in Excel.",
      rows: [],
    };
  }

  const preview = await previewCategoryAttributeImportCsv(await file.text());
  const errorCount = preview.rows.reduce((count, row) => count + row.errors.length, 0);

  return {
    status: "preview",
    message:
      errorCount > 0
        ? `${errorCount} validation issue${errorCount === 1 ? "" : "s"} found.`
        : `${preview.rows.length} category attribute row${preview.rows.length === 1 ? "" : "s"} ready to import.`,
    rows: preview.rows,
    importToken: preview.importToken,
  };
}

export async function importCategoryAttributes(
  _previousState: CategoryAttributeImportPreviewState,
  formData: FormData,
): Promise<CategoryAttributeImportPreviewState> {
  await requirePermission("product.manage");
  const payloadValue = formData.get("payload");

  if (typeof payloadValue !== "string") {
    return {
      status: "error",
      message: "Import payload is missing. Validate the file again.",
      rows: [],
    };
  }

  try {
    const payload = JSON.parse(payloadValue) as CategoryAttributeImportCommitPayload;
    const result = await commitCategoryAttributeImport(payload);

    revalidatePath("/admin/products/categories");
    revalidatePath("/admin/products/attributes");
    revalidatePath("/admin/products/import/category-attributes");

    return {
      status: "imported",
      message: `Import completed. Created ${result.categoriesCreated} categories, ${result.attributesCreated} attributes, ${result.valuesCreated} values, and ${result.linksCreated} category links.`,
      rows: [],
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not import category attributes.",
      rows: [],
    };
  }
}
