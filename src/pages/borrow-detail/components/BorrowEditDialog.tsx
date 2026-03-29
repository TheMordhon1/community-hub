import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { InventoryItemRef, BorrowItem } from "../types";

interface BorrowEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItems: Map<string, number>;
  editNotes: string;
  editReturnDate: Date | undefined;
  allItems: InventoryItemRef[];
  bItems: BorrowItem[];
  isUpdating: boolean;
  onUpdateNotes: (notes: string) => void;
  onUpdateReturnDate: (date: Date | undefined) => void;
  onUpdateQuantity: (itemId: string, qty: number | "", maxAvailable: number) => void;
  onRemoveItem: (itemId: string) => void;
  onFinalizeQuantity: (itemId: string) => void;
  onSave: () => void;
}

export function BorrowEditDialog({
  open,
  onOpenChange,
  editItems,
  editNotes,
  editReturnDate,
  allItems,
  bItems,
  isUpdating,
  onUpdateNotes,
  onUpdateReturnDate,
  onUpdateQuantity,
  onRemoveItem,
  onFinalizeQuantity,
  onSave,
}: BorrowEditDialogProps) {
  const availableToAdd = allItems.filter(
    (i) =>
      (i.available_quantity > 0 || bItems.some((bi) => bi.item_id === i.id)) &&
      i.condition !== "broken" &&
      !editItems.has(i.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Peminjaman</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Item editor */}
          <div>
            <label className="text-sm font-medium mb-2 block">Daftar Barang *</label>
            <div className="space-y-2 mb-3">
              {Array.from(editItems.entries()).map(([itemId, qty]) => {
                const item = allItems.find((i) => i.id === itemId);
                if (!item) return null;
                const alreadyRequested = bItems.find((bi) => bi.item_id === itemId)?.quantity ?? 0;
                const maxAllowed = item.available_quantity + alreadyRequested;
                return (
                  <div key={itemId} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                    <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={maxAllowed}
                        className="w-16 h-8 text-center text-xs"
                        value={qty === 0 ? "" : qty}
                        onChange={(e) => {
                          const val = e.target.value;
                          onUpdateQuantity(itemId, val === "" ? "" : (parseInt(val) || 0), maxAllowed);
                        }}
                        onBlur={() => onFinalizeQuantity(itemId)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onRemoveItem(itemId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {editItems.size === 0 && (
                <p className="text-xs text-muted-foreground p-2 text-center border rounded-lg border-dashed">
                  Belum ada barang dipilih.
                </p>
              )}
            </div>

            {availableToAdd.length > 0 && (
              <Select
                value=""
                onValueChange={(val) => {
                  const item = allItems.find((i) => i.id === val);
                  if (item) {
                    const alreadyRequested = bItems.find((bi) => bi.item_id === item.id)?.quantity ?? 0;
                    onUpdateQuantity(val, 1, item.available_quantity + alreadyRequested);
                  }
                }}
              >
                <SelectTrigger className="w-full text-sm h-9">
                  <SelectValue placeholder="Tambah barang peminjaman..." />
                </SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} ({item.available_quantity} tersedia)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Return date */}
          <div className="pt-2 border-t">
            <label className="text-sm font-medium">Estimasi Tanggal Pengembalian *</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal mt-1", !editReturnDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {editReturnDate ? format(editReturnDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={editReturnDate}
                  onSelect={onUpdateReturnDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium">Catatan (opsional)</label>
            <Textarea
              value={editNotes}
              onChange={(e) => onUpdateNotes(e.target.value)}
              placeholder="Tujuan peminjaman, dll."
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
          <Button onClick={onSave} disabled={isUpdating}>
            {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
