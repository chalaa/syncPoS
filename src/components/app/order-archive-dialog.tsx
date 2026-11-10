import { Archive } from "lucide-react";

import { archiveOrder } from "@/app/admin/order-archive-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { OrderArchiveType } from "@/server/archived/order-archive";

export function OrderArchiveDialog({ entityType, entityId, orderNo }: { entityType: OrderArchiveType; entityId: string; orderNo: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="danger"><Archive data-icon="inline-start" />Archive</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {orderNo}?</DialogTitle>
          <DialogDescription>
            The order, linked {entityType === "purchase_order" ? "receipts" : "deliveries"}, and registered payments will be archived together.
            Received stock will be removed or delivered stock returned. Archiving does not send or refund money.
          </DialogDescription>
        </DialogHeader>
        <form action={archiveOrder}>
          <input type="hidden" name="entityType" value={entityType} />
          <input type="hidden" name="entityId" value={entityId} />
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
            <Button type="submit" variant="danger" pendingLabel="Archiving..."><Archive data-icon="inline-start" />Archive Order</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
