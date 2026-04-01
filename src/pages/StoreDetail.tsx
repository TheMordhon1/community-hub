import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  Store, MapPin, Phone, Globe, ExternalLink, Edit, Trash2, Plus, 
  Package, CheckCircle, XCircle, Clock, Power, AlertCircle, ShoppingCart, 
  ArrowRight, Minus, Loader2, Tag, ArrowLeft, Copy
} from "lucide-react";
import { toast } from "sonner";
import { CatalogItemDialog } from "@/components/stores/CatalogItemDialog";
import { StoreFormDialog } from "@/components/stores/StoreFormDialog";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { StoreStatusBadge } from "@/components/stores/StoreStatusBadge";

type CatalogItem = Tables<"store_catalog_items">;

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const [catalogDialog, setCatalogDialog] = useState<{ open: boolean; item?: CatalogItem }>({ open: false });
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCart, setShowCart] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: store, isLoading } = useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, houses(block, number)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: catalogItems = [], isLoading: catalogLoading } = useQuery({
    queryKey: ["store-catalog", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_catalog_items")
        .select("*")
        .eq("store_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: verifier } = useQuery({
    queryKey: ["store-verifier", store?.verified_by],
    queryFn: async () => {
      if (!store?.verified_by) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", store.verified_by).single();
      return data;
    },
    enabled: !!store?.verified_by,
  });

  const { data: houseMembers } = useQuery({
    queryKey: ["house-members", store?.house_id],
    queryFn: async () => {
      if (!store?.house_id) return [];
      const { data, error } = await supabase
        .from("house_members")
        .select("user_id")
        .eq("house_id", store.house_id)
        .eq("status", "approved");
      if (error) throw error;
      return data;
    },
    enabled: !!store?.house_id,
  });

  const isOwner = store?.created_by === profile?.id;
  const isHouseMember = houseMembers?.some(m => m.user_id === profile?.id);
  const canManageStore = isOwner || isHouseMember || canManageContent();

  const { data: userHouseInfo } = useQuery({
    queryKey: ["user-house-info", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data, error } = await supabase
        .from("house_members")
        .select("houses(block, number)")
        .eq("user_id", profile.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data?.houses as { block: string; number: string } | null;
    },
    enabled: !!profile?.id,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("stores").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Toko berhasil dihapus");
      navigate("/stores");
    },
  });

  const deleteCatalogMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("store_catalog_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item katalog dihapus");
      queryClient.invalidateQueries({ queryKey: ["store-catalog", id] });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (status: "approved" | "rejected" | "pending") => {
      const { error } = await supabase
        .from("stores")
        .update({ status, verified_by: profile?.id, verified_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, status) => {
      toast.success(status === "approved" ? "Toko disetujui" : "Toko ditolak");
      queryClient.invalidateQueries({ queryKey: ["store", id] });
    },
  });

  const toggleOpenMutation = useMutation({
    mutationFn: async (isOpen: boolean) => {
      const { error } = await supabase
        .from("stores")
        .update({ is_open: isOpen, status_changed_at: new Date().toISOString() })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: (_, isOpen) => {
      toast.success(isOpen ? "Toko sekarang Buka" : "Toko sekarang Tutup");
      queryClient.invalidateQueries({ queryKey: ["store", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const waLink = `https://wa.me/${store?.wa_number?.replace(/[^0-9]/g, "")}`;
  
  const handleCheckout = () => {
    if (!store || !profile) return;
    
    const orderList = catalogItems
      .filter(item => cart[item.id] > 0)
      .map(item => `- ${item.name} (${cart[item.id]}x)`)
      .join("\n");
      
    const totalHarga = catalogItems
      .filter(item => cart[item.id] > 0)
      .reduce((sum, item) => sum + (Number(item.price || 0) * cart[item.id]), 0);

    const template = store.order_template || "Halo {nama_toko}, saya {nama_pembeli} dari rumah {no_rumah}. Saya ingin memesan:\n{daftar_pesanan}\n\nTotal: {total_harga}\nTerima kasih!";
    
    const message = template
      .replace("{nama_toko}", store.name)
      .replace("{nama_pembeli}", profile.full_name || "Pelanggan")
      .replace("{no_rumah}", userHouseInfo ? `Blok ${userHouseInfo.block} No. ${userHouseInfo.number}` : "-")
      .replace("{daftar_pesanan}", orderList)
      .replace("{total_harga}", `Rp ${totalHarga.toLocaleString("id-ID")}`);

    window.open(`${waLink}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const addToCart = (itemId: string) => {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
    setShowCart(true);
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });
  };

  const cartTotalItems = Object.values(cart).reduce((a, b) => a + b, 0);
  const cartTotalPrice = catalogItems.reduce((sum, item) => sum + (Number(item.price || 0) * (cart[item.id] || 0)), 0);

  if (!store || isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /></div>;

  const daysSinceStatusChange = store.status_changed_at 
    ? differenceInDays(new Date(), new Date(store.status_changed_at)) 
    : 0;
  const showInactivityWarning = canManageStore && !store.is_open && daysSinceStatusChange >= 7;

  return (
    <section className="py-6 px-4 sm:px-6 md:px-8 space-y-6">
      <div className="flex items-center gap-3 sm:gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate("/stores")} 
          className="rounded-full h-10 w-10 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white border-2 border-slate-100 shadow-md p-0.5 sm:p-1 overflow-hidden flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                  <Store className="w-6 h-6 sm:w-10 sm:h-10" />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1 sm:space-y-1.5 flex-1">
              <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-slate-900 tracking-tight line-clamp-1 leading-tight">{store.name}</h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <StoreStatusBadge status={store.status} isOpen={store.is_open} />
                <Badge variant="outline" className="text-[9px] sm:text-[11px] uppercase font-bold tracking-tighter bg-slate-50 border-slate-200 py-0.5 px-1.5 sm:px-2.5">
                  <MapPin className="w-2.5 h-2.5 sm:w-3 h-3 mr-1 text-slate-400" />Blok {store.houses?.block} No. {store.houses?.number}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showInactivityWarning && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900 rounded-2xl border-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <div className="ml-2">
            <AlertTitle className="text-base font-black">Toko Sudah Tutup Selama {daysSinceStatusChange} Hari</AlertTitle>
            <AlertDescription className="text-sm mt-1 space-y-3">
              <p className="opacity-80">Apakah toko ini masih aktif? Anda dapat membuka kembali toko atau menghapusnya jika sudah tidak beroperasi.</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="h-9 px-4 rounded-xl border-amber-300 text-amber-800 hover:bg-amber-100 font-bold" onClick={() => toggleOpenMutation.mutate(true)}>
                  Buka Kembali
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" className="h-9 px-4 rounded-xl text-amber-800 hover:bg-amber-100 font-bold">
                      Hapus Toko
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-xl font-black">Hapus Toko?</AlertDialogTitle>
                      <AlertDialogDescription className="text-slate-500 font-medium">Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl border-slate-200 font-bold">Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMutation.mutate()} className="rounded-xl bg-destructive hover:bg-destructive/90 font-bold">Hapus</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-100 shadow-sm rounded-3xl overflow-hidden">
            <CardContent className="p-0">
              {store.image_url && (
                <div className="aspect-[4/3] sm:aspect-video lg:aspect-square w-full overflow-hidden">
                  <img src={store.image_url} alt={store.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
              )}
              <div className="p-5 space-y-6">
                {store.description && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 italic text-slate-600 text-sm leading-relaxed relative">
                    <span className="absolute -top-2 left-4 text-4xl text-slate-200 font-serif leading-none italic pointer-events-none">&quot;</span>
                    {store.description}
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  <Button 
                    size="lg" 
                    className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-base shadow-lg shadow-emerald-100 group transition-all"
                    onClick={() => window.open(waLink, "_blank")}
                  >
                    <Phone className="w-5 h-5 mr-2 animate-pulse" />
                    Hubungi
                    <ExternalLink className="w-4 h-4 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                  </Button>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-4 text-sm text-slate-600 group">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-primary/5 transition-colors">
                        <MapPin className="w-5 h-5 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Lokasi</p>
                        <span className="font-bold text-slate-800 truncate block">Blok {store.houses?.block} No. {store.houses?.number}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-slate-600 group">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-emerald-50 transition-colors">
                        <Phone className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">WhatsApp</p>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 truncate">{store.wa_number}</span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg hover:bg-emerald-100 hover:text-emerald-600 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(store.wa_number);
                              toast.success("Nomor WA berhasil disalin");
                            }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {store.website_url && (
                      <div className="flex items-center gap-4 text-sm text-slate-600 group">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-blue-50 transition-colors">
                          <Globe className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Website</p>
                          <div className="flex items-center gap-2">
                            <a 
                              href={store.website_url.startsWith('http') ? store.website_url : `https://${store.website_url}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-blue-600 hover:text-blue-700 font-bold truncate transition-colors"
                            >
                              {store.website_url.replace(/(^\w+:|^)\/\//, '')}
                            </a>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 rounded-lg hover:bg-blue-100 hover:text-blue-600 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                const url = store.website_url.startsWith('http') ? store.website_url : `https://${store.website_url}`;
                                navigator.clipboard.writeText(url);
                                toast.success("Link website berhasil disalin");
                              }}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {store.categories && store.categories.length > 0 && (
                  <div className="flex items-center gap-4 group pt-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 group-hover:bg-amber-50 transition-colors">
                      <Tag className="w-5 h-5 text-slate-400 group-hover:text-amber-500 transition-colors" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Kategori</p>
                      <p className="text-xs font-bold text-amber-700">{store.categories.join(", ")}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-6 pt-5 border-t border-slate-100">
                  {canManageContent() && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider pl-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Manajemen Admin
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {store.status !== "approved" && (
                          <Button 
                            size="sm" 
                            className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm border-none h-9 px-4 rounded-xl font-bold transition-all"
                            onClick={() => verifyMutation.mutate("approved")}
                            disabled={verifyMutation.isPending}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Setujui
                          </Button>
                        )}
                        {store.status !== "rejected" && (
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="h-9 px-4 shadow-sm rounded-xl font-bold transition-all"
                            onClick={() => verifyMutation.mutate("rejected")}
                            disabled={verifyMutation.isPending}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Tolak
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {canManageStore && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider pl-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Pengaturan Toko
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        <div className="flex items-center gap-2 px-3 py-1 h-9 rounded-xl bg-slate-50 border border-slate-100 mr-2 shadow-sm">
                          <Power className={cn("w-3.5 h-3.5", store.is_open ? "text-emerald-500" : "text-slate-400")} />
                          <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{store.is_open ? "Buka" : "Tutup"}</span>
                          <Switch 
                            checked={store.is_open} 
                            onCheckedChange={(checked) => toggleOpenMutation.mutate(checked)}
                            disabled={toggleOpenMutation.isPending}
                            className="scale-90"
                          />
                        </div>
                        
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-9 px-4 border-slate-200 text-slate-600 rounded-xl hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all font-bold"
                          onClick={() => setIsEditDialogOpen(true)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Info
                        </Button>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="ghost" className="h-9 px-4 rounded-xl text-slate-400 hover:text-destructive hover:bg-destructive/5 transition-all font-bold">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Hapus
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-xl font-black">Hapus Toko?</AlertDialogTitle>
                              <AlertDialogDescription className="text-slate-500 font-medium">
                                Tindakan ini tidak bisa dibatalkan. Semua data toko dan katalog produk akan dihapus secara permanen.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="gap-2">
                              <AlertDialogCancel className="rounded-xl border-slate-200 font-bold">Batal</AlertDialogCancel>
                              <AlertDialogAction 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
                                onClick={() => deleteMutation.mutate()}
                              >
                                Hapus Permanen
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {/* Catalog or Website Redirect */}
          <Card className={cn("overflow-hidden border-slate-100 shadow-sm rounded-3xl h-full", store.use_external_website && "bg-blue-50/30 border-blue-100")}>
            <CardHeader className="flex flex-row items-center justify-between pb-3 px-6 pt-6">
              <CardTitle className="text-xl font-black text-slate-800 tracking-tight">Katalog Produk</CardTitle>
              {!store.use_external_website && canManageStore && (
                <Button size="sm" onClick={() => setCatalogDialog({ open: true })} className="rounded-xl h-9 px-4 font-bold">
                  <Plus className="w-4 h-4 mr-1.5" />Tambah
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 px-6 pb-6">
              {store.use_external_website ? (
                <div className="py-16 sm:py-24 flex flex-col items-center text-center space-y-6">
                  <div className="w-24 h-24 rounded-3xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner group animate-bounce-slow">
                    <Globe className="w-12 h-12 transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <div className="space-y-3 max-w-sm">
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Kunjungi Website Kami</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Toko ini menggunakan platform eksternal untuk katalog lengkap dan sistem pemesanan.
                    </p>
                  </div>
                  <a 
                    href={store.website_url?.startsWith('http') ? store.website_url : `https://${store.website_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full max-w-xs"
                  >
                    <Button size="lg" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl shadow-blue-200 group transition-all">
                      Buka Website 
                      <ExternalLink className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                    </Button>
                  </a>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest bg-white/50 px-4 py-1 rounded-full border border-blue-100 shadow-sm">
                    {store.website_url}
                  </p>
                </div>
              ) : (
                <>
                  {catalogLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
                    </div>
                  ) : catalogItems.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                      <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                        <Package className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-slate-500 font-bold">Belum ada produk di katalog</p>
                      <p className="text-xs text-slate-400 mt-1">Silakan tambahkan produk baru untuk mulai berjualan</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {catalogItems.map((item: CatalogItem) => (
                        <Card key={item.id} className="overflow-hidden group hover:shadow-xl hover:border-primary/20 transition-all duration-300 border-slate-100 rounded-2xl">
                          <CardContent className="p-4 flex gap-4">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden flex-shrink-0 shadow-sm border border-slate-50 relative">
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              ) : (
                                <div className="w-full h-full bg-slate-50 flex items-center justify-center text-slate-200">
                                  <Package className="w-8 h-8" />
                                </div>
                              )}
                              {!item.is_available && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex items-center justify-center">
                                  <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest -rotate-12 border-2 border-slate-200 px-2 py-0.5 rounded">Habis</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div className="space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-tight group-hover:text-primary transition-colors line-clamp-2">{item.name}</h4>
                                </div>
                                {item.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed italic pr-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-end justify-between mt-2">
                                <div className="space-y-0.5">
                                  {item.price != null ? (
                                    <p className="text-base font-black text-emerald-600">
                                      Rp {Number(item.price).toLocaleString("id-ID")}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-slate-300 font-black uppercase tracking-tighter">Tanya Harga</p>
                                  )}
                                </div>
                                
                                {canManageStore && (
                                  <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => setCatalogDialog({ open: true, item })}>
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCatalogMutation.mutate(item.id)}>
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}

                                {!canManageStore && store.is_open && item.is_available && (
                                  <div className="flex items-center gap-2">
                                     {cart[item.id] > 0 ? (
                                       <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300 bg-slate-50 rounded-full p-1 border border-slate-100">
                                         <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600 hover:text-primary" onClick={() => removeFromCart(item.id)}>
                                           <Minus className="w-3 h-3" />
                                         </Button>
                                         <span className="text-xs font-black w-4 text-center text-slate-800">{cart[item.id]}</span>
                                         <Button size="icon" variant="default" className="h-7 w-7 rounded-full shadow-sm" onClick={() => addToCart(item.id)}>
                                           <Plus className="w-3 h-3" />
                                         </Button>
                                       </div>
                                     ) : (
                                       <Button size="sm" variant="outline" className="h-8 px-4 rounded-xl border-primary/20 text-primary hover:bg-primary/5 transition-all text-[11px] font-black uppercase tracking-wider" onClick={() => addToCart(item.id)}>
                                         <Plus className="w-3.5 h-3.5 mr-1.5" /> Beli
                                       </Button>
                                     )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Floating Cart Button */}
      {!canManageStore && cartTotalItems > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <Button 
            className="w-full h-16 rounded-3xl shadow-2xl bg-primary hover:bg-primary/95 text-white flex items-center justify-between px-6 border-4 border-white/20 backdrop-blur-xl ring-2 ring-primary/20"
            onClick={handleCheckout}
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center animate-pulse">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <Badge className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-[11px] bg-rose-500 text-white border-2 border-white shadow-md font-black rounded-full">
                  {cartTotalItems}
                </Badge>
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase font-black opacity-80 tracking-widest leading-none mb-1">Checkout Order</p>
                <p className="text-lg font-black tracking-tight">Rp {cartTotalPrice.toLocaleString("id-ID")}</p>
              </div>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <ArrowRight className="w-6 h-6" />
            </div>
          </Button>
        </div>
      )}

      <CatalogItemDialog
        open={catalogDialog.open}
        onOpenChange={(open) => setCatalogDialog({ open })}
        storeId={store.id}
        item={catalogDialog.item}
      />
      <StoreFormDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        houseId={store.house_id}
        mode="edit"
        initialData={store}
      />
    </section>
  );
}
