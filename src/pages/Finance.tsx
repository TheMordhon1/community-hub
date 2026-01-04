import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { FinanceRecordWithDetails } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useAddFinanceRecord } from "@/hooks/finance/useAddFinanceRecord"; // Import the useAddFinanceRecord hook

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
  const { isAdmin, hasFinanceAccess } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [isIuranExpanded, setIsIuranExpanded] = useState(false);
  const [formData, setFormData] = useState({
    type: "income" as "income" | "outcome",
    amount: "",
    description: "",
    category: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const canManageFinance = isAdmin() || hasFinanceAccess;

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

  // Mutation for adding finance records
  const addRecord = useAddFinanceRecord();

  const totalBalance =
    records?.reduce((sum, r) => {
      return r.type === "income" ? sum + r.amount : sum - r.amount;
    }, 0) || 0;

  // Filter records based on tab and date for display only
  const filteredRecords = records?.filter((r) => {
    const typeMatch = activeTab === "all" || r.type === activeTab;
    const date = new Date(r.transaction_date);
    const monthMatch =
      filterMonth === "all" || (date.getMonth() + 1).toString() === filterMonth;
    const yearMatch = date.getFullYear().toString() === filterYear;
    return typeMatch && monthMatch && yearMatch;
  });

  const filteredIncome =
    filteredRecords
      ?.filter((r) => r.type === "income")
      .reduce((sum, r) => sum + r.amount, 0) || 0;
  const filteredOutcome =
    filteredRecords
      ?.filter((r) => r.type === "outcome")
      .reduce((sum, r) => sum + r.amount, 0) || 0;
  // Filter records based on tab and date for display only

  const groupedRecords = (() => {
    if (!filteredRecords) return [];

    const iuranRecords = filteredRecords.filter(
      (r) => r.category?.toLowerCase() === "iuran"
    );
    const otherRecords = filteredRecords.filter(
      (r) => r.category?.toLowerCase() !== "iuran"
    );

    if (iuranRecords.length === 0) return filteredRecords;

    // Create summary row for iuran
    const iuranTotal = iuranRecords.reduce((sum, r) => sum + r.amount, 0);
    const iuranSummary = {
      id: "iuran-summary",
      type: "income" as const,
      category: "iuran",
      description: `Total Iuran (${iuranRecords.length} transaksi)`,
      amount: iuranTotal,
      transaction_date: iuranRecords[0].transaction_date,
      recorded_by: null,
      recorder: null,
      created_at: iuranRecords[0].created_at,
      isGroup: true,
      groupRecords: iuranRecords,
    };

    return [iuranSummary, ...otherRecords];
  })();

  // Export to PDF
  const exportToPDF = () => {
    const periodText =
      filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS[Number.parseInt(filterMonth) - 1]} ${filterYear}`;

    const doc = new jsPDF();
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
      `Total Pemasukan: Rp ${filteredIncome.toLocaleString("id-ID")}`,
      14,
      52
    );
    doc.text(
      `Total Pengeluaran: Rp ${filteredOutcome.toLocaleString("id-ID")}`,
      14,
      60
    );
    doc.text(`Saldo: Rp ${totalBalance.toLocaleString("id-ID")}`, 14, 68);

    // Table
    const tableData =
      filteredRecords?.map((r) => {
        return [
          format(new Date(r.transaction_date), "dd/MM/yyyy"),
          r.type === "income" ? "Masuk" : "Keluar",
          r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
          r.description,
          `Rp ${r.amount.toLocaleString("id-ID")}`,
          r.recorder?.full_name || "Sistem",
        ];
      }) || [];

    autoTable(doc, {
      startY: 78,
      head: [
        ["Tanggal", "Jenis", "Kategori", "Deskripsi", "Jumlah", "Dicatat Oleh"],
      ],
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
        : `${MONTHS[Number.parseInt(filterMonth) - 1]} ${filterYear}`;

    const data =
      groupedRecords?.map((r) => {
        if (r.isGroup) {
          return {
            Tanggal: format(new Date(r.transaction_date), "dd/MM/yyyy"),
            Jenis: r.type === "income" ? "Pemasukan" : "Pengeluaran",
            Kategori:
              r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
            Deskripsi: r.description,
            Jumlah: r.amount,
            "Dicatat Oleh": "-",
          };
        }
        return {
          Tanggal: format(new Date(r.transaction_date), "dd/MM/yyyy"),
          Jenis: r.type === "income" ? "Pemasukan" : "Pengeluaran",
          Kategori: r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
          Deskripsi: r.description,
          Jumlah: r.amount,
          "Dicatat Oleh": r.recorder?.full_name || "Sistem",
        };
      }) || [];

    // Add summary rows
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "",
      Jumlah: 0,
      "Dicatat Oleh": "",
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Total Pemasukan",
      Jumlah: filteredIncome,
      "Dicatat Oleh": "",
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Total Pengeluaran",
      Jumlah: filteredOutcome,
      "Dicatat Oleh": "",
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Saldo",
      Jumlah: totalBalance,
      "Dicatat Oleh": "",
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
    <section className="min-h-screen bg-background p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>

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
                    <span className="inline">Export</span>
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
              {[2025, 2026, 2027].map((y) => (
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
                Rp {filteredIncome.toLocaleString("id-ID")}
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
                Rp {filteredOutcome.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Card
            className={
              totalBalance >= 0
                ? "border-primary/20 bg-primary/5"
                : "border-orange-500/20 bg-orange-500/5"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Saldo</CardTitle>
              <Wallet
                className={`h-4 w-4 ${
                  totalBalance >= 0 ? "text-primary" : "text-orange-600"
                }`}
              />
            </CardHeader>
            <CardContent>
              <div
                className={`text-lg sm:text-2xl font-bold ${
                  totalBalance >= 0 ? "text-primary" : "text-orange-600"
                }`}
              >
                Rp {totalBalance.toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>
        </div>

        {canManageFinance && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <div className="flex justify-end">
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="inline">Tambah Catatan</span>
                </Button>
              </DialogTrigger>
            </div>
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
                  onClick={() => addRecord.mutate(formData)}
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

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : groupedRecords && groupedRecords.length > 0 ? (
              <ScrollArea>
                <Table className="w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Tanggal</TableHead>
                      <TableHead className="w-[90px]">Jenis</TableHead>
                      <TableHead className="w-[110px]">Kategori</TableHead>
                      <TableHead className="min-w-[180px]">Deskripsi</TableHead>
                      <TableHead className="w-[130px]">Jumlah</TableHead>
                      <TableHead className="min-w-[150px]">
                        Dicatat Oleh
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupedRecords.map((record) => {
                      if (record.isGroup) {
                        return (
                          <>
                            <TableRow
                              key={record.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() =>
                                setIsIuranExpanded(!isIuranExpanded)
                              }
                            >
                              <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {isIuranExpanded ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                  {format(
                                    new Date(record.transaction_date),
                                    "dd/MM/yyyy"
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="default"
                                  className="text-xs whitespace-nowrap bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                >
                                  <ArrowUpCircle className="w-3 h-3 mr-1" />
                                  Masuk
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm capitalize font-semibold">
                                {record.category}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-medium">
                                {record.description}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm font-bold whitespace-nowrap text-green-600">
                                + Rp {record.amount.toLocaleString("id-ID")}
                              </TableCell>
                              <TableCell className="text-xs sm:text-sm text-muted-foreground">
                                -
                              </TableCell>
                            </TableRow>
                            {isIuranExpanded &&
                              record?.groupRecords?.map((iuranRecord) => (
                                <TableRow
                                  key={iuranRecord.id}
                                  className="bg-muted/30"
                                >
                                  <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap pl-10">
                                    {format(
                                      new Date(iuranRecord.transaction_date),
                                      "dd/MM/yyyy"
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="default"
                                      className="text-xs whitespace-nowrap bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                    >
                                      <ArrowUpCircle className="w-3 h-3 mr-1" />
                                      Masuk
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm capitalize">
                                    {iuranRecord.category}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm">
                                    <div
                                      className="max-w-[250px] truncate"
                                      title={iuranRecord.description}
                                    >
                                      {iuranRecord.description}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm font-semibold whitespace-nowrap text-green-600">
                                    + Rp{" "}
                                    {iuranRecord.amount.toLocaleString("id-ID")}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm text-muted-foreground">
                                    {iuranRecord.recorder?.full_name ||
                                      "Sistem"}
                                  </TableCell>
                                </TableRow>
                              ))}
                          </>
                        );
                      }

                      // Regular record row (non-iuran)
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="text-xs sm:text-sm font-medium whitespace-nowrap">
                            {format(
                              new Date(record.transaction_date),
                              "dd/MM/yyyy"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                record.type === "income"
                                  ? "default"
                                  : "secondary"
                              }
                              className={`text-xs whitespace-nowrap ${
                                record.type === "income"
                                  ? "bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                  : "bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20"
                              }`}
                            >
                              {record.type === "income" ? (
                                <ArrowUpCircle className="w-3 h-3 mr-1" />
                              ) : (
                                <ArrowDownCircle className="w-3 h-3 mr-1" />
                              )}
                              {record.type === "income" ? "Masuk" : "Keluar"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm capitalize">
                            {record.category}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm">
                            <div
                              className="max-w-[250px] line-clamp-1 hover:line-clamp-none"
                              title={record.description}
                            >
                              {record.description}
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-xs sm:text-sm font-semibold whitespace-nowrap ${
                              record.type === "income"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {record.type === "income" ? "+" : "-"} Rp{" "}
                            {record.amount.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground">
                            {record.recorder?.full_name || "Sistem"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground/40 mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  Belum ada transaksi
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {activeTab === "all"
                    ? "Belum ada catatan keuangan untuk periode ini"
                    : `Belum ada ${
                        activeTab === "income" ? "pemasukan" : "pengeluaran"
                      } untuk periode ini`}
                </p>
                {canManageFinance && (
                  <Button size="sm" onClick={() => setIsAddOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Catatan
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
