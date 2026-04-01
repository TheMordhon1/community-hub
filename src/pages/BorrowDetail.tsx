import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { parse } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { ShareDialog } from "@/components/ShareDialog";
import { ArrowLeft } from "lucide-react";

// Sub-components
import { BorrowDetailHeader } from "./borrow-detail/components/BorrowDetailHeader";
import { BorrowDetailCard } from "./borrow-detail/components/BorrowDetailCard";
import { BorrowEditDialog } from "./borrow-detail/components/BorrowEditDialog";
import { BorrowRejectDialog } from "./borrow-detail/components/BorrowRejectDialog";
import { InventoryItemRef, BorrowRequest, BorrowItem, BorrowStatus } from "./borrow-detail/types";

export default function BorrowDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canManageContent, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editReturnDate, setEditReturnDate] = useState<Date>();
  const [editItems, setEditItems] = useState<Map<string, number>>(new Map());

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: borrow, isLoading: borrowLoading } = useQuery({
    queryKey: ["inventory-borrow", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_borrows").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as BorrowRequest;
    },
    enabled: !!id,
  });

  const { data: userHouseId } = useQuery({
    queryKey: ["user-house-id", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user?.id)
        .maybeSingle();
      if (error) throw error;
      return data?.house_id || null;
    },
    enabled: !!user?.id,
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
        .select("*, item:inventory_items(*)")
        .eq("borrow_id", id!);
      if (error) throw error;
      return data as BorrowItem[];
    },
    enabled: !!id,
  });

  const { data: allItems = [] } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("name");
      if (error) throw error;
      return data as InventoryItemRef[];
    },
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const invalidateBorrow = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-borrows"] });
    queryClient.invalidateQueries({ queryKey: ["inventory-borrow", id] });
    queryClient.invalidateQueries({ queryKey: ["inventory-borrow-items", id] });
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ status, currentStatus }: { status: BorrowStatus; currentStatus: BorrowStatus }) => {
      const updateData: Record<string, unknown> = { status };
      if (status === "approved") {
        updateData.approved_by = user?.id;
        updateData.approved_at = new Date().toISOString();
      }
      if (status === "returned") {
        updateData.return_date = new Date().toISOString();
      }
      if (status === "pending") {
        updateData.approved_by = null;
        updateData.approved_at = null;
      }
      const { error } = await supabase.from("inventory_borrows").update(updateData).eq("id", id!);
      if (error) throw error;

      if (status === "borrowed" && currentStatus !== "borrowed") {
        for (const bi of bItems) {
          const item = bi.item;
          if (item) {
            await supabase.from("inventory_items")
              .update({ available_quantity: Math.max(0, item.available_quantity - bi.quantity) })
              .eq("id", bi.item_id);
          }
        }
      }
      if (status === "returned" && currentStatus === "borrowed") {
        for (const bi of bItems) {
          const item = bi.item;
          if (item) {
            await supabase.from("inventory_items")
              .update({ available_quantity: Math.min(item.quantity, item.available_quantity + bi.quantity) })
              .eq("id", bi.item_id);
          }
        }
      }
    },
    onSuccess: () => {
      invalidateBorrow();
      toast({ title: "Berhasil", description: "Status peminjaman diperbarui" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      const notesWithReason = reason.trim()
        ? `${borrow?.notes || ""}\n\n[Alasan Penolakan]: ${reason.trim()}`
        : borrow?.notes || "";
      const { error: notesError } = await supabase
        .from("inventory_borrows")
        .update({ notes: notesWithReason, status: "rejected" })
        .eq("id", id!);
      if (notesError) throw notesError;
    },
    onSuccess: () => {
      invalidateBorrow();
      toast({ title: "Berhasil", description: "Peminjaman ditolak" });
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error: itemsError } = await supabase.from("inventory_borrow_items").delete().eq("borrow_id", id!);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from("inventory_borrows").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-borrows"] });
      toast({ title: "Berhasil", description: "Peminjaman dibatalkan" });
      navigate("/inventory");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async () => {
      if (!editReturnDate) throw new Error("Pilih estimasi tanggal pengembalian");
      const validItems = new Map(Array.from(editItems.entries()).filter(([, qty]) => qty > 0));
      if (validItems.size === 0) throw new Error("Pilih minimal 1 barang");

      // Recalculate notes which includes the estimation date
      const dateStr = parseReturnDateFromNotes(borrow?.notes || "");
      const cleanNotes = borrow?.notes?.split("\n\nCatatan: ")[1] || "";
      
      const finalNotes = editNotes
        ? `Estimasi Pengembalian: ${parseReturnDateFromDate(editReturnDate)}\n\nCatatan: ${editNotes}`
        : `Estimasi Pengembalian: ${parseReturnDateFromDate(editReturnDate)}`;

      const { error: notesError } = await supabase
        .from("inventory_borrows")
        .update({ notes: finalNotes })
        .eq("id", id!);
      if (notesError) throw notesError;

      const originalItems = new Map(bItems.map(bi => [bi.item_id, bi.quantity]));
      const itemsChanged = bItems.length !== originalItems.size ||
        validItems.size !== originalItems.size ||
        Array.from(validItems.entries()).some(([itemId, qty]) => originalItems.get(itemId) !== qty);

      if (itemsChanged) {
        const { error: deleteError } = await supabase.from("inventory_borrow_items").delete().eq("borrow_id", id!);
        if (deleteError) throw deleteError;
        
        const { error: insertError } = await supabase.from("inventory_borrow_items").insert(
          Array.from(validItems.entries()).map(([item_id, quantity]) => ({ borrow_id: id!, item_id, quantity }))
        );
        if (insertError) throw insertError;
      }
    },
    onSuccess: () => {
      invalidateBorrow();
      toast({ title: "Berhasil", description: "Peminjaman diperbarui" });
      setEditDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const parseReturnDateFromNotes = (notes: string) => {
    if (!notes.startsWith("Estimasi Pengembalian:")) return null;
    return notes.split("\n")[0].replace("Estimasi Pengembalian: ", "").trim();
  };

  const parseReturnDateFromDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('id-ID', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  const openEditDialog = () => {
    if (borrow?.notes?.startsWith("Estimasi Pengembalian:")) {
      const parts = borrow.notes.split("\n\nCatatan: ");
      setEditNotes(parts.length > 1 ? parts[1] : "");
      const dateStr = parts[0].replace("Estimasi Pengembalian: ", "").trim();
      const parsed = parse(dateStr, "dd MMM yyyy", new Date(), { locale: idLocale });
      if (!isNaN(parsed.getTime())) setEditReturnDate(parsed);
    } else {
      setEditNotes(borrow?.notes || "");
    }
    setEditItems(new Map(bItems.map(bi => [bi.item_id, bi.quantity])));
    setEditDialogOpen(true);
  };

  if (borrowLoading || itemsLoading) {
    return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!borrow) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold mb-4">Peminjaman tidak ditemukan</h2>
        <Link to="/inventory"><Button variant="outline">Kembali ke Inventaris</Button></Link>
      </div>
    );
  }

  const profileMap     = new Map(profiles.map(p => [p.id, p.full_name]));
  const canManage      = canManageContent() || isAdmin();
  const isOwner        = user?.id === borrow.user_id;
  const isHousemate    = userHouseId && borrow.house_id === userHouseId;
  const canEdit        = borrow.status === "pending" && (isOwner || isHousemate || canManage);
  const borrowerName   = profileMap.get(borrow.user_id) || "Unknown";
  const approverName   = borrow.approved_by ? profileMap.get(borrow.approved_by) : null;
  const shareUrl       = `${window.location.origin}/inventory/borrow/${id}`;
  const shareText      = `📦 Peminjaman Inventaris oleh ${borrowerName}\n${bItems.map(bi => {
    return `• ${bi.item?.name || "Item"} (${bi.quantity}x)`;
  }).join("\n")}`;

  return (
    <section className="py-6 px-4 space-y-6 pb-24">
      <BorrowDetailHeader
        canEdit={canEdit}
        onEdit={openEditDialog}
        onCancel={() => deleteMutation.mutate()}
        onShare={() => setShareDialogOpen(true)}
        isDeleting={deleteMutation.isPending}
      />

      <BorrowDetailCard
        borrow={borrow}
        borrowerName={borrowerName}
        approverName={approverName}
        bItems={bItems}
        canManage={canManage}
        canEdit={canEdit}
        onEdit={openEditDialog}
        onCancel={() => deleteMutation.mutate()}
        onReject={() => setRejectDialogOpen(true)}
        onStatusUpdate={(status: BorrowStatus) => updateStatusMutation.mutate({ status, currentStatus: borrow.status as BorrowStatus })}
        isDeleting={deleteMutation.isPending}
      />

      <BorrowEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        editItems={editItems}
        editNotes={editNotes}
        editReturnDate={editReturnDate}
        allItems={allItems}
        bItems={bItems}
        isUpdating={updateDetailsMutation.isPending}
        onUpdateNotes={setEditNotes}
        onUpdateReturnDate={setEditReturnDate}
        onUpdateQuantity={(itemId, qty, maxAvail) => {
          setEditItems(prev => {
            const next = new Map(prev);
            if (qty === "" || qty === 0) next.set(itemId, 0);
            else if (qty < 0) next.delete(itemId);
            else next.set(itemId, Math.min(qty, maxAvail));
            return next;
          });
        }}
        onRemoveItem={(itemId) => setEditItems(prev => { const next = new Map(prev); next.delete(itemId); return next; })}
        onFinalizeQuantity={(itemId) => {
          const current = editItems.get(itemId);
          if (current === undefined || current < 1) setEditItems(prev => new Map(prev).set(itemId, 1));
        }}
        onSave={() => updateDetailsMutation.mutate()}
      />

      <BorrowRejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        reason={rejectReason}
        onUpdateReason={setRejectReason}
        onConfirm={() => rejectMutation.mutate(rejectReason)}
        isPending={rejectMutation.isPending}
      />

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        title="Detail Peminjaman Inventaris"
        description="Bagikan detail peminjaman ini ke orang lain"
        url={shareUrl}
        shareText={shareText}
      />
    </section>
  );
}
