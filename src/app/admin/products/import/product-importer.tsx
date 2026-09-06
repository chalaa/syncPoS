"use client";

import { useActionState } from "react";
import { AlertTriangleIcon, CheckCircleIcon, DownloadIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

import {
  importCategories,
  importProducts,
  validateCategoryImport,
  validateProductImport,
} from "@/app/admin/products/import/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CategoryImportPreviewState, ProductImportPreviewState } from "@/server/catalog/types";

const productImportInitialState: ProductImportPreviewState = {
  status: "idle",
  rows: [],
};

const categoryImportInitialState: CategoryImportPreviewState = {
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

function errorReportHref(
  rows: { rowNumber: number; sku: string; productName: string; errors: string[] }[],
) {
  const errorRows = rows.flatMap((row) =>
    row.errors.map((error) =>
      [row.rowNumber, row.sku, row.productName, error].map(csvValue).join(","),
    ),
  );
  const csv = ["row,item_code,product_name,error", ...errorRows].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function categoryErrorReportHref(
  rows: { rowNumber: number; code: string; name: string; errors: string[] }[],
) {
  const errorRows = rows.flatMap((row) =>
    row.errors.map((error) =>
      [row.rowNumber, row.code, row.name, error].map(csvValue).join(","),
    ),
  );
  const csv = ["row,code,name,error", ...errorRows].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

function moneyMinor(value: number) {
  return (value / 100).toFixed(2);
}

export function ProductImporter() {
  const [previewState, validateAction, isValidating] = useActionState(
    validateProductImport,
    productImportInitialState,
  );
  const [importState, importAction, isImporting] = useActionState(
    importProducts,
    productImportInitialState,
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
      {previewState.message ? (
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
              Upload the product template after filling product names, units, tracking modes, prices, taxes, and JSON specifications.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/products/import/template">
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
              Product rows are imported only after every validation issue is fixed.
            </p>
          </div>
          <form action={importAction}>
            <input type="hidden" name="payload" value={payload} />
            <div className="flex flex-wrap justify-end gap-2">
              {hasPreviewErrors ? (
                <Button asChild variant="outline">
                  <a href={errorReportHref(previewRows)} download="product-import-error-report.csv">
                    <DownloadIcon data-icon="inline-start" />
                    Error report
                  </a>
                </Button>
              ) : null}
              <Button disabled={!canImport || isImporting}>
                <CheckCircleIcon data-icon="inline-start" />
                {isImporting ? "Importing..." : "Import products"}
              </Button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1260px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Tracking</th>
                <th className="px-4 py-3 text-right">Sale Price</th>
                <th className="px-4 py-3 text-right">Purchase Cost</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.sku || row.productName}`} className="border-t border-border">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3 capitalize">{row.action}</td>
                  <td className="px-4 py-3 font-medium">{row.sku || "Auto"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.productName || "Missing"}</div>
                    <div className="text-xs text-muted-foreground">{row.model || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{row.categoryName || row.category || "-"}</td>
                  <td className="px-4 py-3">{row.brandName || row.brand || "-"}</td>
                  <td className="px-4 py-3">{row.unitName || row.unit || "Missing"}</td>
                  <td className="px-4 py-3">{row.trackingMode || "Missing"}</td>
                  <td className="px-4 py-3 text-right">{moneyMinor(row.listPriceMinor)}</td>
                  <td className="px-4 py-3 text-right">{moneyMinor(row.standardCostMinor)}</td>
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
                  <td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                    Upload a CSV file to preview product rows.
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

export function CategoryImporter() {
  const [previewState, validateAction, isValidating] = useActionState(
    validateCategoryImport,
    categoryImportInitialState,
  );
  const [importState, importAction, isImporting] = useActionState(
    importCategories,
    categoryImportInitialState,
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
      {previewState.message ? (
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
            <h2 className="text-base font-semibold">Category import file</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload categories with specification names as JSON, for example {`["Power","Voltage","Fuel Type"]`}.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/products/import/category-template">
              <DownloadIcon data-icon="inline-start" />
              Category template
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
            <h2 className="text-base font-semibold">Category validation preview</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Categories are imported only after every validation issue is fixed.
            </p>
          </div>
          <form action={importAction}>
            <input type="hidden" name="payload" value={payload} />
            <div className="flex flex-wrap justify-end gap-2">
              {hasPreviewErrors ? (
                <Button asChild variant="outline">
                  <a href={categoryErrorReportHref(previewRows)} download="category-import-error-report.csv">
                    <DownloadIcon data-icon="inline-start" />
                    Error report
                  </a>
                </Button>
              ) : null}
              <Button disabled={!canImport || isImporting}>
                <CheckCircleIcon data-icon="inline-start" />
                {isImporting ? "Importing..." : "Import categories"}
              </Button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Specifications</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${row.code || row.name}`} className="border-t border-border">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3 capitalize">{row.action}</td>
                  <td className="px-4 py-3 font-medium">{row.code || "Auto"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.name || "Missing"}</div>
                    <div className="text-xs text-muted-foreground">{row.description || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    {row.specificationSchema.length > 0
                      ? row.specificationSchema.map((field) => field.label).join(", ")
                      : "-"}
                  </td>
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
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Upload a CSV file to preview category rows.
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
