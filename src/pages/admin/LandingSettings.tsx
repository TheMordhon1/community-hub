import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  Loader2,
  ImagePlus,
  X,
  ExternalLink,
} from "lucide-react";
import { Link } from "react-router-dom";

type LandingSettings = Record<string, string | null>;

export default function LandingSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<LandingSettings>({});
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_settings")
        .select("key, value");
      if (error) throw error;
      const settingsObj: LandingSettings = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value;
      });
      return settingsObj;
    },
  });

  useEffect(() => {
    if (settingsData) {
      setSettings(settingsData);
      if (settingsData.hero_image) {
        setHeroImagePreview(settingsData.hero_image);
      }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: async (updatedSettings: LandingSettings) => {
      for (const [key, value] of Object.entries(updatedSettings)) {
        const { error } = await supabase
          .from("landing_settings")
          .update({ value })
          .eq("key", key);

        if (error) {
          // Try insert if update fails (key doesn't exist)
          const { error: insertError } = await supabase
            .from("landing_settings")
            .insert({ key, value });
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-settings"] });
      toast({ title: "Berhasil", description: "Pengaturan berhasil disimpan" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menyimpan pengaturan",
      });
    },
  });

  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setHeroImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeHeroImage = () => {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    setSettings((prev) => ({ ...prev, hero_image: null }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadHeroImage = async (): Promise<string | null> => {
    if (!heroImageFile) return settings.hero_image || null;

    const fileExt = heroImageFile.name.split(".").pop();
    const fileName = `hero-${Date.now()}.${fileExt}`;
    const filePath = `hero/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("landing-images")
      .upload(filePath, heroImageFile);

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from("landing-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSave = async () => {
    setIsUploading(true);

    let heroImageUrl = settings.hero_image;

    if (heroImageFile) {
      const uploadedUrl = await uploadHeroImage();
      if (uploadedUrl) {
        heroImageUrl = uploadedUrl;
      } else {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal mengupload gambar hero",
        });
        setIsUploading(false);
        return;
      }
    } else if (!heroImagePreview) {
      heroImageUrl = null;
    }

    const updatedSettings = {
      ...settings,
      hero_image: heroImageUrl,
    };

    setIsUploading(false);
    saveMutation.mutate(updatedSettings);
  };

  const updateSetting = (key: string, value: string | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="font-display text-2xl font-bold">
                Pengaturan Landing Page
              </h1>
              <p className="text-muted-foreground">
                Kelola konten halaman utama
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/" target="_blank">
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4 mr-2" />
                Preview
              </Button>
            </Link>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isUploading}
            >
              {(saveMutation.isPending || isUploading) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              <Save className="w-4 h-4 mr-2" />
              Simpan
            </Button>
          </div>
        </motion.div>

        {/* Hero Section Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Hero Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Gambar Hero (opsional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleHeroImageChange}
                className="hidden"
              />
              {heroImagePreview ? (
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={heroImagePreview}
                    alt="Hero Preview"
                    className="w-full h-48 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={removeHeroImage}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-32 border-dashed"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="w-6 h-6 mr-2" />
                  Tambah Gambar Hero
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero_title">Judul Hero</Label>
              <Input
                id="hero_title"
                value={settings.hero_title || ""}
                onChange={(e) => updateSetting("hero_title", e.target.value)}
                placeholder="Selamat Datang di Perumahan Kami"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hero_subtitle">Subjudul Hero</Label>
              <Textarea
                id="hero_subtitle"
                value={settings.hero_subtitle || ""}
                onChange={(e) => updateSetting("hero_subtitle", e.target.value)}
                placeholder="Komunitas yang nyaman, aman, dan asri..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Community Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informasi Perumahan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="community_name">Nama Perumahan</Label>
              <Input
                id="community_name"
                value={settings.community_name || ""}
                onChange={(e) => updateSetting("community_name", e.target.value)}
                placeholder="Perumahan Harmoni Indah"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="about_text">Tentang Perumahan</Label>
              <Textarea
                id="about_text"
                value={settings.about_text || ""}
                onChange={(e) => updateSetting("about_text", e.target.value)}
                placeholder="Deskripsi tentang perumahan..."
                rows={4}
              />
            </div>

            <Separator />

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Input
                  id="address"
                  value={settings.address || ""}
                  onChange={(e) => updateSetting("address", e.target.value)}
                  placeholder="Jl. Harmoni Indah No. 1"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telepon</Label>
                <Input
                  id="phone"
                  value={settings.phone || ""}
                  onChange={(e) => updateSetting("phone", e.target.value)}
                  placeholder="021-1234567"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email || ""}
                onChange={(e) => updateSetting("email", e.target.value)}
                placeholder="info@perumahan.com"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section Visibility */}
        <Card>
          <CardHeader>
            <CardTitle>Tampilkan Section</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Statistik</Label>
                <p className="text-sm text-muted-foreground">
                  Total rumah, warga, dan acara
                </p>
              </div>
              <Switch
                checked={settings.show_stats !== "false"}
                onCheckedChange={(checked) =>
                  updateSetting("show_stats", checked ? "true" : "false")
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Galeri</Label>
                <p className="text-sm text-muted-foreground">
                  Foto-foto perumahan dari tabel galeri
                </p>
              </div>
              <Switch
                checked={settings.show_gallery !== "false"}
                onCheckedChange={(checked) =>
                  updateSetting("show_gallery", checked ? "true" : "false")
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Acara Mendatang</Label>
                <p className="text-sm text-muted-foreground">
                  3 acara terdekat yang akan datang
                </p>
              </div>
              <Switch
                checked={settings.show_events !== "false"}
                onCheckedChange={(checked) =>
                  updateSetting("show_events", checked ? "true" : "false")
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Pengumuman</Label>
                <p className="text-sm text-muted-foreground">
                  3 pengumuman terbaru yang dipublikasi
                </p>
              </div>
              <Switch
                checked={settings.show_announcements !== "false"}
                onCheckedChange={(checked) =>
                  updateSetting("show_announcements", checked ? "true" : "false")
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
