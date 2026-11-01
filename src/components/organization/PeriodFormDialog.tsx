import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { OrganizationPeriod, PeriodInput } from "@/hooks/useOrganizationPeriods";

interface PeriodFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period?: OrganizationPeriod | null;
  periods: OrganizationPeriod[];
  defaultCopyFromId?: string | null;
  isSaving: boolean;
  onSubmit: (input: PeriodInput, copyFromPeriodId: string | null) => void;
}

const NO_COPY = "__none__";

export function PeriodFormDialog({
  open,
  onOpenChange,
  period,
  periods,
  defaultCopyFromId,
  isSaving,
  onSubmit,
}: PeriodFormDialogProps) {
  const isEdit = !!period;
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [notes, setNotes] = useState("");
  const [copyFrom, setCopyFrom] = useState<string>(NO_COPY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (period) {
      setName(period.name);
      setStartYear(String(period.start_year));
      setEndYear(period.end_year ? String(period.end_year) : "");
      setNotes(period.notes ?? "");
      setCopyFrom(NO_COPY);
    } else {
      const latest = periods.reduce((max, p) => Math.max(max, p.end_year ?? p.start_year), new Date().getFullYear() - 1);
      const next = latest + 1;
      setName(`Periode ${next}`);
      setStartYear(String(next));
      setEndYear(String(next));
      setNotes("");
      setCopyFrom(defaultCopyFromId ?? NO_COPY);
    }
  }, [open, period, periods, defaultCopyFromId]);

  const handleSubmit = () => {
    const start = parseInt(startYear, 10);
    const end = endYear.trim() ? parseInt(endYear, 10) : null;
    if (!name.trim()) return setError("Nama periode wajib diisi");
    if (!Number.isFinite(start) || start < 1900 || start > 2200) return setError("Tahun mulai tidak valid");
    if (end !== null && (!Number.isFinite(end) || end < start)) return setError("Tahun selesai harus sama atau setelah tahun mulai");
    setError(null);
    onSubmit(
      { name: name.trim(), start_year: start, end_year: end, notes: notes.trim() || null },
      !isEdit && copyFrom !== NO_COPY ? copyFrom : null,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Periode" : "Periode Baru"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui informasi periode kepengurusan."
              : "Susun struktur pengurus untuk periode berikutnya. Periode baru tidak langsung aktif."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="period-name">Nama Periode</Label>
            <Input id="period-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Periode 2027" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="period-start">Tahun Mulai</Label>
              <Input id="period-start" inputMode="numeric" value={startYear} onChange={(e) => setStartYear(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-end">Tahun Selesai</Label>
              <Input id="period-end" inputMode="numeric" value={endYear} onChange={(e) => setEndYear(e.target.value.replace(/\D/g, ""))} placeholder="Opsional" />
            </div>
          </div>
          {!isEdit && periods.length > 0 && (
            <div className="space-y-2">
              <Label>Salin pengurus dari</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_COPY}>Mulai kosong</SelectItem>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.is_active ? " (Aktif)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="period-notes">Catatan</Label>
            <Textarea id="period-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Opsional" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
