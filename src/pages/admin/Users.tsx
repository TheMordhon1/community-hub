import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Search,
  UserCog,
  Shield,
  Users,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
  AppRole,
  PengurusTitle,
  Profile,
  UserRole,
} from "@/types/database";

const ROLE_LABELS_MAP: Record<AppRole, string> = {
  admin: "Super Admin",
  pengurus: "Pengurus",
  warga: "Warga",
};

const PENGURUS_TITLE_LABELS_MAP: Record<PengurusTitle, string> = {
  ketua: "Ketua RT",
  wakil_ketua: "Wakil Ketua RT",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  sie_keamanan: "Sie. Keamanan",
  sie_kebersihan: "Sie. Kebersihan",
  sie_sosial: "Sie. Sosial",
  anggota: "Anggota Pengurus",
};

interface UserWithRole extends Profile {
  user_role?: {
    role: AppRole;
    title: PengurusTitle | null;
  };
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("warga");
  const [newTitle, setNewTitle] = useState<PengurusTitle | "">("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          user_role: userRole
            ? {
                role: userRole.role as AppRole,
                title: userRole.title as PengurusTitle | null,
              }
            : undefined,
        };
      });

      return usersWithRoles;
    },
    enabled: isAdmin(),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
      title,
    }: {
      userId: string;
      role: AppRole;
      title: PengurusTitle | null;
    }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role, title })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Berhasil",
        description: "Role pengguna berhasil diperbarui",
      });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui role pengguna",
      });
    },
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.user_role?.role || "warga");
    setNewTitle(user.user_role?.title || "");
    setIsDialogOpen(true);
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({
      userId: selectedUser.id,
      role: newRole,
      title: newRole === "pengurus" ? (newTitle as PengurusTitle) : null,
    });
  };

  const getRoleBadge = (
    role: AppRole | undefined,
    title: PengurusTitle | null | undefined
  ) => {
    if (role === "admin") {
      return <Badge variant="destructive">Super Admin</Badge>;
    }
    if (role === "pengurus") {
      return (
        <Badge className="bg-accent text-accent-foreground">
          {title ? PENGURUS_TITLE_LABELS_MAP[title] : "Pengurus"}
        </Badge>
      );
    }
    return <Badge variant="secondary">Warga</Badge>;
  };

  if (!isAdmin()) {
    return null;
  }

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4"
        >
          <Button variant="ghost" size="icon" asChild>
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold">Kelola Pengguna</h1>
            <p className="text-muted-foreground">Atur role dan jabatan warga</p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter((u) => u.user_role?.role === "admin").length ||
                    0}
                </p>
                <p className="text-sm text-muted-foreground">Admin</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <UserCog className="w-5 h-5 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter((u) => u.user_role?.role === "pengurus")
                    .length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Pengurus</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users?.filter(
                    (u) => u.user_role?.role === "warga" || !u.user_role
                  ).length || 0}
                </p>
                <p className="text-sm text-muted-foreground">Warga</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="font-display">Daftar Pengguna</CardTitle>
                <CardDescription>
                  Total {users?.length || 0} pengguna terdaftar
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama atau email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Terdaftar</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {getRoleBadge(
                            user.user_role?.role,
                            user.user_role?.title
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditRole(user)}
                          >
                            <UserCog className="w-4 h-4 mr-2" />
                            Ubah Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Role Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Role Pengguna</DialogTitle>
              <DialogDescription>
                {selectedUser?.full_name} - {selectedUser?.email}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newRole}
                  onValueChange={(value) => setNewRole(value as AppRole)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="warga">Warga</SelectItem>
                    <SelectItem value="pengurus">Pengurus</SelectItem>
                    <SelectItem value="admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRole === "pengurus" && (
                <div className="space-y-2">
                  <Label>Jabatan Pengurus</Label>
                  <Select
                    value={newTitle}
                    onValueChange={(value) =>
                      setNewTitle(value as PengurusTitle)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jabatan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ketua">Ketua RT</SelectItem>
                      <SelectItem value="wakil_ketua">
                        Wakil Ketua RT
                      </SelectItem>
                      <SelectItem value="sekretaris">Sekretaris</SelectItem>
                      <SelectItem value="bendahara">Bendahara</SelectItem>
                      <SelectItem value="sie_keamanan">
                        Sie. Keamanan
                      </SelectItem>
                      <SelectItem value="sie_kebersihan">
                        Sie. Kebersihan
                      </SelectItem>
                      <SelectItem value="sie_sosial">Sie. Sosial</SelectItem>
                      <SelectItem value="anggota">Anggota Pengurus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={updateRoleMutation.isPending}
              >
                {updateRoleMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
