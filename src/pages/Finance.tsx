import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Download,
  FileText,
  FileSpreadsheet,
  ArrowLeft,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import type { FinanceRecordWithDetails, Profile } from "@/types/database";
import type { SortingFinance } from "@/types/finance";
import { useFinanceCategories } from "@/hooks/finance/useFinanceCategories";
import { useUpdateFinanceRecord } from "@/hooks/finance/useEditFinanceRecord";
import { useDeleteFinanceRecord } from "@/hooks/finance/useDeleteFinanceRecord";
import { useFinanceExport } from "@/hooks/finance/useFinanceExport";
import { FinanceUploadDialog } from "@/components/finance/FinanceUploadDialog";
import { FinanceCategoryDialog } from "@/components/finance/FinanceCategoryDialog";
import { FinanceAddDialog } from "@/components/finance/FinanceAddDialog";
import { FinanceEditDialog } from "@/components/finance/FinanceEditDialog";
import { FinanceDeleteDialog } from "@/components/finance/FinanceDeleteDialog";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function Finance() {
  const { isAdmin, hasFinanceAccess } = useAuth();
  const queryClient = useQueryClient();

  // ── Ledger + Filters ──────────────────────────────────────────────
  const [ledgerType, setLedgerType] = useState<"umum" | "donasi">("umum");
  const [activeTab, setActiveTab] = useState("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortingFinance>("date-newest");

  // ── UI toggles ────────────────────────────────────────────────────
  const [isIuranExpanded, setIsIuranExpanded] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);

  // ── Edit / Delete state ───────────────────────────────────────────
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FinanceRecordWithDetails | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<{
    isModalOpen: boolean;
    data: FinanceRecordWithDetails | null;
  }>({ isModalOpen: false, data: null });

  const canManageFinance = isAdmin() || hasFinanceAccess;

  // ── Data fetching ─────────────────────────────────────────────────
  const { data: categoriesData } = useFinanceCategories();
  const updateRecord = useUpdateFinanceRecord();
  const deleteRecord = useDeleteFinanceRecord();
  const { exportToPDF, exportToExcel } = useFinanceExport();

  const { data: records, isLoading } = useQuery({
    queryKey: ["finance-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_records")
        .select("*")
        .order("transaction_date", { ascending: false });
      if (error) throw error;

      const userIds = new Set<string>();
      data?.forEach((r) => { if (r.recorded_by) userIds.add(r.recorded_by); });

      const profiles: Record<string, Profile> = {};
      if (userIds.size > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", Array.from(userIds));
        profileData?.forEach((p) => { profiles[p.id] = p; });
      }

      return data?.map((r) => ({
        ...r,
        recorder: r.recorded_by ? profiles[r.recorded_by] : null,
      })) as FinanceRecordWithDetails[];
    },
  });

  // ── Categories ────────────────────────────────────────────────────
  const CATEGORIES = useMemo(() => {
    if (!categoriesData) {
      return { income: [] as string[], outcome: [] as string[], donation: [] as string[], donation_outcome: [] as string[] };
    }
    return {
      income: categoriesData.filter((c) => c.type === "income").map((c) => c.name),
      outcome: categoriesData.filter((c) => c.type === "outcome").map((c) => c.name),
      donation: categoriesData.filter((c) => c.type === "donation").map((c) => c.name),
      donation_outcome: categoriesData.filter((c) => c.type === "donation_outcome").map((c) => c.name),
    };
  }, [categoriesData]);

  // ── All-time balance (not filtered by date) ───────────────────────
  const totalBalance =
    records?.reduce((sum, r) => {
      const isDonation = r.type === "donation" || r.type === "donation_outcome";
      if (ledgerType === "umum") {
        if (isDonation) return sum;
        return r.type === "income" ? sum + r.amount : sum - r.amount;
      } else {
        if (!isDonation) return sum;
        return r.type === "donation" ? sum + r.amount : sum - r.amount;
      }
    }, 0) || 0;

  // ── Filtered records ──────────────────────────────────────────────
  const filteredRecords = records?.filter((r) => {
    const isDonation = r.type === "donation" || r.type === "donation_outcome";
    if (ledgerType === "umum" && isDonation) return false;
    if (ledgerType === "donasi" && !isDonation) return false;

    if (activeTab !== "all") {
      if (ledgerType === "umum") {
        if (r.type !== activeTab) return false;
      } else {
        if (activeTab === "income" && r.type !== "donation") return false;
        if (activeTab === "outcome" && r.type !== "donation_outcome") return false;
      }
    }

    const date = new Date(r.transaction_date);
    if (filterMonth !== "all" && (date.getMonth() + 1).toString() !== filterMonth) return false;
    if (date.getFullYear().toString() !== filterYear) return false;
    if (filterCategory !== "all" && r.category !== filterCategory) return false;

    return true;
  });

  // ── Sorted records ────────────────────────────────────────────────
  const sortedFilteredRecords = useMemo(() => {
    if (!filteredRecords) return [];
    const sorted = [...filteredRecords];
    switch (sortBy) {
      case "date-newest": sorted.sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()); break;
      case "date-oldest": sorted.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()); break;
      case "amount-asc": sorted.sort((a, b) => a.amount - b.amount); break;
      case "amount-desc": sorted.sort((a, b) => b.amount - a.amount); break;
    }
    return sorted;
  }, [filteredRecords, sortBy]);

  // ── Grouped records (iuran grouping for umum) ─────────────────────
  const groupedRecords = useMemo((): FinanceRecordWithDetails[] => {
    if (!sortedFilteredRecords.length) return [];
    if (ledgerType === "donasi") return sortedFilteredRecords;

    const iuranRecords = sortedFilteredRecords.filter((r) => r.category?.toLowerCase() === "iuran");
    const otherRecords = sortedFilteredRecords.filter((r) => r.category?.toLowerCase() !== "iuran");
    const result: FinanceRecordWithDetails[] = [];

    if (iuranRecords.length > 0) {
      const iuranTotal = iuranRecords.reduce((sum, r) => sum + r.amount, 0);
      result.push({
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
      });
    }
    result.push(...otherRecords);
    return result;
  }, [sortedFilteredRecords, ledgerType]);

  // ── Table display data ────────────────────────────────────────────
  const displayData = useMemo(() => {
    const flattened: (FinanceRecordWithDetails & { isChild?: boolean })[] = [];
    groupedRecords.forEach((record) => {
      flattened.push(record);
      if (record.isGroup && record.groupRecords) {
        const isExpanded = record.id === "iuran-summary" ? isIuranExpanded : false;
        if (isExpanded) {
          record.groupRecords.forEach((child) => flattened.push({ ...child, isChild: true }));
        }
      }
    });
    return flattened;
  }, [groupedRecords, isIuranExpanded]);

  // ── Table columns ─────────────────────────────────────────────────
  const columns: DataTableColumn<FinanceRecordWithDetails & { isChild?: boolean }>[] = [
    {
      key: "transaction_date",
      label: "Tanggal",
      className: "min-w-[140px]",
      render: (_, row) => (
        <div
          className={`flex items-center gap-2 ${row.isGroup ? "cursor-pointer font-bold text-primary" : ""} ${row.isChild ? "pl-8 text-muted-foreground scale-90" : ""}`}
          onClick={() => {
            if (row.isGroup && row.id === "iuran-summary") setIsIuranExpanded(!isIuranExpanded);
          }}
        >
          {row.isGroup && (row.id === "iuran-summary" && isIuranExpanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          )}
          {format(new Date(row.transaction_date), "dd/MM/yyyy")}
        </div>
      ),
    },
    {
      key: "type",
      label: "Jenis",
      render: (_, row) => (
        <Badge
          variant={row.type === "outcome" ? "destructive" : "default"}
          className={`${row.isChild ? "scale-90 opacity-80" : ""} ${
            row.type === "income" ? "bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 border-none"
            : row.type === "donation" ? "bg-blue-500/10 hover:bg-blue-500/10 text-blue-600 border-none"
            : "bg-red-500/10 hover:bg-red-500/10 text-red-600 border-none"
          }`}
        >
          {row.type === "income" ? "Masuk" : row.type === "outcome" ? "Keluar" : "Donasi"}
        </Badge>
      ),
    },
    {
      key: "category",
      label: "Kategori",
      className: "min-w-[160px] whitespace-nowrap capitalize",
      render: (_, row) => (
        <span className={`${row.isGroup ? "font-bold text-primary" : ""} ${row.isChild ? "text-xs italic" : ""}`}>
          {row.category}
        </span>
      ),
    },
    {
      key: "description",
      label: "Deskripsi",
      className: "min-w-[300px]",
      render: (_, row) => <div className="line-clamp-1 hover:line-clamp-none">{row.description}</div>,
    },
    {
      key: "amount",
      label: "Jumlah",
      className: "min-w-[160px] whitespace-nowrap",
      render: (_, row) => {
        const isPositive = row.isGroup ? row.type !== "outcome" : row.type === "income" || row.type === "donation";
        return (
          <span className={`font-mono font-bold ${row.type === "donation" ? "text-blue-600" : isPositive ? "text-emerald-600" : "text-red-600"}`}>
            {row.type === "outcome" ? "-" : "+"} Rp {row.amount.toLocaleString("id-ID")}
          </span>
        );
      },
    },
    {
      key: "recorder",
      label: "Dicatat Oleh",
      className: "min-w-[160px] whitespace-nowrap",
      render: (_, row) => row.isGroup ? "-" : row.recorder?.full_name || "Sistem",
    },
    {
      key: "id",
      label: "Aksi",
      className: "text-right",
      render: (_, row) => {
        if (!canManageFinance || row.isGroup) return null;
        return (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon" className={row.isChild ? "h-7 w-7" : "h-8 w-8"}
              onClick={() => {
                setEditingRecord(row);
                setIsEditOpen(true);
              }}
            >
              <Pencil className={row.isChild ? "w-3 h-3" : "w-4 h-4"} />
            </Button>
            <Button variant="ghost" size="icon" className={`text-destructive ${row.isChild ? "h-7 w-7" : "h-8 w-8"}`}
              onClick={() => setDeletingRecord({ isModalOpen: true, data: row })}
            >
              <Trash2 className={row.isChild ? "w-3 h-3" : "w-4 h-4"} />
            </Button>
          </div>
        );
      },
    },
  ];

  // ── Active categories (for filter dropdown) ───────────────────────
  const activeCategories = ledgerType === "umum"
    ? [...CATEGORIES.income, ...CATEGORIES.outcome]
    : [...CATEGORIES.donation, ...CATEGORIES.donation_outcome];

  // ── Export helpers ────────────────────────────────────────────────
  const exportParams = { ledgerType, filterMonth, filterYear, totalBalance, sortedFilteredRecords, groupedRecords };

  return (
    <section className="min-h-screen bg-background p-4 sm:p-6">
      <div className="space-y-4 sm:space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
            <div>
              <div className="flex items-center gap-3">
                <Select
                  value={ledgerType}
                  onValueChange={(v: "umum" | "donasi") => {
                    setLedgerType(v);
                    setFilterCategory("all");
                    setActiveTab("all");
                  }}
                >
                  <SelectTrigger className="w-auto border-none shadow-none text-xl sm:text-2xl font-display font-bold p-0 h-auto gap-2 focus:ring-0 [&>svg]:w-6 [&>svg]:h-6">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="umum" className="text-lg font-medium">Laporan Keuangan Umum</SelectItem>
                    <SelectItem value="donasi" className="text-lg font-medium">Laporan Donasi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {ledgerType === "umum"
                  ? "Catatan pemasukan dan pengeluaran paguyuban"
                  : "Catatan penerimaan dan penyaluran dana donasi"}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {canManageFinance && (
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="inline">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToPDF(exportParams)}>
                    <FileText className="w-4 h-4 mr-2" /> Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToExcel(exportParams)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Download Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={() => setIsUploadOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                <span className="inline">Upload Excel</span>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsCategoryOpen(true)}>
                <Settings className="w-4 h-4 mr-2" />
                <span className="inline">Kategori</span>
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Bulan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Tahun" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: new Date().getFullYear() - 2025 + 1 }, (_, i) => 2025 + i).map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[140px] text-left"><SelectValue placeholder="Kategori" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Kategori</SelectItem>
              {activeCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v: SortingFinance) => setSortBy(v)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Urutkan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date-newest">Tanggal (Terbaru)</SelectItem>
              <SelectItem value="date-oldest">Tanggal (Terlama)</SelectItem>
              <SelectItem value="amount-desc">Jumlah (Terbesar)</SelectItem>
              <SelectItem value="amount-asc">Jumlah (Terkecil)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {ledgerType === "umum" ? "Total Pemasukan" : "Total Donasi Masuk"}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-green-600">
                Rp {sortedFilteredRecords
                  .filter((r) => ledgerType === "umum" ? r.type === "income" : r.type === "donation")
                  .reduce((sum, r) => sum + r.amount, 0)
                  .toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {ledgerType === "umum" ? "Total Pengeluaran" : "Total Pengeluaran Donasi"}
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold text-red-600">
                Rp {sortedFilteredRecords
                  .filter((r) => ledgerType === "umum" ? r.type === "outcome" : r.type === "donation_outcome")
                  .reduce((sum, r) => sum + r.amount, 0)
                  .toLocaleString("id-ID")}
              </div>
            </CardContent>
          </Card>

          <Card className={totalBalance >= 0 ? "border-primary/20 bg-primary/5" : "border-orange-500/20 bg-orange-500/5"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {ledgerType === "umum" ? "Saldo Umum" : "Sisa Saldo Donasi"}
              </CardTitle>
              <Wallet className={`h-4 w-4 ${totalBalance >= 0 ? "text-primary" : "text-orange-600"}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-lg sm:text-2xl font-bold ${totalBalance >= 0 ? "text-primary" : "text-orange-600"}`}>
                Rp {totalBalance.toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-muted-foreground mt-1 opacity-80">
                *Total keseluruhan (semua periode)
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Record Button + Dialog */}
        {canManageFinance && (
          <FinanceAddDialog
            ledgerType={ledgerType}
            CATEGORIES={CATEGORIES}
            isAddOpen={isAddOpen}
            setIsAddOpen={setIsAddOpen}
          />
        )}

        {/* Data Table */}
        <Card>
          <CardHeader className="flex md:flex-row items-center justify-between gap-4">
            <CardTitle>Daftar Transaksi</CardTitle>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList className="flex h-auto w-full flex-wrap md:w-auto">
                <TabsTrigger value="all">Semua</TabsTrigger>
                <TabsTrigger value="income">Pemasukan</TabsTrigger>
                <TabsTrigger value="outcome">Pengeluaran</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <DataTable columns={columns} data={displayData} pageSize={10} isLoading={isLoading} />
        </Card>
      </div>

      {/* Dialogs */}
      <FinanceEditDialog
        ledgerType={ledgerType}
        CATEGORIES={CATEGORIES}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        editingRecord={editingRecord}
        setEditingRecord={setEditingRecord}
        updateRecord={updateRecord}
      />

      <FinanceDeleteDialog
        deletingRecord={deletingRecord}
        setDeletingRecord={setDeletingRecord}
        deleteRecord={deleteRecord}
      />

      <FinanceUploadDialog
        ledgerType={ledgerType}
        CATEGORIES={CATEGORIES}
        isUploadOpen={isUploadOpen}
        setIsUploadOpen={setIsUploadOpen}
      />

      <FinanceCategoryDialog
        ledgerType={ledgerType}
        isCategoryOpen={isCategoryOpen}
        setIsCategoryOpen={setIsCategoryOpen}
      />
    </section>
  );
}
