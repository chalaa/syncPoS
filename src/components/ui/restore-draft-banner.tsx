"use client";

import { History, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/use-translation";

export type RestoreDraftBannerProps = {
  hasDraft: boolean;
  onRestore: () => void;
  onDiscard: () => void;
};

export function RestoreDraftBanner({
  hasDraft,
  onRestore,
  onDiscard,
}: RestoreDraftBannerProps) {
  const { t } = useTranslation();

  if (!hasDraft) return null;

  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4 text-xs font-medium text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs transition-all">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
          <History className="size-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-bold text-xs">
            {t("draft.unfinishedTitle", "Unfinished Form Draft Found")}
          </p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
            {t("draft.unfinishedDesc", "You have an unsaved draft from a previous session. Would you like to restore it?")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
        <Button
          type="button"
          size="sm"
          onClick={onRestore}
          className="gap-1.5 h-8 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-2xs cursor-pointer"
        >
          <RotateCcw className="size-3.5" />
          {t("draft.restoreOption", "Restore last form")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDiscard}
          className="gap-1.5 h-8 px-2.5 rounded-lg border-amber-600/30 text-amber-800 dark:text-amber-200 hover:bg-amber-500/20 text-xs font-medium cursor-pointer"
        >
          <Trash2 className="size-3.5 text-destructive" />
          {t("action.discard", "Discard")}
        </Button>
      </div>
    </div>
  );
}
