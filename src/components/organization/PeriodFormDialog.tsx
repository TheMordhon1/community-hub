import { useEffect, useState } from "react";
import { addDays, addYears, format, subDays } from "date-fns";
import { id as idLocale } from "date-fns/locale";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarIcon, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseIsoDate,
  toIsoDate,
  type OrganizationPeriod,
  type PeriodInput,
} from "@/hooks/useOrganizationPeriods";

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

/** Latest end of any existing period, used to suggest the next period's start. */
function latestPeriodEnd(periods: OrganizationPeriod[]): Date | null {
  let latest: Date | null = null;
  for (const p of periods) {
    const end = parseIsoDate(p.end_date) ?? new Date(p.end_year ?? p.start_year, 11, 31);
    if (!latest || end > latest) latest = end;
  }
  return latest;
}

interface DateFieldProps {
  id: string;
  label: string;
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  placeholder: string;
  disabledBefore?: Date;
  clearable?: boolean;
}

function DateField({ id, label, value, onChange, placeholder, disabledBefore, clearable }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2 min-w-0">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={id}
              variant="outline"
              className={cn("flex-1 min-w-0 justify-start text-left font-normal", !value && "text-muted-foreground")}
            >
              <CalendarIcon className="w-4 h-4 mr-2 shrink-0" />
              <span className="truncate">{value ? format(value, "d MMM yyyy", { locale: idLocale }) : placeholder}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              locale={idLocale}
              selected={value}
              defaultMonth={value ?? disabledBefore}
              onSelect={(d) => {
                onChange(d);
                setOpen(false);
              }}
              disabled={disabledBefore ? { before: disabledBefore } : undefined}
              captionLayout="dropdown-buttons"
              fromYear={2000}
              toYear={2100}
              initialFocus
              className="p-3 pointer-events-auto"
              classNames={{
                caption_label: "hidden",
                caption_dropdowns: "flex gap-1",
                dropdown: "rounded-md border border-input bg-background px-1 py-0.5 text-sm",
                vhidden: "sr-only",
              }}
            />
          </PopoverContent>
        </Popover>
        {clearable && value && (
          <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`Kosongkan ${label}`} onClick={() => onChange(undefined)}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

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
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [notes, setNotes] = useState("");
  const [copyFrom, setCopyFrom] = useState<string>(NO_COPY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (period) {
      setName(period.name);
      setStartDate(parseIsoDate(period.start_date) ?? new Date(period.start_year, 0, 1));
      const end = parseIsoDate(period.end_date) ?? (period.end_year ? new Date(period.end_year, 11, 31) : null);
      setEndDate(end ?? undefined);
      setNotes(period.notes ?? "");
      setCopyFrom(NO_COPY);
    } else {
      const latest = latestPeriodEnd(periods);
      const start = latest ? addDays(latest, 1) : new Date(new Date().getFullYear(), 0, 1);
      setName(`Periode ${start.getFullYear()}`);
      setStartDate(start);
      setEndDate(subDays(addYears(start, 1), 1));
      setNotes("");
      setCopyFrom(defaultCopyFromId ?? NO_COPY);
    }
  }, [open, period, periods, defaultCopyFromId]);

  const handleStartChange = (d: Date | undefined) => {
    setStartDate(d);
    if (d && endDate && endDate < d) setEndDate(undefined);
  };

  const handleSubmit = () => {
    if (!name.trim()) return setError("Nama periode wajib diisi");
    if (!startDate) return setError("Tanggal mulai wajib diisi");
    if (endDate && endDate < startDate) return setError("Tanggal selesai harus sama atau setelah tanggal mulai");
    setError(null);
    onSubmit(
      {
        name: name.trim(),
        start_date: toIsoDate(startDate),
        end_date: endDate ? toIsoDate(endDate) : null,
        start_year: startDate.getFullYear(),
        end_year: endDate ? endDate.getFullYear() : null,
        notes: notes.trim() || null,
      },
      !isEdit && copyFrom !== NO_COPY ? copyFrom : null,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto rounded-lg">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateField
              id="period-start"
              label="Tanggal Mulai"
              value={startDate}
              onChange={handleStartChange}
              placeholder="Pilih tanggal"
            />
            <DateField
              id="period-end"
              label="Tanggal Selesai"
              value={endDate}
              onChange={setEndDate}
              placeholder="Opsional"
              disabledBefore={startDate}
              clearable
            />
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

        <DialogFooter className="gap-2 sm:gap-0">
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
