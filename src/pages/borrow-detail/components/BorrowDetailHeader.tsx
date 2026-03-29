import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Share2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface BorrowDetailHeaderProps {
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onShare: () => void;
  isDeleting: boolean;
}

export function BorrowDetailHeader({
  canEdit,
  onEdit,
  onCancel,
  onShare,
  isDeleting,
}: BorrowDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link to="/inventory">
          <Button variant="outline" size="icon" className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Detail Peminjaman</h1>
      </div>
      <div className="flex gap-2">
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="gap-2 hidden sm:flex"
            >
              <Edit className="w-4 h-4" /> Edit
            </Button>
            <div className="hidden sm:flex">
              <CancelBorrowDialog onConfirm={onCancel} isDeleting={isDeleting} />
            </div>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={onShare}
          className="gap-2"
        >
          <Share2 className="w-4 h-4" />
          <span className="hidden sm:inline">Bagikan</span>
        </Button>
      </div>
    </div>
  );
}

function CancelBorrowDialog({ onConfirm, isDeleting }: { onConfirm: () => void; isDeleting: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="w-4 h-4" /> Batal
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Batalkan Peminjaman?</AlertDialogTitle>
          <AlertDialogDescription>
            Tindakan ini akan menghapus permintaan peminjaman. Aksi ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Tutup</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Batalkan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { CancelBorrowDialog };
