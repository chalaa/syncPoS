"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/session";
import {
  commitCategoryImport,
  previewCategoryImportCsv,
} from "@/server/catalog/category-import";
import {
  commitProductImport,
  previewProductImportCsv,
} from "@/server/catalog/product-import";
import type {
  CategoryImportCommitPayload,
  CategoryImportPreviewState,
  ProductImportCommitPayload,
  ProductImportPreviewState,
} from "@/server/catalog/types";

export async function validateProductImport(
  _previousState: ProductImportPreviewState,
  formData: FormData,
): Promise<ProductImportPreviewState> {
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

  const preview = await previewProductImportCsv(await file.text());
  const errorCount = preview.rows.reduce((count, row) => count + row.errors.length, 0);

  return {
    status: "preview",
    message:
      errorCount > 0
        ? `${errorCount} validation issue${errorCount === 1 ? "" : "s"} found.`
        : `${preview.rows.length} product row${preview.rows.length === 1 ? "" : "s"} ready to import.`,
    rows: preview.rows,
    importToken: preview.importToken,
  };
}

export async function importProducts(
  _previousState: ProductImportPreviewState,
  formData: FormData,
): Promise<ProductImportPreviewState> {
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
    const payload = JSON.parse(payloadValue) as ProductImportCommitPayload;
    const result = await commitProductImport(payload);

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/import");

    return {
      status: "imported",
      message: `Product import completed. Created ${result.created}, updated ${result.updated}.`,
      rows: [],
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not import products.",
      rows: [],
    };
  }
}

export async function validateCategoryImport(
  _previousState: CategoryImportPreviewState,
  formData: FormData,
): Promise<CategoryImportPreviewState> {
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

  const preview = await previewCategoryImportCsv(await file.text());
  const errorCount = preview.rows.reduce((count, row) => count + row.errors.length, 0);

  return {
    status: "preview",
    message:
      errorCount > 0
        ? `${errorCount} validation issue${errorCount === 1 ? "" : "s"} found.`
        : `${preview.rows.length} categor${preview.rows.length === 1 ? "y" : "ies"} ready to import.`,
    rows: preview.rows,
    importToken: preview.importToken,
  };
}

export async function importCategories(
  _previousState: CategoryImportPreviewState,
  formData: FormData,
): Promise<CategoryImportPreviewState> {
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
    const payload = JSON.parse(payloadValue) as CategoryImportCommitPayload;
    const result = await commitCategoryImport(payload);

    revalidatePath("/admin/products/categories");
    revalidatePath("/admin/products/import");

    return {
      status: "imported",
      message: `Category import completed. Created ${result.created}, updated ${result.updated}.`,
      rows: [],
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not import categories.",
      rows: [],
    };
  }
}
