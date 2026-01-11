import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
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
import { cn } from "@/lib/utils";
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
  Pencil,
  Trash2,
  CalendarIcon,
} from "lucide-react";
import type { FinanceRecordWithDetails, Profile } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { useAddFinanceRecord } from "@/hooks/finance/useAddFinanceRecord"; // Import the useAddFinanceRecord hook
import { useUpdateFinanceRecord } from "@/hooks/finance/useEditFinanceRecord";
import { useDeleteFinanceRecord } from "@/hooks/finance/useDeleteFinanceRecord";
import type { SortingFinance } from "@/types/finance";
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

const CATEGORIES = {
  income: ["iuran", "donasi", "Pendapatan Lainnya"],
  outcome: [
    "kegiatan",
    "keamanan",
    "kebersihan",
    "perbaikan",
    "acara",
    "operasional",
    "Pengeluaran Lainnya",
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
  const [sortBy, setSortBy] = useState<
    "date-newest" | "date-oldest" | "amount-asc" | "amount-desc"
  >("date-newest");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isIuranExpanded, setIsIuranExpanded] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] =
    useState<FinanceRecordWithDetails | null>(null);
  const [editType, setEditType] = useState<"income" | "outcome">("income");
  const [editTransactionDate, setEditTransactionDate] = useState<
    Date | undefined
  >(undefined);
  const [deletingRecord, setDeletingRecord] = useState<{
    isModalOpen: boolean;
    data: FinanceRecordWithDetails | null;
  }>({
    isModalOpen: false,
    data: null,
  });

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

      const profiles: Record<string, Profile> = {};
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
  const updateRecord = useUpdateFinanceRecord();
  const deleteRecord = useDeleteFinanceRecord();

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
    const categoryMatch =
      filterCategory === "all" || r.category === filterCategory;
    return typeMatch && monthMatch && yearMatch && categoryMatch;
  });

  // Grouping and sorting logic
  const sortedFilteredRecords = (() => {
    if (!filteredRecords) return [];

    const sorted = [...filteredRecords];

    // Apply sorting
    switch (sortBy) {
      case "date-newest":
        sorted.sort(
          (a, b) =>
            new Date(b.transaction_date).getTime() -
            new Date(a.transaction_date).getTime()
        );
        break;
      case "date-oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.transaction_date).getTime() -
            new Date(b.transaction_date).getTime()
        );
        break;
      case "amount-asc":
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case "amount-desc":
        sorted.sort((a, b) => b.amount - a.amount);
        break;
    }

    return sorted;
  })();

  const groupedRecords = (() => {
    if (!sortedFilteredRecords) return [];

    const iuranRecords = sortedFilteredRecords.filter(
      (r) => r.category?.toLowerCase() === "iuran"
    );
    const otherRecords = sortedFilteredRecords.filter(
      (r) => r.category?.toLowerCase() !== "iuran"
    );

    if (iuranRecords.length === 0) return sortedFilteredRecords;

    // Create summary row for iuran
    const iuranTotal = iuranRecords.reduce((sum, r) => sum + r.amount, 0);
    const iuranSummary: FinanceRecordWithDetails = {
      id: "iuran-summary",
      type: "income" as const,
      category: "iuran",
      description: `Total Iuran (${iuranRecords.length} transaksi)`,
      amount: iuranTotal,
      transaction_date: iuranRecords[0].transaction_date,
      recorded_by: null,
      recorder: undefined,
      payment_id: null,
      updated_at: iuranRecords[0].updated_at,
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
      `Total Pemasukan: Rp ${sortedFilteredRecords
        .filter((r) => r.type === "income")
        .reduce((sum, r) => sum + r.amount, 0)
        .toLocaleString("id-ID")}`,
      14,
      52
    );
    doc.text(
      `Total Pengeluaran: Rp ${sortedFilteredRecords
        .filter((r) => r.type === "outcome")
        .reduce((sum, r) => sum + r.amount, 0)
        .toLocaleString("id-ID")}`,
      14,
      60
    );
    doc.text(`Saldo: Rp ${totalBalance.toLocaleString("id-ID")}`, 14, 68);

    // Table
    const tableData =
      sortedFilteredRecords?.map((r) => {
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
      Jumlah: sortedFilteredRecords
        .filter((r) => r.type === "income")
        .reduce((sum, r) => sum + r.amount, 0),
      "Dicatat Oleh": "",
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: "Total Pengeluaran",
      Jumlah: sortedFilteredRecords
        .filter((r) => r.type === "outcome")
        .reduce((sum, r) => sum + r.amount, 0),
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

  const handleEdit = (record: FinanceRecordWithDetails) => {
    setEditingRecord(record);
    setEditType(record.type);
    setEditTransactionDate(
      record.transaction_date ? new Date(record.transaction_date) : undefined
    );
    setIsEditOpen(true);
  };

  const handleDelete = async (record: FinanceRecordWithDetails) => {
    setDeletingRecord({
      isModalOpen: true,
      data: record,
    });
  };

  let formEditData = new FormData();
  const handleEditSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRecord) return;

    formEditData = new FormData(e.currentTarget);
    updateRecord.mutate(
      {
        id: editingRecord.id,
        type: formEditData.get("type") as "income" | "outcome",
        amount: formEditData.get("amount") as string,
        description: formEditData.get("description") as string,
        category: formEditData.get("category") as string,
        transaction_date: editTransactionDate
          ? format(editTransactionDate, "yyyy-MM-dd")
          : "",
      },
      {
        onSuccess: () => {
          setIsEditOpen(false);
          setEditingRecord(null);
        },
      }
    );
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
        <div className="flex flex-col gap-3">
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

            {/* Category Filter */}
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[140px] text-left">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {Object.values(CATEGORIES)
                  .flat()
                  .map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            {/* Sorting Dropdown */}
            <Select
              value={sortBy}
              onValueChange={(v: SortingFinance) => setSortBy(v)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-newest">Tanggal (Terbaru)</SelectItem>
                <SelectItem value="date-oldest">Tanggal (Terlama)</SelectItem>
                <SelectItem value="amount-desc">Jumlah (Terbesar)</SelectItem>
                <SelectItem value="amount-asc">Jumlah (Terkecil)</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                Rp{" "}
                {sortedFilteredRecords
                  .filter((r) => r.type === "income")
                  .reduce((sum, r) => sum + r.amount, 0)
                  .toLocaleString("id-ID")}
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
                Rp{" "}
                {sortedFilteredRecords
                  .filter((r) => r.type === "outcome")
                  .reduce((sum, r) => sum + r.amount, 0)
                  .toLocaleString("id-ID")}
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
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.transaction_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.transaction_date ? (
                          format(
                            new Date(formData.transaction_date),
                            "dd MMMM yyyy",
                            { locale: localeId }
                          )
                        ) : (
                          <span>Pilih tanggal</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={
                          formData.transaction_date
                            ? new Date(formData.transaction_date)
                            : undefined
                        }
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            transaction_date: date
                              ? format(date, "yyyy-MM-dd")
                              : "",
                          })
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
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

          <CardContent className="p-0 -mx-4 sm:mx-0 px-4 sm:px-6">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : groupedRecords && groupedRecords.length > 0 ? (
              <div className="w-screen -mx-4 sm:w-auto sm:mx-0 overflow-x-auto">
                <div className="w-full inline-block min-w-full px-4 sm:px-0">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm whitespace-nowrap min-w-28">
                          Tanggal
                        </TableHead>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm whitespace-nowrap min-w-28">
                          Jenis
                        </TableHead>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm table-cell whitespace-nowrap min-w-28">
                          Kategori
                        </TableHead>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm whitespace-nowrap min-w-52">
                          Deskripsi
                        </TableHead>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm whitespace-nowrap">
                          Jumlah
                        </TableHead>
                        <TableHead className="px-2 sm:px-6 text-xs sm:text-sm table-cell whitespace-nowrap">
                          Dicatat Oleh
                        </TableHead>
                        {canManageFinance && (
                          <TableHead className="px-2 sm:px-6 text-xs sm:text-sm text-center whitespace-nowrap">
                            Aksi
                          </TableHead>
                        )}
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
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-medium whitespace-nowrap">
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
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm">
                                  <Badge
                                    variant="default"
                                    className="text-xs whitespace-nowrap bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                  >
                                    <ArrowUpCircle className="w-3 h-3 mr-1" />
                                    Masuk
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm capitalize font-semibold table-cell">
                                  {record.category}
                                </TableCell>
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-medium">
                                  {record.description}
                                </TableCell>
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-bold whitespace-nowrap text-green-600">
                                  + Rp {record.amount.toLocaleString("id-ID")}
                                </TableCell>
                                <TableCell className="px-2 sm:px-6 text-xs sm:text-sm text-muted-foreground table-cell">
                                  -
                                </TableCell>
                                {canManageFinance && <TableCell />}
                              </TableRow>
                              {isIuranExpanded &&
                                record?.groupRecords?.map((iuranRecord) => (
                                  <TableRow
                                    key={iuranRecord.id}
                                    className="bg-muted/30"
                                  >
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-medium whitespace-nowrap pl-6 sm:pl-10">
                                      {format(
                                        new Date(iuranRecord.transaction_date),
                                        "dd/MM/yyyy"
                                      )}
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm">
                                      <Badge
                                        variant="default"
                                        className="text-xs whitespace-nowrap bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20"
                                      >
                                        <ArrowUpCircle className="w-3 h-3 mr-1" />
                                        Masuk
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm capitalize table-cell">
                                      {iuranRecord.category}
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm">
                                      <div
                                        className="max-w-[250px] truncate"
                                        title={iuranRecord.description}
                                      >
                                        {iuranRecord.description}
                                      </div>
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-semibold whitespace-nowrap text-green-600">
                                      + Rp{" "}
                                      {iuranRecord.amount.toLocaleString(
                                        "id-ID"
                                      )}
                                    </TableCell>
                                    <TableCell className="px-2 sm:px-6 text-xs sm:text-sm text-muted-foreground table-cell">
                                      {iuranRecord.recorder?.full_name ||
                                        "Sistem"}
                                    </TableCell>
                                    {canManageFinance && (
                                      <TableCell className="px-2 sm:px-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEdit(iuranRecord);
                                            }}
                                            className="h-8 w-8 p-0"
                                          >
                                            <Pencil className="w-4 h-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(record)}
                                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                            </>
                          );
                        }

                        // Regular record row (non-iuran)
                        return (
                          <TableRow key={record.id}>
                            <TableCell className="px-2 sm:px-6 text-xs sm:text-sm font-medium whitespace-nowrap">
                              {format(
                                new Date(record.transaction_date),
                                "dd/MM/yyyy"
                              )}
                            </TableCell>
                            <TableCell className="px-2 sm:px-6 text-xs sm:text-sm">
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
                            <TableCell className="px-2 sm:px-6 text-xs sm:text-sm capitalize table-cell">
                              {record.category}
                            </TableCell>
                            <TableCell className="px-2 sm:px-6 text-xs sm:text-sm">
                              <div
                                className="max-w-[250px] line-clamp-1 hover:line-clamp-none"
                                title={record.description}
                              >
                                {record.description}
                              </div>
                            </TableCell>
                            <TableCell
                              className={`px-2 sm:px-6 text-xs sm:text-sm font-semibold whitespace-nowrap ${
                                record.type === "income"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {record.type === "income" ? "+" : "-"} Rp{" "}
                              {record.amount.toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="px-2 sm:px-6 text-xs sm:text-sm text-muted-foreground table-cell">
                              {record.recorder?.full_name || "Sistem"}
                            </TableCell>
                            {canManageFinance && (
                              <TableCell className="px-2 sm:px-6 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      handleEdit(record);
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(record)}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Catatan Keuangan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-type">Jenis Transaksi</Label>
                <Select
                  name="type"
                  defaultValue={editingRecord?.type}
                  value={editType}
                  onValueChange={(value: "income" | "outcome") => {
                    setEditType(value);
                  }}
                >
                  <SelectTrigger id="edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="income">Pemasukan</SelectItem>
                      <SelectItem value="outcome">Pengeluaran</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-amount">Jumlah (Rp)</Label>
                <Input
                  id="edit-amount"
                  name="amount"
                  type="number"
                  defaultValue={editingRecord?.amount}
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Kategori</Label>
                <Select name="category" defaultValue={editingRecord?.category}>
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectGroup>
                      {CATEGORIES[editType].map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tanggal Transaksi</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editTransactionDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editTransactionDate ? (
                        format(editTransactionDate, "dd MMMM yyyy", {
                          locale: localeId,
                        })
                      ) : (
                        <span>Pilih tanggal</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={editTransactionDate}
                      onSelect={setEditTransactionDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Deskripsi</Label>
              <Textarea
                id="edit-description"
                name="description"
                defaultValue={editingRecord?.description}
                required
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingRecord(null);
                }}
              >
                Batal
              </Button>
              <Button type="submit" disabled={updateRecord.isPending}>
                {updateRecord.isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingRecord.isModalOpen}
        onOpenChange={(open) =>
          !open &&
          setDeletingRecord({ data: deletingRecord?.data, isModalOpen: false })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Transaksi</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah anda yakin ingin menghapus data{" "}
              {deletingRecord?.data?.category} ini?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteRecord.mutate(deletingRecord?.data?.id);
                setDeletingRecord({
                  isModalOpen: false,
                  data: null,
                });
              }}
            >
              {deleteRecord.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
