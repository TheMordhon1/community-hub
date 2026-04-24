import { useState, useRef, useEffect, useCallback } from "react";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Save,
  Loader2,
  ImagePlus,
  X,
  ImageIcon,
  Home,
  Phone,
  Settings2,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type LandingSettingsMap = Record<string, string | null>;

// Friendly default values (bahasa santai-sopan)
const FRIENDLY_DEFAULTS: LandingSettingsMap = {
  community_name: "Perumahan Kita",
  hero_title: "Selamat Datang di Rumah Kita",
  hero_subtitle:
    "Yuk, jadi bagian dari komunitas yang hangat, ramah, dan bikin betah. Senang banget bisa kenalan sama kamu!",
  about_text:
    "Perumahan kita adalah tempat di mana tetangga bukan cuma sekadar kenal, tapi juga jadi keluarga. Lingkungan yang asri, aman, dan penuh kebersamaan, cocok buat kamu yang lagi cari rumah idaman bareng keluarga tercinta.",
  address: "Jl. Mawar Indah No. 1, Sejahtera",
  phone: "021-1234-5678",
  email: "halo@perumahankita.com",
  show_stats: "true",
  show_gallery: "true",
  show_events: "true",
  show_announcements: "true",
  announcement_max_image_size: "1",
};

const DEVICE_PRESETS = {
  desktop: { width: 1280, height: 800, label: "Desktop", icon: Monitor },
  tablet: { width: 768, height: 1024, label: "Tablet", icon: Tablet },
  mobile: { width: 390, height: 780, label: "Mobile", icon: Smartphone },
} as const;

type DeviceKey = keyof typeof DEVICE_PRESETS;

