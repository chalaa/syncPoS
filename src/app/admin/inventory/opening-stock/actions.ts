"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/server/auth/session";
import {
  commitOpeningStockImport,
  previewOpeningStockCsv,
} from "@/server/inventory/opening-stock";
import type {
  OpeningStockCommitPayload,
  OpeningStockPreviewState,
} from "@/server/inventory/types";

export const openingStockInitialState: OpeningStockPreviewState = {
  status: "idle",
  rows: [],
};

export async function validateOpeningStockImport(
  _previousState: OpeningStockPreviewState,
  formData: FormData,
): Promise<OpeningStockPreviewState> {
  await requirePermission("inventory.receive");

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

  const text = await file.text();
  const preview = await previewOpeningStockCsv(text);
  const errorCount = preview.rows.reduce((count, row) => count + row.errors.length, 0);

  return {
    status: "preview",
    message:
      errorCount > 0
        ? `${errorCount} validation issue${errorCount === 1 ? "" : "s"} found.`
        : `${preview.rows.length} row${preview.rows.length === 1 ? "" : "s"} ready to import.`,
    rows: preview.rows,
    importToken: preview.importToken,
  };
}

export async function importOpeningStock(
  _previousState: OpeningStockPreviewState,
  formData: FormData,
): Promise<OpeningStockPreviewState> {
  const user = await requirePermission("inventory.receive");
  const payloadValue = formData.get("payload");

  if (typeof payloadValue !== "string") {
    return {
      status: "error",
      message: "Import payload is missing. Validate the file again.",
      rows: [],
    };
  }

  try {
    const payload = JSON.parse(payloadValue) as OpeningStockCommitPayload;
    const result = await commitOpeningStockImport(payload, user.id);

    revalidatePath("/admin/inventory");
    revalidatePath("/admin/inventory/opening-stock");

    return {
      status: "imported",
      message: `Opening stock imported as movement ${result.movementNo}.`,
      rows: [],
      movementNo: result.movementNo,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not import opening stock.",
      rows: [],
    };
  }
}
