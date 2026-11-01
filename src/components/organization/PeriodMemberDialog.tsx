import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PengurusTitle, PeriodMember } from "@/hooks/useOrganizationPeriods";

interface ProfileOption {
  id: string;
  full_name: string;
  email: string;
}

interface PeriodMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member?: PeriodMember | null;
  existingUserIds: string[];
  profiles: ProfileOption[];
  titles: PengurusTitle[];
  isSaving: boolean;
  onSubmit: (userId: string, titleId: string) => void;
}

export function PeriodMemberDialog({
  open,
  onOpenChange,
  member,
  existingUserIds,
  profiles,
  titles,
  isSaving,
  onSubmit,
}: PeriodMemberDialogProps) {
  const isEdit = !!member;
  const [userId, setUserId] = useState("");
  const [titleId, setTitleId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUserId(member?.user_id ?? "");
    setTitleId(member?.title_id ?? "");
  }, [open, member]);

  const available = useMemo(() => {
    const taken = new Set(existingUserIds);
    return profiles.filter((p) => p.id === member?.user_id || !taken.has(p.id));
  }, [profiles, existingUserIds, member]);

  const selected = profiles.find((p) => p.id === userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Jabatan" : "Tambah Pengurus"}</DialogTitle>
          <DialogDescription>Pilih warga terdaftar dan jabatannya pada periode ini.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Warga</Label>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  disabled={isEdit}
                  className="w-full justify-between font-normal"
                >
                  <span className="truncate">{selected ? selected.full_name || selected.email : "Pilih warga..."}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
                <Command>
                  <CommandInput placeholder="Cari nama atau email..." />
                  <CommandList className="max-h-64">
                    <CommandEmpty>Warga tidak ditemukan.</CommandEmpty>
                    <CommandGroup>
                      {available.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`${p.full_name} ${p.email}`}
                          onSelect={() => {
                            setUserId(p.id);
                            setPickerOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", userId === p.id ? "opacity-100" : "opacity-0")} />
                          <div className="min-w-0">
                            <p className="truncate">{p.full_name || "(tanpa nama)"}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label>Jabatan</Label>
            <Select value={titleId} onValueChange={setTitleId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jabatan" />
              </SelectTrigger>
              <SelectContent>
                {titles.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={() => onSubmit(userId, titleId)} disabled={isSaving || !userId || !titleId}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
