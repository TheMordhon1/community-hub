import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Menu } from "@/types/menu";
import { toast } from "sonner";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Reorder } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Menus() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = useState<Menu | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    url: "",
    icon: "Home",
    is_active: true,
    show_in_sidebar_main: false,
    show_in_sidebar_pengurus: false,
    show_in_sidebar_admin: false,
    show_in_quick_menu: false,
    show_in_pengurus_menu: false,
    show_in_admin_menu: false,
    color: "text-primary",
  });

  const { data: menus, isLoading } = useQuery({
    queryKey: ["menus", "admin-manage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as Menu[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Get the current max order_index
      const { data: maxData } = await supabase
        .from("menus")
        .select("order_index")
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      const newOrderIndex = (maxData?.order_index ?? -1) + 1;
      
      const { error } = await supabase.from("menus").insert({
        ...data,
        order_index: newOrderIndex
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Menu berhasil ditambahkan");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Gagal menambahkan menu: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase.from("menus").update(data).eq("id", id).select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Menu berhasil diperbarui");
      setIsDialogOpen(false);
      setEditingMenu(null);
      resetForm();
    },
    onError: (error) => {
      toast.error("Gagal memperbarui menu: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menus").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Menu berhasil dihapus");
      setDeletingMenu(null);
    },
    onError: (error) => {
      toast.error("Gagal menghapus menu: " + error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("menus")
        .update({ is_active })
        .eq("id", id)
        .select();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Status menu berhasil diperbarui");
    },
    onError: (error) => {
      toast.error("Gagal memperbarui status: " + error.message);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async (updatedMenus: Menu[]) => {
      const orders = updatedMenus.map((menu, index) => ({
        id: menu.id,
        order_index: index,
      }));

      const { error } = await supabase.rpc("update_menu_orders", {
        p_orders: orders,
      });
      if (error) throw error;
    },
    onMutate: async (updatedMenus) => {
      await queryClient.cancelQueries({ queryKey: ["menus"] });
      const previousMenus = queryClient.getQueryData(["menus", "admin-manage"]);
      queryClient.setQueryData(["menus", "admin-manage"], (old: Menu[] | undefined) => {
        if (!old) return old;
        // Create a map of updated indices
        const orderMap = new Map(updatedMenus.map((m, i) => [m.id, i]));
        return old.map(m => orderMap.has(m.id) ? { ...m, order_index: orderMap.get(m.id)! } : m)
                  .sort((a, b) => a.order_index - b.order_index);
      });
      return { previousMenus };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menus"] });
      toast.success("Urutan menu berhasil diperbarui");
    },
    onError: (error, __, context) => {
      if (context?.previousMenus) {
        queryClient.setQueryData(["menus", "admin-manage"], context.previousMenus);
      }
      toast.error("Gagal memperbarui urutan: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      title: "",
      url: "",
      icon: "Home",
      is_active: true,
      show_in_sidebar_main: false,
      show_in_sidebar_pengurus: false,
      show_in_sidebar_admin: false,
      show_in_quick_menu: false,
      show_in_pengurus_menu: false,
      show_in_admin_menu: false,
      color: "text-primary",
    });
  };

  const openEditDialog = (menu: Menu) => {
    setEditingMenu(menu);
    setFormData({
      name: menu.name,
      title: menu.title,
      url: menu.url,
      icon: menu.icon,
      is_active: menu.is_active,
      show_in_sidebar_main: menu.show_in_sidebar_main,
      show_in_sidebar_pengurus: menu.show_in_sidebar_pengurus,
      show_in_sidebar_admin: menu.show_in_sidebar_admin,
      show_in_quick_menu: menu.show_in_quick_menu,
      show_in_pengurus_menu: menu.show_in_pengurus_menu,
      show_in_admin_menu: menu.show_in_admin_menu,
      color: menu.color || "text-primary",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.title || !formData.url || !formData.icon) {
      toast.error("Semua field harus diisi");
      return;
    }

    if (editingMenu) {
      updateMutation.mutate({ id: editingMenu.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const mainMenus = menus?.filter((m) => m.show_in_sidebar_main) || [];
  const pengurusMenus = menus?.filter((m) => m.show_in_sidebar_pengurus) || [];
  const adminMenus = menus?.filter((m) => m.show_in_sidebar_admin) || [];
  
  const quickMenus = menus?.filter((m) => m.show_in_quick_menu) || [];
  const dashboardPengurusMenus = menus?.filter((m) => m.show_in_pengurus_menu) || [];
  const dashboardAdminMenus = menus?.filter((m) => m.show_in_admin_menu) || [];

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="font-display text-2xl font-bold">Kelola Menu</h1>
            <p className="text-muted-foreground">
              Atur menu navigasi dan akses menu
            </p>
          </div>
          <Button
            onClick={() => {
              resetForm();
              setEditingMenu(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Menu
          </Button>
        </div>

        {/* Main Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Utama (Sidebar)</CardTitle>
            <CardDescription>Menu yang tampil di sidebar untuk semua user</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={mainMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* Pengurus Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Pengurus (Sidebar)</CardTitle>
            <CardDescription>Menu khusus pengurus di sidebar</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={pengurusMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* Admin Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Admin (Sidebar)</CardTitle>
            <CardDescription>Menu khusus admin di sidebar</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={adminMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* Dashboard Quick Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Cepat (Dashboard)</CardTitle>
            <CardDescription>Menu yang tampil di dashboard untuk akses cepat</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={quickMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* Dashboard Pengurus Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Pengurus (Dashboard)</CardTitle>
            <CardDescription>Menu khusus pengurus di dashboard</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={dashboardPengurusMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* Dashboard Admin Menu Section */}
        <Card>
          <CardHeader>
            <CardTitle>Menu Admin (Dashboard)</CardTitle>
            <CardDescription>Menu khusus admin di dashboard</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <MenuTable
              menus={dashboardAdminMenus}
              onEdit={openEditDialog}
              onDelete={setDeletingMenu}
              onToggleActive={(menu) =>
                toggleActiveMutation.mutate({
                  id: menu.id,
                  is_active: !menu.is_active,
                })
              }
              onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
            />
          </CardContent>
        </Card>

        {/* All Menus */}
        <Card>
          <CardHeader>
            <CardTitle>Semua Menu</CardTitle>
            <CardDescription>Daftar lengkap semua menu. Anda bisa drag & drop di sini untuk mengatur urutan global.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <MenuTable
                menus={menus || []}
                onEdit={openEditDialog}
                onDelete={setDeletingMenu}
                onToggleActive={(menu) =>
                  toggleActiveMutation.mutate({
                    id: menu.id,
                    is_active: !menu.is_active,
                  })
                }
                onReorder={(newOrder) => updateOrderMutation.mutate(newOrder)}
                showVisibility={true}
              />
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMenu ? "Edit Menu" : "Tambah Menu Baru"}
              </DialogTitle>
              <DialogDescription>
                Atur properti dan visibilitas menu
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama (ID)</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Judul</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Dashboard"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) =>
                      setFormData({ ...formData, url: e.target.value })
                    }
                    placeholder="/dashboard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Lucide)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="icon"
                      value={formData.icon}
                      onChange={(e) =>
                        setFormData({ ...formData, icon: e.target.value })
                      }
                      placeholder="Home"
                    />
                    <div className="w-10 h-10 flex items-center justify-center border rounded-md">
                      <DynamicIcon name={formData.icon} className="w-5 h-5" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="color">Warna (Tailwind class)</Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) =>
                      setFormData({ ...formData, color: e.target.value })
                    }
                    placeholder="text-primary"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active">Menu Aktif</Label>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Tampil di Sidebar</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_sidebar_main"
                      checked={formData.show_in_sidebar_main}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_sidebar_main: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_sidebar_main">Menu Utama</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_sidebar_pengurus"
                      checked={formData.show_in_sidebar_pengurus}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_sidebar_pengurus: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_sidebar_pengurus">Menu Pengurus</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_sidebar_admin"
                      checked={formData.show_in_sidebar_admin}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_sidebar_admin: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_sidebar_admin">Menu Admin</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">Tampil di Dashboard</Label>
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_quick_menu"
                      checked={formData.show_in_quick_menu}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_quick_menu: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_quick_menu">Menu Cepat</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_pengurus_menu"
                      checked={formData.show_in_pengurus_menu}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_pengurus_menu: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_pengurus_menu">Menu Pengurus</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="show_in_admin_menu"
                      checked={formData.show_in_admin_menu}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          show_in_admin_menu: checked as boolean,
                        })
                      }
                    />
                    <Label htmlFor="show_in_admin_menu">Menu Admin</Label>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {editingMenu ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deletingMenu}
          onOpenChange={() => setDeletingMenu(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Menu?</AlertDialogTitle>
              <AlertDialogDescription>
                Menu "{deletingMenu?.title}" akan dihapus secara permanen.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deletingMenu && deleteMutation.mutate(deletingMenu.id)}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function MenuTable({
  menus,
  onEdit,
  onDelete,
  onToggleActive,
  onReorder,
  showVisibility = false,
}: {
  menus: Menu[];
  onEdit: (menu: Menu) => void;
  onDelete: (menu: Menu) => void;
  onToggleActive: (menu: Menu) => void;
  onReorder: (newOrder: Menu[]) => void;
  showVisibility?: boolean;
}) {
  if (menus.length === 0) {
    return <p className="text-muted-foreground text-sm">Tidak ada menu</p>;
  }

  return (
    <div className="min-w-[500px]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Icon</TableHead>
            <TableHead>Judul</TableHead>
            <TableHead className="hidden lg:table-cell">URL</TableHead>
            <TableHead>Aktif</TableHead>
            {showVisibility && (
              <>
                <TableHead>Sidebar</TableHead>
                <TableHead>Dashboard</TableHead>
              </>
            )}
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <Reorder.Group axis="y" values={menus} onReorder={onReorder} as="tbody" className="divide-y">
          {menus.map((menu) => (
            <Reorder.Item 
              key={menu.id} 
              value={menu} 
              as="tr" 
              className={cn(
                "group hover:bg-muted/50 transition-colors bg-background",
                !menu.is_active && "opacity-50"
              )}
            >
              <TableCell className="w-12">
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab group-active:cursor-grabbing" />
              </TableCell>
              <TableCell>
                <DynamicIcon name={menu.icon} className={`w-5 h-5 ${menu.color}`} />
              </TableCell>
              <TableCell className="font-medium">{menu.title}</TableCell>
              <TableCell className="font-mono text-[10px] hidden lg:table-cell">{menu.url}</TableCell>
              <TableCell>
                <Switch
                  checked={menu.is_active}
                  onCheckedChange={() => onToggleActive(menu)}
                />
              </TableCell>
              {showVisibility && (
                <>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {menu.show_in_sidebar_main && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-primary/10 text-primary border-none">Main</Badge>}
                      {menu.show_in_sidebar_pengurus && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-accent/10 text-accent border-none">Pgrs</Badge>}
                      {menu.show_in_sidebar_admin && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-destructive/10 text-destructive border-none">Admin</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 text-[9px]">
                      {menu.show_in_quick_menu && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-success/10 text-success border-none">Cepat</Badge>}
                      {menu.show_in_pengurus_menu && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-amber-500/10 text-amber-600 border-none">Pgrs</Badge>}
                      {menu.show_in_admin_menu && <Badge variant="secondary" className="px-1 py-0 h-4 uppercase font-bold text-[8px] bg-purple-500/10 text-purple-600 border-none">Admin</Badge>}
                    </div>
                  </TableCell>
                </>
              )}
              <TableCell>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(menu)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(menu)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </Table>
    </div>
  );
}
