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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <section className="py-6 px-4 sm:px-6 md:px-8 space-y-6">
      <div className="flex flex-row justify-between items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <Link to="/dashboard">
            <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-sm hover:border-primary/50 hover:bg-primary/5 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">Toko Warga</h1>
            <p className="text-muted-foreground text-sm truncate">Daftar toko dan usaha warga perumahan</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Cari toko atau kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 bg-white shadow-sm border-slate-200 focus:border-primary/50 focus:ring-primary/20 transition-all rounded-xl"
          />
        </div>

        {/* Mobile Category Select */}
        <div className="sm:hidden">
          <Select 
            value={selectedCategory || "all"} 
            onValueChange={(val) => setSelectedCategory(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-full h-11 bg-white shadow-sm border-slate-200 rounded-xl font-bold text-slate-700">
              <SelectValue placeholder="Semua Kategori" />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
              <SelectItem value="all" className="font-bold text-slate-700">Semua Kategori</SelectItem>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat} className="font-medium text-slate-600">
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop/Tablet Horizontal Scroll */}
        <div className="hidden sm:flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="rounded-full h-8 px-4 text-[11px] font-bold uppercase tracking-wider transition-all flex-shrink-0"
          >
            Semua
          </Button>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className="rounded-full h-8 px-4 text-[11px] font-bold uppercase tracking-wider whitespace-nowrap transition-all flex-shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border-slate-100"><CardContent className="p-4"><Skeleton className="h-48 w-full rounded-xl" /></CardContent></Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
          <CardContent className="p-12 text-center space-y-3">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Belum ada toko terdaftar</p>
            <p className="text-xs text-slate-400 max-w-[200px] mx-auto">Coba cari dengan kata kunci lain atau pilih kategori berbeda</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {filtered.map((store) => (
            <Link key={store.id} to={`/stores/${store.id}`} className="group">
              <Card className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full border-slate-100 overflow-hidden flex flex-col">
                <CardContent className="p-4 space-y-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-50 shadow-sm overflow-hidden flex-shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                      {store.logo_url ? (
                        <img src={store.logo_url} alt={store.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-50">
                          <Store className="w-6 h-6 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 overflow-hidden">
                        <h3 className="font-bold text-slate-800 line-clamp-1 group-hover:text-primary transition-colors text-base leading-tight">{store.name}</h3>
                        <StoreStatusBadge status={store.status} isOpen={store.is_open} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                        <MapPin className="w-3 h-3 text-slate-300" />
                        <span className="truncate">Blok {store.houses?.block} No. {store.houses?.number}</span>
                      </div>
                    </div>
                  </div>

                  {store.image_url ? (
                    <div className="relative h-36 sm:h-44 w-full overflow-hidden rounded-2xl shadow-inner bg-slate-100">
                      <img src={store.image_url} alt={store.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    {store.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed italic border-l-2 border-slate-100 pl-3">
                        &quot;{store.description}&quot;
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-auto">
                      <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-full border border-slate-100">
                        <Phone className="w-3 h-3 text-emerald-500" />
                        <span className="font-bold tracking-tight text-slate-600">{store.wa_number}</span>
                      </div>
                      {store.website_url && (
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-black uppercase tracking-tighter hover:text-blue-700 transition-colors">
                          <Globe className="w-3.5 h-3.5" />
                          <span>Visit Web</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {canManageContent() && store.status === "pending" && (
                    <div className="flex gap-2 pt-2" onClick={(e) => e.preventDefault()}>
                      <Button size="sm" variant="default" className="flex-1 rounded-xl h-9 hover:bg-emerald-600 shadow-md shadow-emerald-100 border-none px-0" onClick={() => verifyMutation.mutate({ id: store.id, status: "approved" })}>
                        <CheckCircle className="w-3.5 h-3.5 mr-1" />Setujui
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 rounded-xl h-9 hover:bg-rose-600 shadow-md shadow-rose-100 border-none px-0" onClick={() => verifyMutation.mutate({ id: store.id, status: "rejected" })}>
                        <XCircle className="w-3.5 h-3.5 mr-1" />Tolak
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