export default function LandingSettings() {
  const { toast } = useToast();
  const { role, pengurusTitle, isAdmin, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<LandingSettingsMap>({});
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [heroImagePreview, setHeroImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [previewKey, setPreviewKey] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_settings")
        .select("key, value");
      if (error) throw error;
      const settingsObj: LandingSettingsMap = {};
      data?.forEach((item) => {
        settingsObj[item.key] = item.value;
      });
      return settingsObj;
    },
  });

  useEffect(() => {
    if (!settingsData) return;
    // Merge friendly defaults for any missing keys (so editor never shows blanks)
    const merged: LandingSettingsMap = { ...FRIENDLY_DEFAULTS, ...settingsData };
    setSettings(merged);
    if (merged.hero_image) setHeroImagePreview(merged.hero_image);
  }, [settingsData]);

  // Listen for "ready" handshake from preview iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === "landing-preview-ready") {
        setIframeReady(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Push current (unsaved) settings to iframe whenever they change
  const pushPreview = useCallback(
    (next: LandingSettingsMap) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const payload: LandingSettingsMap = {
        ...next,
        hero_image: heroImagePreview || next.hero_image || null,
      };
      win.postMessage(
        { type: "landing-preview-update", settings: payload },
        "*"
      );
    },
    [heroImagePreview]
  );

  useEffect(() => {
    if (iframeReady) pushPreview(settings);
  }, [settings, iframeReady, pushPreview]);

  const saveMutation = useMutation({
    mutationFn: async (updatedSettings: LandingSettingsMap) => {
      for (const [key, value] of Object.entries(updatedSettings)) {
        const { error } = await supabase
          .from("landing_settings")
          .update({ value })
          .eq("key", key);
        if (error) {
          const { error: insertError } = await supabase
            .from("landing_settings")
            .insert({ key, value });
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-settings"] });
      toast({ title: "Berhasil 🎉", description: "Pengaturan disimpan dan langsung diterapkan." });
      setPreviewKey((k) => k + 1); // Reload iframe to fetch saved data
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Yah, gagal",
        description: "Pengaturan belum tersimpan. Coba lagi ya.",
      });
    },
  });

  const handleHeroImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setHeroImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setHeroImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeHeroImage = () => {
    setHeroImageFile(null);
    setHeroImagePreview(null);
    setSettings((prev) => ({ ...prev, hero_image: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      if (uploadedUrl) heroImageUrl = uploadedUrl;
      else {
        toast({ variant: "destructive", title: "Gagal", description: "Gagal mengupload gambar hero" });
        setIsUploading(false);
        return;
      }
    } else if (!heroImagePreview) {
      heroImageUrl = null;
    }
    const updatedSettings = { ...settings, hero_image: heroImageUrl };
    setIsUploading(false);
    saveMutation.mutate(updatedSettings);
  };

  const updateSetting = (key: string, value: string | null) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const applyFriendlyDefaults = () => {
    setSettings((prev) => ({ ...FRIENDLY_DEFAULTS, ...prev, ...FRIENDLY_DEFAULTS }));
    toast({
      title: "Template santai diterapkan ✨",
      description: "Field sudah terisi otomatis. Jangan lupa klik Simpan ya!",
    });
  };

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const canManageSettings =
    isAdmin() || (role === "pengurus" && pengurusTitle === "menteri_sisdigi");
  if (!canManageSettings) return <Navigate to="/dashboard" replace />;

  const preset = DEVICE_PRESETS[device];

  return (
    <section className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-4 px-4 md:px-6 py-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-lg md:text-xl">Editor Landing Page</h1>
              <p className="text-xs text-muted-foreground">
                Edit di kiri, lihat hasilnya langsung di kanan ✨
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={applyFriendlyDefaults} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Pakai Template Santai
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending || isUploading}
              className="gap-2"
            >
              {(saveMutation.isPending || isUploading) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              <Save className="w-4 h-4" />
              Simpan
            </Button>
          </div>
        </div>
      </div>

      {/* Editor + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px,1fr] gap-0 min-h-[calc(100vh-65px)]">
        {/* Editor (left) */}
        <aside className="border-r border-border bg-muted/20 overflow-y-auto max-h-[calc(100vh-65px)]">
          <Tabs defaultValue="hero" className="w-full">
            <TabsList className="sticky top-0 z-10 grid grid-cols-4 w-full rounded-none bg-background border-b border-border h-auto p-1">
              <TabsTrigger value="hero" className="text-xs">Hero</TabsTrigger>
              <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
              <TabsTrigger value="contact" className="text-xs">Kontak</TabsTrigger>
              <TabsTrigger value="sections" className="text-xs">Section</TabsTrigger>
            </TabsList>

            {/* HERO */}
            <TabsContent value="hero" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Bagian Hero
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Gambar Hero (opsional)</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeroImageChange}
                      className="hidden"
                    />
                    {heroImagePreview ? (
                      <div className="relative rounded-lg overflow-hidden border border-border">
                        <img
                          src={heroImagePreview || "/placeholder.svg"}
                          alt="Hero preview"
                          className="w-full h-32 object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 w-7 h-7"
                          onClick={removeHeroImage}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-24 border-dashed border-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <ImagePlus className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs">Tambah gambar hero</span>
                        </div>
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <Label htmlFor="hero_title" className="text-xs font-semibold">
                      Judul Hero
                    </Label>
                    <Input
                      id="hero_title"
                      value={settings.hero_title || ""}
                      onChange={(e) => updateSetting("hero_title", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.hero_title || ""}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="hero_subtitle" className="text-xs font-semibold">
                      Subjudul Hero
                    </Label>
                    <Textarea
                      id="hero_subtitle"
                      value={settings.hero_subtitle || ""}
                      onChange={(e) => updateSetting("hero_subtitle", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.hero_subtitle || ""}
                      rows={3}
                      className="resize-none text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* INFO */}
            <TabsContent value="info" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Home className="w-4 h-4 text-primary" />
                    Informasi Perumahan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="community_name" className="text-xs font-semibold">
                      Nama Perumahan
                    </Label>
                    <Input
                      id="community_name"
                      value={settings.community_name || ""}
                      onChange={(e) => updateSetting("community_name", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.community_name || ""}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="about_text" className="text-xs font-semibold">
                      Tentang Perumahan
                    </Label>
                    <Textarea
                      id="about_text"
                      value={settings.about_text || ""}
                      onChange={(e) => updateSetting("about_text", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.about_text || ""}
                      rows={5}
                      className="resize-none text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONTACT */}
            <TabsContent value="contact" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    Kontak
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="address" className="text-xs font-semibold">Alamat</Label>
                    <Input
                      id="address"
                      value={settings.address || ""}
                      onChange={(e) => updateSetting("address", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.address || ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">Telepon</Label>
                    <Input
                      id="phone"
                      value={settings.phone || ""}
                      onChange={(e) => updateSetting("phone", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.phone || ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={settings.email || ""}
                      onChange={(e) => updateSetting("email", e.target.value)}
                      placeholder={FRIENDLY_DEFAULTS.email || ""}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SECTIONS */}
            <TabsContent value="sections" className="p-4 space-y-4 mt-0">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Tampilkan Section</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { key: "show_stats", label: "Statistik", desc: "Rumah, warga, acara" },
                    { key: "show_gallery", label: "Galeri", desc: "Foto perumahan" },
                    { key: "show_events", label: "Acara", desc: "Acara mendatang" },
                    { key: "show_announcements", label: "Pengumuman", desc: "Pengumuman terbaru" },
                  ].map((section) => (
                    <div
                      key={section.key}
                      className="flex items-center justify-between p-3 rounded-md bg-background border border-border"
                    >
                      <div>
                        <p className="font-medium text-sm">{section.label}</p>
                        <p className="text-xs text-muted-foreground">{section.desc}</p>
                      </div>
                      <Switch
                        checked={settings[section.key] !== "false"}
                        onCheckedChange={(checked) =>
                          updateSetting(section.key, checked ? "true" : "false")
                        }
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-primary" />
                    Ketentuan Aplikasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Label htmlFor="announcement_max_image_size" className="text-xs font-semibold">
                    Maks. ukuran gambar pengumuman (MB)
                  </Label>
                  <Input
                    id="announcement_max_image_size"
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={settings.announcement_max_image_size || "1"}
                    onChange={(e) =>
                      updateSetting("announcement_max_image_size", e.target.value)
                    }
                  />
                  <p className="text-[10px] text-muted-foreground">Default: 1 MB.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Preview (right) */}
        <div className="bg-muted/40 flex flex-col">
          {/* Device toolbar */}
          <div className="flex items-center justify-between gap-2 px-4 py-2 border-b border-border bg-background flex-wrap">
            <div className="flex items-center gap-1 bg-muted rounded-md p-1">
              {(Object.keys(DEVICE_PRESETS) as DeviceKey[]).map((key) => {
                const Item = DEVICE_PRESETS[key];
                const Icon = Item.icon;
                const active = device === key;
                return (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={active ? "default" : "ghost"}
                    className={cn("h-7 gap-1.5 px-2.5 text-xs", !active && "hover:bg-background")}
                    onClick={() => setDevice(key)}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{Item.label}</span>
                  </Button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                {preset.width} × {preset.height}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setIframeReady(false);
                  setPreviewKey((k) => k + 1);
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Iframe wrapper */}
          <div className="flex-1 overflow-auto p-4 md:p-6 flex justify-center">
            <motion.div
              key={device}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-background rounded-xl border border-border shadow-2xl overflow-hidden"
              style={{
                width: `min(100%, ${preset.width}px)`,
                height: `min(calc(100vh - 180px), ${preset.height}px)`,
                maxWidth: preset.width,
              }}
            >
              <iframe
                key={previewKey}
                ref={iframeRef}
                src="/"
                title="Landing preview"
                className="w-full h-full border-0"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
