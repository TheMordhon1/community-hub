import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Share2, Package, CheckCircle, XCircle, RotateCcw, Edit, Trash2, CalendarIcon } from "lucide-react";
import { format, parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/ShareDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

function getStatusBadge(status: string) {
  switch (status) {
    case "pending": return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Menunggu</Badge>;
    case "approved": return <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">Disetujui</Badge>;
    case "borrowed": return <Badge className="bg-purple-500/20 text-purple-700 border-purple-300">Dipinjam</Badge>;
    case "returned": return <Badge className="bg-green-500/20 text-green-700 border-green-300">Dikembalikan</Badge>;
    case "rejected": return <Badge variant="destructive">Ditolak</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

export default function BorrowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canManageContent, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editReturnDate, setEditReturnDate] = useState<Date>();
  const [editItems, setEditItems] = useState<Map<string, number>>(new Map());

  const { data: borrow, isLoading: borrowLoading } = useQuery({
    queryKey: ["inventory-borrow", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_borrows")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const { data: bItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["inventory-borrow-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_borrow_items")
        .select(`
          *,
          item:inventory_items(*)
        `)
        .eq("borrow_id", id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const updateBorrowStatusMutation = useMutation({
    mutationFn: async ({ id, status, currentStatus }: { id: string; status: string; currentStatus: string }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "approved") {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }
      if (status === "returned") {
        updateData.return_date = new Date().toISOString();
      }
      const { error } = await supabase.from("inventory_borrows").update(updateData).eq("id", id);
      if (error) throw error;

      // Ensure item quantity is managed only if we haven't already subtracted (e.g., jump from approved -> borrowed)
      // For simplicity, we assume strict state machine: pending -> approved -> borrowed -> returned
      if (status === "borrowed" && currentStatus !== "borrowed") {
        for (const bi of bItems) {
          const item = bi.item as { available_quantity: number, quantity: number, id: string } | null;
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ available_quantity: Math.max(0, item.available_quantity - bi.quantity) })
              .eq("id", bi.item_id);
          }
        }
      }
      if (status === "returned" && currentStatus === "borrowed") {
        for (const bi of bItems) {
          const item = bi.item as { available_quantity: number, quantity: number, id: string } | null;
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ available_quantity: Math.min(item.quantity, item.available_quantity + bi.quantity) })
              .eq("id", bi.item_id);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-borrows"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-borrow", id] });
      toast({ title: "Berhasil", description: "Status peminjaman diperbarui" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBorrowMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("inventory_borrows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-borrows"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-borrow-items"] });
      toast({ title: "Berhasil", description: "Peminjaman dibatalkan" });
      navigate("/inventory");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBorrowMutation = useMutation({
    mutationFn: async () => {
      if (!editReturnDate) throw new Error("Pilih estimasi tanggal pengembalian");
      if (editItems.size === 0) throw new Error("Pilih minimal 1 barang");

      const finalNotes = editNotes 
        ? `Estimasi Pengembalian: ${format(editReturnDate, "dd MMM yyyy", { locale: idLocale })}\n\nCatatan: ${editNotes}`
        : `Estimasi Pengembalian: ${format(editReturnDate, "dd MMM yyyy", { locale: idLocale })}`;

      const { error: notesError } = await supabase
        .from("inventory_borrows")
        .update({ notes: finalNotes })
        .eq("id", id);
      
      if (notesError) throw notesError;

      // Check if items have actually changed, or if the DB has duplicate rows (self-healing)
      const originalItems = new Map(bItems.map(bi => [bi.item_id, bi.quantity]));
      const hasDuplicatesInDb = bItems.length !== originalItems.size;
      const itemsChanged =
        hasDuplicatesInDb ||
        editItems.size !== originalItems.size ||
        Array.from(editItems.entries()).some(
          ([itemId, qty]) => originalItems.get(itemId) !== qty
        );

      if (itemsChanged) {
        // Update items by deleting old ones and inserting new ones
        const { error: deleteError } = await supabase
          .from("inventory_borrow_items")
          .delete()
          .eq("borrow_id", id);
        if (deleteError) throw deleteError;

        const newItems = Array.from(editItems.entries()).map(([item_id, quantity]) => ({
          borrow_id: id,
          item_id,
          quantity,
        }));

        const { error: insertError } = await supabase
          .from("inventory_borrow_items")
          .insert(newItems);
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-borrows"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-borrow", id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-borrow-items", id] });
      toast({ title: "Berhasil", description: "Peminjaman diperbarui" });
      setEditDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openEditDialog = () => {
    if (borrow?.notes && borrow.notes.startsWith("Estimasi Pengembalian:")) {
      const parts = borrow.notes.split("\n\nCatatan: ");
      if (parts.length > 1) {
        setEditNotes(parts[1]);
      } else {
        setEditNotes("");
      }
      const dateStr = parts[0].replace("Estimasi Pengembalian: ", "").trim();
      const parsedDate = parse(dateStr, "dd MMM yyyy", new Date(), { locale: idLocale });
      if (!isNaN(parsedDate.getTime())) {
        setEditReturnDate(parsedDate);
      }
    } else {
      setEditNotes(borrow?.notes || "");
    }

    const itemMap = new Map<string, number>();
    bItems.forEach((bi) => {
      itemMap.set(bi.item_id, bi.quantity);
    });
    setEditItems(itemMap);
    setEditDialogOpen(true);
  };

  const updateEditQuantity = (itemId: string, qty: number, maxAvailable: number) => {
    const newItems = new Map(editItems);
    if (qty <= 0) {
      newItems.delete(itemId);
    } else {
      newItems.set(itemId, Math.min(qty, maxAvailable));
    }
    setEditItems(newItems);
  };

  const remainingItemsToAdd = allItems.filter(i => i.available_quantity > 0 && i.condition !== "broken" && !editItems.has(i.id));

  const shareUrl = `${window.location.origin}/inventory/borrow/${id}`;

  if (borrowLoading || itemsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!borrow) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Peminjaman tidak ditemukan</h2>
        <Link to="/inventory">
          <Button variant="outline">Kembali ke Inventaris</Button>
        </Link>
      </div>
    );
  }

  const profileMap = new Map(profiles.map(p => [p.id, p.full_name]));
  const canManage = canManageContent() || isAdmin();
  const borrowerName = profileMap.get(borrow.user_id) || "Unknown";
  const approverName = borrow.approved_by ? profileMap.get(borrow.approved_by) : null;
  const shareText = `📦 Peminjaman Inventaris oleh ${borrowerName}\n${bItems.map(bi => `• ${(bi.item as { name: string } | null)?.name || 'Item'} (${bi.quantity}x)`).join('\n')}`;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/inventory">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Detail Peminjaman</h1>
        </div>
        <div className="flex gap-2">
          {borrow.status === "pending" && (user?.id === borrow.user_id || canManage) && (
            <>
              <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-2 hidden sm:flex">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 hidden sm:flex">
                    <Trash2 className="w-4 h-4" />
                    Batal
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Batalkan Peminjaman?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menghapus permintaan peminjaman. Aksi ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tutup</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteBorrowMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Batalkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)} className="gap-2">
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Bagikan</span>
          </Button>
        </div>
      </div>

      <Card className="shadow-lg border-2">
        <CardHeader className="bg-muted/30 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">{borrowerName}</CardTitle>
              <CardDescription>
                Diajukan pada: {format(new Date(borrow.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
              </CardDescription>
            </div>
            {getStatusBadge(borrow.status)}
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Daftar Barang</h3>
            <div className="space-y-3">
              {bItems.map((bi) => {
                const item = bi.item as { name: string, category: string, image_url: string } | null;
                return (
                  <div key={bi.id} className="flex items-center justify-between bg-muted/50 p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {item?.image_url ? (
                        <div className="w-10 h-10 rounded overflow-hidden bg-background shrink-0">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded bg-background border flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm sm:text-base leading-tight">{item?.name || "Unknown"}</p>
                        {item?.category && <p className="text-xs text-muted-foreground">{item.category}</p>}
                      </div>
                    </div>
                    <Badge variant="outline" className="font-bold sm:text-base px-3 py-1">{bi.quantity} unit</Badge>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 bg-muted/20 p-4 rounded-xl border">
            {borrow.notes && (
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Informasi & Catatan</h3>
                <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">
                  {borrow.notes.startsWith("Estimasi Pengembalian:") ? borrow.notes : `Catatan: ${borrow.notes}`}
                </p>
              </div>
            )}
            
            {approverName && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Disetujui Oleh</h3>
                <p className="text-sm font-medium">{approverName}</p>
                {borrow.approved_at && (
                  <p className="text-xs text-muted-foreground">
                    Pada {format(new Date(borrow.approved_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                  </p>
                )}
              </div>
            )}

            {borrow.return_date && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">Dikembalikan Pada</h3>
                <p className="text-sm font-medium">
                  {format(new Date(borrow.return_date), "dd MMM yyyy HH:mm", { locale: idLocale })}
                </p>
              </div>
            )}
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
              {borrow.status === "pending" && (
                <>
                  <Button onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "approved", currentStatus: borrow.status })} className="gap-2">
                    <CheckCircle className="w-4 h-4" /> Setujui
                  </Button>
                  <Button variant="destructive" onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "rejected", currentStatus: borrow.status })} className="gap-2">
                    <XCircle className="w-4 h-4" /> Tolak
                  </Button>
                </>
              )}
              {borrow.status === "approved" && (
                <Button onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "borrowed", currentStatus: borrow.status })} className="gap-2">
                  <Package className="w-4 h-4" /> Tandai Dipinjam (Keluar)
                </Button>
              )}
              {borrow.status === "borrowed" && (
                <Button onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "returned", currentStatus: borrow.status })} className="gap-2">
                  <RotateCcw className="w-4 h-4" /> Tandai Dikembalikan
                </Button>
              )}
            </div>
          )}
          
          {/* Mobile action buttons for edit/cancel (stacked at bottom) */}
          {borrow.status === "pending" && (user?.id === borrow.user_id || canManage) && (
            <div className="flex sm:hidden gap-2 pt-4 border-t w-full">
              <Button variant="outline" size="sm" onClick={openEditDialog} className="flex-1 gap-2">
                <Edit className="w-4 h-4" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 gap-2 text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-4 h-4" /> Batal
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Batalkan Peminjaman?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tindakan ini akan menghapus permintaan peminjaman. Aksi ini tidak dapat dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Tutup</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteBorrowMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Batalkan
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Peminjaman</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Daftar Barang *</label>
              <div className="space-y-2 mb-3">
                {Array.from(editItems.entries()).map(([itemId, qty]) => {
                  const item = allItems.find(i => i.id === itemId);
                  if (!item) return null;
                  const alreadyRequested = bItems.find(bi => bi.item_id === itemId)?.quantity ?? 0;
                  const maxAllowed = item.available_quantity + alreadyRequested;
                  return (
                    <div key={itemId} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                      <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={maxAllowed}
                          className="w-16 h-8 text-center text-xs"
                          value={qty === 0 ? "" : qty}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                            updateEditQuantity(itemId, val || 0, maxAllowed);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => updateEditQuantity(itemId, 0, 0)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {editItems.size === 0 && <p className="text-xs text-muted-foreground p-2 text-center border rounded-lg border-dashed">Belum ada barang dipilih.</p>}
              </div>

              {remainingItemsToAdd.length > 0 && (
                <Select
                  onValueChange={(val) => {
                    if (val) {
                      const item = allItems.find(i => i.id === val);
                      if (item) {
                        const alreadyRequested = bItems.find(bi => bi.item_id === item.id)?.quantity ?? 0;
                        const maxAllowed = item.available_quantity + alreadyRequested;
                        updateEditQuantity(val, 1, maxAllowed);
                      }
                    }
                  }}
                  value=""
                >
                  <SelectTrigger className="w-full text-sm h-9">
                    <SelectValue placeholder="Tambah barang peminjaman..." />
                  </SelectTrigger>
                  <SelectContent>
                    {remainingItemsToAdd.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.available_quantity} tersedia)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="pt-2 border-t mt-2">
              <label className="text-sm font-medium">Estimasi Tanggal Pengembalian *</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal mt-1",
                      !editReturnDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editReturnDate ? format(editReturnDate, "dd MMM yyyy", { locale: idLocale }) : <span>Pilih tanggal</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={editReturnDate}
                    onSelect={setEditReturnDate}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium">Catatan (opsional)</label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Tujuan peminjaman, dll."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Tutup</Button>
            <Button onClick={() => updateBorrowMutation.mutate()} disabled={updateBorrowMutation.isPending}>
              {updateBorrowMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Simpan Perubahan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Detail Peminjaman Inventaris"
        description="Bagikan detail peminjaman ini ke orang lain"
        url={shareUrl}
        shareText={shareText}
      />
    </div>
  );
}
