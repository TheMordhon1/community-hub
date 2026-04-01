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
import { ArrowLeft, Phone, MapPin, CheckCircle, Clock, XCircle, Trash2, Plus, Edit, Package } from "lucide-react";
import { toast } from "sonner";
import { CatalogItemDialog } from "@/components/stores/CatalogItemDialog";

export default function StoreDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { profile, canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const [catalogDialog, setCatalogDialog] = useState<{ open: boolean; item?: any }>({ open: false });

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
    mutationFn: async (status: "approved" | "rejected") => {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground"><CheckCircle className="w-3 h-3 mr-1" />Terverifikasi</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Ditolak</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Menunggu Verifikasi</Badge>;
    }
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/stores")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{store.name}</h1>
          <p className="text-sm text-muted-foreground">
            Blok {store.houses?.block} No. {store.houses?.number}
          </p>
        </div>
        {getStatusBadge(store.status)}
      </div>

      <Card>
        <CardContent className="p-5 space-y-4">
          {store.image_url && (
            <img src={store.image_url} alt={store.name} className="w-full h-48 object-cover rounded-lg" />
          )}
          {store.description && (
            <p className="text-foreground">{store.description}</p>
          )}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span>Blok {store.houses?.block} No. {store.houses?.number}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {store.wa_number}
              </a>
            </div>
          </div>
          {store.status === "approved" && verifier && (
            <p className="text-xs text-muted-foreground">
              Diverifikasi oleh {verifier.full_name} pada {new Date(store.verified_at).toLocaleDateString("id-ID")}
            </p>
          )}

          <div className="flex gap-2 flex-wrap">
            {canManageContent() && store.status === "pending" && (
              <>
                <Button size="sm" onClick={() => verifyMutation.mutate("approved")}>
                  <CheckCircle className="w-3 h-3 mr-1" />Setujui
                </Button>
                <Button size="sm" variant="destructive" onClick={() => verifyMutation.mutate("rejected")}>
                  <XCircle className="w-3 h-3 mr-1" />Tolak
                </Button>
              </>
            )}
            {isOwner && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive">
                    <Trash2 className="w-3 h-3 mr-1" />Hapus Toko
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Toko?</AlertDialogTitle>
                    <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan. Semua data toko dan katalog akan dihapus.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>Hapus</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {catalogItems.map((item: any) => (
                <Card key={item.id} className="overflow-hidden">
                  <CardContent className="p-3 flex gap-3">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                        {!item.is_available && <Badge variant="secondary" className="text-[10px]">Habis</Badge>}
                      </div>
                      {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                      {item.price != null && (
                        <p className="text-sm font-semibold text-primary mt-1">
                          Rp {Number(item.price).toLocaleString("id-ID")}
                        </p>
                      )}
                      {isOwner && (
                        <div className="flex gap-1 mt-1">
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setCatalogDialog({ open: true, item })}>
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive" onClick={() => deleteCatalogMutation.mutate(item.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
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
    </div>
  );
}
