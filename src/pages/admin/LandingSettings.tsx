import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
  ImageIcon,
  Home,
  Phone,
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
      <div className="space-y-6">
        {/* Header - CHANGE: Enhanced header with better visual hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="font-bold text-3xl">Pengaturan Landing Page</h1>
                <p className="text-muted-foreground mt-1">
                  Kelola dan kustomisasi tampilan halaman utama komunitas
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to="/" target="_blank">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-transparent"
                >
                  <ExternalLink className="w-4 h-4" />
                  Preview
                </Button>
              </Link>
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || isUploading}
                className="gap-2 shadow-lg"
              >
                {(saveMutation.isPending || isUploading) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                <Save className="w-4 h-4" />
                Simpan
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Main Content Grid - CHANGE: Better organization with sections */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Hero and About */}
          <div className="md:col-span-2 space-y-6">
            {/* Hero Section */}
            <Card className="overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-primary" />
                  Hero Section
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
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
                    <div className="relative rounded-xl overflow-hidden border border-border">
                      <img
                        src={heroImagePreview || "/placeholder.svg"}
                        alt="Hero Preview"
                        className="w-full h-48 object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-3 right-3 rounded-lg"
                        onClick={removeHeroImage}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-40 border-dashed border-2 rounded-xl hover:bg-primary/5 transition-colors bg-transparent"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <ImagePlus className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm">
                          Klik untuk menambah gambar hero
                        </span>
                      </div>
                    </Button>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="hero_title" className="font-semibold">
                    Judul Hero
                  </Label>
                  <Input
                    id="hero_title"
                    value={settings.hero_title || ""}
                    onChange={(e) =>
                      updateSetting("hero_title", e.target.value)
                    }
                    placeholder="Selamat Datang di Perumahan Kami"
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hero_subtitle" className="font-semibold">
                    Subjudul Hero
                  </Label>
                  <Textarea
                    id="hero_subtitle"
                    value={settings.hero_subtitle || ""}
                    onChange={(e) =>
                      updateSetting("hero_subtitle", e.target.value)
                    }
                    placeholder="Komunitas yang nyaman, aman, dan asri..."
                    rows={3}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Community Info */}
            <Card className="overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-primary" />
                  Informasi Perumahan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="community_name" className="font-semibold">
                    Nama Perumahan
                  </Label>
                  <Input
                    id="community_name"
                    value={settings.community_name || ""}
                    onChange={(e) =>
                      updateSetting("community_name", e.target.value)
                    }
                    placeholder="Perumahan Harmoni Indah"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="about_text" className="font-semibold">
                    Tentang Perumahan
                  </Label>
                  <Textarea
                    id="about_text"
                    value={settings.about_text || ""}
                    onChange={(e) =>
                      updateSetting("about_text", e.target.value)
                    }
                    placeholder="Deskripsi tentang perumahan..."
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Contact and Visibility */}
          <div className="space-y-6">
            {/* Contact Information */}
            <Card className="overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5 text-primary" />
                  Kontak
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-semibold text-sm">
                    Alamat
                  </Label>
                  <Input
                    id="address"
                    value={settings.address || ""}
                    onChange={(e) => updateSetting("address", e.target.value)}
                    placeholder="Jl. Harmoni Indah No. 1"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-semibold text-sm">
                    Telepon
                  </Label>
                  <Input
                    id="phone"
                    value={settings.phone || ""}
                    onChange={(e) => updateSetting("phone", e.target.value)}
                    placeholder="021-1234567"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-semibold text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email || ""}
                    onChange={(e) => updateSetting("email", e.target.value)}
                    placeholder="info@perumahan.com"
                    className="text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Section Visibility */}
            <Card className="overflow-hidden border-2 border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader className="bg-gradient-to-r from-primary/5 to-transparent">
                <CardTitle className="text-base">Tampilkan Section</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {[
                  {
                    key: "show_stats",
                    label: "Statistik",
                    desc: "Rumah, warga, acara",
                  },
                  {
                    key: "show_gallery",
                    label: "Galeri",
                    desc: "Foto perumahan",
                  },
                  {
                    key: "show_events",
                    label: "Acara",
                    desc: "Acara mendatang",
                  },
                  {
                    key: "show_announcements",
                    label: "Pengumuman",
                    desc: "Pengumuman terbaru",
                  },
                ].map((section) => (
                  <div key={section.key}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/50 hover:bg-background transition-colors">
                      <div>
                        <p className="font-medium text-sm">{section.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {section.desc}
                        </p>
                      </div>
                      <Switch
                        checked={settings[section.key] !== "false"}
                        onCheckedChange={(checked) =>
                          updateSetting(section.key, checked ? "true" : "false")
                        }
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}
