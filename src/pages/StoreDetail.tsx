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
import { ArrowLeft, Phone, MapPin, CheckCircle, Clock, XCircle, Trash2, Plus, Edit, Package, Globe, ExternalLink, Store, Power, AlertCircle, Tag } from "lucide-react";
import { toast } from "sonner";
import { CatalogItemDialog } from "@/components/stores/CatalogItemDialog";
import { StoreFormDialog } from "@/components/stores/StoreFormDialog";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Tables } from "@/integrations/supabase/types";
import { StoreCategoryBadge } from "@/components/stores/StoreCategoryBadge";
import { StoreStatusBadge } from "@/components/stores/StoreStatusBadge";

type CatalogItem = Tables<"store_catalog_items">;

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const [catalogDialog, setCatalogDialog] = useState<{ open: boolean; item?: CatalogItem }>({ open: false });
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

  const isOwner = store?.created_by === profile?.id;

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

  const getStatusBadge = (status: string, isOpen: boolean = true) => {
    if (status === "approved" && isOpen) {
      return (
        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white border-none shadow-sm animate-in fade-in zoom-in duration-300 px-3 py-1 rounded-full text-xs font-bold">
          <CheckCircle className="w-3 h-3 mr-1" />Buka
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 shadow-sm animate-in fade-in zoom-in duration-300 px-3 py-1 rounded-full text-xs font-bold">
        <Power className="w-3 h-3 mr-1" />Tutup
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Toko tidak ditemukan</p>
        <Button variant="link" onClick={() => navigate("/stores")}>Kembali</Button>
      </div>
    );
  }

  const waLink = `https://wa.me/${store.wa_number.replace(/[^0-9]/g, "")}`;
  const daysSinceStatusChange = store.status_changed_at 
    ? differenceInDays(new Date(), new Date(store.status_changed_at)) 
    : 0;
  const showInactivityWarning = isOwner && !store.is_open && daysSinceStatusChange >= 7;

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
                {store.categories?.map((cat) => (
                  <StoreCategoryBadge key={cat} category={cat} size="md" />
                ))}
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
          </div>
          {store.status === "approved" && verifier && (
            <p className="text-xs text-muted-foreground">
              Diverifikasi oleh {verifier.full_name} pada {new Date(store.verified_at).toLocaleDateString("id-ID")}
            </p>
          )}

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

            {isOwner && (
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

      {/* Catalog */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Katalog Produk</CardTitle>
          {isOwner && (
            <Button size="sm" onClick={() => setCatalogDialog({ open: true })}>
              <Plus className="w-3 h-3 mr-1" />Tambah
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
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
                        
                        {isOwner && (
                          <div className="flex gap-1 animate-in fade-in slide-in-from-right-2 duration-300">
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-primary/10 hover:text-primary" onClick={() => setCatalogDialog({ open: true, item })}>
                              <Edit className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteCatalogMutation.mutate(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
