import { useState, useEffect, ReactNode } from "react";
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
import type { AppRole, Profile, PengurusTitleRecord } from "@/types/database";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";

interface UserWithRole extends Profile {
  user_role?: {
    role: AppRole;
    title_id: string | null;
    pengurus_title?: PengurusTitleRecord;
  };
  actions?: ReactNode;
}

export default function AdminUsers() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("warga");
  const [newTitleId, setNewTitleId] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");

  useEffect(() => {
    if (!isAdmin()) {
      navigate("/dashboard");
    }
  }, [isAdmin, navigate]);

  // Fetch dynamic pengurus titles
  const { data: pengurusTitles } = useQuery({
    queryKey: ["pengurus-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pengurus_titles")
        .select("*")
        .order("order_index", { ascending: true });

      if (error) throw error;
      return data as PengurusTitleRecord[];
    },
    enabled: isAdmin(),
  });

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch all roles with title_id
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("*");

      if (rolesError) throw rolesError;

      // Fetch all pengurus titles
      const { data: titles, error: titlesError } = await supabase
        .from("pengurus_titles")
        .select("*");

      if (titlesError) throw titlesError;

      // Create a map for quick title lookup
      const titleMap = new Map(titles.map((t) => [t.id, t]));

      // Combine profiles with their roles and titles
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          user_role: userRole
            ? {
                role: userRole.role as AppRole,
                title_id: userRole.title_id,
                pengurus_title: userRole.title_id
                  ? (titleMap.get(userRole.title_id) as PengurusTitleRecord)
                  : undefined,
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
      titleId,
    }: {
      userId: string;
      role: AppRole;
      titleId: string | null;
    }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role, title_id: titleId })
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

  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.full_name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());

    const matchesRole =
      roleFilter === "all" || user.user_role?.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const handleEditRole = (user: UserWithRole) => {
    setSelectedUser(user);
    setNewRole(user.user_role?.role || "warga");
    setNewTitleId(user.user_role?.title_id || "");
    setIsDialogOpen(true);
  };

  const handleSaveRole = () => {
    if (!selectedUser) return;
    updateRoleMutation.mutate({
      userId: selectedUser.id,
      role: newRole,
      titleId: newRole === "pengurus" && newTitleId ? newTitleId : null,
    });
  };

  const getRoleBadge = (
    role: AppRole | undefined,
    pengurusTitle?: PengurusTitleRecord
  ) => {
    if (role === "admin") {
      return <Badge variant="destructive">Super Admin</Badge>;
    }
    if (role === "pengurus") {
      return (
        <Badge className="bg-accent text-accent-foreground">
          {pengurusTitle?.display_name || "Pengurus"}
        </Badge>
      );
    }
    return <Badge variant="secondary">Warga</Badge>;
  };

  const columns: DataTableColumn<UserWithRole>[] = [
    {
      key: "full_name",
      label: "Nama",
      className: "min-w-[160px] whitespace-nowrap",
    },
    { key: "email", label: "Email" },
    {
      key: "user_role",
      label: "Role",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value, row: UserWithRole) =>
        getRoleBadge(row.user_role?.role, row.user_role?.pengurus_title),
    },
    {
      key: "created_at",
      label: "Terdaftar",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value: string) =>
        new Date(value).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
    },
    {
      key: "actions",
      label: "Aksi",
      render: (_, row: UserWithRole) => (
        <Button variant="outline" size="sm" onClick={() => handleEditRole(row)}>
          <UserCog className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Ubah Role</span>
        </Button>
      ),
    },
  ];

  if (!isAdmin()) {
    return null;
  }

  return (
    <section className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-row items-center gap-4"
        >
          <Link to="/dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div>
            <h1 className="font-display text-xl md:text-2xl font-bold">
              Kelola Pengguna
            </h1>
            <p className="text-sm text-muted-foreground">
              Atur role dan jabatan warga
            </p>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-display">Daftar Pengguna</CardTitle>
                <CardDescription>
                  Total {users?.length || 0} pengguna terdaftar
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Select
                  value={roleFilter}
                  onValueChange={(value) =>
                    setRoleFilter(value as AppRole | "all")
                  }
                >
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Role</SelectItem>
                    <SelectItem value="admin">Super Admin</SelectItem>
                    <SelectItem value="pengurus">Pengurus</SelectItem>
                    <SelectItem value="warga">Warga</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama atau email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <DataTable
            columns={columns}
            data={filteredUsers || []}
            isLoading={isLoading}
            pageSize={10}
          />
        </Card>

        {/* Edit Role Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
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
                  <Select value={newTitleId} onValueChange={setNewTitleId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jabatan" />
                    </SelectTrigger>
                    <SelectContent>
                      {pengurusTitles?.map((title) => (
                        <SelectItem key={title.id} value={title.id}>
                          {title.display_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="w-full sm:w-auto"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveRole}
                disabled={updateRoleMutation.isPending}
                className="w-full sm:w-auto"
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
