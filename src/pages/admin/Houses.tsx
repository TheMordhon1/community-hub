import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  X,
  ArrowLeft,
} from "lucide-react";
import type { House } from "@/types/database";
import { Link } from "react-router-dom";

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

export default function AdminHouses() {
  const { canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: housesData, isLoading } = useQuery({
    queryKey: ["houses-with-residents"],
    queryFn: async () => {
      // Fetch houses
      const { data: houses, error: housesError } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (housesError) throw housesError;

      // Fetch all house residents with profiles
      const { data: residents, error: residentsError } = await supabase.from(
        "house_residents"
      ).select(`
          id,
          user_id,
          house_id,
          is_owner,
          profiles:user_id (
            id,
            full_name,
            email,
            phone,
            avatar_url
          )
        `);

      if (residentsError) throw residentsError;

      // Map residents to houses
      const housesWithResidents: HouseWithResidents[] = (houses as House[]).map(
        (house) => ({
          ...house,
          residents: (residents as unknown as HouseResident[]).filter(
            (r) => r.house_id === house.id
          ),
        })
      );

      return housesWithResidents;
    },
  });

  const houses = housesData ?? [];

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
      toast({ title: "Berhasil", description: "Rumah berhasil ditambahkan" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message.includes("duplicate")
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
      toast({ title: "Berhasil", description: "Rumah berhasil diperbarui" });
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui rumah",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("houses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      toast({ title: "Berhasil", description: "Rumah berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus rumah",
      });
    },
  });

  const updateResidentHouseMutation = useMutation({
    mutationFn: async (data: {
      residentId: string;
      newHouseId: string;
      oldHouseId: string;
    }) => {
      // Update the house_residents record
      const { error } = await supabase
        .from("house_residents")
        .update({ house_id: data.newHouseId })
        .eq("id", data.residentId);
      if (error) throw error;

      // Mark new house as occupied
      await supabase
        .from("houses")
        .update({ is_occupied: true })
        .eq("id", data.newHouseId);

      // Check if old house still has residents
      const { data: remainingResidents } = await supabase
        .from("house_residents")
        .select("id")
        .eq("house_id", data.oldHouseId);

      // If no residents left, mark old house as unoccupied
      if (!remainingResidents || remainingResidents.length === 0) {
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
        description: "Rumah penghuni berhasil diperbarui",
      });
      setEditingResident(null);
      setNewHouseId("");
      setSelectedResidentsHouse(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui rumah penghuni",
      });
    },
  });

  const resetForm = () => {
    setBlock("");
    setNumber("");
    setIsCreateOpen(false);
    setEditingHouse(null);
  };

  const handleSubmit = () => {
    if (!block.trim() || !number.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Blok dan nomor rumah wajib diisi",
      });
      return;
    }

    if (editingHouse) {
      updateMutation.mutate({ id: editingHouse.id, block, number });
    } else {
      createMutation.mutate({ block, number });
    }
  };

  const openEdit = (house: House) => {
    setEditingHouse(house);
    setBlock(house.block);
    setNumber(house.number);
    setIsCreateOpen(true);
  };

  const handleUpdateResidentHouse = () => {
    if (!editingResident || !newHouseId) return;
    updateResidentHouseMutation.mutate({
      residentId: editingResident.id,
      newHouseId,
      oldHouseId: editingResident.house_id,
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!canManageContent()) {
    return (
      <div className="p-6">
        <Card className="py-12">
          <CardContent className="text-center text-muted-foreground">
            Anda tidak memiliki akses ke halaman ini
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <section className="p-6">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">Kelola Rumah</h1>
              <p className="text-muted-foreground">
                Daftar nomor rumah di perumahan
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Rumah
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingHouse ? "Edit Rumah" : "Tambah Rumah Baru"}
                </DialogTitle>
                <DialogDescription>
                  {editingHouse
                    ? "Perbarui informasi rumah"
                    : "Tambahkan nomor rumah baru ke daftar"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="block">Blok</Label>
                  <Input
                    id="block"
                    placeholder="Contoh: A, B, C"
                    value={block}
                    onChange={(e) => setBlock(e.target.value.toUpperCase())}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="number">Nomor Rumah</Label>
                  <Input
                    id="number"
                    placeholder="Contoh: 1, 2, 3"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingHouse ? "Simpan" : "Tambah"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Daftar Rumah ({houses.length})
            </CardTitle>
            <CardDescription>
              Kelola daftar rumah untuk registrasi warga
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : houses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada data rumah. Klik "Tambah Rumah" untuk menambahkan.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blok</TableHead>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Penghuni</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {houses.map((house) => (
                    <TableRow key={house.id}>
                      <TableCell className="font-medium">
                        {house.block}
                      </TableCell>
                      <TableCell>{house.number}</TableCell>
                      <TableCell>
                        {house.residents.length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : house.residents.length === 1 ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-6 h-6">
                              <AvatarImage
                                src={
                                  house.residents[0].profiles?.avatar_url ||
                                  undefined
                                }
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(
                                  house.residents[0].profiles?.full_name || "?"
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {house.residents[0].profiles?.full_name}
                            </span>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedResidentsHouse(house)}
                            className="gap-1"
                          >
                            <Users className="w-4 h-4" />
                            {house.residents.length} penghuni
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {house.is_occupied ? (
                          <Badge className="bg-success/10 text-success">
                            Dihuni
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Kosong</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(house)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(house.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Residents Popup Dialog */}
      <Dialog
        open={!!selectedResidentsHouse}
        onOpenChange={(open) => !open && setSelectedResidentsHouse(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5" />
              Penghuni Blok {selectedResidentsHouse?.block} No.{" "}
              {selectedResidentsHouse?.number}
            </DialogTitle>
            <DialogDescription>
              Daftar semua penghuni di rumah ini
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            {selectedResidentsHouse?.residents.map((resident) => (
              <div
                key={resident.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarImage
                      src={resident.profiles?.avatar_url || undefined}
                    />
                    <AvatarFallback>
                      {getInitials(resident.profiles?.full_name || "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {resident.profiles?.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {resident.profiles?.email}
                    </p>
                    {resident.profiles?.phone && (
                      <p className="text-sm text-muted-foreground">
                        {resident.profiles?.phone}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingResident(resident);
                    setNewHouseId(resident.house_id);
                  }}
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Ubah Rumah
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Resident House Dialog */}
      <Dialog
        open={!!editingResident}
        onOpenChange={(open) => !open && setEditingResident(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Rumah Penghuni</DialogTitle>
            <DialogDescription>
              Pindahkan {editingResident?.profiles?.full_name} ke rumah lain
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pilih Rumah Baru</Label>
              <Select value={newHouseId} onValueChange={setNewHouseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih rumah" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((house) => (
                    <SelectItem key={house.id} value={house.id}>
                      Blok {house.block} No. {house.number}
                      {house.residents.length > 0 &&
                        ` (${house.residents.length} penghuni)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingResident(null)}>
              Batal
            </Button>
            <Button
              onClick={handleUpdateResidentHouse}
              disabled={
                updateResidentHouseMutation.isPending ||
                !newHouseId ||
                newHouseId === editingResident?.house_id
              }
            >
              {updateResidentHouseMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
