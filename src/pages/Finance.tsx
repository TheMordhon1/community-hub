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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Download,
  FileText,
  FileSpreadsheet,
  CreditCard,
  ArrowLeft,
} from "lucide-react";
import type { FinanceRecordWithDetails } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";

const CATEGORIES = {
  income: ["iuran", "donasi", "lainnya"],
  outcome: [
    "keamanan",
    "kebersihan",
    "perbaikan",
    "acara",
    "operasional",
    "lainnya",
  ],
};

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export default function Finance() {
  const { user, isAdmin, pengurusTitle } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(
    new Date().getFullYear().toString()
  );
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

      const userIds = new Set<string>();
      data?.forEach((r) => {
        if (r.recorded_by) userIds.add(r.recorded_by);
      });

      const profiles: Record<string, any> = {};
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

  // Filter records based on tab and date
  const filteredRecords = records?.filter((r) => {
    const typeMatch = activeTab === "all" || r.type === activeTab;
    const date = new Date(r.transaction_date);
    const monthMatch =
      filterMonth === "all" || (date.getMonth() + 1).toString() === filterMonth;
    const yearMatch = date.getFullYear().toString() === filterYear;
    return typeMatch && monthMatch && yearMatch;
  });

  // Calculate totals for filtered records
  const totalIncome =
    filteredRecords
      ?.filter((r) => r.type === "income")
      .reduce((sum, r) => sum + r.amount, 0) || 0;
  const totalOutcome =
    filteredRecords
      ?.filter((r) => r.type === "outcome")
      .reduce((sum, r) => sum + r.amount, 0) || 0;
  const balance = totalIncome - totalOutcome;

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const periodText =
      filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}`;

    doc.setFontSize(18);
    doc.text("Laporan Keuangan paguyuban", 14, 22);
    doc.setFontSize(12);
    doc.text(`Periode: ${periodText}`, 14, 32);
    doc.text(
      `Tanggal Cetak: ${format(new Date(), "dd MMMM yyyy", {
        locale: localeId,
      })}`,
      14,
      40
    );

    // Summary
    doc.setFontSize(11);
    doc.text(
      `Total Pemasukan: Rp ${totalIncome.toLocaleString("id-ID")}`,
      14,
      52
    );
    doc.text(
      `Total Pengeluaran: Rp ${totalOutcome.toLocaleString("id-ID")}`,
      14,
      60
    );
    doc.text(`Saldo: Rp ${balance.toLocaleString("id-ID")}`, 14, 68);

    // Table
    const tableData =
      filteredRecords?.map((r) => [
        format(new Date(r.transaction_date), "dd/MM/yyyy"),
        r.type === "income" ? "Masuk" : "Keluar",
        r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
        r.description,
        `Rp ${r.amount.toLocaleString("id-ID")}`,
      ]) || [];

    autoTable(doc, {
      startY: 78,
      head: [["Tanggal", "Jenis", "Kategori", "Deskripsi", "Jumlah"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(
      `laporan-keuangan-${filterYear}-${
        filterMonth === "all" ? "tahunan" : filterMonth
      }.pdf`
    );
    toast.success("Laporan PDF berhasil diunduh");
  };

  // Export to Excel
  const exportToExcel = () => {
    const periodText =
      filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}`;

    const data =
      filteredRecords?.map((r) => ({
        Tanggal: format(new Date(r.transaction_date), "dd/MM/yyyy"),
        Jenis: r.type === "income" ? "Pemasukan" : "Pengeluaran",
        Kategori: r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
        Deskripsi: r.description,
        Jumlah: r.amount,
      })) || [];

    // Add summary rows
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "",
      Jumlah: 0,
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Total Pemasukan",
      Jumlah: totalIncome,
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Total Pengeluaran",
      Jumlah: totalOutcome,
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Saldo",
      Jumlah: balance,
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan");
    XLSX.writeFile(
      wb,
      `laporan-keuangan-${filterYear}-${
        filterMonth === "all" ? "tahunan" : filterMonth
      }.xlsx`
    );
    toast.success("Laporan Excel berhasil diunduh");
  };

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold">
                Laporan Keuangan
              </h1>
              <p className="text-sm text-muted-foreground">
                Catatan pemasukan dan pengeluaran paguyuban
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canManageFinance && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={exportToPDF}>
                    <FileText className="w-4 h-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToExcel}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Download Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {canManageFinance && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Tambah Catatan</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
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
                          setFormData({
                            ...formData,
                            transaction_date: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Deskripsi</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Keterangan transaksi"
                      />
                    </div>

                    <Button
                      onClick={() => addRecord.mutate()}
                      disabled={
                        !formData.amount ||
                        !formData.description ||
                        !formData.category
                      }
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
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Bulan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pemasukan
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                Rp {totalIncome.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pengeluaran
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                Rp {totalOutcome.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Card
            className={
              balance >= 0
                ? "border-primary/20 bg-primary/5"
                : "border-orange-500/20 bg-orange-500/5"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
              <Wallet
                className={`h-4 w-4 ${
                  balance >= 0 ? "text-primary" : "text-orange-600"
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-lg sm:text-2xl font-bold ${
                  balance >= 0 ? "text-primary" : "text-orange-600"
                }`}
              >
                Rp {balance.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Records Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base sm:text-lg">
                Riwayat Transaksi
              </CardTitle>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="all" className="text-xs px-2 sm:px-3">
                    Semua
                  </TabsTrigger>
                  <TabsTrigger value="income" className="text-xs px-2 sm:px-3">
                    Masuk
                  </TabsTrigger>
                  <TabsTrigger value="outcome" className="text-xs px-2 sm:px-3">
                    Keluar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredRecords && filteredRecords.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Tanggal</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">
                        Jenis
                      </TableHead>
                      <TableHead className="text-xs">Kategori</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">
                        Deskripsi
                      </TableHead>
                      <TableHead className="text-xs text-right">
                        Jumlah
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="text-xs sm:text-sm py-2">
                          {format(new Date(record.transaction_date), "dd MMM", {
                            locale: localeId,
                          })}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1">
                            {record.type === "income" ? (
                              <ArrowUpCircle className="w-3 h-3 text-green-600" />
                            ) : (
                              <ArrowDownCircle className="w-3 h-3 text-red-600" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge variant="outline" className="text-xs">
                            {record.category?.charAt(0).toUpperCase() +
                              record.category?.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-xs hidden md:table-cell">
                          {record.description}
                        </TableCell>
                        <TableCell
                          className={`text-right text-xs sm:text-sm font-medium py-2 ${
                            record.type === "income"
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {record.type === "income" ? "+" : "-"} Rp{" "}
                          {record.amount.toLocaleString("id-ID")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent className="flex flex-col items-center justify-center text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  Belum Ada Catatan
                </h3>
                <p className="text-muted-foreground">
                  Belum ada catatan keuangan yang masuk
                </p>
              </CardContent>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
