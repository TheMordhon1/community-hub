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
  ArrowRight, Minus, Loader2, Tag, ArrowLeft
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
    <section className="py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => navigate("/stores")} 
          className="rounded-full h-10 w-10 border-slate-200 hover:border-primary/50 hover:bg-primary/5 transition-all duration-300 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-100 shadow-md p-1 overflow-hidden flex-shrink-0">
              {store.logo_url ? (
                <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover rounded-xl" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                  <Store className="w-7 h-7" />
                </div>
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="text-2xl font-black text-foreground tracking-tight truncate leading-tight">{store.name}</h1>
              <div className="flex items-center gap-2 flex-wrap">
                <StoreStatusBadge status={store.status} isOpen={store.is_open} />
                <Badge variant="outline" className="text-[10px] uppercase tracking-tighter bg-slate-50 border-slate-200">
                  <MapPin className="w-3 h-3 mr-1" />Blok {store.houses?.block} No. {store.houses?.number}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showInactivityWarning && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-900">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm font-bold">Toko Sudah Tutup Selama {daysSinceStatusChange} Hari</AlertTitle>
          <AlertDescription className="text-xs mt-1 space-y-2">
            <p>Apakah toko ini masih aktif? Anda dapat membuka kembali toko atau menghapusnya jika sudah tidak beroperasi.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[10px] border-amber-300 text-amber-800 hover:bg-amber-100" onClick={() => toggleOpenMutation.mutate(true)}>
                Buka Kembali
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px] text-amber-800 hover:bg-amber-100">
                    Hapus Toko
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Toko?</AlertDialogTitle>
                    <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>Hapus</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          {store.image_url && (
            <img src={store.image_url} alt={store.name} className="w-full h-48 object-cover rounded-lg" />
          )}

          {store.description && (
            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 italic text-slate-600 text-sm leading-relaxed">
              &quot;{store.description}&quot;
            </div>
          )}

          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
                <MapPin className="w-4 h-4 text-slate-400" />
              </div>
              <span className="font-medium">Blok {store.houses?.block} No. {store.houses?.number}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
                <Phone className="w-4 h-4 text-slate-400" />
              </div>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 hover:underline font-bold transition-colors">
                {store.wa_number}
              </a>
            </div>
            {store.website_url && (
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
                  <Globe className="w-4 h-4 text-slate-400" />
                </div>
                <a 
                  href={store.website_url.startsWith('http') ? store.website_url : `https://${store.website_url}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:text-primary/80 hover:underline font-bold flex items-center gap-1 transition-colors"
                >
                  Kunjungi Website <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}


          {store.categories && store.categories.length > 0 && (
            <div className="flex">
              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 font-bold px-2 py-0.5">
                <Tag className="w-3 h-3 mr-1" />
                {store.categories.join(", ")}
              </Badge>
            </div>
          )}
          </div>

          <div className="flex flex-col gap-6 pt-4 border-t border-slate-100">
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
                      className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm border-none h-8 px-4"
                      onClick={() => verifyMutation.mutate("approved")}
                      disabled={verifyMutation.isPending}
                    >
                      <CheckCircle className="w-3.5 h-3.5 mr-2" />
                      Setujui
                    </Button>
                  )}
                  {store.status !== "rejected" && (
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="h-8 px-4 shadow-sm"
                      onClick={() => verifyMutation.mutate("rejected")}
                      disabled={verifyMutation.isPending}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-2" />
                      Tolak
                    </Button>
                  )}
                  {store.status !== "pending" && (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all font-semibold"
                      onClick={() => verifyMutation.mutate("pending")}
                      disabled={verifyMutation.isPending}
                    >
                      <Clock className="w-3.5 h-3.5 mr-2" />
                      Reset ke Pending
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
                  <div className="flex items-center gap-2 px-3 py-1 h-8 rounded-full bg-slate-50 border border-slate-100 mr-2 shadow-sm">
                    <Power className={cn("w-3 h-3", store.is_open ? "text-emerald-500" : "text-slate-400")} />
                    <span className="text-[11px] font-bold text-slate-600">{store.is_open ? "Buka" : "Tutup"}</span>
                    <Switch 
                      checked={store.is_open} 
                      onCheckedChange={(checked) => toggleOpenMutation.mutate(checked)}
                      disabled={toggleOpenMutation.isPending}
                      className="scale-75"
                    />
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-8 px-4 border-slate-200 text-slate-600 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all shadow-sm font-semibold"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-2" />
                    Edit Info
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 px-4 text-slate-400 hover:text-destructive hover:bg-destructive/5 transition-all">
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        Hapus Toko
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Toko?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tindakan ini tidak bisa dibatalkan. Semua data toko dan katalog produk akan dihapus secara permanen.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        </CardContent>
      </Card>

      {/* Catalog or Website Redirect */}
      <Card className={cn("overflow-hidden border-slate-100", store.use_external_website && "bg-blue-50/30 border-blue-100")}>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Katalog Produk</CardTitle>
          {!store.use_external_website && canManageStore && (
            <Button size="sm" onClick={() => setCatalogDialog({ open: true })}>
              <Plus className="w-3 h-3 mr-1" />Tambah
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {store.use_external_website ? (
            <div className="py-12 flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-blue-100 flex items-center justify-center text-blue-600 shadow-inner">
                <Globe className="w-10 h-10" />
              </div>
              <div className="space-y-2 max-w-xs">
                <h3 className="text-xl font-black text-slate-800">Kunjungi Website Kami</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Toko ini menggunakan website eksternal untuk katalog dan pemesanan.
                </p>
              </div>
              <a 
                href={store.website_url?.startsWith('http') ? store.website_url : `https://${store.website_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full max-w-xs"
              >
                <Button size="lg" className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-xl shadow-blue-200 group">
                  Buka Website 
                  <ExternalLink className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                </Button>
              </a>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">
                {store.website_url}
              </p>
            </div>
          ) : (
            <>
              {catalogLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : catalogItems.length === 0 ? (
                <div className="text-center py-6">
                  <Package className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Belum ada produk di katalog</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {catalogItems.map((item: CatalogItem) => (
                    <Card key={item.id} className="overflow-hidden group hover:shadow-md transition-all duration-300 border-slate-100">
                      <CardContent className="p-4 flex gap-4">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 shadow-sm transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center flex-shrink-0 text-slate-300">
                            <Package className="w-8 h-8" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-bold text-slate-800 text-sm leading-tight group-hover:text-primary transition-colors">{item.name}</h4>
                              {!item.is_available && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-slate-100 text-slate-500 border-none uppercase font-black">
                                  Habis
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed italic">
                                {item.description}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-end justify-between mt-2">
                            {item.price != null ? (
                              <p className="text-sm font-black text-emerald-600">
                                Rp {Number(item.price).toLocaleString("id-ID")}
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-300 font-medium">Harga tidak dicantumkan</p>
                            )}
                            
                            {canManageStore && (
                              <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => setCatalogDialog({ open: true, item })}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCatalogMutation.mutate(item.id)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}

                            {!canManageStore && store.is_open && item.is_available && (
                              <div className="flex items-center gap-2">
                                 {cart[item.id] > 0 ? (
                                   <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                                     <Button size="icon" variant="outline" className="h-7 w-7 rounded-full border-primary/20 text-primary hover:bg-primary/5" onClick={() => removeFromCart(item.id)}>
                                       <Minus className="w-3 h-3" />
                                     </Button>
                                     <span className="text-xs font-bold w-4 text-center">{cart[item.id]}</span>
                                     <Button size="icon" variant="default" className="h-7 w-7 rounded-full shadow-sm" onClick={() => addToCart(item.id)}>
                                       <Plus className="w-3 h-3" />
                                     </Button>
                                   </div>
                                 ) : (
                                   <Button size="sm" variant="outline" className="h-7 px-3 rounded-full border-primary/20 text-primary hover:bg-primary/5 transition-all text-[10px] font-bold uppercase tracking-wider" onClick={() => addToCart(item.id)}>
                                     <Plus className="w-3 h-3 mr-1" /> Beli
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

      {/* Floating Cart Button */}
      {!canManageStore && cartTotalItems > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-in slide-in-from-bottom-10 fade-in duration-500">
          <Button 
            className="w-full h-14 rounded-2xl shadow-xl bg-primary hover:bg-primary/95 text-white flex items-center justify-between px-6 border-4 border-white/20 backdrop-blur-sm"
            onClick={handleCheckout}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6" />
                <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-white text-primary border-2 border-primary shadow-sm font-black">
                  {cartTotalItems}
                </Badge>
              </div>
              <div className="text-left">
                <p className="text-[10px] uppercase font-black opacity-80 leading-none">Order via WhatsApp</p>
                <p className="text-sm font-black">Rp {cartTotalPrice.toLocaleString("id-ID")}</p>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 animate-pulse" />
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
