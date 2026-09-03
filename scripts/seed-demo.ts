import "dotenv/config";

import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  auditLogs,
  brands,
  companies,
  customerInvoices,
  customerInvoiceLines,
  expenseCategories,
  expenses,
  owners,
  partners,
  paymentAccounts,
  paymentAllocations,
  paymentMethods,
  payments,
  paymentTerms,
  priceListItems,
  priceLists,
  productCategories,
  productLots,
  productPurchaseTaxes,
  productSaleTaxes,
  products,
  productSerials,
  purchaseOrderLines,
  purchaseOrderLineTaxes,
  purchaseOrders,
  salesOrderLines,
  salesOrderLineTaxes,
  salesOrders,
  stockBalances,
  stockMovementLines,
  stockMovements,
  taxGroups,
  taxes,
  unitsOfMeasure,
  users,
  vendorBillLines,
  vendorBills,
} from "@/server/db/schema";

const databaseUrl = process.env.DATABASE_URL ?? "";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed demo data.");
}

const foundationIds = {
  company: "11111111-1111-4111-8111-111111111111",
  adminUser: "33333333-3333-4333-8333-333333333333",
  defaultOwner: "10101010-1010-4101-8101-101010101010",
  warehouse: "77777777-7777-4777-8777-777777777777",
  displayShop: "88888888-8888-4888-8888-888888888888",
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function uuidFromSeed(value: string) {
  const hash = sha256(value);

  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const ids = {
  categoryMachinery: uuidFromSeed("demo:category:machinery"),
  categoryParts: uuidFromSeed("demo:category:parts"),
  brandCaterpillar: uuidFromSeed("demo:brand:caterpillar"),
  brandPerkins: uuidFromSeed("demo:brand:perkins"),
  unitEach: uuidFromSeed("demo:unit:each"),
  unitLiter: uuidFromSeed("demo:unit:liter"),
  taxGroupVat: uuidFromSeed("demo:tax-group:vat"),
  taxVat15: uuidFromSeed("demo:tax:vat-15"),
  paymentTermCash: uuidFromSeed("demo:payment-term:cash"),
  paymentTermNet15: uuidFromSeed("demo:payment-term:net15"),
  supplier: uuidFromSeed("demo:partner:supplier"),
  customer: uuidFromSeed("demo:partner:customer"),
  cashMethod: uuidFromSeed("demo:payment-method:cash"),
  bankMethod: uuidFromSeed("demo:payment-method:bank"),
  cashAccount: uuidFromSeed("demo:payment-account:cash-main"),
  bankAccount: uuidFromSeed("demo:payment-account:awash"),
  excavator: uuidFromSeed("demo:product:excavator"),
  filter: uuidFromSeed("demo:product:filter"),
  oil: uuidFromSeed("demo:product:oil"),
  excavatorSerial: uuidFromSeed("demo:serial:excavator:001"),
  oilLot: uuidFromSeed("demo:lot:oil:2026-08"),
  priceList: uuidFromSeed("demo:price-list:retail"),
  openingMovement: uuidFromSeed("demo:stock-movement:opening"),
  salesOrder: uuidFromSeed("demo:sales-order:001"),
  salesOrderLineExcavator: uuidFromSeed("demo:sales-order-line:excavator"),
  salesOrderLineFilter: uuidFromSeed("demo:sales-order-line:filter"),
  customerInvoice: uuidFromSeed("demo:customer-invoice:001"),
  customerInvoiceLine: uuidFromSeed("demo:customer-invoice-line:filter"),
  customerPayment: uuidFromSeed("demo:payment:customer:001"),
  customerPaymentAllocation: uuidFromSeed("demo:payment-allocation:customer:001"),
  purchaseOrder: uuidFromSeed("demo:purchase-order:001"),
  purchaseOrderLineFilter: uuidFromSeed("demo:purchase-order-line:filter"),
  vendorBill: uuidFromSeed("demo:vendor-bill:001"),
  vendorBillLine: uuidFromSeed("demo:vendor-bill-line:filter"),
  supplierPayment: uuidFromSeed("demo:payment:supplier:001"),
  supplierPaymentAllocation: uuidFromSeed("demo:payment-allocation:supplier:001"),
  expenseCategory: uuidFromSeed("demo:expense-category:transport"),
  expense: uuidFromSeed("demo:expense:transport:001"),
  expensePayment: uuidFromSeed("demo:payment:expense:001"),
  expensePaymentAllocation: uuidFromSeed("demo:payment-allocation:expense:001"),
  audit: uuidFromSeed("demo:audit:seed"),
};

const currencyCode = "ETB";
const today = new Date();
const todayDate = today.toISOString().slice(0, 10);
const nextWeekDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const nextMonthDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

async function main() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await db.transaction(async (tx) => {
      const [company] = await tx
        .select({ id: companies.id })
        .from(companies)
        .where(eq(companies.id, foundationIds.company))
        .limit(1);
      const [adminUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, foundationIds.adminUser))
        .limit(1);

      if (!company || !adminUser) {
        throw new Error("Foundation seed is required first. Run `pnpm db:seed`, then run `pnpm db:seed:demo`.");
      }

      await tx
        .insert(owners)
        .values({
          id: foundationIds.defaultOwner,
          companyId: foundationIds.company,
          name: "Main Owner",
        })
        .onConflictDoNothing();

      await tx
        .insert(productCategories)
        .values([
          {
            id: ids.categoryMachinery,
            companyId: foundationIds.company,
            code: "DEMO-MACH",
            name: "Demo Machinery",
            description: "Demo heavy machinery and equipment.",
            isActive: true,
          },
          {
            id: ids.categoryParts,
            companyId: foundationIds.company,
            code: "DEMO-PARTS",
            name: "Demo Spare Parts",
            description: "Demo replacement parts and consumables.",
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: productCategories.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(brands)
        .values([
          {
            id: ids.brandCaterpillar,
            companyId: foundationIds.company,
            code: "CAT",
            name: "Caterpillar",
            isActive: true,
          },
          {
            id: ids.brandPerkins,
            companyId: foundationIds.company,
            code: "PERKINS",
            name: "Perkins",
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: brands.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(unitsOfMeasure)
        .values([
          {
            id: ids.unitEach,
            companyId: foundationIds.company,
            code: "EA",
            name: "Each",
            precision: "1",
            isActive: true,
          },
          {
            id: ids.unitLiter,
            companyId: foundationIds.company,
            code: "LTR",
            name: "Liter",
            precision: "0.01",
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: unitsOfMeasure.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(taxGroups)
        .values({
          id: ids.taxGroupVat,
          companyId: foundationIds.company,
          code: "VAT",
          name: "VAT",
          sortOrder: 1,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: taxGroups.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(taxes)
        .values({
          id: ids.taxVat15,
          companyId: foundationIds.company,
          taxGroupId: ids.taxGroupVat,
          code: "VAT15",
          name: "VAT 15%",
          scope: "both",
          computation: "percent",
          rate: "15.0000",
          amountMinor: 0,
          priceIncluded: false,
          description: "Demo VAT tax used for purchase and sales examples.",
          isActive: true,
        })
        .onConflictDoUpdate({
          target: taxes.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentTerms)
        .values([
          {
            id: ids.paymentTermCash,
            companyId: foundationIds.company,
            code: "CASH",
            name: "Cash",
            dueDays: 0,
            description: "Payment due immediately.",
            isActive: true,
          },
          {
            id: ids.paymentTermNet15,
            companyId: foundationIds.company,
            code: "NET15",
            name: "15 Days",
            dueDays: 15,
            description: "Payment due within 15 days.",
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: paymentTerms.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(partners)
        .values([
          {
            id: ids.supplier,
            companyId: foundationIds.company,
            code: "DEMO-SUP-001",
            displayName: "Addis Machinery Importers",
            legalName: "Addis Machinery Importers PLC",
            tin: "DEMO-SUP-TIN",
            isCustomer: false,
            isSupplier: true,
            paymentTermId: ids.paymentTermNet15,
            creditLimitMinor: 0,
            currencyCode,
            status: "active",
            notes: "Demo supplier for purchase testing.",
          },
          {
            id: ids.customer,
            companyId: foundationIds.company,
            code: "DEMO-CUS-001",
            displayName: "Ethio Builders",
            legalName: "Ethio Builders SC",
            tin: "DEMO-CUS-TIN",
            isCustomer: true,
            isSupplier: false,
            paymentTermId: ids.paymentTermNet15,
            creditLimitMinor: 2_000_000_00,
            currencyCode,
            status: "active",
            notes: "Demo customer for sales testing.",
          },
        ])
        .onConflictDoUpdate({
          target: partners.id,
          set: { deletedAt: null, status: "active", updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentMethods)
        .values([
          {
            id: ids.cashMethod,
            companyId: foundationIds.company,
            code: "DEMO-CASH",
            name: "Demo Cash",
            methodType: "cash",
            allowInbound: true,
            allowOutbound: true,
            requiresReference: false,
            isActive: true,
          },
          {
            id: ids.bankMethod,
            companyId: foundationIds.company,
            code: "DEMO-BANK",
            name: "Demo Bank Transfer",
            methodType: "bank_transfer",
            allowInbound: true,
            allowOutbound: true,
            requiresReference: true,
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: paymentMethods.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentAccounts)
        .values([
          {
            id: ids.cashAccount,
            companyId: foundationIds.company,
            paymentMethodId: ids.cashMethod,
            code: "DEMO-CASH-MAIN",
            name: "Demo Main Cash Box",
            openingBalanceMinor: 25_000_00,
            currencyCode,
            isActive: true,
          },
          {
            id: ids.bankAccount,
            companyId: foundationIds.company,
            paymentMethodId: ids.bankMethod,
            code: "DEMO-AWASH",
            name: "Demo Awash Bank",
            institutionName: "Awash Bank",
            accountNumber: "DEMO-100200300",
            openingBalanceMinor: 150_000_00,
            currencyCode,
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: paymentAccounts.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(products)
        .values([
          {
            id: ids.excavator,
            companyId: foundationIds.company,
            sku: "DEMO-EXC-320",
            name: "Demo Excavator 320",
            categoryId: ids.categoryMachinery,
            brandId: ids.brandCaterpillar,
            model: "320",
            description: "Serial-tracked demo excavator.",
            unitId: ids.unitEach,
            trackingMode: "serial",
            standardCostMinor: 3_500_000_00,
            listPriceMinor: 4_250_000_00,
            currencyCode,
            isActive: true,
          },
          {
            id: ids.filter,
            companyId: foundationIds.company,
            sku: "DEMO-FLT-001",
            name: "Demo Hydraulic Filter",
            categoryId: ids.categoryParts,
            brandId: ids.brandPerkins,
            model: "HF-001",
            description: "Untracked spare part for normal stock testing.",
            unitId: ids.unitEach,
            trackingMode: "none",
            standardCostMinor: 1_200_00,
            listPriceMinor: 1_950_00,
            currencyCode,
            isActive: true,
          },
          {
            id: ids.oil,
            companyId: foundationIds.company,
            sku: "DEMO-OIL-20W50",
            name: "Demo Engine Oil 20W-50",
            categoryId: ids.categoryParts,
            brandId: ids.brandPerkins,
            model: "20W-50",
            description: "Lot-tracked consumable for lot selection testing.",
            unitId: ids.unitLiter,
            trackingMode: "lot",
            standardCostMinor: 450_00,
            listPriceMinor: 650_00,
            currencyCode,
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: products.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(productSaleTaxes)
        .values([
          { productId: ids.excavator, taxId: ids.taxVat15 },
          { productId: ids.filter, taxId: ids.taxVat15 },
          { productId: ids.oil, taxId: ids.taxVat15 },
        ])
        .onConflictDoNothing();

      await tx
        .insert(productPurchaseTaxes)
        .values([
          { productId: ids.excavator, taxId: ids.taxVat15 },
          { productId: ids.filter, taxId: ids.taxVat15 },
          { productId: ids.oil, taxId: ids.taxVat15 },
        ])
        .onConflictDoNothing();

      await tx
        .insert(productSerials)
        .values({
          id: ids.excavatorSerial,
          productId: ids.excavator,
          serialNo: "DEMO-EXC-320-0001",
          engineNo: "DEMO-ENG-0001",
          chassisNo: "DEMO-CHS-0001",
          status: "available",
          currentLocationId: foundationIds.displayShop,
          landedUnitCostMinor: 3_500_000_00,
        })
        .onConflictDoUpdate({
          target: productSerials.id,
          set: {
            status: "available",
            currentLocationId: foundationIds.displayShop,
            landedUnitCostMinor: 3_500_000_00,
            deletedAt: null,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(productLots)
        .values({
          id: ids.oilLot,
          productId: ids.oil,
          lotNo: "DEMO-OIL-2026-08",
          status: "available",
          currentLocationId: foundationIds.warehouse,
          landedUnitCostMinor: 450_00,
          expiryDate: nextMonthDate,
        })
        .onConflictDoUpdate({
          target: productLots.id,
          set: {
            status: "available",
            currentLocationId: foundationIds.warehouse,
            landedUnitCostMinor: 450_00,
            deletedAt: null,
            updatedAt: sql`now()`,
          },
        });

      await tx
        .insert(priceLists)
        .values({
          id: ids.priceList,
          companyId: foundationIds.company,
          ownerId: foundationIds.defaultOwner,
          name: "Demo Retail Price List",
          currencyCode,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: priceLists.id,
          set: { ownerId: foundationIds.defaultOwner, deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(priceListItems)
        .values([
          {
            id: uuidFromSeed("demo:price-list-item:excavator"),
            priceListId: ids.priceList,
            productId: ids.excavator,
            minimumQuantity: "1",
            unitPriceMinor: 4_250_000_00,
            discountMinor: 0,
            isActive: true,
          },
          {
            id: uuidFromSeed("demo:price-list-item:filter"),
            priceListId: ids.priceList,
            productId: ids.filter,
            minimumQuantity: "1",
            unitPriceMinor: 1_950_00,
            discountMinor: 0,
            isActive: true,
          },
          {
            id: uuidFromSeed("demo:price-list-item:oil"),
            priceListId: ids.priceList,
            productId: ids.oil,
            minimumQuantity: "1",
            unitPriceMinor: 650_00,
            discountMinor: 0,
            isActive: true,
          },
        ])
        .onConflictDoUpdate({
          target: priceListItems.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(stockMovements)
        .values({
          id: ids.openingMovement,
          companyId: foundationIds.company,
          movementNo: "DEMO-OPENING-001",
          ownerId: foundationIds.defaultOwner,
          movementType: "opening_balance",
          status: "posted",
          movementDate: today,
          toLocationId: foundationIds.warehouse,
          sourceType: "demo_seed",
          sourceId: ids.openingMovement,
          sourceNo: "DEMO-OPENING-001",
          postedAt: today,
          postedBy: foundationIds.adminUser,
          notes: "Demo opening stock.",
          metadata: { seed: "demo" },
        })
        .onConflictDoUpdate({
          target: stockMovements.id,
          set: { ownerId: foundationIds.defaultOwner, status: "posted", postedAt: today, updatedAt: sql`now()` },
        });

      await tx
        .insert(stockMovementLines)
        .values([
          {
            id: uuidFromSeed("demo:stock-movement-line:excavator"),
            stockMovementId: ids.openingMovement,
            ownerId: foundationIds.defaultOwner,
            lineNo: 1,
            productId: ids.excavator,
            productSerialId: ids.excavatorSerial,
            toLocationId: foundationIds.displayShop,
            unitId: ids.unitEach,
            quantity: "1",
            totalCostMinor: 3_500_000_00,
            currencyCode,
            metadata: { seed: "demo" },
          },
          {
            id: uuidFromSeed("demo:stock-movement-line:filter"),
            stockMovementId: ids.openingMovement,
            ownerId: foundationIds.defaultOwner,
            lineNo: 2,
            productId: ids.filter,
            toLocationId: foundationIds.warehouse,
            unitId: ids.unitEach,
            quantity: "24",
            totalCostMinor: 28_800_00,
            currencyCode,
            metadata: { seed: "demo" },
          },
          {
            id: uuidFromSeed("demo:stock-movement-line:oil"),
            stockMovementId: ids.openingMovement,
            ownerId: foundationIds.defaultOwner,
            lineNo: 3,
            productId: ids.oil,
            productLotId: ids.oilLot,
            toLocationId: foundationIds.warehouse,
            unitId: ids.unitLiter,
            quantity: "120",
            totalCostMinor: 54_000_00,
            currencyCode,
            metadata: { seed: "demo" },
          },
        ])
        .onConflictDoUpdate({
          target: stockMovementLines.id,
          set: { ownerId: foundationIds.defaultOwner, deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(stockBalances)
        .values([
          {
            id: uuidFromSeed("demo:stock-balance:excavator"),
            companyId: foundationIds.company,
            ownerId: foundationIds.defaultOwner,
            locationId: foundationIds.displayShop,
            productId: ids.excavator,
            productSerialId: ids.excavatorSerial,
            quantityOnHand: "1",
            quantityReserved: "0",
            quantityAvailable: "1",
            averageCostMinor: 3_500_000_00,
            currencyCode,
            lastMovementAt: today,
          },
          {
            id: uuidFromSeed("demo:stock-balance:filter"),
            companyId: foundationIds.company,
            ownerId: foundationIds.defaultOwner,
            locationId: foundationIds.warehouse,
            productId: ids.filter,
            quantityOnHand: "24",
            quantityReserved: "0",
            quantityAvailable: "24",
            averageCostMinor: 1_200_00,
            currencyCode,
            lastMovementAt: today,
          },
          {
            id: uuidFromSeed("demo:stock-balance:oil"),
            companyId: foundationIds.company,
            ownerId: foundationIds.defaultOwner,
            locationId: foundationIds.warehouse,
            productId: ids.oil,
            productLotId: ids.oilLot,
            quantityOnHand: "120",
            quantityReserved: "0",
            quantityAvailable: "120",
            averageCostMinor: 450_00,
            currencyCode,
            lastMovementAt: today,
          },
        ])
        .onConflictDoUpdate({
          target: stockBalances.id,
          set: { ownerId: foundationIds.defaultOwner, deletedAt: null, updatedAt: sql`now()` },
        });

      const salesSubtotal = 1_950_00 * 4;
      const salesTax = Math.round(salesSubtotal * 0.15);
      const salesTotal = salesSubtotal + salesTax;

      await tx
        .insert(salesOrders)
        .values({
          id: ids.salesOrder,
          companyId: foundationIds.company,
          customerId: ids.customer,
          ownerId: foundationIds.defaultOwner,
          sourceLocationId: foundationIds.warehouse,
          priceListId: ids.priceList,
          orderNo: "DEMO-SO-001",
          customerReference: "DEMO-CUSTOMER-RFQ",
          status: "quotation",
          orderDate: todayDate,
          validUntil: nextWeekDate,
          expectedDeliveryDate: nextWeekDate,
          currencyCode,
          subtotalMinor: salesSubtotal,
          taxAmountMinor: salesTax,
          totalMinor: salesTotal,
          reserveOnConfirm: true,
          notes: "Demo quotation for user testing.",
          createdBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: salesOrders.id,
          set: { ownerId: foundationIds.defaultOwner, deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(salesOrderLines)
        .values({
          id: ids.salesOrderLineFilter,
          salesOrderId: ids.salesOrder,
          lineNo: 1,
          productId: ids.filter,
          description: "Demo Hydraulic Filter",
          unitId: ids.unitEach,
          quantityOrdered: "4",
          unitPriceMinor: 1_950_00,
          discountMinor: 0,
          taxAmountMinor: salesTax,
          lineTotalMinor: salesTotal,
          currencyCode,
        })
        .onConflictDoUpdate({
          target: salesOrderLines.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(salesOrderLineTaxes)
        .values({
          salesOrderLineId: ids.salesOrderLineFilter,
          taxId: ids.taxVat15,
          taxAmountMinor: salesTax,
        })
        .onConflictDoNothing();

      await tx
        .insert(customerInvoices)
        .values({
          id: ids.customerInvoice,
          companyId: foundationIds.company,
          salesOrderId: ids.salesOrder,
          customerId: ids.customer,
          invoiceNo: "DEMO-INV-001",
          customerReference: "DEMO-CUSTOMER-RFQ",
          status: "posted",
          paymentStatus: "partial",
          invoiceDate: todayDate,
          dueDate: nextWeekDate,
          postedAt: today,
          postedBy: foundationIds.adminUser,
          currencyCode,
          untaxedAmountMinor: salesSubtotal,
          taxAmountMinor: salesTax,
          totalMinor: salesTotal,
          notes: "Demo posted customer invoice.",
        })
        .onConflictDoUpdate({
          target: customerInvoices.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(customerInvoiceLines)
        .values({
          id: ids.customerInvoiceLine,
          customerInvoiceId: ids.customerInvoice,
          salesOrderLineId: ids.salesOrderLineFilter,
          lineNo: 1,
          productId: ids.filter,
          description: "Demo Hydraulic Filter",
          quantity: "4",
          unitPriceMinor: 1_950_00,
          discountMinor: 0,
          taxAmountMinor: salesTax,
          lineTotalMinor: salesTotal,
          currencyCode,
        })
        .onConflictDoUpdate({
          target: customerInvoiceLines.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(payments)
        .values({
          id: ids.customerPayment,
          companyId: foundationIds.company,
          partnerId: ids.customer,
          paymentNo: "DEMO-IN-PAY-001",
          paymentType: "inbound",
          status: "posted",
          paymentDate: today,
          paymentMethodId: ids.cashMethod,
          paymentAccountId: ids.cashAccount,
          amountMinor: Math.round(salesTotal / 2),
          currencyCode,
          reference: "DEMO-CASH-001",
          notes: "Demo partial customer payment.",
          postedAt: today,
          postedBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: payments.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentAllocations)
        .values({
          id: ids.customerPaymentAllocation,
          paymentId: ids.customerPayment,
          customerInvoiceId: ids.customerInvoice,
          amountMinor: Math.round(salesTotal / 2),
          notes: "Demo partial payment allocation.",
        })
        .onConflictDoUpdate({
          target: paymentAllocations.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      const purchaseSubtotal = 1_200_00 * 12;
      const purchaseTax = Math.round(purchaseSubtotal * 0.15);
      const purchaseTotal = purchaseSubtotal + purchaseTax;

      await tx
        .insert(purchaseOrders)
        .values({
          id: ids.purchaseOrder,
          companyId: foundationIds.company,
          supplierId: ids.supplier,
          ownerId: foundationIds.defaultOwner,
          deliverToLocationId: foundationIds.warehouse,
          orderNo: "DEMO-PO-001",
          vendorReference: "DEMO-SUP-QUOTE-001",
          status: "confirmed",
          orderDate: todayDate,
          currencyCode,
          subtotalMinor: purchaseSubtotal,
          taxAmountMinor: purchaseTax,
          totalMinor: purchaseTotal,
          notes: "Demo confirmed purchase order.",
          createdBy: foundationIds.adminUser,
          confirmedAt: today,
          confirmedBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: purchaseOrders.id,
          set: { ownerId: foundationIds.defaultOwner, deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(purchaseOrderLines)
        .values({
          id: ids.purchaseOrderLineFilter,
          purchaseOrderId: ids.purchaseOrder,
          lineNo: 1,
          productId: ids.filter,
          description: "Demo Hydraulic Filter",
          unitId: ids.unitEach,
          quantityOrdered: "12",
          quantityReceived: "0",
          unitCostMinor: 1_200_00,
          taxAmountMinor: purchaseTax,
          lineTotalMinor: purchaseTotal,
          currencyCode,
        })
        .onConflictDoUpdate({
          target: purchaseOrderLines.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(purchaseOrderLineTaxes)
        .values({
          purchaseOrderLineId: ids.purchaseOrderLineFilter,
          taxId: ids.taxVat15,
          taxAmountMinor: purchaseTax,
        })
        .onConflictDoNothing();

      await tx
        .insert(vendorBills)
        .values({
          id: ids.vendorBill,
          companyId: foundationIds.company,
          supplierId: ids.supplier,
          purchaseOrderId: ids.purchaseOrder,
          billNo: "DEMO-VB-001",
          vendorReference: "DEMO-SUP-BILL-001",
          status: "posted",
          paymentStatus: "partial",
          billDate: todayDate,
          accountingDate: todayDate,
          dueDate: nextWeekDate,
          untaxedAmountMinor: purchaseSubtotal,
          taxAmountMinor: purchaseTax,
          totalMinor: purchaseTotal,
          currencyCode,
          notes: "Demo posted supplier bill.",
          postedAt: today,
          postedBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: vendorBills.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(vendorBillLines)
        .values({
          id: ids.vendorBillLine,
          vendorBillId: ids.vendorBill,
          purchaseOrderLineId: ids.purchaseOrderLineFilter,
          lineNo: 1,
          productId: ids.filter,
          description: "Demo Hydraulic Filter",
          unitId: ids.unitEach,
          quantity: "12",
          unitPriceMinor: 1_200_00,
          subtotalMinor: purchaseSubtotal,
          taxAmountMinor: purchaseTax,
          totalMinor: purchaseTotal,
          currencyCode,
        })
        .onConflictDoUpdate({
          target: vendorBillLines.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(payments)
        .values({
          id: ids.supplierPayment,
          companyId: foundationIds.company,
          partnerId: ids.supplier,
          paymentNo: "DEMO-OUT-PAY-001",
          paymentType: "outbound",
          status: "posted",
          paymentDate: today,
          paymentMethodId: ids.bankMethod,
          paymentAccountId: ids.bankAccount,
          amountMinor: Math.round(purchaseTotal / 2),
          currencyCode,
          reference: "DEMO-BANK-OUT-001",
          notes: "Demo partial supplier payment.",
          postedAt: today,
          postedBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: payments.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentAllocations)
        .values({
          id: ids.supplierPaymentAllocation,
          paymentId: ids.supplierPayment,
          vendorBillId: ids.vendorBill,
          amountMinor: Math.round(purchaseTotal / 2),
          notes: "Demo partial supplier payment allocation.",
        })
        .onConflictDoUpdate({
          target: paymentAllocations.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(expenseCategories)
        .values({
          id: ids.expenseCategory,
          companyId: foundationIds.company,
          code: "DEMO-TRANSPORT",
          name: "Demo Transport",
          description: "Demo operating transport expense category.",
          isActive: true,
        })
        .onConflictDoUpdate({
          target: expenseCategories.id,
          set: { deletedAt: null, isActive: true, updatedAt: sql`now()` },
        });

      await tx
        .insert(expenses)
        .values({
          id: ids.expense,
          companyId: foundationIds.company,
          categoryId: ids.expenseCategory,
          vendorId: ids.supplier,
          locationId: foundationIds.warehouse,
          expenseNo: "DEMO-EXP-001",
          status: "posted",
          paymentStatus: "paid",
          expenseDate: todayDate,
          amountMinor: 3_500_00,
          currencyCode,
          description: "Demo delivery transport expense.",
        })
        .onConflictDoUpdate({
          target: expenses.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(payments)
        .values({
          id: ids.expensePayment,
          companyId: foundationIds.company,
          partnerId: ids.supplier,
          paymentNo: "DEMO-EXP-PAY-001",
          paymentType: "outbound",
          status: "posted",
          paymentDate: today,
          paymentMethodId: ids.cashMethod,
          paymentAccountId: ids.cashAccount,
          amountMinor: 3_500_00,
          currencyCode,
          reference: "DEMO-EXP-CASH-001",
          notes: "Demo expense payment.",
          postedAt: today,
          postedBy: foundationIds.adminUser,
        })
        .onConflictDoUpdate({
          target: payments.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(paymentAllocations)
        .values({
          id: ids.expensePaymentAllocation,
          paymentId: ids.expensePayment,
          expenseId: ids.expense,
          amountMinor: 3_500_00,
          notes: "Demo expense payment allocation.",
        })
        .onConflictDoUpdate({
          target: paymentAllocations.id,
          set: { deletedAt: null, updatedAt: sql`now()` },
        });

      await tx
        .insert(auditLogs)
        .values({
          id: ids.audit,
          companyId: foundationIds.company,
          actorUserId: foundationIds.adminUser,
          locationId: foundationIds.warehouse,
          action: "seed.demo",
          entityType: "database_seed",
          entityId: foundationIds.company,
          severity: "info",
          metadata: {
            seed: "demo",
            products: ["DEMO-EXC-320", "DEMO-FLT-001", "DEMO-OIL-20W50"],
          },
        })
        .onConflictDoNothing();
    });

    console.log("Demo seed completed.");
    console.log("Created demo products, partners, stock, payments, sales, purchasing, and expenses.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("Demo seed failed.");
  console.error(error);
  process.exit(1);
});
