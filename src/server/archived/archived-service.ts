import { and, eq, isNotNull } from "drizzle-orm";

import { getDefaultCompany } from "@/server/catalog/products";
import { db } from "@/server/db/client";
import {
  brands,
  expenseCategories,
  expenses,
  locations,
  owners,
  partners,
  paymentAccounts,
  paymentTerms,
  productCategories,
  products,
  purchaseOrders,
  salesOrders,
  taxes,
} from "@/server/db/schema";

export type EntityType =
  | "product"
  | "sales_order"
  | "purchase_order"
  | "expense"
  | "partner"
  | "location"
  | "product_category"
  | "expense_category"
  | "brand"
  | "payment_term"
  | "owner"
  | "payment_account"
  | "tax";

export type TypeGroup =
  | "all"
  | "products"
  | "sales_orders"
  | "purchase_orders"
  | "expenses"
  | "partners"
  | "locations_config";

export type ArchivedItem = {
  id: string;
  entityType: EntityType;
  typeGroup: Exclude<TypeGroup, "all">;
  typeName: string;
  title: string;
  codeOrNumber: string;
  details?: string;
  amountFormatted?: string;
  deletedAt: Date;
  statusContext?: string;
};

function formatMoney(minor: number, currency: string = "ETB"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export async function getArchivedSummary({
  query = "",
  group = "all",
}: {
  query?: string;
  group?: TypeGroup;
}) {
  const company = await getDefaultCompany();
  const q = query.trim().toLowerCase();

  const [
    rawProducts,
    rawSalesOrders,
    rawPurchaseOrders,
    rawExpenses,
    rawPartners,
    rawLocations,
    rawProdCategories,
    rawExpCategories,
    rawBrands,
    rawPayTerms,
    rawOwners,
    rawPayAccounts,
    rawTaxes,
  ] = await Promise.all([
    db
      .select({
        id: products.id,
        code: products.sku,
        name: products.name,
        deletedAt: products.deletedAt,
        catName: productCategories.name,
        isActive: products.isActive,
      })
      .from(products)
      .leftJoin(productCategories, eq(products.categoryId, productCategories.id))
      .where(and(eq(products.companyId, company.id), isNotNull(products.deletedAt))),

    db
      .select({
        id: salesOrders.id,
        orderNo: salesOrders.orderNo,
        totalMinor: salesOrders.totalMinor,
        currencyCode: salesOrders.currencyCode,
        status: salesOrders.status,
        deletedAt: salesOrders.deletedAt,
        customerName: partners.displayName,
      })
      .from(salesOrders)
      .leftJoin(partners, eq(salesOrders.customerId, partners.id))
      .where(and(eq(salesOrders.companyId, company.id), isNotNull(salesOrders.deletedAt))),

    db
      .select({
        id: purchaseOrders.id,
        orderNo: purchaseOrders.orderNo,
        totalMinor: purchaseOrders.totalMinor,
        currencyCode: purchaseOrders.currencyCode,
        status: purchaseOrders.status,
        deletedAt: purchaseOrders.deletedAt,
        supplierName: partners.displayName,
      })
      .from(purchaseOrders)
      .leftJoin(partners, eq(purchaseOrders.supplierId, partners.id))
      .where(and(eq(purchaseOrders.companyId, company.id), isNotNull(purchaseOrders.deletedAt))),

    db
      .select({
        id: expenses.id,
        expenseNo: expenses.expenseNo,
        amountMinor: expenses.amountMinor,
        currencyCode: expenses.currencyCode,
        deletedAt: expenses.deletedAt,
        description: expenses.description,
        catName: expenseCategories.name,
      })
      .from(expenses)
      .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
      .where(and(eq(expenses.companyId, company.id), isNotNull(expenses.deletedAt))),

    db
      .select({
        id: partners.id,
        code: partners.code,
        displayName: partners.displayName,
        deletedAt: partners.deletedAt,
        isCustomer: partners.isCustomer,
        isSupplier: partners.isSupplier,
      })
      .from(partners)
      .where(and(eq(partners.companyId, company.id), isNotNull(partners.deletedAt))),

    db
      .select({
        id: locations.id,
        code: locations.code,
        name: locations.name,
        deletedAt: locations.deletedAt,
        locationType: locations.locationType,
      })
      .from(locations)
      .where(and(eq(locations.companyId, company.id), isNotNull(locations.deletedAt))),

    db
      .select({
        id: productCategories.id,
        code: productCategories.code,
        name: productCategories.name,
        deletedAt: productCategories.deletedAt,
      })
      .from(productCategories)
      .where(and(eq(productCategories.companyId, company.id), isNotNull(productCategories.deletedAt))),

    db
      .select({
        id: expenseCategories.id,
        code: expenseCategories.code,
        name: expenseCategories.name,
        deletedAt: expenseCategories.deletedAt,
      })
      .from(expenseCategories)
      .where(and(eq(expenseCategories.companyId, company.id), isNotNull(expenseCategories.deletedAt))),

    db
      .select({
        id: brands.id,
        code: brands.code,
        name: brands.name,
        deletedAt: brands.deletedAt,
      })
      .from(brands)
      .where(and(eq(brands.companyId, company.id), isNotNull(brands.deletedAt))),

    db
      .select({
        id: paymentTerms.id,
        code: paymentTerms.code,
        name: paymentTerms.name,
        deletedAt: paymentTerms.deletedAt,
      })
      .from(paymentTerms)
      .where(and(eq(paymentTerms.companyId, company.id), isNotNull(paymentTerms.deletedAt))),

    db
      .select({
        id: owners.id,
        name: owners.name,
        deletedAt: owners.deletedAt,
      })
      .from(owners)
      .where(and(eq(owners.companyId, company.id), isNotNull(owners.deletedAt))),

    db
      .select({
        id: paymentAccounts.id,
        code: paymentAccounts.code,
        name: paymentAccounts.name,
        deletedAt: paymentAccounts.deletedAt,
      })
      .from(paymentAccounts)
      .where(and(eq(paymentAccounts.companyId, company.id), isNotNull(paymentAccounts.deletedAt))),

    db
      .select({
        id: taxes.id,
        code: taxes.code,
        name: taxes.name,
        deletedAt: taxes.deletedAt,
      })
      .from(taxes)
      .where(and(eq(taxes.companyId, company.id), isNotNull(taxes.deletedAt))),
  ]);

  const items: ArchivedItem[] = [];

  for (const item of rawProducts) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "product",
        typeGroup: "products",
        typeName: "Product",
        title: item.name,
        codeOrNumber: item.code,
        details: item.catName ? `Category: ${item.catName}` : undefined,
        deletedAt: item.deletedAt,
        statusContext: item.isActive ? "Active before delete" : "Inactive",
      });
    }
  }

  for (const item of rawSalesOrders) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "sales_order",
        typeGroup: "sales_orders",
        typeName: "Sales Order",
        title: `Sales Order #${item.orderNo}`,
        codeOrNumber: item.orderNo,
        details: item.customerName ? `Customer: ${item.customerName}` : undefined,
        amountFormatted: formatMoney(item.totalMinor, item.currencyCode),
        deletedAt: item.deletedAt,
        statusContext: `Status: ${item.status}`,
      });
    }
  }

  for (const item of rawPurchaseOrders) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "purchase_order",
        typeGroup: "purchase_orders",
        typeName: "Purchase Order",
        title: `Purchase Order #${item.orderNo}`,
        codeOrNumber: item.orderNo,
        details: item.supplierName ? `Supplier: ${item.supplierName}` : undefined,
        amountFormatted: formatMoney(item.totalMinor, item.currencyCode),
        deletedAt: item.deletedAt,
        statusContext: `Status: ${item.status}`,
      });
    }
  }

  for (const item of rawExpenses) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "expense",
        typeGroup: "expenses",
        typeName: "Expense",
        title: item.expenseNo ? `Expense #${item.expenseNo}` : item.catName ?? "Expense",
        codeOrNumber: item.expenseNo ?? item.id.substring(0, 8),
        details: item.description || item.catName || undefined,
        amountFormatted: formatMoney(item.amountMinor, item.currencyCode),
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawPartners) {
    if (item.deletedAt) {
      const roles = [item.isCustomer && "Customer", item.isSupplier && "Supplier"].filter(Boolean).join(" & ");
      items.push({
        id: item.id,
        entityType: "partner",
        typeGroup: "partners",
        typeName: "Partner",
        title: item.displayName,
        codeOrNumber: item.code,
        details: roles || undefined,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawLocations) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "location",
        typeGroup: "locations_config",
        typeName: "Location",
        title: item.name,
        codeOrNumber: item.code,
        details: `Type: ${item.locationType}`,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawProdCategories) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "product_category",
        typeGroup: "locations_config",
        typeName: "Product Category",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawExpCategories) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "expense_category",
        typeGroup: "locations_config",
        typeName: "Expense Category",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawBrands) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "brand",
        typeGroup: "locations_config",
        typeName: "Brand",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawPayTerms) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "payment_term",
        typeGroup: "locations_config",
        typeName: "Payment Term",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawOwners) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "owner",
        typeGroup: "locations_config",
        typeName: "Beneficial Owner",
        title: item.name,
        codeOrNumber: "OWNER",
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawPayAccounts) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "payment_account",
        typeGroup: "locations_config",
        typeName: "Payment Account",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  for (const item of rawTaxes) {
    if (item.deletedAt) {
      items.push({
        id: item.id,
        entityType: "tax",
        typeGroup: "locations_config",
        typeName: "Tax Rate",
        title: item.name,
        codeOrNumber: item.code,
        deletedAt: item.deletedAt,
      });
    }
  }

  // Calculate counts per group
  const counts = {
    all: items.length,
    products: items.filter((i) => i.typeGroup === "products").length,
    sales_orders: items.filter((i) => i.typeGroup === "sales_orders").length,
    purchase_orders: items.filter((i) => i.typeGroup === "purchase_orders").length,
    expenses: items.filter((i) => i.typeGroup === "expenses").length,
    partners: items.filter((i) => i.typeGroup === "partners").length,
    locations_config: items.filter((i) => i.typeGroup === "locations_config").length,
  };

  // Filter by group tab
  let filtered = group === "all" ? items : items.filter((i) => i.typeGroup === group);

  // Filter by search query
  if (q) {
    filtered = filtered.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.codeOrNumber.toLowerCase().includes(q) ||
        item.typeName.toLowerCase().includes(q) ||
        (item.details && item.details.toLowerCase().includes(q)) ||
        (item.statusContext && item.statusContext.toLowerCase().includes(q)),
    );
  }

  // Sort descending by deletedAt
  filtered.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());

  return {
    items: filtered,
    counts,
  };
}
