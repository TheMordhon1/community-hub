import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Loader2,
  Trash2,
  Home,
  Pencil,
  Users,
  ArrowLeft,
} from "lucide-react";
import type { House } from "@/types/database";
import { Link } from "react-router-dom";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { getInitials } from "@/lib/utils";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";

interface HouseResident {
  id: string;
  user_id: string;
  house_id: string;
  is_owner: boolean;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
}

interface HouseWithResidents extends House {
  residents: HouseResident[];
}

export default function Houses() {
  const { canManageContent } = useAuth();
  const { toast } = useToast();
  const { naturalSort } = useNaturalSort();
  const queryClient = useQueryClient();

  // State Management
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [block, setBlock] = useState("");
  const [number, setNumber] = useState("");
  const [selectedResidentsHouse, setSelectedResidentsHouse] =
    useState<HouseWithResidents | null>(null);
  const [editingResident, setEditingResident] = useState<HouseResident | null>(
    null
  );
  const [newHouseId, setNewHouseId] = useState("");
  const [deletingHouse, setDeletingHouse] = useState<HouseWithResidents | null>(
    null
  );

  // Data Fetching
  const { data: houses = [], isLoading } = useQuery({
    queryKey: ["houses-with-residents"],
    queryFn: async () => {
      const { data: houses, error: housesError } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (housesError) throw housesError;

      const { data: residents, error: residentsError } = await supabase
        .from("house_residents")
        .select("id, user_id, house_id, is_owner");

      if (residentsError) throw residentsError;

      const userIds = residents?.map((r) => r.user_id) || [];
      let profilesMap = new Map();

      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        profilesMap = new Map(profiles?.map((p) => [p.id, p]));
      }

      const residentsWithProfiles: HouseResident[] = (residents || []).map(
        (r) => ({
          ...r,
          is_owner: r.is_owner ?? false,
          profiles: profilesMap.get(r.user_id) || {
            id: r.user_id,
            full_name: "Unknown",
            email: "",
            phone: null,
            avatar_url: null,
          },
        })
      );

      const combined = (houses as House[]).map((house) => ({
        ...house,
        residents: residentsWithProfiles.filter((r) => r.house_id === house.id),
      }));

      // Apply Natural Sort
      return combined.sort((a, b) => {
        const blockSort = naturalSort(a.block, b.block);
        if (blockSort !== 0) return blockSort;
        return naturalSort(a.number, b.number);
      });
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: { block: string; number: string }) => {
      const { error } = await supabase.from("houses").insert({
        block: data.block,
        number: data.number,
        x_position: 0,
        y_position: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      toast({
        title: "Berhasil",
        description: "Rumah berhasil ditambahkan",
        duration: 3000,
      });
      resetForm();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message?.includes("duplicate")
          ? "Nomor rumah sudah ada"
          : "Gagal menambah rumah",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; block: string; number: string }) => {
      const { error } = await supabase
        .from("houses")
        .update({ block: data.block, number: data.number })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      toast({
        title: "Berhasil",
        description: "Rumah berhasil diperbarui",
        duration: 3000,
      });
      resetForm();
    },
    onError: () =>
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui rumah",
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("houses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      toast({ title: "Berhasil", description: "Rumah berhasil dihapus" });
      setDeletingHouse(null);
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message?.includes("foreign key")
          ? "Tidak dapat menghapus rumah yang masih memiliki penghuni"
          : "Gagal menghapus rumah",
        duration: 3000,
      });
    },
  });

  const updateResidentHouseMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      newHouseId: string;
      oldHouseId: string;
    }) => {
      const { error } = await supabase
        .from("house_residents")
        .update({ house_id: data.newHouseId })
        .eq("id", data.residentId);
      if (error) throw error;

      await supabase
        .from("houses")
        .update({ is_occupied: true })
        .eq("id", data.newHouseId);

      const { data: remaining } = await supabase
        .from("house_residents")
        .select("id")
        .eq("house_id", data.oldHouseId);
      if (!remaining || remaining.length === 0) {
        await supabase
          .from("houses")
          .update({ is_occupied: false })
          .eq("id", data.oldHouseId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      toast({
        title: "Berhasil",
        description: "Lokasi penghuni berhasil dipindahkan",
        duration: 3000,
      });
      setEditingResident(null);
    },
  });

  // Helpers
  const resetForm = () => {
    setBlock("");
    setNumber("");
    setIsCreateOpen(false);
    setEditingHouse(null);
  };

  const handleSubmit = () => {
    if (!block.trim() || !number.trim()) return;
    if (editingHouse) {
      updateMutation.mutate({ id: editingHouse.id, block, number });
    } else {
      createMutation.mutate({ block, number });
    }
  };



  // Table Columns
  const columns: DataTableColumn<HouseWithResidents>[] = [
    {
      key: "number",
      label: "Alamat",
      render: (_, row) => (
        <span className="font-medium">
          Blok {row.block} No. {row.number}
        </span>
      ),
      className: "min-w-[120px]",
    },
    {
      key: "residents",
      label: "Penghuni",
      className: "min-w-[200px]",

      render: (residents: HouseResident[], row: HouseWithResidents) => {
        if (!residents || residents.length === 0) {
          return (
            <span className="text-muted-foreground text-xs italic">Kosong</span>
          );
        }

        if (residents.length === 1) {
          const firstResident = residents[0];
          return (
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage
                  src={firstResident.profiles.avatar_url ?? undefined}
                />
                <AvatarFallback className="text-[10px]">
                  {getInitials(firstResident.profiles.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm line-clamp-1 max-w-[150px]">
                {firstResident.profiles.full_name}
              </span>
            </div>
          );
        }

        return (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedResidentsHouse(row)}
            className="h-7 gap-1 text-xs"
          >
            <Users className="w-3 h-3" /> {residents.length} Orang
          </Button>
        );
      },
    },
    {
      key: "is_occupied",
      label: "Status",
      render: (val) => (
        <Badge
          variant={val ? "default" : "secondary"}
          className={
            val
              ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10"
              : ""
          }
        >
          {val ? "Dihuni" : "Tersedia"}
        </Badge>
      ),
    },
    {
      key: "id",
      label: "Aksi",
      className: "text-right",
      render: (_, row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => {
              setEditingHouse(row);
              setBlock(row.block);
              setNumber(row.number);
              setIsCreateOpen(true);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive"
            onClick={() => setDeletingHouse(row)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  if (!canManageContent()) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Akses Ditolak
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <section className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/dashboard"
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kelola Rumah</h1>
            <p className="text-sm text-muted-foreground text-wrap">
              Manajemen kavling dan penghuni
            </p>
          </div>
        </div>

        <Dialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button className="fixed bottom-6 right-6 shadow-lg md:static rounded-full md:rounded-md h-14 w-14 md:h-10 md:w-auto">
              <Plus className="w-6 h-6 md:w-4 md:h-4 md:mr-2" />
              <span className="hidden md:inline">Tambah Rumah</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingHouse ? "Edit Rumah" : "Tambah Rumah"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Blok</Label>
                <Input
                  value={block}
                  onChange={(e) => setBlock(e.target.value.toUpperCase())}
                  placeholder="A"
                />
              </div>
              <div className="space-y-2">
                <Label>Nomor</Label>
                <Input
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="01"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={resetForm}>
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Total {houses.length} Unit
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={houses} isLoading={isLoading} />
        </CardContent>
      </Card>

      {/* View Residents Dialog */}
      <Dialog
        open={!!selectedResidentsHouse}
        onOpenChange={(open) => !open && setSelectedResidentsHouse(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Penghuni Blok {selectedResidentsHouse?.block}-
              {selectedResidentsHouse?.number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {selectedResidentsHouse?.residents.map((res) => (
              <div
                key={res.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={res.profiles.avatar_url || ""} />
                    <AvatarFallback>
                      {getInitials(res.profiles.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold">
                      {res.profiles.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {res.profiles.phone || "No Phone"}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingResident(res);
                    setNewHouseId(res.house_id);
                  }}
                >
                  Pindah
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Move Resident Dialog */}
      <Dialog
        open={!!editingResident}
        onOpenChange={(open) => !open && setEditingResident(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pindahkan Penghuni</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm">
              Pindahkan <b>{editingResident?.profiles.full_name}</b> ke:
            </p>
            <Select value={newHouseId} onValueChange={setNewHouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih rumah baru" />
              </SelectTrigger>
              <SelectContent>
                {houses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    Blok {h.block} No. {h.number} ({h.residents.length} orang)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingResident(null)}>
              Batal
            </Button>
            <Button
              onClick={() =>
                editingResident &&
                updateResidentHouseMutation.mutate({
                  residentId: editingResident.id,
                  newHouseId,
                  oldHouseId: editingResident.house_id,
                })
              }
              disabled={
                updateResidentHouseMutation.isPending ||
                newHouseId === editingResident?.house_id
              }
            >
              Konfirmasi Pindah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog
        open={!!deletingHouse}
        onOpenChange={(open) => !open && setDeletingHouse(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Rumah?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Rumah Blok{" "}
              {deletingHouse?.block} No. {deletingHouse?.number} akan dihapus
              secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingHouse && deleteMutation.mutate(deletingHouse.id)
              }
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
