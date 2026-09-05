"use client";

import { useActionState } from "react";
import { AlertTriangleIcon, CheckCircleIcon, DownloadIcon, UploadIcon } from "lucide-react";
import Link from "next/link";

import {
  importCategoryAttributes,
  validateCategoryAttributeImport,
} from "@/app/admin/products/import/category-attributes/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { CategoryAttributeImportPreviewState } from "@/server/catalog/types";

const initialState: CategoryAttributeImportPreviewState = {
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
  rows: {
    rowNumber: number;
    categoryCode: string;
    categoryName: string;
    attributeCode: string;
    attributeName: string;
    value: string;
    errors: string[];
  }[],
) {
  const errorRows = rows.flatMap((row) =>
    row.errors.map((error) =>
      [
        row.rowNumber,
        row.categoryCode,
        row.categoryName,
        row.attributeCode,
        row.attributeName,
        row.value,
        error,
      ].map(csvValue).join(","),
    ),
  );
  const csv = [
    "row,category_code,category_name,attribute_code,attribute_name,value,error",
    ...errorRows,
  ].join("\n");

  return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
}

export function CategoryAttributeImporter() {
  const [previewState, validateAction, isValidating] = useActionState(validateCategoryAttributeImport, initialState);
  const [importState, importAction, isImporting] = useActionState(importCategoryAttributes, initialState);
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
              Upload category attributes and values before importing product templates.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/products/import/category-attributes/template">
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
              Existing records are reused. Same category, attribute, and value cannot appear twice in one file.
            </p>
          </div>
          <form action={importAction}>
            <input type="hidden" name="payload" value={payload} />
            <div className="flex flex-wrap justify-end gap-2">
              {hasPreviewErrors ? (
                <Button asChild variant="outline">
                  <a href={errorReportHref(previewRows)} download="category-attribute-import-error-report.csv">
                    <DownloadIcon data-icon="inline-start" />
                    Error report
                  </a>
                </Button>
              ) : null}
              <Button disabled={!canImport || isImporting}>
                <CheckCircleIcon data-icon="inline-start" />
                {isImporting ? "Importing..." : "Import configuration"}
              </Button>
            </div>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Attribute</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Required</th>
                <th className="px-4 py-3">Sequence</th>
                <th className="px-4 py-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.rowNumber}-${rowKey(row)}`} className="border-t border-border">
                  <td className="px-4 py-3">{row.rowNumber}</td>
                  <td className="px-4 py-3 capitalize">{row.action}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.categoryName || "Missing"}</div>
                    <div className="text-xs text-muted-foreground">{row.categoryCode || "-"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.attributeName || "Missing"}</div>
                    <div className="text-xs text-muted-foreground">{row.attributeCode || "-"}</div>
                  </td>
                  <td className="px-4 py-3">{row.value || "Missing"}</td>
                  <td className="px-4 py-3">{row.isRequired ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{row.sortOrder}</td>
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
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Upload a CSV file to preview category attributes and values.
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

function rowKey(row: { categoryCode: string; attributeCode: string; value: string }) {
  return `${row.categoryCode}-${row.attributeCode}-${row.value}`;
}
