import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface BorrowRejectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
  onUpdateReason: (reason: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

export function BorrowRejectDialog({
  open,
  onOpenChange,
  reason,
  onUpdateReason,
  onConfirm,
  isPending,
}: BorrowRejectDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(op) => {
        onOpenChange(op);
        if (!op) onUpdateReason("");
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Tolak Peminjaman</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Konfirmasi penolakan peminjaman ini. Alasan penolakan bersifat opsional.
          </p>
          <div>
            <label className="text-sm font-medium">Alasan Penolakan (opsional)</label>
            <Textarea
              value={reason}
              onChange={(e) => onUpdateReason(e.target.value)}
              placeholder="Contoh: Stok tidak mencukupi, jadwal bentrok, dll."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); onUpdateReason(""); }}>
            Tutup
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Konfirmasi Tolak
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
