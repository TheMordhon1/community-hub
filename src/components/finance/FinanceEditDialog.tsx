import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import type { FinanceRecordWithDetails } from "@/types/database";

type FinanceType = "income" | "outcome" | "donation" | "donation_outcome";

interface CATEGORIES {
  income: string[];
  outcome: string[];
  donation: string[];
  donation_outcome: string[];
}

interface Props {
  ledgerType: "umum" | "donasi";
  CATEGORIES: CATEGORIES;
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editingRecord: FinanceRecordWithDetails | null;
  setEditingRecord: (r: FinanceRecordWithDetails | null) => void;
  updateRecord: {
    mutate: (data: any, options?: any) => void;
    isPending: boolean;
  };
}

export function FinanceEditDialog({
  ledgerType,
  CATEGORIES,
  isEditOpen,
  setIsEditOpen,
  editingRecord,
  setEditingRecord,
  updateRecord,
}: Props) {
  const [editType, setEditType] = useState<FinanceType>(editingRecord?.type ?? "income");
  const [editTransactionDate, setEditTransactionDate] = useState<Date | undefined>(
    editingRecord?.transaction_date ? new Date(editingRecord.transaction_date) : undefined
  );

  // Sync local state when editingRecord changes
  const handleOpenChange = (open: boolean) => {
    if (open && editingRecord) {
      setEditType(editingRecord.type as FinanceType);
      setEditTransactionDate(editingRecord.transaction_date ? new Date(editingRecord.transaction_date) : undefined);
    }
    setIsEditOpen(open);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecord) return;
    const fd = new FormData(e.currentTarget);
    updateRecord.mutate(
      {
        id: editingRecord.id,
        type: fd.get("type") as FinanceType,
        amount: fd.get("amount") as string,
        description: fd.get("description") as string,
        category: fd.get("category") as string,
        transaction_date: editTransactionDate ? format(editTransactionDate, "yyyy-MM-dd") : "",
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingRecord(null);
        },
      }
    );
  };

  return (
    <Dialog open={isEditOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Catatan Keuangan</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jenis */}
            <div className="space-y-2">
              <Label htmlFor="edit-type">Jenis Transaksi</Label>
              <Select
                name="type"
                value={editType}
                onValueChange={(v: FinanceType) => setEditType(v)}
              >
                <SelectTrigger id="edit-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ledgerType === "umum" ? (
                      <>
                        <SelectItem value="income">Pemasukan</SelectItem>
                        <SelectItem value="outcome">Pengeluaran</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="donation">Uang Masuk Donasi</SelectItem>
                        <SelectItem value="donation_outcome">Pengeluaran Donasi</SelectItem>
                      </>
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Jumlah */}
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Jumlah (Rp)</Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                defaultValue={editingRecord?.amount}
                required
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Kategori */}
            <div className="space-y-2">
              <Label htmlFor="edit-category">Kategori</Label>
              <Select name="category" defaultValue={editingRecord?.category}>
                <SelectTrigger id="edit-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {CATEGORIES[editType].map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Tanggal */}
            <div className="space-y-2">
              <Label>Tanggal Transaksi</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editTransactionDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editTransactionDate
                      ? format(editTransactionDate, "dd MMMM yyyy", { locale: localeId })
                      : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editTransactionDate}
                    onSelect={setEditTransactionDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Deskripsi</Label>
            <Textarea id="edit-description" name="description" defaultValue={editingRecord?.description} required rows={3} />
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={() => { setIsEditOpen(false); setEditingRecord(null); }}>
              Batal
            </Button>
            <Button type="submit" disabled={updateRecord.isPending}>
              {updateRecord.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
