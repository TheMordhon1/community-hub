import { Loader2 } from "lucide-react";
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
import type { FinanceRecordWithDetails } from "@/types/database";

interface Props {
  deletingRecord: { isModalOpen: boolean; data: FinanceRecordWithDetails | null };
  setDeletingRecord: (v: { isModalOpen: boolean; data: FinanceRecordWithDetails | null }) => void;
  deleteRecord: {
    mutate: (id: string | undefined) => void;
    isPending: boolean;
  };
}

export function FinanceDeleteDialog({ deletingRecord, setDeletingRecord, deleteRecord }: Props) {
  return (
    <AlertDialog
      open={!!deletingRecord.isModalOpen}
      onOpenChange={(open) =>
        !open && setDeletingRecord({ data: deletingRecord?.data, isModalOpen: false })
      }
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah anda yakin ingin menghapus data {deletingRecord?.data?.category} ini?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              deleteRecord.mutate(deletingRecord?.data?.id);
              setDeletingRecord({ isModalOpen: false, data: null });
            }}
          >
            {deleteRecord.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
