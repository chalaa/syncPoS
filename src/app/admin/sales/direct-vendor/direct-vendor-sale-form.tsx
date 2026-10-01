"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Coins, FileText, Package, PlusIcon, Trash2Icon, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { ProductSelect } from "@/app/admin/products/product-select";
import { Button } from "@/components/ui/button";
import { RelatedModelSelect } from "@/components/ui/related-model-select";
import type { DirectVendorSaleFormOptions } from "@/server/direct-vendor-sales/types";

const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type PaymentTerm = "cash" | "credit";

type DirectVendorLineDraft = {
  key: string;
  productId: string;
  description: string;
  quantity: string;
  vendorUnitCost: string;
  customerUnitPrice: string;
  discount: string;
  taxAmount: string;
  lineNotes: string;
};

type DirectVendorSaleFormProps = DirectVendorSaleFormOptions & {
  action: (formData: FormData) => void | Promise<void>;
  error?: string;
  defaultDate: string;
  isModal?: boolean;
  onCancel?: () => void;
};

type LineAmounts = {
  vendorTotalMinor: number;
  subtotalMinor: number;
  taxAmountMinor: number;
  customerTotalMinor: number;
  marginMinor: number;
};

function newLine(): DirectVendorLineDraft {
  return {
    key: crypto.randomUUID(),
    productId: "",
    description: "",
    quantity: "1",
    vendorUnitCost: "0",
    customerUnitPrice: "0",
    discount: "0",
    taxAmount: "0",
    lineNotes: "",
  };
}

function minorToMajor(value: number) {
  return (value / 100).toFixed(2);
}

