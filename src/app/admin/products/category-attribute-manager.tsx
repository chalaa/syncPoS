"use client";

import { PlusIcon } from "lucide-react";

import { assignCategoryAttribute } from "@/app/admin/products/actions";
import { Button } from "@/components/ui/button";
import type {
  CatalogAttributeRecord,
  CatalogReferenceRecord,
  CategoryAttributeRecord,
} from "@/server/catalog/types";

const inputClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

type CategoryAttributeManagerProps = {
  categories: CatalogReferenceRecord[];
  attributes: CatalogAttributeRecord[];
  assignments: CategoryAttributeRecord[];
  returnPath: string;
};

export function CategoryAttributeManager({
  categories,
  attributes,
  assignments,
  returnPath,
}: CategoryAttributeManagerProps) {
  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold">Category Attributes</h2>
        <p className="text-sm text-muted-foreground">
          Define the selectable attributes that product templates inherit from each category.
        </p>
      </div>

      <form action={assignCategoryAttribute} className="grid gap-3 border-b border-border p-4 lg:grid-cols-[1fr_1fr_8rem_auto_auto]">
        <input type="hidden" name="returnPath" value={returnPath} />
        <label className="grid gap-1 text-sm font-medium">
          Category
          <select name="categoryId" required className={inputClass}>
            <option value="">Select category</option>
            {categories.filter((category) => category.isActive).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Attribute
          <select name="attributeId" required className={inputClass}>
            <option value="">Select attribute</option>
            {attributes.filter((attribute) => attribute.isActive).map((attribute) => (
              <option key={attribute.id} value={attribute.id}>
                {attribute.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Sequence
          <input name="sortOrder" type="number" min="0" defaultValue="0" className={inputClass} />
        </label>
        <label className="mt-7 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="isRequired" className="size-4" />
          Required
        </label>
        <Button className="mt-6">
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Attribute</th>
              <th className="px-4 py-3">Required</th>
              <th className="px-4 py-3">Sequence</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{assignment.categoryName}</td>
                <td className="px-4 py-3">{assignment.attributeName}</td>
                <td className="px-4 py-3">{assignment.isRequired ? "Yes" : "No"}</td>
                <td className="px-4 py-3">{assignment.sortOrder}</td>
              </tr>
            ))}
            {assignments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No category attributes assigned yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
