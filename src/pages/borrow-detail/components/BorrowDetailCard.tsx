import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Package, CheckCircle, XCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./StatusBadge";
import { BorrowRequest, BorrowItem, InventoryItemRef } from "../types";
import { Edit } from "lucide-react";
import { CancelBorrowDialog } from "./BorrowDetailHeader";

interface BorrowDetailCardProps {
  borrow: BorrowRequest;
  borrowerName: string;
  approverName: string | null;
  bItems: BorrowItem[];
  canManage: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onReject: () => void;
  onStatusUpdate: (status: string) => void;
  isDeleting: boolean;
}

export function BorrowDetailCard({
  borrow,
  borrowerName,
  approverName,
  bItems,
  canManage,
  canEdit,
  onEdit,
  onCancel,
  onReject,
  onStatusUpdate,
  isDeleting,
}: BorrowDetailCardProps) {
  return (
    <Card className="shadow-lg border-2">
      <CardHeader className="bg-muted/30 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-xl">{borrowerName}</CardTitle>
            <CardDescription>
              Diajukan pada: {format(new Date(borrow.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
            </CardDescription>
          </div>
          <StatusBadge status={borrow.status} />
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Item list */}
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Daftar Barang</h3>
          <div className="space-y-3">
            {bItems.map((bi) => {
              const item = bi.item as InventoryItemRef | null;
              return (
                <div key={bi.id} className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {item?.image_url ? (
                      <div className="w-10 h-10 rounded overflow-hidden bg-background shrink-0">
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-background border flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-muted-foreground/50" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm sm:text-base leading-tight">{item?.name || "Unknown"}</p>
                      {item?.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="font-bold sm:text-base px-3 py-1">{bi.quantity} unit</Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notes / info */}
        <div className="grid sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border">
          {borrow.notes && (
            <div className="sm:col-span-2">
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informasi & Catatan</h3>
              <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                {borrow.notes.startsWith("Estimasi Pengembalian:") ? borrow.notes : `Catatan: ${borrow.notes}`}
              </p>
            </div>
          )}
          {approverName && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Disetujui Oleh</h3>
              <p className="text-sm font-medium">{approverName}</p>
              {borrow.approved_at && (
                <p className="text-xs text-muted-foreground">
                  Pada {format(new Date(borrow.approved_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                </p>
              )}
            </div>
          )}
          {borrow.return_date && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-1">Dikembalikan Pada</h3>
              <p className="text-sm font-medium">
                {format(new Date(borrow.return_date), "dd MMM yyyy HH:mm", { locale: idLocale })}
              </p>
            </div>
          )}
        </div>

        {/* Admin actions */}
        {canManage && (
          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {borrow.status === "pending" && (
              <>
                <Button onClick={() => onStatusUpdate("approved")} className="gap-2">
                  <CheckCircle className="w-4 h-4" /> Setujui
                </Button>
                <Button variant="destructive" onClick={onReject} className="gap-2">
                  <XCircle className="w-4 h-4" /> Tolak
                </Button>
              </>
            )}
            {borrow.status === "approved" && (
              <>
                <Button onClick={() => onStatusUpdate("borrowed")} className="gap-2">
                  <Package className="w-4 h-4" /> Tandai Dipinjam (Keluar)
                </Button>
                <Button variant="outline" onClick={() => onStatusUpdate("pending")} className="gap-2 text-muted-foreground">
                  <RotateCcw className="w-4 h-4" /> Batalkan Persetujuan
                </Button>
              </>
            )}
            {borrow.status === "borrowed" && (
              <Button onClick={() => onStatusUpdate("returned")} className="gap-2">
                <RotateCcw className="w-4 h-4" /> Tandai Dikembalikan
              </Button>
            )}
            {borrow.status === "rejected" && (
              <Button variant="outline" onClick={() => onStatusUpdate("pending")} className="gap-2 text-muted-foreground">
                <RotateCcw className="w-4 h-4" /> Batalkan Penolakan
              </Button>
            )}
          </div>
        )}

        {/* Mobile edit / cancel buttons */}
        {canEdit && (
          <div className="flex sm:hidden gap-2 pt-4 border-t">
            <Button variant="outline" size="sm" onClick={onEdit} className="flex-1 gap-2">
              <Edit className="w-4 h-4" /> Edit
            </Button>
            <CancelBorrowDialog onConfirm={onCancel} isDeleting={isDeleting} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
