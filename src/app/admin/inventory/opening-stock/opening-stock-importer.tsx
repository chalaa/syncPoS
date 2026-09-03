"use client";

import { useActionState } from "react";
import { AlertTriangleIcon, CheckCircleIcon, DownloadIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

import {
  importOpeningStock,
  validateOpeningStockImport,
} from "@/app/admin/inventory/opening-stock/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { OpeningStockPreviewState } from "@/server/inventory/types";

const openingStockInitialState: OpeningStockPreviewState = {
  status: "idle",
  rows: [],
};

function hasErrors(rows: { errors: string[] }[]) {
  return rows.some((row) => row.errors.length > 0);
}

function csvValue(value: string | number) {
  const text = String(value);

  return `"${text.replace(/"/g, "\"\"")}"`;
}

function errorReportHref(rows: { rowNumber: number; sku: string; productName: string; ownerName: string; locationCode: string; errors: string[] }[]) {
  const errorRows = rows.flatMap((row) =>
    row.errors.map((error) =>
      [row.rowNumber, row.sku, row.productName, row.ownerName, row.locationCode, error].map(csvValue).join(","),
    ),
  );
  const csv = ["row,item_code,product_name,owner_name,location_code,error", ...errorRows].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function OpeningStockImporter() {
  const [previewState, validateAction, isValidating] = useActionState(
    validateOpeningStockImport,
    openingStockInitialState,
  );
  const [importState, importAction, isImporting] = useActionState(
    importOpeningStock,
    openingStockInitialState,
  );
  const importCompleted = importState.status === "imported";
  const previewRows = importCompleted ? [] : previewState.rows ?? [];
  const hasPreviewErrors = hasErrors(previewRows);
  const canImport =
    !importCompleted &&
    previewState.status === "preview" &&
    previewRows.length > 0 &&
    !hasPreviewErrors &&
    previewState.importToken;
  const payload = canImport
    ? JSON.stringify({
        importToken: previewState.importToken,
        rows: previewRows,
      })
    : "";

  return (
    <div className="flex flex-col gap-5">
      {previewState.message && !importCompleted ? (
        <Alert kind={hasPreviewErrors ? "error" : "success"}>
          {previewState.message}
        </Alert>
      ) : null}
      {importState.message ? (
        <Alert kind={importState.status === "imported" ? "success" : "error"}>
          {importState.message}
        </Alert>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Import file</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload the CSV template after filling products, owners, locations, quantities, costs, and serial numbers.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/inventory/opening-stock/template">
              <DownloadIcon data-icon="inline-start" />
              Template
            </Link>
          </Button>
        </div>

        <form action={validateAction} className="mt-5 flex flex-col gap-4 sm:flex-row">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            className="min-h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button disabled={isValidating}>
            <UploadIcon data-icon="inline-start" />
            {isValidating ? "Validating..." : "Validate preview"}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold">Validation preview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Fix all row errors before importing opening balances.
            </p>
          </div>
          <form action={importAction}>
            <input type="hidden" name="payload" value={payload} />
            <div className="flex flex-wrap justify-end gap-2">
              {hasPreviewErrors ? (
                <Button asChild variant="outline">
                  <a
                    href={errorReportHref(previewRows)}
                    download="opening-stock-error-report.csv"
                  >
                    <DownloadIcon data-icon="inline-start" />
                    Error report
                  </a>
                </Button>
              ) : null}
              <Button disabled={!canImport || isImporting}>
                <CheckCircleIcon data-icon="inline-start" />
                {isImporting ? "Importing..." : "Import opening stock"}
              </Button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Unit cost</th>
                <th className="px-4 py-3">Serial</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.sku}-${row.serialNo}`} className="border-t border-border">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3 font-medium">{row.sku || "Missing"}</td>
                  <td className="px-4 py-3">
                    <div>{row.productName || "Unknown product"}</div>
                    <div className="text-xs text-muted-foreground">{row.trackingMode}</div>
                  </td>
                  <td className="px-4 py-3">{row.ownerName || "Missing"}</td>
                  <td className="px-4 py-3">
                    <div>{row.locationCode || "Missing"}</div>
                    <div className="text-xs text-muted-foreground">{row.locationName}</div>
                  </td>
                  <td className="px-4 py-3 text-right">{row.quantity}</td>
                  <td className="px-4 py-3 text-right">{row.unitCost}</td>
                  <td className="px-4 py-3">{row.serialNo || "-"}</td>
                  <td className="px-4 py-3">
                    {row.errors.length > 0 ? (
                      <div className="flex flex-col gap-1 text-destructive">
                        {row.errors.map((error) => (
                          <span key={error} className="inline-flex items-center gap-1">
                            <AlertTriangleIcon data-icon="inline-start" />
                            {error}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Ready</span>
                    )}
                  </td>
                </tr>
              ))}
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                    Upload a CSV file to preview opening stock rows.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
