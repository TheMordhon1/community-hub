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
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

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

  // Item form state
  const [itemForm, setItemForm] = useState({
    name: "",
    description: "",
    category: "",
    quantity: 1,
    condition: "good",
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
        })
        .eq("id", id);
      if (error) throw error;
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
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
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
    setItemForm({ name: "", description: "", category: "", quantity: 1, condition: "good" });
  };

  const openEditDialog = (item: InventoryItem) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description || "",
      category: item.category || "",
      quantity: item.quantity,
      condition: item.condition,
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

  const canManage = canManageContent() || isAdmin();

  return (
    <section className="p-6">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Inventaris</h1>
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
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {items.map((item) => {
                    const borrowers = activeBorrowsByItem.get(item.id) || [];
                    const isSelected = selectedItems.has(item.id);
                    return (
                      <Card key={item.id} className={`transition-all ${isSelected ? "ring-2 ring-primary" : ""}`}>
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3 flex-1">
                              {item.available_quantity > 0 && item.condition !== "broken" && (
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleItemSelection(item.id, item.available_quantity)}
                                  className="mt-1"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold truncate">{item.name}</h3>
                                {item.category && (
                                  <Badge variant="outline" className="text-xs mt-1">{item.category}</Badge>
                                )}
                              </div>
                            </div>
                            {canManage && (
                              <div className="flex gap-1">
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
                            )}
                          </div>
                          {item.description && <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>}
                          <div className="flex flex-wrap gap-2 items-center">
                            {getConditionBadge(item.condition)}
                            <span className="text-sm">
                              Tersedia: <strong>{item.available_quantity}</strong> / {item.quantity}
                            </span>
                          </div>
                          {isSelected && (
                            <div className="flex items-center gap-2">
                              <label className="text-sm">Jumlah pinjam:</label>
                              <Input
                                type="number"
                                min={1}
                                max={item.available_quantity}
                                value={selectedItems.get(item.id) || 1}
                                onChange={(e) => updateSelectedQuantity(item.id, parseInt(e.target.value) || 1, item.available_quantity)}
                                className="w-20 h-8"
                              />
                            </div>
                          )}
                          {borrowers.length > 0 && (
                            <div className="text-sm space-y-1 border-t pt-2">
                              <p className="text-muted-foreground font-medium flex items-center gap-1">
                                <User className="w-3.5 h-3.5" /> Sedang dipinjam:
                              </p>
                              {borrowers.map((b, i) => (
                                <p key={i} className="text-muted-foreground pl-5">
                                  {b.userName} ({b.quantity}x)
                                </p>
                              ))}
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
    </section>
  );
}
