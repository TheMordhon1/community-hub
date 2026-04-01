import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type CatalogItem = Tables<"store_catalog_items">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  item?: CatalogItem;
}

export function CatalogItemDialog({ open, onOpenChange, storeId, item }: Props) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setPrice(item.price != null ? String(item.price) : "");
      setIsAvailable(item.is_available ?? true);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setIsAvailable(true);
    }
  }, [item, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        store_id: storeId,
        name,
        description: description || null,
        price: price ? Number(price) : null,
        is_available: isAvailable,
      };
      if (item?.id) {
        const { error } = await supabase.from("store_catalog_items").update(payload).eq("id", item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("store_catalog_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(item ? "Produk diperbarui" : "Produk ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["store-catalog", storeId] });
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nama Produk *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama produk" />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi produk" />
          </div>
          <div>
            <Label>Harga (Rp)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
          <div className="flex items-center justify-between">
            <Label>Tersedia</Label>
            <Switch checked={isAvailable} onCheckedChange={setIsAvailable} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