function money(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function displayMoney(value: number, currencyCode: string) {
  return `${currencyCode} ${money(value / 100)}`;
}

function majorToMinor(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function calculateLine(line: DirectVendorLineDraft): LineAmounts {
  const quantity = Number(line.quantity);
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const vendorTotalMinor = Math.round(majorToMinor(line.vendorUnitCost) * safeQuantity);
  const grossCustomerMinor = Math.round(majorToMinor(line.customerUnitPrice) * safeQuantity);
  const discountMinor = Math.max(majorToMinor(line.discount), 0);
  const taxAmountMinor = Math.max(majorToMinor(line.taxAmount), 0);
  const subtotalMinor = Math.max(grossCustomerMinor - discountMinor, 0);
  const customerTotalMinor = subtotalMinor + taxAmountMinor;

  return {
    vendorTotalMinor,
    subtotalMinor,
    taxAmountMinor,
    customerTotalMinor,
    marginMinor: customerTotalMinor - vendorTotalMinor,
  };
}

export function DirectVendorSaleForm({
  action,
  company,
  customers,
  vendors,
  owners,
  products,
  productCategories,
  productBrands,
  productUnits,
  error,
  defaultDate,
  onCancel,
}: DirectVendorSaleFormProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [customerId, setCustomerId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [saleDate, setSaleDate] = useState(defaultDate);
  const [customerPaymentTerm, setCustomerPaymentTerm] = useState<PaymentTerm>("cash");
  const [vendorPaymentTerm, setVendorPaymentTerm] = useState<PaymentTerm>("cash");
  const [lines, setLines] = useState<DirectVendorLineDraft[]>(() => [newLine()]);

  const totals = useMemo(() => {
    return lines.reduce(
      (sum, line) => {
        const amounts = calculateLine(line);

        return {
          subtotalMinor: sum.subtotalMinor + amounts.subtotalMinor,
          taxAmountMinor: sum.taxAmountMinor + amounts.taxAmountMinor,
          customerTotalMinor: sum.customerTotalMinor + amounts.customerTotalMinor,
          vendorCostTotalMinor: sum.vendorCostTotalMinor + amounts.vendorTotalMinor,
          marginMinor: sum.marginMinor + amounts.marginMinor,
        };
      },
      { subtotalMinor: 0, taxAmountMinor: 0, customerTotalMinor: 0, vendorCostTotalMinor: 0, marginMinor: 0 },
    );
  }, [lines]);

  const specifiedLineCount = lines.filter((line) => line.productId).length;

  function updateLine(key: string, patch: Partial<DirectVendorLineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function handleProductChange(line: DirectVendorLineDraft, productId: string) {
    const product = products.find((item) => item.id === productId);
    updateLine(line.key, {
      productId,
      customerUnitPrice: product ? minorToMajor(product.listPriceMinor) : line.customerUnitPrice,
      vendorUnitCost: product ? minorToMajor(product.standardCostMinor) : line.vendorUnitCost,
    });
  }

  return (
    <form action={action} className="flex flex-col">
      {step === 2 ? (
        <div hidden>
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="vendorId" value={vendorId} />
          <input type="hidden" name="ownerId" value={ownerId} />
          <input type="hidden" name="saleDate" value={saleDate} />
          {lines.map((line) => (
            <div key={line.key}>
              <input type="hidden" name="productId" value={line.productId} />
              <input type="hidden" name="description" value={line.description} />
              <input type="hidden" name="quantity" value={line.quantity} />
              <input type="hidden" name="vendorUnitCost" value={line.vendorUnitCost} />
              <input type="hidden" name="customerUnitPrice" value={line.customerUnitPrice} />
              <input type="hidden" name="discount" value={line.discount} />
              <input type="hidden" name="taxAmount" value={line.taxAmount} />
              <input type="hidden" name="lineNotes" value={line.lineNotes} />
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="border-b border-border bg-background px-4 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-[11px]">1</span>
              Direct Sale Details & Lines
            </button>
            <span className="hidden h-px w-10 bg-border sm:block" />
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`inline-flex h-8 items-center gap-2 rounded-md px-3 text-sm font-medium ${
                step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-white/20 text-[11px]">2</span>
              Review & Payment
            </button>
          </div>
          <div className="text-xs text-muted-foreground">
            Step {step} of 2 <span className="ml-2 font-semibold text-primary">{step === 1 ? "Drafting direct sale" : "Ready to post"}</span>
          </div>
        </div>
      </div>

      <div className="max-h-[calc(92vh-190px)] overflow-y-auto px-4 py-5 sm:px-6">
        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-lg border border-border bg-background shadow-xs">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary"><Users className="size-3.5" /></span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Customer & Vendor</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Client & Source</span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Customer
                    <RelatedModelSelect
                      name="customerId"
                      value={customerId}
                      options={customers}
                      onValueChange={setCustomerId}
                      placeholder="Search or add customer..."
                      inputClassName={inputClass}
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Vendor
                    <RelatedModelSelect
                      name="vendorId"
                      value={vendorId}
                      options={vendors}
                      onValueChange={setVendorId}
                      placeholder="Search or select vendor..."
                      inputClassName={inputClass}
                      required
                    />
                  </label>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-background shadow-xs">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex size-6 items-center justify-center rounded-md bg-gold/15 text-dark"><Coins className="size-3.5" /></span>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Commercial Terms & Payment</h2>
                  </div>
                  <span className="text-[11px] text-muted-foreground">No Inventory</span>
                </div>
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Sales Owner
                    <select name="ownerId" value={ownerId} onChange={(event) => setOwnerId(event.target.value)} className={inputClass}>
                      <option value="">No owner</option>
                      {owners.map((owner) => (
                        <option key={owner.id} value={owner.id}>
                          {owner.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Sale Date
                    <input
                      name="saleDate"
                      type="date"
                      value={saleDate}
                      onChange={(event) => setSaleDate(event.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground md:col-span-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 text-primary" />
                      <div>
                        <div className="font-semibold text-foreground">Inventory will not be touched.</div>
                        Product is sold directly from the vendor and both payments are registered on this document.
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-lg border border-border bg-background shadow-xs">
              <div className="flex items-center gap-4 border-b border-border px-4 py-2">
                <div className="inline-flex h-9 items-center gap-2 border-b-2 border-primary px-2 text-sm font-medium text-foreground">
                  <Package className="size-4 text-primary" />
                  Order Items
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-primary">{lines.length}</span>
                </div>
                <div className="inline-flex h-9 items-center gap-2 px-2 text-sm text-muted-foreground">
                  <FileText className="size-4" />
                  Terms & Notes
                </div>
              </div>

              <div className="flex flex-col gap-4 p-4">
                {lines.map((line, index) => {
                  const amounts = calculateLine(line);

                  return (
                    <div key={line.key} className="rounded-xl border border-border bg-card p-3 shadow-xs">
                      <div className="mb-3 flex items-start gap-3">
                        <span className="mt-2 inline-flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ProductSelect
                            name="productId"
                            value={line.productId}
                            options={products}
                            categories={productCategories}
                            brands={productBrands}
                            units={productUnits}
                            placeholder="Search product by name, SKU, or brand..."
                            inputClassName={inputClass}
                            onValueChange={(productId) => handleProductChange(line, productId)}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={lines.length === 1}
                          onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                          aria-label="Remove line"
                        >
                          <Trash2Icon />
                        </Button>
                      </div>

                      <div className="grid gap-3 md:grid-cols-6">
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Quantity
                          <input
                            name="quantity"
                            type="number"
                            min="0.000001"
                            step="0.000001"
                            value={line.quantity}
                            onChange={(event) => updateLine(line.key, { quantity: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Vendor Cost
                          <input
                            name="vendorUnitCost"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.vendorUnitCost}
                            onChange={(event) => updateLine(line.key, { vendorUnitCost: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Sale Price
                          <input
                            name="customerUnitPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.customerUnitPrice}
                            onChange={(event) => updateLine(line.key, { customerUnitPrice: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Discount
                          <input
                            name="discount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.discount}
                            onChange={(event) => updateLine(line.key, { discount: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-semibold">
                          Tax
                          <input
                            name="taxAmount"
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.taxAmount}
                            onChange={(event) => updateLine(line.key, { taxAmount: event.target.value })}
                            className={`${inputClass} text-right font-mono`}
                          />
                        </label>
                        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-right">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Line Margin</div>
                          <div className="font-mono text-sm font-bold text-primary">{displayMoney(amounts.marginMinor, company.baseCurrencyCode)}</div>
                        </div>
                      </div>

                      <input type="hidden" name="description" value={line.description} />
                      <input type="hidden" name="lineNotes" value={line.lineNotes} />
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Vendor direct sale</span>
                        <span>Customer total <strong className="font-mono text-foreground">{displayMoney(amounts.customerTotalMinor, company.baseCurrencyCode)}</strong></span>
                        <span>Vendor total <strong className="font-mono text-foreground">{displayMoney(amounts.vendorTotalMinor, company.baseCurrencyCode)}</strong></span>
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                  <div className="flex items-start">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-dashed"
                      onClick={() => setLines((current) => [...current, newLine()])}
                    >
                      <PlusIcon data-icon="inline-start" />
                      Add Product
                    </Button>
                  </div>
                  <SummaryBox totals={totals} currencyCode={company.baseCurrencyCode} />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <section className="rounded-lg border border-border bg-background shadow-xs">
              <div className="flex items-center gap-2 border-b border-border px-4 py-3">
                <Wallet className="size-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-foreground">Both-Way Payment</h2>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <PaymentTermPanel
                  title="Customer Payment"
                  caption="Sales payment"
                  term={customerPaymentTerm}
                  onTermChange={setCustomerPaymentTerm}
                  inputName="customerPaymentTerm"
                  totalLabel="Customer receives"
                  totalValue={displayMoney(totals.customerTotalMinor, company.baseCurrencyCode)}
                >
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Confirm the direct sale first, then register the customer payment from the posted sale.
                  </div>
                </PaymentTermPanel>

                <PaymentTermPanel
                  title="Vendor Payment"
                  caption="Purchase payment"
                  term={vendorPaymentTerm}
                  onTermChange={setVendorPaymentTerm}
                  inputName="vendorPaymentTerm"
                  totalLabel="Vendor cost"
                  totalValue={displayMoney(totals.vendorCostTotalMinor, company.baseCurrencyCode)}
                >
                  <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                    Confirm the direct sale first, then register the vendor payment from the posted sale.
                  </div>
                </PaymentTermPanel>

                <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
                  Notes
                  <textarea name="notes" className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                </label>
              </div>
            </section>
            <SummaryBox totals={totals} currencyCode={company.baseCurrencyCode} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 shadow-lg backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1">
            <Package className="size-3.5 text-primary" />
            {specifiedLineCount} / {lines.length} Item specified
          </span>
          <span>Total Value: <strong className="font-mono text-primary">{displayMoney(totals.customerTotalMinor, company.baseCurrencyCode)}</strong></span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {step === 2 ? (
            <button
              type="button"
              onClick={() => setStep(1)}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <ArrowLeft data-icon="inline-start" />
              Back
            </button>
          ) : null}
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-input bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Cancel
            </button>
          ) : null}
          <Button type="submit" name="intent" value="draft" variant="outline">
            Save as Draft Direct Sale
          </Button>
          {step === 1 ? (
            <button
              type="button"
              onClick={() => setStep(2)}
              className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-dark focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Continue to Confirmation
              <ArrowRight data-icon="inline-end" />
            </button>
          ) : (
            <Button type="submit" name="intent" value="post">
              Post Direct Sale
              <ArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

function PaymentTermPanel({
  title,
  caption,
  term,
  onTermChange,
  inputName,
  totalLabel,
  totalValue,
  children,
}: {
  title: string;
  caption: string;
  term: PaymentTerm;
  onTermChange: (term: PaymentTerm) => void;
  inputName: string;
  totalLabel: string;
  totalValue: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        <div className="text-right text-xs">
          <div className="text-muted-foreground">{totalLabel}</div>
          <div className="font-mono font-bold text-primary">{totalValue}</div>
        </div>
      </div>
      <input type="hidden" name={inputName} value={term} />
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/20 p-1">
        <button
          type="button"
          onClick={() => onTermChange("cash")}
          className={`h-9 rounded-sm text-sm font-semibold transition-colors ${
            term === "cash" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cash
        </button>
        <button
          type="button"
          onClick={() => onTermChange("credit")}
          className={`h-9 rounded-sm text-sm font-semibold transition-colors ${
            term === "credit" ? "bg-background text-primary shadow-xs" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Credit
        </button>
      </div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}

function SummaryBox({
  totals,
  currencyCode,
}: {
  totals: {
    subtotalMinor: number;
    taxAmountMinor: number;
    customerTotalMinor: number;
    vendorCostTotalMinor: number;
    marginMinor: number;
  };
  currencyCode: string;
}) {
  return (
    <aside className="rounded-xl border border-border bg-background p-4 shadow-xs">
      <dl className="flex flex-col gap-3 text-xs">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Untaxed Subtotal</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.subtotalMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Applicable Taxes</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.taxAmountMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">Vendor Cost</dt>
          <dd className="font-mono font-semibold">{displayMoney(totals.vendorCostTotalMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
          <dt className="font-bold text-foreground">Total Direct Sale Value</dt>
          <dd className="font-mono text-base font-bold text-primary">{displayMoney(totals.customerTotalMinor, currencyCode)}</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="font-semibold text-foreground">Margin</dt>
          <dd className="font-mono text-base font-bold text-primary">{displayMoney(totals.marginMinor, currencyCode)}</dd>
        </div>
      </dl>
    </aside>
  );
}
