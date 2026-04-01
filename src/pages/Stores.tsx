import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Store, Search, Phone, MapPin, Clock, CheckCircle, XCircle, ArrowLeft, Globe, Power, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { StoreFormDialog } from "@/components/stores/StoreFormDialog";
import { StoreCategoryBadge } from "@/components/stores/StoreCategoryBadge";
import { StoreStatusBadge } from "@/components/stores/StoreStatusBadge";

export default function Stores() {
  const { profile, isAdmin, isPengurus, canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const CATEGORIES = [
    "Sembako",
    "Jajanan",
    "Makanan & Minuman",
    "Jasa",
    "Fashion",
    "Warung",
    "Lainnya"
  ];

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

  const filtered = stores.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || 
                         (s.description?.toLowerCase() || "").includes(search.toLowerCase()) ||
                         s.categories?.some((cat: string) => cat.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = !selectedCategory || s.categories?.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });


  return (
    <section className="py-6 px-4 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-sm">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Toko Warga</h1>
            <p className="text-muted-foreground text-sm">Daftar toko dan usaha warga perumahan</p>
          </div>
        </div>
        {/* Add store from Profile page */}
      </div>

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cari toko atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white shadow-sm border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="rounded-full h-8 px-4 text-[11px] font-bold uppercase tracking-wider transition-all"
          >
            Semua
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className="rounded-full h-8 px-4 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all"
            >
              {cat}
            </Button>
          ))}
        </div>
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
          {filtered.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted border overflow-hidden flex-shrink-0">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Store className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">{store.name}</h3>
                        <StoreStatusBadge status={store.status} isOpen={store.is_open} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                        <MapPin className="w-3 h-3" />
                        <span>Blok {store.houses?.block} No. {store.houses?.number}</span>
                      </div>
                    </div>
                  </div>

                  {store.image_url && (
                    <img src={store.image_url} alt={store.name} className="w-full h-32 object-cover rounded-lg" />
                  )}

                  <div className="space-y-2">
                    {store.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{store.description}</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        <span className="font-medium">{store.wa_number}</span>
                      </div>
                      {store.website_url && (
                        <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                          <Globe className="w-3 h-3" />
                          <span>Website</span>
                        </div>
                      )}
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

      <StoreFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        houseId={userHouse?.house_id || ""}
        mode="create"
      />
    </section>
  );
}
