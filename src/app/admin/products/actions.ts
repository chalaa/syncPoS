"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import {
  getDefaultCompany,
  majorToMinor,
  normalizeCode,
  productTypeOptions,
  taxComputationOptions,
  taxScopeOptions,
  trackingModeOptions,
  uniqueViolationMessage,
} from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  brands,
  productCategories,
  products,
  taxes,
  unitsOfMeasure,
} from "@/server/db/schema";
import { requirePermission } from "@/server/auth/session";

const optionalUuid = z.string().uuid().or(z.literal("")).transform((value) => value || null);

const productFormSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().trim().min(1, "SKU is required").max(60),
  barcode: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1, "Name is required").max(200),
  categoryId: optionalUuid,
  brandId: optionalUuid,
  model: z.string().trim().max(100).optional(),
  description: z.string().trim().optional(),
  unitId: z.string().uuid("Unit is required"),
  productType: z.enum(productTypeOptions),
  trackingMode: z.enum(trackingModeOptions),
  standardCost: z.string().trim().default("0"),
  listPrice: z.string().trim().default("0"),
  isActive: z.enum(["on"]).optional(),
});

const referenceSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().optional(),
  isActive: z.enum(["on"]).optional(),
  returnPath: z.string().trim().startsWith("/admin/products").default("/admin/products"),
});

const unitSchema = referenceSchema.extend({
  precision: z.coerce.number().int().min(0).max(6).default(0),
});

const taxSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  scope: z.enum(taxScopeOptions),
  computation: z.enum(taxComputationOptions),
  rate: z.coerce.number().min(0).max(100).default(0),
  amount: z.string().trim().default("0"),
  priceIncluded: z.enum(["on"]).optional(),
  description: z.string().trim().optional(),
  isActive: z.enum(["on"]).optional(),
  returnPath: z.string().trim().startsWith("/admin/products").default("/admin/products/taxes"),
});

function formValue(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

function formPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    sku: formValue(formData, "sku"),
    barcode: formValue(formData, "barcode"),
    name: formValue(formData, "name"),
    categoryId: formValue(formData, "categoryId"),
    brandId: formValue(formData, "brandId"),
    model: formValue(formData, "model"),
    description: formValue(formData, "description"),
    unitId: formValue(formData, "unitId"),
    productType: formValue(formData, "productType"),
    trackingMode: formValue(formData, "trackingMode"),
    standardCost: formValue(formData, "standardCost") || "0",
    listPrice: formValue(formData, "listPrice") || "0",
    isActive: formData.get("isActive") === "on" ? "on" : undefined,
  };
}

function formErrorPath(path: string, error: unknown) {
  const message = error instanceof z.ZodError ? error.issues[0]?.message : String(error);

  return `${path}?error=${encodeURIComponent(message || "Invalid form data")}`;
}

function referencePayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: normalizeCode(formValue(formData, "code")),
    name: formValue(formData, "name"),
    description: formValue(formData, "description"),
    isActive: formData.get("isActive") === "on" ? "on" : undefined,
    returnPath: formValue(formData, "returnPath") || "/admin/products",
  };
}

function unitPayload(formData: FormData) {
  return {
    ...referencePayload(formData),
    precision: formValue(formData, "precision") || "0",
  };
}

function taxPayload(formData: FormData) {
  return {
    id: formValue(formData, "id") || undefined,
    code: normalizeCode(formValue(formData, "code")),
    name: formValue(formData, "name"),
    scope: formValue(formData, "scope") || "purchase",
    computation: formValue(formData, "computation") || "percent",
    rate: formValue(formData, "rate") || "0",
    amount: formValue(formData, "amount") || "0",
    priceIncluded: formData.get("priceIncluded") === "on" ? "on" : undefined,
    description: formValue(formData, "description"),
    isActive: formData.get("isActive") === "on" ? "on" : undefined,
    returnPath: formValue(formData, "returnPath") || "/admin/products/taxes",
  };
}

