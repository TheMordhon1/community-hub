import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
}

export function CreateStoreDialog({ open, onOpenChange, houseId }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").insert({
        house_id: houseId,
        name,
        wa_number: waNumber,
        description: description || null,
        created_by: profile!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Toko berhasil ditambahkan. Menunggu verifikasi pengurus.");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      onOpenChange(false);
      setName("");
      setWaNumber("");
      setDescription("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Toko Baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama Toko *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama toko Anda" />
          </div>
          <div>
            <Label>Nomor WhatsApp *</Label>
            <Input value={waNumber} onChange={(e) => setWaNumber(e.target.value)} placeholder="08xxxxxxxxxx" />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi singkat toko Anda" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !waNumber.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
