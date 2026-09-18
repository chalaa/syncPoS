"use client";

import type { ReactNode } from "react";
import { AlertTriangleIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useTranslation } from "@/lib/i18n/use-translation";

type DeleteConfirmationDialogProps = {
  title?: string;
  description?: string;
  itemName?: string;
  action: (formData: FormData) => void | Promise<void>;
  hiddenInputs?: Record<string, string>;
  children?: ReactNode;
  triggerLabel?: string;
  variant?: "destructive" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

export function DeleteConfirmationDialog({
  title,
  description,
  itemName,
  action,
  hiddenInputs = {},
  children,
  triggerLabel,
  variant = "destructive",
  size = "sm",
  className = "h-7 text-xs",
}: DeleteConfirmationDialogProps) {
  const { t } = useTranslation();

  const dialogTitle = title ?? t("action.confirmDeletion", "Confirm Deletion");
  const buttonTriggerLabel = triggerLabel ?? t("action.delete", "Delete");
  const displayDescription =
    description ??
    (itemName
      ? `Are you sure you want to delete "${itemName}"? It will be moved to the Settings Archive.`
      : "Are you sure you want to delete this item? It will be moved to the Settings Archive.");

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ?? (
          <Button variant={variant} size={size} className={className}>
            <Trash2Icon className="size-3.5" data-icon="inline-start" />
            {buttonTriggerLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={action} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="size-5 shrink-0" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground pt-1">
              {displayDescription}
            </DialogDescription>
          </DialogHeader>

          {Object.entries(hiddenInputs).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("action.cancel", "Cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive">
              <Trash2Icon className="size-4" data-icon="inline-start" />
              {t("action.confirmDelete", "Confirm Delete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
