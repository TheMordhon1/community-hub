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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Trash2, Home, Pencil } from "lucide-react";
import type { House } from "@/types/database";

export default function AdminHouses() {
  const { canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<House | null>(null);
  const [block, setBlock] = useState("");
  const [number, setNumber] = useState("");

  const { data: houses, isLoading } = useQuery({
    queryKey: ["houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (error) throw error;
      return data as House[];
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["houses"] });
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
      queryClient.invalidateQueries({ queryKey: ["houses"] });
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
      queryClient.invalidateQueries({ queryKey: ["houses"] });
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
          <div>
            <h1 className="font-display text-2xl font-bold">Kelola Rumah</h1>
            <p className="text-muted-foreground">
              Daftar nomor rumah di perumahan
            </p>
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
              Daftar Rumah ({houses?.length ?? 0})
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
            ) : houses?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Belum ada data rumah. Klik "Tambah Rumah" untuk menambahkan.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blok</TableHead>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {houses?.map((house) => (
                    <TableRow key={house.id}>
                      <TableCell className="font-medium">
                        {house.block}
                      </TableCell>
                      <TableCell>{house.number}</TableCell>
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
    </section>
  );
}
