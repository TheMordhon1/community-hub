import { useState } from "react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus, Loader2 } from "lucide-react";
import { useAddFinanceRecord } from "@/hooks/finance/useAddFinanceRecord";

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
  isAddOpen: boolean;
  setIsAddOpen: (open: boolean) => void;
}

export function FinanceAddDialog({ ledgerType, CATEGORIES, isAddOpen, setIsAddOpen }: Props) {
  const addRecord = useAddFinanceRecord();
  const defaultType: FinanceType = ledgerType === "umum" ? "income" : "donation";

  const [formData, setFormData] = useState<{
    type: string;
    amount: string;
    description: string;
    category: string;
    transaction_date: string;
  }>({
    type: defaultType,
    amount: "",
    description: "",
    category: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const resetForm = () =>
    setFormData({ type: defaultType, amount: "", description: "", category: "", transaction_date: new Date().toISOString().split("T")[0] });

  return (
    <Dialog
      open={isAddOpen}
      onOpenChange={(open) => {
        if (open) resetForm();
        setIsAddOpen(open);
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
          {/* Jenis */}
          <div className="space-y-2">
            <Label>Jenis</Label>
            <Select
              value={formData.type}
              onValueChange={(v) => setFormData({ ...formData, type: v as FinanceType, category: "" })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
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

          {/* Kategori */}
          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {CATEGORIES[formData.type].map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Jumlah */}
          <div className="space-y-2">
            <Label>Jumlah (Rp)</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="Contoh: 500000"
            />
          </div>

          {/* Tanggal */}
          <div className="space-y-2">
            <Label>Tanggal Transaksi</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.transaction_date && "text-muted-foreground")}>
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
                  onSelect={(date) => setFormData({ ...formData, transaction_date: date ? format(date, "yyyy-MM-dd") : "" })}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Deskripsi */}
          <div className="space-y-2">
            <Label>Deskripsi</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Keterangan transaksi"
            />
          </div>

          <Button
            onClick={() => addRecord.mutate({ ...formData, type: formData.type as FinanceType }, { onSuccess: () => { resetForm(); setIsAddOpen(false); } })}
            disabled={!formData.amount || !formData.description || !formData.category || addRecord.isPending}
            className="w-full"
          >
            {addRecord.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            {addRecord.isPending ? "Menyimpan..." : "Tambah Catatan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
