"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/session";
import {
  commitProductTemplateImport,
  previewProductTemplateImportCsv,
} from "@/server/catalog/product-template-import";
import type {
  ProductTemplateImportCommitPayload,
  ProductTemplateImportPreviewState,
} from "@/server/catalog/types";

export async function validateProductTemplateImport(
  _previousState: ProductTemplateImportPreviewState,
  formData: FormData,
): Promise<ProductTemplateImportPreviewState> {
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

  const preview = await previewProductTemplateImportCsv(await file.text());
  const errorCount = preview.rows.reduce((count, row) => count + row.errors.length, 0);

  return {
    status: "preview",
    message:
      errorCount > 0
        ? `${errorCount} validation issue${errorCount === 1 ? "" : "s"} found.`
        : `${preview.rows.length} template variant row${preview.rows.length === 1 ? "" : "s"} ready to import.`,
    rows: preview.rows,
    importToken: preview.importToken,
  };
}

export async function importProductTemplates(
  _previousState: ProductTemplateImportPreviewState,
  formData: FormData,
): Promise<ProductTemplateImportPreviewState> {
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
    const payload = JSON.parse(payloadValue) as ProductTemplateImportCommitPayload;
    const result = await commitProductTemplateImport(payload);

    revalidatePath("/admin/products");
    revalidatePath("/admin/products/import/templates");
    revalidatePath("/admin/products/templates");

    return {
      status: "imported",
      message: `Product template import completed. Created ${result.created}, updated ${result.updated}, generated ${result.variantsCreated} variants.`,
      rows: [],
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not import product templates.",
      rows: [],
    };
  }
}
