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
import { Loader2, Image as ImageIcon, Plus, X } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

type CatalogItem = Tables<"store_catalog_items">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  item?: CatalogItem;
}

export function CatalogItemDialog({ open, onOpenChange, storeId, item }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setDescription(item.description || "");
      setPrice(item.price != null ? String(item.price) : "");
      setImageUrl(item.image_url || "");
      setIsAvailable(item.is_available ?? true);
    } else {
      setName("");
      setDescription("");
      setPrice("");
      setImageUrl("");
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
        image_url: imageUrl || null,
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("File tidak valid. Pilih file gambar.");
      return;
    }

    if (file.size > 1 * 1024 * 1024) {
      toast.error("File terlalu besar. Maksimal 1MB.");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.id}/product-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("resident-stores")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("resident-stores")
        .getPublicUrl(filePath);

      setImageUrl(urlData.publicUrl);
      toast.success("Foto produk berhasil diunggah");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error("Gagal mengunggah foto: " + message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1 py-1">
          <div className="flex flex-col items-center gap-2 mb-4">
            <Label>Foto Produk (Optional)</Label>
            <div className="relative group">
              <div className="w-32 h-32 rounded-xl bg-muted border-2 border-dashed border-muted-foreground/20 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                {imageUrl ? (
                  <img src={imageUrl} alt="Product preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    )}
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full shadow-lg border"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                <Plus className="h-4 w-4" />
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                  onClick={() => setImageUrl("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

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
