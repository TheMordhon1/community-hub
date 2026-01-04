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
    order_index: 0,
    color: "text-primary",
  });

  const { data: menus, isLoading } = useQuery({
    queryKey: ["menus", "admin"],
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
      const { error } = await supabase.from("menus").insert(data);
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
      const { error } = await supabase.from("menus").update(data).eq("id", id);
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
        .eq("id", id);
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
      order_index: 0,
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
      order_index: menu.order_index,
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
            />
          </CardContent>
        </Card>

        {/* All Menus */}
        <Card>
          <CardHeader>
            <CardTitle>Semua Menu</CardTitle>
            <CardDescription>Daftar lengkap semua menu</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p>Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Icon</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Judul</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Aktif</TableHead>
                    <TableHead>Sidebar</TableHead>
                    <TableHead>Dashboard</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {menus?.map((menu) => (
                    <TableRow key={menu.id}>
                      <TableCell>
                        <DynamicIcon name={menu.icon} className={`w-5 h-5 ${menu.color}`} />
                      </TableCell>
                      <TableCell className="font-medium">{menu.name}</TableCell>
                      <TableCell>{menu.title}</TableCell>
                      <TableCell className="font-mono text-xs">{menu.url}</TableCell>
                      <TableCell>
                        <Switch
                          checked={menu.is_active}
                          onCheckedChange={() =>
                            toggleActiveMutation.mutate({
                              id: menu.id,
                              is_active: !menu.is_active,
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs">
                          {menu.show_in_sidebar_main && (
                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded">Main</span>
                          )}
                          {menu.show_in_sidebar_pengurus && (
                            <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded">Pengurus</span>
                          )}
                          {menu.show_in_sidebar_admin && (
                            <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">Admin</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 text-xs">
                          {menu.show_in_quick_menu && (
                            <span className="px-1.5 py-0.5 bg-success/10 text-success rounded">Cepat</span>
                          )}
                          {menu.show_in_pengurus_menu && (
                            <span className="px-1.5 py-0.5 bg-accent/10 text-accent rounded">Pengurus</span>
                          )}
                          {menu.show_in_admin_menu && (
                            <span className="px-1.5 py-0.5 bg-destructive/10 text-destructive rounded">Admin</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(menu)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingMenu(menu)}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="order_index">Urutan</Label>
                  <Input
                    id="order_index"
                    type="number"
                    value={formData.order_index}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        order_index: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
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
}: {
  menus: Menu[];
  onEdit: (menu: Menu) => void;
  onDelete: (menu: Menu) => void;
  onToggleActive: (menu: Menu) => void;
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
            <TableHead className="hidden sm:table-cell">URL</TableHead>
            <TableHead>Aktif</TableHead>
            <TableHead>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {menus.map((menu) => (
            <TableRow key={menu.id} className={!menu.is_active ? "opacity-50" : ""}>
              <TableCell>
                <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              </TableCell>
              <TableCell>
                <DynamicIcon name={menu.icon} className={`w-5 h-5 ${menu.color}`} />
              </TableCell>
              <TableCell className="font-medium">{menu.title}</TableCell>
              <TableCell className="font-mono text-xs hidden sm:table-cell">{menu.url}</TableCell>
              <TableCell>
                <Switch
                  checked={menu.is_active}
                  onCheckedChange={() => onToggleActive(menu)}
                />
              </TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
