import { useState, useEffect } from "react";
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
import { Loader2, Image as ImageIcon, X, Globe, Plus } from "lucide-react";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  houseId: string;
  mode?: "create" | "edit";
  initialData?: {
    id: string;
    name: string;
    wa_number: string;
    description: string | null;
    website_url: string | null;
    logo_url: string | null;
  };
}

export function StoreFormDialog({ open, onOpenChange, houseId, mode = "create", initialData }: Props) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [waNumber, setWaNumber] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && mode === "edit" && initialData) {
      setName(initialData.name || "");
      setWaNumber(initialData.wa_number || "");
      setDescription(initialData.description || "");
      setWebsiteUrl(initialData.website_url || "");
      setLogoUrl(initialData.logo_url || "");
    } else if (open && mode === "create") {
      setName("");
      setWaNumber("");
      setDescription("");
      setWebsiteUrl("");
      setLogoUrl("");
    }
  }, [open, mode, initialData]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "create") {
        const { error } = await supabase.from("stores").insert({
          house_id: houseId,
          name,
          wa_number: waNumber,
          description: description || null,
          website_url: websiteUrl || null,
          logo_url: logoUrl || null,
          created_by: profile!.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("stores").update({
          name,
          wa_number: waNumber,
          description: description || null,
          website_url: websiteUrl || null,
          logo_url: logoUrl || null,
          updated_at: new Date().toISOString(),
        }).eq("id", initialData.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Toko berhasil ditambahkan. Menunggu verifikasi pengurus." : "Perubahan berhasil disimpan.");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
      queryClient.invalidateQueries({ queryKey: ["store", initialData?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-stores"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
      const fileName = `${profile.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("resident-stores")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("resident-stores")
        .getPublicUrl(filePath);

      setLogoUrl(urlData.publicUrl);
      toast.success("Logo berhasil diunggah");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast.error("Gagal mengunggah logo: " + message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Toko Baru" : "Edit Toko"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl bg-muted border-2 border-dashed border-muted-foreground/20 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover" />
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
              {logoUrl && (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-lg"
                  onClick={() => setLogoUrl("")}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              Logo Toko (Optional, Max 1MB)
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nama Toko *</Label>
            <Input 
              id="name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Contoh: Warung Berkah" 
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wa">Nomor WhatsApp *</Label>
            <Input 
              id="wa"
              value={waNumber} 
              onChange={(e) => setWaNumber(e.target.value)} 
              placeholder="08xxxxxxxxx" 
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="website">Website / Link (Opsional)</Label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                id="website"
                value={websiteUrl} 
                onChange={(e) => setWebsiteUrl(e.target.value)} 
                placeholder="https://tokoanda.com" 
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="desc">Deskripsi</Label>
            <Textarea 
              id="desc"
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Ceritakan sedikit tentang toko Anda" 
              className="resize-none h-20"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => mutation.mutate()} disabled={!name.trim() || !waNumber.trim() || mutation.isPending}>
            {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "create" ? "Simpan" : "Simpan Perubahan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
