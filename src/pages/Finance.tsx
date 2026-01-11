import type React from "react";
import { useMemo, useState } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Download,
  FileText,
  FileSpreadsheet,
  ArrowLeft,
  Pencil,
  Trash2,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
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
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  const filteredRecords = records?.filter((r) => {
    // Filter by Type (Income/Outcome)
    const typeMatch = activeTab === "all" || r.type === activeTab;

    // Existing date logic
    const date = new Date(r.transaction_date);
    const monthMatch =
      filterMonth === "all" || (date.getMonth() + 1).toString() === filterMonth;
    const yearMatch = date.getFullYear().toString() === filterYear;

    // Existing category logic
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

  const displayData = useMemo(() => {
    if (!groupedRecords) return [];

    const flattened: (FinanceRecordWithDetails & { isChild?: boolean })[] = [];

    groupedRecords.forEach((record) => {
      flattened.push(record);

      // If this is the Iuran summary and it's expanded, insert children
      if (record.isGroup && isIuranExpanded && record.groupRecords) {
        record.groupRecords.forEach((child) => {
          flattened.push({
            ...child,
            isChild: true, // Mark this so we can indent the UI
          });
        });
      }
    });

    return flattened;
  }, [groupedRecords, isIuranExpanded]);

  const columns: DataTableColumn<
    FinanceRecordWithDetails & { isChild?: boolean }
  >[] = [
    {
      key: "transaction_date",
      label: "Tanggal",
      className: "min-w-[140px]",
      render: (_, row) => {
        const isGroup = row.isGroup;
        const isChild = row.isChild;

        return (
          <div
            className={`flex items-center gap-2 ${
              isGroup ? "cursor-pointer font-bold text-primary" : ""
            } ${isChild ? "pl-8 text-muted-foreground scale-90" : ""}`}
            onClick={() => isGroup && setIsIuranExpanded(!isIuranExpanded)}
          >
            {isGroup &&
              (isIuranExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              ))}
            {format(new Date(row.transaction_date), "dd/MM/yyyy")}
          </div>
        );
      },
    },
    {
      key: "type",
      label: "Jenis",
      render: (_, row) => (
        <Badge
          variant={row.type === "income" ? "default" : "destructive"}
          className={`${row.isChild ? "scale-90 opacity-80" : ""} ${
            row.type === "income"
              ? "bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 border-none"
              : "bg-red-500/10 hover:bg-red-500/10 text-red-600 border-none"
          }`}
        >
          {row.type === "income" ? "Masuk" : "Keluar"}
        </Badge>
      ),
    },
    {
      key: "category",
      label: "Kategori",
      className: "min-w-[160px] whitespace-nowrap capitalize",
      render: (_, row) => (
        <span
          className={`${row.isGroup ? "font-bold text-primary" : ""} ${
            row.isChild ? "text-xs italic" : ""
          }`}
        >
          {row.category}
        </span>
      ),
    },
    {
      key: "description",
      label: "Deskripsi",
      className: "min-w-[300px]",
      render: (_, row) => (
        <div className="line-clamp-1 hover:line-clamp-none">
          {row.description}
        </div>
      ),
    },
    {
      key: "amount",
      label: "Jumlah",
      className: "min-w-[160px] whitespace-nowrap",
      render: (_, row) => (
        <span
          className={`font-mono font-bold ${
            row.isGroup || row.type === "income"
              ? "text-emerald-600"
              : "text-red-600"
          }`}
        >
          {row.isGroup || row.type === "income" ? "+" : "-"} Rp{" "}
          {row.amount.toLocaleString("id-ID")}
        </span>
      ),
    },
    {
      key: "recorder",
      label: "Dicatat Oleh",
      className: "min-w-[160px] whitespace-nowrap",
      render: (_, row) =>
        row.isGroup ? "-" : row.recorder?.full_name || "Sistem",
    },
    {
      key: "id",
      label: "Aksi",
      className: "text-right",
      render: (_, row) => {
        // Logic: Summary rows (isGroup) CANNOT be edited/deleted (they are calculated)
        // Regular rows and Child rows CAN be edited/deleted
        if (!canManageFinance || row.isGroup) return null;

        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={`${row.isChild ? "h-7 w-7" : "h-8 w-8"}`}
              onClick={() => handleEdit(row)}
            >
              <Pencil className={row.isChild ? "w-3 h-3" : "w-4 h-4"} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`text-destructive ${
                row.isChild ? "h-7 w-7" : "h-8 w-8"
              }`}
              onClick={() => handleDelete(row)}
            >
              <Trash2 className={row.isChild ? "w-3 h-3" : "w-4 h-4"} />
            </Button>
          </div>
        );
      },
    },
  ];
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
          <CardHeader className="flex md:flex-row items-center justify-between gap-4">
            <CardTitle>Daftar Transaksi</CardTitle>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <Tabs
                defaultValue="all"
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full md:w-auto"
              >
                <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                  <TabsTrigger value="all">Semua</TabsTrigger>
                  <TabsTrigger value="income">Pemasukan</TabsTrigger>
                  <TabsTrigger value="outcome">Pengeluaran</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>

          <DataTable
            columns={columns}
            data={displayData}
            pageSize={10}
            isLoading={isLoading}
          />
        </Card>

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
                  <Select
                    name="category"
                    defaultValue={editingRecord?.category}
                  >
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
            setDeletingRecord({
              data: deletingRecord?.data,
              isModalOpen: false,
            })
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
      </div>
    </section>
  );
}
