"use client";

import { Banknote, Plus, Receipt, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { createExpense } from "@/app/admin/operations/expenses/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ExpenseFormOptions } from "@/server/expenses/types";

export type NewExpenseModalProps = {
  options: ExpenseFormOptions;
  returnPath?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

export function NewExpenseModal({
  options,
  returnPath = "/admin/operations/expenses",
  trigger,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: NewExpenseModalProps) {
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
    "min-h-24 w-full rounded-xl border border-border/80 bg-background p-3 text-xs outline-none focus:border-[#0B5D4B] focus:ring-2 focus:ring-[#0B5D4B]/20 transition-all font-medium resize-y";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer">
            <Plus className="size-4 text-emerald-200" />
            New Expense
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent
        className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-1.5rem)] max-w-2xl sm:max-w-2xl p-0 gap-0 flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden outline-none"
        showCloseButton={false}
      >
        {/* Top Brand Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#0B5D4B] via-[#073B35] to-[#D9A441] shrink-0" />

        {/* Modal Header */}
        <DialogHeader className="shrink-0 border-b border-border/70 bg-background/95 px-6 py-4 backdrop-blur-md flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B5D4B] to-[#073B35] text-white shadow-md shadow-[#0B5D4B]/25 ring-1 ring-white/20">
              <Receipt className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                Record New Expense
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Capture operating costs, team reimbursements, or administrative fees.
              </p>
            </div>
          </div>
          <DialogClose
            type="button"
            className="rounded-lg p-1.5 sm:p-2 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs"
            aria-label="Close dialog"
            onClick={() => setOpen(false)}
          >
            <X className="size-4 sm:size-4.5" />
          </DialogClose>
        </DialogHeader>

        {/* Modal Form Body */}
        <form action={createExpense} className="flex flex-col flex-1 overflow-y-auto p-6 space-y-4">
          <input type="hidden" name="returnPath" value={returnPath} />

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Category Select */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
              <span className="flex items-center gap-1">
                Category <span className="text-destructive">*</span>
              </span>
              <select name="categoryId" required className={inputClass}>
                <option value="">Select expense category...</option>
                {options.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.code ? `${category.code} · ` : ""}{category.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Expense Date */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1">
                Expense Date <span className="text-destructive">*</span>
              </span>
              <input
                name="expenseDate"
                type="date"
                required
                defaultValue={todayInputValue()}
                className={inputClass}
              />
            </label>

            {/* Amount */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground">
              <span className="flex items-center gap-1">
                Amount <span className="text-destructive">*</span>
              </span>
              <div className="relative flex items-center">
                <Banknote className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  required
                  className={`${inputClass} pl-9 font-mono font-bold text-foreground`}
                />
              </div>
            </label>

            {/* Employee */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
              <span>Employee / Requester</span>
              <select name="employeeId" className={inputClass}>
                <option value="">No specific employee (General Company Expense)</option>
                {options.employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.code ? `${employee.code} · ` : ""}{employee.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Description */}
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
              <span>Notes & Description</span>
              <textarea
                name="description"
                placeholder="Provide description, invoice/receipt ref, or justification..."
                className={textareaClass}
              />
            </label>
          </div>

          {/* Form Footer Actions */}
          <div className="pt-4 border-t border-border/80 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 w-full sm:w-auto px-4 text-xs font-semibold justify-center"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={options.categories.length === 0}
              className="h-10 w-full sm:w-auto px-5 gap-2 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] font-semibold text-white shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] justify-center"
            >
              <Plus className="size-4 text-emerald-200" />
              Create Expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
