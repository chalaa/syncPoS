"use client";

import { AlertTriangle, FileText, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CloseConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label shown in the "Save as Draft" button, e.g. "Save as Draft RFQ" */
  draftLabel?: string;
  /** Called when user chooses to save as draft */
  onSaveDraft: () => void;
  /** Called when user chooses to discard and close */
  onDiscard: () => void;
};

export function CloseConfirmDialog({
  open,
  onOpenChange,
  draftLabel = "Save as Draft",
  onSaveDraft,
  onDiscard,
}: CloseConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="fixed left-1/2 top-1/2 z-[70] -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm p-0 rounded-2xl border border-border/80 bg-card shadow-2xl overflow-hidden outline-none"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Amber accent strip */}
        <div className="h-1 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 shrink-0" />

        <div className="p-6 flex flex-col gap-5">
          {/* Icon + title */}
          <DialogHeader className="p-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-700/40">
                  <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base font-bold text-foreground leading-tight">
                    Unsaved Changes
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    You have unsaved work. What would you like to do?
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-lg p-1.5 bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 shadow-2xs shrink-0"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>
          </DialogHeader>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <Button
              type="button"
              onClick={onSaveDraft}
              className="w-full gap-2 h-10 bg-gradient-to-r from-[#0B5D4B] to-[#073B35] text-white font-semibold shadow-md shadow-[#0B5D4B]/20 hover:brightness-110 active:scale-[0.99] transition-all"
            >
              <FileText className="size-4 text-emerald-200" />
              {draftLabel}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={onDiscard}
              className="w-full gap-2 h-10 border-destructive/40 text-destructive hover:bg-destructive/5 hover:border-destructive/60 font-semibold transition-all"
            >
              <Trash2 className="size-4" />
              Discard &amp; Close
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="w-full gap-2 h-9 text-muted-foreground hover:text-foreground text-sm font-medium"
            >
              <X className="size-3.5" />
              Continue Editing
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