function redirectWithMessage(path: string, key: "notice" | "error", message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(message)}`);
}

export async function createProduct(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = productFormSchema.safeParse(formPayload(formData));

  if (!parsed.success) {
    redirect(formErrorPath("/admin/products/new", parsed.error));
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(products).values({
      companyId: company.id,
      sku: parsed.data.sku,
      barcode: parsed.data.barcode || null,
      name: parsed.data.name,
      categoryId: parsed.data.categoryId,
      brandId: parsed.data.brandId,
      model: parsed.data.model || null,
      description: parsed.data.description || null,
      unitId: parsed.data.unitId,
      productType: parsed.data.productType,
      trackingMode: parsed.data.trackingMode,
      standardCostMinor: majorToMinor(parsed.data.standardCost),
      listPriceMinor: majorToMinor(parsed.data.listPrice),
      currencyCode: company.baseCurrencyCode,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirect(
      `/admin/products/new?error=${encodeURIComponent(
        uniqueViolationMessage(error, "Could not create product."),
      )}`,
    );
  }

  revalidatePath("/admin/products");
  redirect("/admin/products?notice=Product created");
}

export async function updateProduct(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = productFormSchema.safeParse(formPayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirect(formErrorPath("/admin/products", parsed.success ? "Product ID is missing" : parsed.error));
  }

  try {
    await db
      .update(products)
      .set({
        sku: parsed.data.sku,
        barcode: parsed.data.barcode || null,
        name: parsed.data.name,
        categoryId: parsed.data.categoryId,
        brandId: parsed.data.brandId,
        model: parsed.data.model || null,
        description: parsed.data.description || null,
        unitId: parsed.data.unitId,
        productType: parsed.data.productType,
        trackingMode: parsed.data.trackingMode,
        standardCostMinor: majorToMinor(parsed.data.standardCost),
        listPriceMinor: majorToMinor(parsed.data.listPrice),
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(products.id, parsed.data.id));
  } catch (error) {
    redirect(
      `/admin/products/${parsed.data.id}/edit?error=${encodeURIComponent(
        uniqueViolationMessage(error, "Could not update product."),
      )}`,
    );
  }

  revalidatePath("/admin/products");
  redirect("/admin/products?notice=Product updated");
}

export async function softDeleteProduct(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");

  if (!id) {
    redirect("/admin/products?error=Product ID is missing");
  }

  await db
    .update(products)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from product admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, id));

  revalidatePath("/admin/products");
  redirect("/admin/products?notice=Product deleted");
}

export async function restoreProduct(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");

  if (!id) {
    redirect("/admin/products?show=deleted&error=Product ID is missing");
  }

  await db
    .update(products)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(products.id, id));

  revalidatePath("/admin/products");
  redirect("/admin/products?show=deleted&notice=Product restored");
}

export async function createTax(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = taxSchema.safeParse(taxPayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/products/taxes", "error", parsed.error.issues[0]?.message ?? "Tax details are required");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(taxes).values({
      companyId: company.id,
      code: parsed.data.code,
      name: parsed.data.name,
      scope: parsed.data.scope,
      computation: parsed.data.computation,
      rate: String(parsed.data.rate),
      amountMinor: majorToMinor(parsed.data.amount),
      priceIncluded: parsed.data.priceIncluded === "on",
      description: parsed.data.description || null,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create tax."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/taxes");
  redirectWithMessage(parsed.data.returnPath, "notice", "Tax created");
}

export async function updateTax(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = taxSchema.safeParse(taxPayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/products/taxes", "error", parsed.success ? "Tax ID is missing" : (parsed.error.issues[0]?.message ?? "Tax details are required"));
  }

  try {
    await db
      .update(taxes)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        scope: parsed.data.scope,
        computation: parsed.data.computation,
        rate: String(parsed.data.rate),
        amountMinor: majorToMinor(parsed.data.amount),
        priceIncluded: parsed.data.priceIncluded === "on",
        description: parsed.data.description || null,
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(taxes.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update tax."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/taxes");
  redirectWithMessage(parsed.data.returnPath, "notice", "Tax updated");
}

export async function softDeleteTax(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/taxes";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Tax ID is missing");
  }

  await db
    .update(taxes)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from tax admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(taxes.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/taxes");
  redirectWithMessage(returnPath, "notice", "Tax deleted");
}

export async function restoreTax(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/taxes?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Tax ID is missing");
  }

  await db
    .update(taxes)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(taxes.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/taxes");
  redirectWithMessage(returnPath, "notice", "Tax restored");
}

export async function createCategory(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = referenceSchema.safeParse(referencePayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/products/categories", "error", "Category code and name are required");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(productCategories).values({
      companyId: company.id,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create category."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/categories");
  redirectWithMessage(parsed.data.returnPath, "notice", "Category created");
}

export async function createBrand(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = referenceSchema.safeParse(referencePayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/products/brands", "error", "Brand code and name are required");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(brands).values({
      companyId: company.id,
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create brand."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/brands");
  redirectWithMessage(parsed.data.returnPath, "notice", "Brand created");
}

export async function createUnit(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = unitSchema.safeParse(unitPayload(formData));

  if (!parsed.success) {
    redirectWithMessage("/admin/products/units", "error", "Unit code, name, and precision are required");
  }

  const company = await getDefaultCompany();

  try {
    await db.insert(unitsOfMeasure).values({
      companyId: company.id,
      code: parsed.data.code,
      name: parsed.data.name,
      precision: parsed.data.precision,
      isActive: parsed.data.isActive === "on",
    });
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not create unit."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/units");
  redirectWithMessage(parsed.data.returnPath, "notice", "Unit created");
}

export async function updateCategory(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = referenceSchema.safeParse(referencePayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/products/categories", "error", "Category ID, code, and name are required");
  }

  try {
    await db
      .update(productCategories)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(productCategories.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update category."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/categories");
  redirectWithMessage(parsed.data.returnPath, "notice", "Category updated");
}

export async function updateBrand(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = referenceSchema.safeParse(referencePayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/products/brands", "error", "Brand ID, code, and name are required");
  }

  try {
    await db
      .update(brands)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(brands.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update brand."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/brands");
  redirectWithMessage(parsed.data.returnPath, "notice", "Brand updated");
}

export async function updateUnit(formData: FormData) {
  await requirePermission("product.manage");

  const parsed = unitSchema.safeParse(unitPayload(formData));

  if (!parsed.success || !parsed.data.id) {
    redirectWithMessage("/admin/products/units", "error", "Unit ID, code, name, and precision are required");
  }

  try {
    await db
      .update(unitsOfMeasure)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        precision: parsed.data.precision,
        isActive: parsed.data.isActive === "on",
        updatedAt: sql`now()`,
      })
      .where(eq(unitsOfMeasure.id, parsed.data.id));
  } catch (error) {
    redirectWithMessage(parsed.data.returnPath, "error", uniqueViolationMessage(error, "Could not update unit."));
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/units");
  redirectWithMessage(parsed.data.returnPath, "notice", "Unit updated");
}

export async function softDeleteCategory(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/categories";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Category ID is missing");
  }

  await db
    .update(productCategories)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from category admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(productCategories.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/categories");
  redirectWithMessage(returnPath, "notice", "Category deleted");
}

export async function restoreCategory(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/categories?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Category ID is missing");
  }

  await db
    .update(productCategories)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(productCategories.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/categories");
  redirectWithMessage(returnPath, "notice", "Category restored");
}

export async function softDeleteBrand(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/brands";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Brand ID is missing");
  }

  await db
    .update(brands)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from brand admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(brands.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/brands");
  redirectWithMessage(returnPath, "notice", "Brand deleted");
}

export async function restoreBrand(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/brands?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Brand ID is missing");
  }

  await db
    .update(brands)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(brands.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/brands");
  redirectWithMessage(returnPath, "notice", "Brand restored");
}

export async function softDeleteUnit(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/units";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Unit ID is missing");
  }

  await db
    .update(unitsOfMeasure)
    .set({
      deletedAt: sql`now()`,
      deleteReason: "Deleted from unit admin screen",
      updatedAt: sql`now()`,
    })
    .where(eq(unitsOfMeasure.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/units");
  redirectWithMessage(returnPath, "notice", "Unit deleted");
}

export async function restoreUnit(formData: FormData) {
  await requirePermission("product.manage");

  const id = formValue(formData, "id");
  const returnPath = formValue(formData, "returnPath") || "/admin/products/units?show=deleted";

  if (!id) {
    redirectWithMessage(returnPath, "error", "Unit ID is missing");
  }

  await db
    .update(unitsOfMeasure)
    .set({
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
      updatedAt: sql`now()`,
    })
    .where(eq(unitsOfMeasure.id, id));

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/units");
  redirectWithMessage(returnPath, "notice", "Unit restored");
}
