import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Store, Search, Phone, MapPin, Clock, CheckCircle, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CreateStoreDialog } from "@/components/stores/CreateStoreDialog";

export default function Stores() {
  const { profile, isAdmin, isPengurus, canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["stores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*, houses(block, number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: userHouse } = useQuery({
    queryKey: ["user-house", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", profile.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.id,
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("stores")
        .update({ status, verified_by: profile?.id, verified_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "Toko disetujui" : "Toko ditolak");
      queryClient.invalidateQueries({ queryKey: ["stores"] });
    },
  });

  const filtered = stores.filter((s: any) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Toko Warga</h1>
          <p className="text-muted-foreground text-sm">Daftar toko dan usaha warga perumahan</p>
        </div>
        {userHouse?.house_id && (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Toko
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cari toko..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Store className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Belum ada toko terdaftar</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((store: any) => (
            <Link key={store.id} to={`/stores/${store.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 space-y-3">
                  {store.image_url && (
                    <img src={store.image_url} alt={store.name} className="w-full h-32 object-cover rounded-lg" />
                  )}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-foreground line-clamp-1">{store.name}</h3>
                      {getStatusBadge(store.status)}
                    </div>
                    {store.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{store.description}</p>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>Blok {store.houses?.block} No. {store.houses?.number}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{store.wa_number}</span>
                    </div>
                  </div>
                  {canManageContent() && store.status === "pending" && (
                    <div className="flex gap-2 pt-2" onClick={(e) => e.preventDefault()}>
                      <Button size="sm" variant="default" className="flex-1" onClick={() => verifyMutation.mutate({ id: store.id, status: "approved" })}>
                        <CheckCircle className="w-3 h-3 mr-1" />Setujui
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => verifyMutation.mutate({ id: store.id, status: "rejected" })}>
                        <XCircle className="w-3 h-3 mr-1" />Tolak
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateStoreDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        houseId={userHouse?.house_id || ""}
      />
    </div>
  );
}
