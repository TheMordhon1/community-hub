import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  Wallet,
  Loader2,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import type { FinanceRecordWithDetails } from "@/types/database";

const CATEGORIES = {
  income: ["iuran", "donasi", "lainnya"],
  outcome: ["keamanan", "kebersihan", "perbaikan", "acara", "operasional", "lainnya"],
};

export default function Finance() {
  const { user, isAdmin, pengurusTitle } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [formData, setFormData] = useState({
    type: "income" as "income" | "outcome",
    amount: "",
    description: "",
    category: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const isBendahara = pengurusTitle === "bendahara";
  const canManageFinance = isAdmin() || isBendahara;

  // Fetch finance records
  const { data: records, isLoading } = useQuery({
    queryKey: ["finance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (error) throw error;

      // Fetch profiles for recorders
      const userIds = new Set<string>();
      data?.forEach((r) => {
        if (r.recorded_by) userIds.add(r.recorded_by);
      });

      let profiles: Record<string, any> = {};
      if (userIds.size > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", Array.from(userIds));
        profileData?.forEach((p) => {
          profiles[p.id] = p;
        });
      }

      return data?.map((r) => ({
        ...r,
        recorder: r.recorded_by ? profiles[r.recorded_by] : null,
      })) as FinanceRecordWithDetails[];
    },
  });

  // Add record mutation
  const addRecord = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("finance_records").insert({
        type: formData.type,
        amount: parseFloat(formData.amount),
        description: formData.description,
        category: formData.category,
        recorded_by: user?.id,
        transaction_date: formData.transaction_date,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catatan keuangan berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["finance-records"] });
      setIsAddOpen(false);
      setFormData({
        type: "income",
        amount: "",
        description: "",
        category: "",
        transaction_date: new Date().toISOString().split("T")[0],
      });
    },
    onError: () => {
      toast.error("Gagal menambahkan catatan keuangan");
    },
  });

  // Calculate totals
  const totalIncome = records?.filter((r) => r.type === "income").reduce((sum, r) => sum + r.amount, 0) || 0;
  const totalOutcome = records?.filter((r) => r.type === "outcome").reduce((sum, r) => sum + r.amount, 0) || 0;
  const balance = totalIncome - totalOutcome;

  // Filter records based on tab
  const filteredRecords = records?.filter((r) => {
    if (activeTab === "all") return true;
    return r.type === activeTab;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Laporan Keuangan</h1>
          <p className="text-muted-foreground">
            Catatan pemasukan dan pengeluaran RT
          </p>
        </div>

        {canManageFinance && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Tambah Catatan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Catatan Keuangan</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Jenis</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(v: "income" | "outcome") =>
                      setFormData({ ...formData, type: v, category: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="outcome">Pengeluaran</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) =>
                      setFormData({ ...formData, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES[formData.type].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Jumlah (Rp)</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="Contoh: 500000"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tanggal Transaksi</Label>
                  <Input
                    type="date"
                    value={formData.transaction_date}
                    onChange={(e) =>
                      setFormData({ ...formData, transaction_date: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Deskripsi</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Keterangan transaksi"
                  />
                </div>

                <Button
                  onClick={() => addRecord.mutate()}
                  disabled={!formData.amount || !formData.description || !formData.category}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tambah Catatan
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/20 bg-green-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              Rp {totalIncome.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              Rp {totalOutcome.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>

        <Card className={balance >= 0 ? "border-primary/20 bg-primary/5" : "border-orange-500/20 bg-orange-500/5"}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo</CardTitle>
            <Wallet className={`h-4 w-4 ${balance >= 0 ? "text-primary" : "text-orange-600"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-primary" : "text-orange-600"}`}>
              Rp {balance.toLocaleString("id-ID")}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Riwayat Transaksi</CardTitle>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">Semua</TabsTrigger>
                <TabsTrigger value="income">Pemasukan</TabsTrigger>
                <TabsTrigger value="outcome">Pengeluaran</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredRecords && filteredRecords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead className="text-right">Jumlah</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      {format(new Date(record.transaction_date), "dd MMM yyyy", {
                        locale: localeId,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {record.type === "income" ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <ArrowDownCircle className="w-4 h-4 text-red-600" />
                        )}
                        <span className={record.type === "income" ? "text-green-600" : "text-red-600"}>
                          {record.type === "income" ? "Masuk" : "Keluar"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {record.category?.charAt(0).toUpperCase() + record.category?.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {record.description}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${record.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {record.type === "income" ? "+" : "-"} Rp {record.amount.toLocaleString("id-ID")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada catatan keuangan
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}