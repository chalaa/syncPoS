"use client";

import { Building2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { createPartner } from "@/app/admin/partners/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/use-translation";
import {
  addressTypeOptions,
  partnerStatusOptions,
  type PaymentTermOption,
} from "@/server/partners/types";

export type NewPartnerModalProps = {
  paymentTerms: PaymentTermOption[];
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function NewPartnerModal({
  paymentTerms,
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: NewPartnerModalProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  function setOpen(nextOpen: boolean) {
    if (!isControlled) {
      setInternalOpen(nextOpen);
    }
    controlledOnOpenChange?.(nextOpen);
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-medium";
  const textareaClass =
    "min-h-20 w-full rounded-xl border border-border/80 bg-background p-3 text-xs outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-medium resize-y";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer">
            <Plus className="size-4 text-emerald-200" />
            {t("action.newPartner", "New partner")}
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1rem)] sm:w-full max-w-3xl p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-y-auto outline-none max-h-[92vh] sm:max-h-[90vh]"
        showCloseButton={false}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441]" />

        <DialogHeader className="border-b border-border/70 bg-background/95 px-4 sm:px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Building2 className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                {t("modal.newPartner.title", "New Partner")}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("modal.newPartner.desc", "Create a customer, supplier, or dual-role account.")}
              </p>
            </div>
          </div>
          <DialogClose
            type="button"
            className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
            aria-label={t("action.closeDialog", "Close dialog")}
            onClick={() => setOpen(false)}
          >
            <X className="size-4 sm:size-4.5" />
          </DialogClose>
        </DialogHeader>

        <form action={createPartner} className="flex flex-col p-4 sm:p-6 gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              <span>
                {t("field.displayName", "Display name")} <span className="text-destructive">*</span>
              </span>
              <input name="displayName" required maxLength={200} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              {t("field.legalName", "Legal name")}
              <input name="legalName" maxLength={200} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <fieldset className="rounded-xl border border-border/80 bg-background/40 px-3 py-2">
              <legend className="px-1 text-xs font-semibold">{t("field.role", "Role")}</legend>
              <label className="mt-1 flex items-center gap-2 text-xs font-medium">
                <input name="isCustomer" type="checkbox" defaultChecked />
                {t("Customer", "Customer")}
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input name="isSupplier" type="checkbox" />
                {t("Supplier", "Supplier")}
              </label>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              {t("field.paymentTerm", "Payment term")}
              <select name="paymentTermId" className={inputClass}>
                <option value="">{t("common.none", "None")}</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.dueDays} {t("common.days", "days")})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              {t("field.status", "Status")}
              <select name="status" defaultValue="active" className={inputClass}>
                {partnerStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`, status)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            {t("Credit limit", "Credit limit")}
            <input
              name="creditLimit"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0.00"
              className={inputClass}
            />
          </label>

          <section className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("Primary Contact", "Primary Contact")}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.name", "Name")}
                <input name="contactName" maxLength={160} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.roleTitle", "Role/title")}
                <input name="contactRole" maxLength={100} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.phone", "Phone")}
                <input name="contactPhone" maxLength={40} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.email", "Email")}
                <input name="contactEmail" type="email" maxLength={160} className={inputClass} />
              </label>
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground">{t("Primary Address", "Primary Address")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.type", "Type")}
                <select name="addressType" defaultValue="office" className={inputClass}>
                  {addressTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {t(`status.${type}`, type)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
                {t("field.label", "Label")}
                <input name="addressLabel" maxLength={100} className={inputClass} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              {t("field.addressLine1", "Address line 1")}
              <input name="addressLine1" maxLength={200} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              {t("field.addressLine2", "Address line 2")}
              <input name="addressLine2" maxLength={200} className={inputClass} />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.city", "City")}
                <input name="city" maxLength={120} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.region", "Region")}
                <input name="region" maxLength={120} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                {t("field.country", "Country")} <span className="text-destructive">*</span>
                <input
                  name="country"
                  defaultValue="Ethiopia"
                  required
                  maxLength={120}
                  className={inputClass}
                />
              </label>
            </div>
          </section>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            {t("field.notes", "Notes")}
            <textarea name="notes" rows={3} className={textareaClass} />
          </label>

          <div className="pt-3 border-t border-border/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 w-full sm:w-auto px-4 text-xs font-semibold justify-center"
            >
              {t("action.cancel", "Cancel")}
            </Button>
            <Button
              type="submit"
              className="h-10 w-full sm:w-auto px-5 gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] justify-center"
            >
              <Plus className="size-4 text-emerald-200" />
              {t("action.createPartner", "Create partner")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
