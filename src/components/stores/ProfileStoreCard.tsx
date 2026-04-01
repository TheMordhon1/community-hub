import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, ExternalLink, CheckCircle, Clock, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { CreateStoreDialog } from "./CreateStoreDialog";

interface ProfileStoreCardProps {
  houseId: string;
  userId: string;
}

export function ProfileStoreCard({ houseId, userId }: ProfileStoreCardProps) {
  const [showCreate, setShowCreate] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["my-stores", houseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id, name, status, wa_number")
        .eq("house_id", houseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!houseId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground text-[9px] h-5"><CheckCircle className="w-2.5 h-2.5 mr-1" />Terverifikasi</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-[9px] h-5"><XCircle className="w-2.5 h-2.5 mr-1" />Ditolak</Badge>;
      default:
        return <Badge variant="secondary" className="text-[9px] h-5"><Clock className="w-2.5 h-2.5 mr-1" />Menunggu</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Toko Saya
            </CardTitle>
            <CardDescription className="text-xs">
              Kelola toko dan usaha rumah Anda
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Tambah
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : stores.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <Store className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada toko terdaftar</p>
              <p className="text-xs mt-1">Tambahkan toko untuk mempromosikan usaha Anda ke warga</p>
            </div>
          ) : (
            <div className="space-y-3">
              {stores.map((store) => (
                <Link key={store.id} to={`/stores/${store.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-md transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Store className="w-4 h-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{store.name}</p>
                        <p className="text-xs text-muted-foreground">{store.wa_number}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getStatusBadge(store.status)}
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateStoreDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        houseId={houseId}
      />
    </>
  );
}
