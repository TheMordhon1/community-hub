import { useState, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const AVATAR_PRESETS = [
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Felix",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Luna",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Oliver",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Sophia",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Milo",
  "https://api.dicebear.com/7.x/adventurer/svg?seed=Zoe"
];

interface MemberAvatarSelectorProps {
  avatarUrl: string;
  onChange: (url: string) => void;
  defaultFallbackName: string;
  isRegisteredUser?: boolean;
  userProfileAvatar?: string | null;
}

export function MemberAvatarSelector({
  avatarUrl,
  onChange,
  defaultFallbackName,
  isRegisteredUser,
  userProfileAvatar
}: MemberAvatarSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        variant: "destructive",
        title: "File tidak valid",
        description: "Silakan pilih file gambar (JPG, PNG, dll)",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "File terlalu besar",
        description: "Ukuran maksimal foto adalah 2MB",
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const randomId = Math.random().toString(36).substring(2, 15);
      const filePath = `${randomId}.${fileExt}`;

      // Upload to supabase storage bucket
      const { error: uploadError } = await supabase.storage
        .from("competition-avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("competition-avatars")
        .getPublicUrl(filePath);

      onChange(urlData.publicUrl);
      toast({
        title: "Foto berhasil diunggah",
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "Gagal mengunggah foto",
        description: "Terjadi kesalahan saat mengunggah foto",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const currentDisplayAvatar = avatarUrl || (isRegisteredUser ? userProfileAvatar : "") || "";

  return (
    <div className="space-y-2 mt-1.5 p-2 bg-muted/40 rounded-lg border border-border/50">
      <div className="flex items-center gap-3">
        <div className="relative group shrink-0">
          <Avatar className="w-10 h-10 border border-primary/20 shadow-sm">
            <AvatarImage src={currentDisplayAvatar} />
            <AvatarFallback className="text-xs uppercase bg-primary/10 text-primary">
              {defaultFallbackName.slice(0, 2) || "?"}
            </AvatarFallback>
          </Avatar>
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          >
            <Camera className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">Foto / Avatar Peserta</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {avatarUrl ? "Menggunakan foto kustom" : isRegisteredUser && userProfileAvatar ? "Menggunakan foto profil warga" : "Belum ada foto"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          type="button"
          className="h-7 text-xs px-2.5 shrink-0"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? "Tutup" : "Pilih/Upload"}
        </Button>
      </div>

      {isOpen && (
        <div className="pt-2 border-t border-border/40 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
          {/* Preset options */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500 fill-current" />
              Pilih Avatar Preset
            </label>
            <div className="grid grid-cols-8 gap-1.5 p-1 bg-background/50 rounded-md">
              {AVATAR_PRESETS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={`relative rounded-full overflow-hidden hover:scale-105 transition-transform border-2 ${
                    avatarUrl === preset ? "border-primary shadow-sm" : "border-transparent"
                  }`}
                >
                  <img src={preset} alt={`Preset ${idx + 1}`} className="w-7 h-7 object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Custom actions */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Masukkan URL foto..."
                value={avatarUrl}
                onChange={(e) => onChange(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex gap-1 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs flex-1 sm:flex-none"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <ImageIcon className="w-3.5 h-3.5 mr-1" />
                )}
                Upload
              </Button>
              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={`h-7 text-xs ${
                    isRegisteredUser 
                      ? "text-primary hover:text-primary hover:bg-primary/10" 
                      : "text-destructive hover:text-destructive hover:bg-destructive/10"
                  }`}
                  onClick={() => onChange("")}
                >
                  {isRegisteredUser ? "Kembalikan Foto Profil Warga" : "Reset"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
