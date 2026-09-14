"use client";

import { Building2, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { createPartner } from "@/app/admin/partners/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
            New partner
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-3xl sm:max-w-3xl p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden outline-none max-h-[90vh]"
        showCloseButton={false}
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441] shrink-0" />

        <DialogHeader className="shrink-0 border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Building2 className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                New Partner
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Create a customer, supplier, or dual-role account.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setOpen(false)}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <form action={createPartner} className="flex flex-col flex-1 overflow-y-auto p-6 gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              <span>
                Display name <span className="text-destructive">*</span>
              </span>
              <input name="displayName" required maxLength={200} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Legal name
              <input name="legalName" maxLength={200} className={inputClass} />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <fieldset className="rounded-xl border border-border/80 bg-background/40 px-3 py-2">
              <legend className="px-1 text-xs font-semibold">Role</legend>
              <label className="mt-1 flex items-center gap-2 text-xs font-medium">
                <input name="isCustomer" type="checkbox" defaultChecked />
                Customer
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs font-medium">
                <input name="isSupplier" type="checkbox" />
                Supplier
              </label>
            </fieldset>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Payment term
              <select name="paymentTermId" className={inputClass}>
                <option value="">None</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.dueDays} days)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Status
              <select name="status" defaultValue="active" className={inputClass}>
                {partnerStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
            Credit limit
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
            <h2 className="text-sm font-semibold text-foreground">Primary Contact</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Name
                <input name="contactName" maxLength={160} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Role/title
                <input name="contactRole" maxLength={100} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Phone
                <input name="contactPhone" maxLength={40} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Email
                <input name="contactEmail" type="email" maxLength={160} className={inputClass} />
              </label>
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
            <h2 className="text-sm font-semibold text-foreground">Primary Address</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Type
                <select name="addressType" defaultValue="office" className={inputClass}>
                  {addressTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground md:col-span-2">
                Label
                <input name="addressLabel" maxLength={100} className={inputClass} />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Address line 1
              <input name="addressLine1" maxLength={200} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              Address line 2
              <input name="addressLine2" maxLength={200} className={inputClass} />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                City
                <input name="city" maxLength={120} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Region
                <input name="region" maxLength={120} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
                Country <span className="text-destructive">*</span>
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
            Notes
            <textarea name="notes" rows={3} className={textareaClass} />
          </label>

          <div className="pt-2 border-t border-border/80 flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 px-4 text-xs font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-10 px-5 gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99]"
            >
              <Plus className="size-4 text-emerald-200" />
              Create partner
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
