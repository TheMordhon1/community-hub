import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Event } from "@/types/database";

interface EventDeleteDialogProps {
  deletingEvent: Event | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}

export function EventDeleteDialog({ deletingEvent, onClose, onConfirm }: EventDeleteDialogProps) {
  return (
    <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Acara</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus acara ini? Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deletingEvent) {
                onConfirm(deletingEvent.id);
                onClose();
              }
            }}
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
