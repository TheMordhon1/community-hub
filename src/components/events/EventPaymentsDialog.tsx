import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X, Search, Wallet } from "lucide-react";
import {
  useEventHousePayments,
  useMarkEventHousePaid,
  useUnmarkEventHousePaid,
} from "@/hooks/useEventHousePayments";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import type { House } from "@/types/database";

interface EventPaymentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  participationFee: number | null;
}

export function EventPaymentsDialog({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  participationFee,
}: EventPaymentsDialogProps) {
  const [search, setSearch] = useState("");
  const naturalSort = useNaturalSort();

  const { data: houses, isLoading: housesLoading } = useQuery({
    queryKey: ["houses-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block", { ascending: true })
        .order("number", { ascending: true });
      if (error) throw error;
      return data as House[];
    },
    enabled: open,
  });

  const { data: payments, isLoading: paymentsLoading } = useEventHousePayments(eventId);
  const markPaid = useMarkEventHousePaid();
  const unmark = useUnmarkEventHousePaid();

  const paidSet = useMemo(() => new Set((payments || []).map((p) => p.house_id)), [payments]);

  const filtered = useMemo(() => {
    if (!houses) return [];
    const sorted = [...houses].sort((a, b) => naturalSort(`${a.block}-${a.number}`, `${b.block}-${b.number}`));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((h) =>
      `${h.block} ${h.number}`.toLowerCase().includes(q)
    );
  }, [houses, search, naturalSort]);

  const isLoading = housesLoading || paymentsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Kelola Pembayaran Rumah
          </DialogTitle>
          <DialogDescription>
            Tandai rumah yang sudah membayar untuk acara <span className="font-medium">{eventTitle}</span>
            {participationFee != null && participationFee > 0 && (
              <> · Biaya: Rp {participationFee.toLocaleString("id-ID")}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari blok / nomor rumah..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{paidSet.size} dari {houses?.length || 0} rumah sudah membayar</span>
        </div>

        <div className="flex-1 overflow-y-auto border rounded-md divide-y">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              Tidak ada rumah ditemukan
            </div>
          ) : (
            filtered.map((house) => {
              const isPaid = paidSet.has(house.id);
              const pending =
                (markPaid.isPending && markPaid.variables?.house_id === house.id) ||
                (unmark.isPending && unmark.variables?.house_id === house.id);
              return (
                <div key={house.id} className="flex items-center justify-between p-3 hover:bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Blok {house.block} No. {house.number}</span>
                    {isPaid && (
                      <Badge variant="default" className="gap-1 bg-success hover:bg-success">
                        <Check className="w-3 h-3" /> Lunas
                      </Badge>
                    )}
                  </div>
                  {isPaid ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => unmark.mutate({ event_id: eventId, house_id: house.id })}
                    >
                      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                      Batalkan
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        markPaid.mutate({
                          event_id: eventId,
                          house_id: house.id,
                          amount: participationFee ?? null,
                        })
                      }
                    >
                      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Tandai Lunas
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
