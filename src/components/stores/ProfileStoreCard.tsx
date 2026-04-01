import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, Plus, ExternalLink, CheckCircle, Clock, XCircle, Power, AlertCircle, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { StoreFormDialog } from "./StoreFormDialog";
import { differenceInDays } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StoreStatusBadge } from "./StoreStatusBadge";

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
        .select("id, name, status, wa_number, is_open, status_changed_at, categories")
        .eq("house_id", houseId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!houseId,
  });


  const storesToWarn = stores.filter(s => !s.is_open && s.status_changed_at && differenceInDays(new Date(), new Date(s.status_changed_at)) >= 7);

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
        <CardContent className="space-y-4">
          {storesToWarn.length > 0 && (
            <Alert className="bg-amber-50 border-amber-200 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-xs font-bold text-amber-900">Pemberitahuan</AlertTitle>
              <AlertDescription className="text-[10px] text-amber-800">
                Ada toko yang tutup lebih dari 7 hari. Cek status toko Anda.
              </AlertDescription>
            </Alert>
          )}

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
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end max-w-[100px]">
                      <StoreStatusBadge status={store.status} isOpen={store.is_open} />
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <StoreFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        houseId={houseId}
        mode="create"
      />
    </>
  );
}
