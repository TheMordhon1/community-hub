import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { useAddFinanceRecord } from "@/hooks/finance/useAddFinanceRecord";
import { useUpdateFinanceRecord } from "@/hooks/finance/useEditFinanceRecord";
import { useDeleteFinanceRecord } from "@/hooks/finance/useDeleteFinanceRecord";
import type { FinanceRecordWithDetails } from "@/types/database";

type FinanceType = "income" | "outcome" | "donation" | "donation_outcome";

interface CATEGORIES {
  income: string[];
  outcome: string[];
  donation: string[];
  donation_outcome: string[];
}

interface FinanceRecordDialogsProps {
  ledgerType: "umum" | "donasi";
  canManageFinance: boolean;
  CATEGORIES: CATEGORIES;
  // Edit state (controlled externally so the table can trigger it)
  isEditOpen: boolean;
  setIsEditOpen: (open: boolean) => void;
  editingRecord: FinanceRecordWithDetails | null;
  setEditingRecord: (r: FinanceRecordWithDetails | null) => void;
  // Delete state
  deletingRecord: { isModalOpen: boolean; data: FinanceRecordWithDetails | null };
  setDeletingRecord: (v: { isModalOpen: boolean; data: FinanceRecordWithDetails | null }) => void;
}

export function FinanceRecordDialogs({
  ledgerType,
  canManageFinance,
  CATEGORIES,
  isEditOpen,
  setIsEditOpen,
  editingRecord,
  setEditingRecord,
  deletingRecord,
  setDeletingRecord,
}: FinanceRecordDialogsProps) {
  const addRecord = useAddFinanceRecord();
  const updateRecord = useUpdateFinanceRecord();
  const deleteRecord = useDeleteFinanceRecord();

  // Add form state
  const [formData, setFormData] = useState({
    type: (ledgerType === "umum" ? "income" : "donation") as FinanceType,
    amount: "",
    description: "",
    category: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  // Edit internal state
  const [editType, setEditType] = useState<FinanceType>(
    editingRecord?.type ?? "income"
  );
  const [editTransactionDate, setEditTransactionDate] = useState<Date | undefined>(
    editingRecord?.transaction_date ? new Date(editingRecord.transaction_date) : undefined
  );

  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
        transaction_date: editTransactionDate
          ? format(editTransactionDate, "yyyy-MM-dd")
          : "",
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
    <>
      {/* Add Record Dialog */}
      {canManageFinance && (
        <Dialog
          open={undefined}
          onOpenChange={(open) => {
            if (open) {
              setFormData({
                type: ledgerType === "umum" ? "income" : "donation",
                amount: "",
                description: "",
                category: "",
                transaction_date: new Date().toISOString().split("T")[0],
              });
            }
          }}
        >
          <div className="flex justify-end">
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 sm:mr-2" />
                <span className="inline">Tambah Catatan</span>
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Catatan Keuangan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v: FinanceType) =>
                    setFormData({ ...formData, type: v, category: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES[formData.type].map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Jumlah (Rp)</Label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="Contoh: 500000"
                />
              </div>

              <div className="space-y-2">
                <Label>Tanggal Transaksi</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.transaction_date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.transaction_date
                        ? format(new Date(formData.transaction_date), "dd MMMM yyyy", { locale: localeId })
                        : <span>Pilih tanggal</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.transaction_date ? new Date(formData.transaction_date) : undefined}
                      onSelect={(date) =>
                        setFormData({
                          ...formData,
                          transaction_date: date ? format(date, "yyyy-MM-dd") : "",
                        })
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Keterangan transaksi"
                />
              </div>

              <Button
                onClick={() => addRecord.mutate(formData)}
                disabled={!formData.amount || !formData.description || !formData.category || addRecord.isPending}
                className="w-full"
              >
                {addRecord.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {addRecord.isPending ? "Menyimpan..." : "Tambah Catatan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Catatan Keuangan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Jenis Transaksi</Label>
                <Select
                  name="type"
                  defaultValue={editingRecord?.type}
                  value={editType}
                  onValueChange={(v: FinanceType) => setEditType(v)}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
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
              <div className="space-y-2">
                <Label htmlFor="edit-category">Kategori</Label>
                <Select name="category" defaultValue={editingRecord?.category}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
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

              <div className="space-y-2">
                <Label>Tanggal Transaksi</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !editTransactionDate && "text-muted-foreground")}
                    >
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

            <div className="space-y-2">
              <Label htmlFor="edit-description">Deskripsi</Label>
              <Textarea
                id="edit-description"
                name="description"
                defaultValue={editingRecord?.description}
                required
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingRecord(null);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={updateRecord.isPending}>
                {updateRecord.isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
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
              Apakah anda yakin ingin menghapus data{" "}
              {deletingRecord?.data?.category} ini?
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
    </>
  );
}
