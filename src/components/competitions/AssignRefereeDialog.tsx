import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAssignReferee } from "@/hooks/useCompetitions";
import { getInitials } from "@/lib/utils";
import type { EventCompetitionWithDetails } from "@/types/competition";

interface AssignRefereeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competition: EventCompetitionWithDetails;
  title?: string;
  description?: string;
  onAssigned?: () => void;
}

export function AssignRefereeDialog({
  open,
  onOpenChange,
  competition,
  title = "Tambah Wasit",
  description = "Pilih warga terdaftar atau masukkan nama wasit secara manual.",
  onAssigned,
}: AssignRefereeDialogProps) {
  const [source, setSource] = useState<"user" | "manual">("user");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [manualName, setManualName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const assignReferee = useAssignReferee();
  const referees = competition.referees || [];

  useEffect(() => {
    if (!open) {
      setSource("user");
      setSelectedUserId("");
      setManualName("");
      setSearchQuery("");
    }
  }, [open]);

  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["all-profiles-for-referee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const isValid =
    source === "user" ? !!selectedUserId : manualName.trim().length > 0;

  const handleSubmit = () => {
    if (!isValid) return;
    assignReferee.mutate(
      {
        competition_id: competition.id,
        user_id: source === "user" ? selectedUserId : null,
        manual_name: source === "manual" ? manualName.trim() : null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onAssigned?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Sumber Wasit</Label>
            <RadioGroup
              value={source}
              onValueChange={(v) => setSource(v as "user" | "manual")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="ref-src-user" value="user" />
                <Label htmlFor="ref-src-user" className="font-normal cursor-pointer">
                  Warga Terdaftar
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="ref-src-manual" value="manual" />
                <Label htmlFor="ref-src-manual" className="font-normal cursor-pointer">
                  Input Manual
                </Label>
              </div>
            </RadioGroup>
          </div>

          {source === "user" ? (
            <div className="space-y-2">
              <Label>Pilih Warga</Label>
              <Input
                placeholder="Cari nama warga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="border rounded-md max-h-56 overflow-y-auto">
                {isLoadingProfiles ? (
                  <div className="flex items-center justify-center p-4 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Memuat...
                  </div>
                ) : (
                  (() => {
                    const list =
                      profiles?.filter(
                        (p) =>
                          !referees.some((r) => r.user_id === p.id) &&
                          p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
                      ) || [];
                    if (list.length === 0) {
                      return (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Tidak ada warga ditemukan
                        </div>
                      );
                    }
                    return list.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedUserId(p.id)}
                        className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                          selectedUserId === p.id ? "bg-muted" : ""
                        }`}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={p.avatar_url || ""} />
                          <AvatarFallback>{getInitials(p.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{p.full_name}</span>
                        {selectedUserId === p.id && (
                          <div className="ml-auto text-primary text-xs font-medium">
                            Terpilih
                          </div>
                        )}
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="ref-manual-name">Nama Wasit</Label>
              <Input
                id="ref-manual-name"
                placeholder="Contoh: Pak Budi (Wasit Tamu)"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Gunakan opsi ini jika wasit bukan warga terdaftar di aplikasi.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || assignReferee.isPending}>
            {assignReferee.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Simpan Wasit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
