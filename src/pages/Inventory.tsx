import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import {
  Plus,
  Package,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  RotateCcw,
  User,
  Loader2,
  Image as ImageIcon,
  Camera,
  X,
  HelpCircle,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useRef } from "react";
import { getStoragePath } from "@/lib/utils";

interface InventoryItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  quantity: number;
  available_quantity: number;
  condition: string;
  image_url: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface BorrowRequest {
  id: string;
  user_id: string;
  status: string;
  notes: string | null;
  borrow_date: string;
  return_date: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BorrowItem {
  id: string;
  borrow_id: string;
  item_id: string;
  quantity: number;
  created_at: string;
}

const CONDITION_OPTIONS = [
  { value: "good", label: "Baik" },
  { value: "fair", label: "Cukup" },
  { value: "poor", label: "Rusak Ringan" },
  { value: "broken", label: "Rusak Berat" },
];

const CATEGORY_OPTIONS = [
  "Alat Kebersihan",
  "Alat Olahraga",
  "Alat Keamanan",
  "Peralatan Acara",
  "Elektronik",
  "Lainnya",
];

function getConditionBadge(condition: string) {
  switch (condition) {
    case "good":
      return <Badge className="bg-green-500/20 text-green-700 border-green-300">Baik</Badge>;
    case "fair":
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Cukup</Badge>;
    case "poor":
      return <Badge className="bg-orange-500/20 text-orange-700 border-orange-300">Rusak Ringan</Badge>;
    case "broken":
      return <Badge variant="destructive">Rusak Berat</Badge>;
    default:
      return <Badge variant="outline">{condition}</Badge>;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-300">Menunggu</Badge>;
    case "approved":
      return <Badge className="bg-blue-500/20 text-blue-700 border-blue-300">Disetujui</Badge>;
    case "borrowed":
      return <Badge className="bg-purple-500/20 text-purple-700 border-purple-300">Dipinjam</Badge>;
    case "returned":
      return <Badge className="bg-green-500/20 text-green-700 border-green-300">Dikembalikan</Badge>;
    case "rejected":
      return <Badge variant="destructive">Ditolak</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Inventory() {
  const { user, canManageContent, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [selectedItems, setSelectedItems] = useState<Map<string, number>>(new Map());
  const [borrowNotes, setBorrowNotes] = useState("");
  const [borrowDialogOpen, setBorrowDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);

  // Item form state
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    category: "",
    quantity: 1,
    condition: "good",
    image_url: "",
  });

  // Fetch inventory items
  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Fetch borrow requests with items and profiles
  const { data: borrows = [], isLoading: borrowsLoading } = useQuery({
    queryKey: ["inventory-borrows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_borrows")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as BorrowRequest[];
    },
  });

  const { data: borrowItems = [] } = useQuery({
    queryKey: ["inventory-borrow-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_borrow_items")
        .select("*");
      if (error) throw error;
      return data as BorrowItem[];
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

  const { data: residents = [] } = useQuery({
    queryKey: ["residents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_residents")
        .select("user_id, houses(block, number)");
      if (error) throw error;
      
      // Since houses is an array when joining (or single object depending on relationship),
      // we need to handle both possible return shapes from supabase-js typing.
      // Usually house_residents -> houses is a many-to-one (one house per resident record).
      return data as { user_id: string; houses: { block: string; number: string } | null }[];
    },
  });

  const profileMap = new Map(profiles.map((p) => {
    const resident = residents.find(r => r.user_id === p.id);
    const houseStr = resident?.houses ? `${resident.houses.block}${resident.houses.number}` : "";
    return [p.id, houseStr ? `${p.full_name} (${houseStr})` : p.full_name];
  }));

  // Get active borrowers per item
  const activeBorrowsByItem = new Map<string, { userName: string; quantity: number }[]>();
  borrows
    .filter((b) => b.status === "borrowed" || b.status === "approved")
    .forEach((b) => {
      const bItems = borrowItems.filter((bi) => bi.borrow_id === b.id);
      bItems.forEach((bi) => {
        const existing = activeBorrowsByItem.get(bi.item_id) || [];
        existing.push({
          userName: profileMap.get(b.user_id) || "Unknown",
          quantity: bi.quantity,
        });
        activeBorrowsByItem.set(bi.item_id, existing);
      });
    });

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: async (form: typeof itemForm) => {
      const { error } = await supabase.from("inventory_items").insert({
        name: form.name,
        description: form.description || null,
        category: form.category || null,
        quantity: form.quantity,
        available_quantity: form.quantity,
        condition: form.condition,
        image_url: form.image_url || null,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Berhasil", description: "Inventaris berhasil ditambahkan" });
      resetItemForm();
      setItemDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: typeof itemForm }) => {
      // Calculate how many are currently lent out
      const currentItem = items.find((i) => i.id === id);
      const lentOut = currentItem ? currentItem.quantity - currentItem.available_quantity : 0;
      const newAvailable = Math.max(0, form.quantity - lentOut);

      const { error } = await supabase
        .from("inventory_items")
        .update({
          name: form.name,
          description: form.description || null,
          category: form.category || null,
          quantity: form.quantity,
          available_quantity: newAvailable,
          condition: form.condition,
          image_url: form.image_url || null,
        })
        .eq("id", id);
      if (error) throw error;

      // Cleanup old image if it was changed
      if (currentItem?.image_url && currentItem.image_url !== form.image_url) {
        const oldPath = getStoragePath(currentItem.image_url, "inventory");
        if (oldPath) {
          await supabase.storage.from("inventory").remove([oldPath]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Berhasil", description: "Inventaris berhasil diperbarui" });
      resetItemForm();
      setItemDialogOpen(false);
      setEditingItem(null);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      // Find item to get image_url before deletion
      const item = items.find((i) => i.id === id);

      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;

      // Cleanup storage image
      if (item?.image_url) {
        const path = getStoragePath(item.image_url, "inventory");
        if (path) {
          await supabase.storage.from("inventory").remove([path]);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
      toast({ title: "Berhasil", description: "Inventaris berhasil dihapus" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const submitBorrowMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Anda harus login");
      if (selectedItems.size === 0) throw new Error("Pilih minimal 1 barang");

      const { data: borrow, error: borrowError } = await supabase
        .from("inventory_borrows")
        .insert({
          user_id: user.id,
          notes: borrowNotes || null,
          status: "pending",
        })
        .select()
        .single();
      if (borrowError) throw borrowError;

      const borrowItemsData = Array.from(selectedItems.entries()).map(([item_id, quantity]) => ({
        borrow_id: borrow.id,
        item_id,
        quantity,
      }));

      const { error: itemsError } = await supabase
        .from("inventory_borrow_items")
        .insert(borrowItemsData);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory-borrows", "inventory-borrow-items"] });
      toast({ title: "Berhasil", description: "Permintaan peminjaman berhasil dikirim" });
      setSelectedItems(new Map());
      setBorrowNotes("");
      setBorrowDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateBorrowStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
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

      // Update available quantities
      if (status === "borrowed") {
        const bItems = borrowItems.filter((bi) => bi.borrow_id === id);
        for (const bi of bItems) {
          const item = items.find((i) => i.id === bi.item_id);
          if (item) {
            await supabase
              .from("inventory_items")
              .update({ available_quantity: Math.max(0, item.available_quantity - bi.quantity) })
              .eq("id", bi.item_id);
          }
        }
      }
      if (status === "returned") {
        const bItems = borrowItems.filter((bi) => bi.borrow_id === id);
        for (const bi of bItems) {
          const item = items.find((i) => i.id === bi.item_id);
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
      queryClient.invalidateQueries({ queryKey: ["inventory-items", "inventory-borrows"] });
      toast({ title: "Berhasil", description: "Status peminjaman diperbarui" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetItemForm = () => {
    setItemForm({ name: "", description: "", category: "", quantity: 1, condition: "good", image_url: "" });
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      quantity: item.quantity,
      condition: item.condition,
      image_url: item.image_url || "",
    });
    setItemDialogOpen(true);
  };

  const toggleItemSelection = (itemId: string, available: number) => {
    const newSelected = new Map(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.set(itemId, Math.min(1, available));
    }
    setSelectedItems(newSelected);
  };

  const updateSelectedQuantity = (itemId: string, qty: number, maxAvailable: number) => {
    const newSelected = new Map(selectedItems);
    newSelected.set(itemId, Math.min(Math.max(1, qty), maxAvailable));
    setSelectedItems(newSelected);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "File tidak valid", description: "Pilih file gambar" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File terlalu besar", description: "Maksimal 2MB" });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("inventory").upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("inventory").getPublicUrl(filePath);
      setItemForm((prev) => ({ ...prev, image_url: urlData.publicUrl }));
      toast({ title: "Berhasil", description: "Gambar berhasil diunggah" });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
      toast({ variant: "destructive", title: "Gagal", description: errorMessage });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setItemForm((prev) => ({ ...prev, image_url: "" }));
  };

  const canManage = canManageContent() || isAdmin();

  return (
    <section className="p-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Inventaris</h1>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-200 ml-1 shadow-sm bg-background/50 backdrop-blur-sm"
                onClick={() => setIsInstructionsOpen(true)}
              >
                <HelpCircle className="w-4 h-4" />
                <span>Cara Pinjam</span>
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">Kelola dan pinjam peralatan paguyuban</p>
          </div>
          <div className="flex gap-2">
            {selectedItems.size > 0 && (
              <Button onClick={() => setBorrowDialogOpen(true)} className="gap-2">
                <Send className="w-4 h-4" />
                Pinjam ({selectedItems.size})
              </Button>
            )}
            {canManage && (
              <Dialog open={itemDialogOpen} onOpenChange={(open) => {
                setItemDialogOpen(open);
                if (!open) { resetItemForm(); setEditingItem(null); }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{editingItem ? "Edit Inventaris" : "Tambah Inventaris"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Nama Barang *</label>
                      <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Nama barang" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Deskripsi</label>
                      <Textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Deskripsi barang" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Kategori</label>
                      <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                        <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">Jumlah *</label>
                        <Input type="number" min={1} value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 1 })} />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Kondisi *</label>
                        <Select value={itemForm.condition} onValueChange={(v) => setItemForm({ ...itemForm, condition: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CONDITION_OPTIONS.map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Foto Barang</label>
                      <div className="mt-2 flex items-center gap-4">
                        {itemForm.image_url ? (
                          <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                            <img src={itemForm.image_url} alt="Preview" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={removeImage}
                              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 shadow-sm"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="w-20 h-20 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted transition-colors text-muted-foreground"
                          >
                            <Camera className="w-6 h-6 mb-1" />
                            <span className="text-[10px]">Unggah</span>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        {isUploading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => editingItem
                        ? updateItemMutation.mutate({ id: editingItem.id, form: itemForm })
                        : createItemMutation.mutate(itemForm)
                      }
                      disabled={!itemForm.name || createItemMutation.isPending || updateItemMutation.isPending}
                    >
                      {(createItemMutation.isPending || updateItemMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {editingItem ? "Simpan" : "Tambah"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Tabs defaultValue="items">
          <TabsList>
            <TabsTrigger value="items">Daftar Barang</TabsTrigger>
            <TabsTrigger value="borrows">Peminjaman</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4">
            {itemsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Belum ada inventaris</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Mobile cards */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                  {items.map((item) => {
                    const borrowers = activeBorrowsByItem.get(item.id) || [];
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <Card key={item.id} className={`overflow-hidden transition-all duration-300 ${isSelected ? "ring-2 ring-primary shadow-lg scale-[1.02]" : "shadow-sm"}`}>
                        <div className="relative">
                          {/* Selection Checkbox - Absolute Top Left */}
                          {item.available_quantity > 0 && item.condition !== "broken" && (
                            <div className="absolute top-3 left-3 z-20">
                              <div className="bg-background/90 backdrop-blur-md p-1.5 rounded-full shadow-md border border-primary/20 flex items-center justify-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItemSelection(item.id, item.available_quantity)}
                                  className="h-5 w-5 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                                />
                              </div>
                            </div>
                          )}


                            {/* Image on Top - Full Width */}
                            <div 
                              className="w-full h-56 bg-muted relative overflow-hidden cursor-pointer active:scale-95 transition-transform"
                              onClick={() => item.image_url && setPreviewImage(item.image_url)}
                            >
                              {item.image_url ? (
                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-gradient-to-br from-muted to-muted-foreground/10">
                                  <ImageIcon className="w-12 h-12 opacity-20 mb-2" />
                                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-40">No Image</span>
                                </div>
                              )}
                              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent pointer-events-none" />
                            </div>
                          </div>

                          <CardContent className="p-5 -mt-6 relative bg-background rounded-t-3xl space-y-4">
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-bold text-xl text-foreground leading-tight">{item.name}</h3>
                                {getConditionBadge(item.condition)}
                              </div>
                              {item.category && (
                                <p className="text-xs font-bold text-primary uppercase tracking-widest">{item.category}</p>
                              )}
                            </div>

                            {item.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/50">
                              <div className="space-y-0.5">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status Stok</p>
                                <p className="text-sm font-bold">
                                  <span className={item.available_quantity === 0 ? "text-destructive" : "text-green-600"}>
                                    {item.available_quantity} Tersedia
                                  </span>
                                  <span className="text-muted-foreground font-normal ml-1">/ {item.quantity} Total</span>
                                </p>
                              </div>
                              <div className="w-12 h-12 rounded-full border-4 border-muted flex items-center justify-center relative">
                                <div 
                                  className="absolute inset-0 rounded-full border-4 border-primary transition-all duration-500" 
                                  style={{ 
                                    clipPath: `inset(${100 - (item.available_quantity / item.quantity) * 100}% 0 0 0)`,
                                    borderColor: item.available_quantity === 0 ? 'rgb(239 68 68)' : 'rgb(34 197 94)'
                                  }}
                                />
                                <span className="text-[10px] font-black">{Math.round((item.available_quantity / item.quantity) * 100)}%</span>
                              </div>
                            </div>

                            {isSelected && (
                              <div className="p-4 rounded-xl border-2 border-primary bg-primary/5 space-y-3 animate-in fade-in zoom-in-95 duration-300">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-black uppercase tracking-widest text-primary">Jumlah Pinjam</label>
                                  <Badge variant="outline" className="font-bold">{selectedItems.get(item.id) || 1} Unit</Badge>
                                </div>
                                <Input
                                  type="number"
                                  min={1}
                                  max={item.available_quantity}
                                  className="h-12 text-lg font-bold text-center appearance-none"
                                  value={selectedItems.get(item.id) || 1}
                                  onChange={(e) => updateSelectedQuantity(item.id, parseInt(e.target.value) || 1, item.available_quantity)}
                                />
                              </div>
                            )}

                            {borrowers.length > 0 && (
                              <div className="pt-2 border-t border-dashed">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5" /> Peminjam Saat Ini
                                </p>
                                <div className="space-y-2">
                                  {borrowers.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between bg-muted/50 p-2 rounded-lg border border-border/30">
                                      <span className="text-xs font-medium">{b.userName}</span>
                                      <Badge variant="outline" className="text-[10px] font-bold bg-background">{b.quantity}x</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Full-width manage buttons at the very bottom of content */}
                            {canManage && (
                              <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-4">
                                <Button 
                                  variant="outline" 
                                  className="w-full flex items-center gap-2 h-11 font-bold uppercase text-[10px] tracking-widest"
                                  onClick={() => openEditDialog(item)}
                                >
                                  <Edit className="w-4 h-4" /> Edit
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      className="w-full flex items-center gap-2 h-11 font-bold uppercase text-[10px] tracking-widest text-destructive hover:text-destructive hover:bg-destructive/5"
                                    >
                                      <Trash2 className="w-4 h-4" /> Hapus
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Hapus {item.name}?</AlertDialogTitle>
                                      <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Batal</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteItemMutation.mutate(item.id)}>Hapus</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                {/* Desktop table */}
                <div className="hidden md:block">
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead className="w-16">Foto</TableHead>
                          <TableHead>Nama</TableHead>
                          <TableHead>Kategori</TableHead>
                          <TableHead>Kondisi</TableHead>
                          <TableHead className="text-center">Jumlah</TableHead>
                          <TableHead className="text-center">Tersedia</TableHead>
                          <TableHead>Peminjam</TableHead>
                          {canManage && <TableHead className="text-right">Aksi</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => {
                          const borrowers = activeBorrowsByItem.get(item.id) || [];
                          const isSelected = selectedItems.has(item.id);
                          return (
                            <TableRow key={item.id} className={isSelected ? "bg-primary/5" : ""}>
                              <TableCell>
                                {item.available_quantity > 0 && item.condition !== "broken" && (
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleItemSelection(item.id, item.available_quantity)}
                                  />
                                )}
                              </TableCell>
                              <TableCell>
                                <div 
                                  className="w-10 h-10 rounded border overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() => item.image_url && setPreviewImage(item.image_url)}
                                >
                                  {item.image_url ? (
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                                      <ImageIcon className="w-4 h-4" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{item.name}</p>
                                  {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                                </div>
                                {isSelected && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <label className="text-xs">Qty:</label>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={item.available_quantity}
                                      value={selectedItems.get(item.id) || 1}
                                      onChange={(e) => updateSelectedQuantity(item.id, parseInt(e.target.value) || 1, item.available_quantity)}
                                      className="w-16 h-7 text-xs"
                                    />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                {item.category && <Badge variant="outline">{item.category}</Badge>}
                              </TableCell>
                              <TableCell>{getConditionBadge(item.condition)}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-center">
                                <span className={item.available_quantity === 0 ? "text-destructive font-bold" : "text-green-600 font-bold"}>
                                  {item.available_quantity}
                                </span>
                              </TableCell>
                              <TableCell>
                                {borrowers.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {borrowers.map((b, i) => (
                                      <p key={i} className="text-xs flex items-center gap-1">
                                        <User className="w-3 h-3" /> {b.userName}
                                      </p>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(item)}>
                                      <Edit className="w-3.5 h-3.5" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Hapus {item.name}?</AlertDialogTitle>
                                          <AlertDialogDescription>Tindakan ini tidak bisa dibatalkan.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Batal</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => deleteItemMutation.mutate(item.id)}>Hapus</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="borrows" className="mt-4">
            {borrowsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : borrows.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Send className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Belum ada peminjaman</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {borrows.map((borrow) => {
                  const bItems = borrowItems.filter((bi) => bi.borrow_id === borrow.id);
                  const borrowerName = profileMap.get(borrow.user_id) || "Unknown";
                  const approverName = borrow.approved_by ? profileMap.get(borrow.approved_by) : null;

                  return (
                    <Card key={borrow.id}>
                      <CardHeader className="pb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{borrowerName}</CardTitle>
                            {getStatusBadge(borrow.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(borrow.created_at), "dd MMM yyyy HH:mm", { locale: idLocale })}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-1">
                          {bItems.map((bi) => {
                            const item = items.find((i) => i.id === bi.item_id);
                            return (
                              <p key={bi.id} className="text-sm">
                                • {item?.name || "Unknown"} ({bi.quantity}x)
                              </p>
                            );
                          })}
                        </div>
                        {borrow.notes && <p className="text-sm text-muted-foreground">Catatan: {borrow.notes}</p>}
                        {approverName && (
                          <p className="text-xs text-muted-foreground">Disetujui oleh: {approverName}</p>
                        )}
                        {borrow.return_date && (
                          <p className="text-xs text-muted-foreground">
                            Dikembalikan: {format(new Date(borrow.return_date), "dd MMM yyyy HH:mm", { locale: idLocale })}
                          </p>
                        )}

                        {canManage && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t">
                            {borrow.status === "pending" && (
                              <>
                                <Button size="sm" variant="outline" className="gap-1" onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "approved" })}>
                                  <CheckCircle className="w-3.5 h-3.5" /> Setujui
                                </Button>
                                <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "rejected" })}>
                                  <XCircle className="w-3.5 h-3.5" /> Tolak
                                </Button>
                              </>
                            )}
                            {borrow.status === "approved" && (
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "borrowed" })}>
                                <Package className="w-3.5 h-3.5" /> Tandai Dipinjam
                              </Button>
                            )}
                            {borrow.status === "borrowed" && (
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => updateBorrowStatusMutation.mutate({ id: borrow.id, status: "returned" })}>
                                <RotateCcw className="w-3.5 h-3.5" /> Tandai Dikembalikan
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Borrow confirmation dialog */}
        <Dialog open={borrowDialogOpen} onOpenChange={setBorrowDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Konfirmasi Peminjaman</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Barang yang dipinjam:</p>
                {Array.from(selectedItems.entries()).map(([itemId, qty]) => {
                  const item = items.find((i) => i.id === itemId);
                  return (
                    <p key={itemId} className="text-sm text-muted-foreground">
                      • {item?.name} ({qty}x)
                    </p>
                  );
                })}
              </div>
              <div>
                <label className="text-sm font-medium">Catatan (opsional)</label>
                <Textarea
                  value={borrowNotes}
                  onChange={(e) => setBorrowNotes(e.target.value)}
                  placeholder="Tujuan peminjaman, estimasi pengembalian, dll."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBorrowDialogOpen(false)}>Batal</Button>
              <Button onClick={() => submitBorrowMutation.mutate()} disabled={submitBorrowMutation.isPending}>
                {submitBorrowMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Kirim Permintaan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isInstructionsOpen} onOpenChange={setIsInstructionsOpen}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="w-5 h-5 text-primary" />
              Tata Cara Peminjaman
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid gap-4">
              <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">1</div>
                <div>
                  <h4 className="font-semibold text-sm">Pilih Barang</h4>
                  <p className="text-sm text-muted-foreground">Cari barang yang Anda butuhkan di daftar inventaris. Pastikan stok tersedia (tersedia &gt; 0).</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">2</div>
                <div>
                  <h4 className="font-semibold text-sm">Tambah ke Daftar</h4>
                  <p className="text-sm text-muted-foreground">Centang kotak pada barang yang ingin dipinjam. Anda bisa memilih lebih dari satu barang sekaligus.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">3</div>
                <div>
                  <h4 className="font-semibold text-sm">Isi Formulir</h4>
                  <p className="text-sm text-muted-foreground">Klik tombol <span className="font-medium text-foreground">"Pinjam"</span> di pojok kanan atas, lalu isi tanggal peminjaman dan perkiraan kembali.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">4</div>
                <div>
                  <h4 className="font-semibold text-sm">Tunggu Persetujuan</h4>
                  <p className="text-sm text-muted-foreground">Permintaan akan dikirim ke Pengurus. Pantau statusnya di tab <span className="font-medium text-foreground">"Riwayat Peminjaman"</span>.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-none flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">5</div>
                <div>
                  <h4 className="font-semibold text-sm">Pengambilan & Pengembalian</h4>
                  <p className="text-sm text-muted-foreground">Setelah disetujui, hubungi Pengurus untuk pengambilan fisik. Kembalikan barang tepat waktu dalam kondisi baik.</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg border border-dashed text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Catatan:</p>
              Penanggung jawab inventaris berhak menolak ajuan peminjaman sesuai dengan kebijakan atau kondisi barang.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsInstructionsOpen(false)} className="w-full sm:w-auto font-semibold">
              Saya Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative w-full h-full max-h-[80vh] flex items-center justify-center">
            <img 
              src={previewImage || ""} 
              alt="Preview" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            />
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-4 right-4 bg-background/50 backdrop-blur-sm text-foreground rounded-full p-2 hover:bg-background/80 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
