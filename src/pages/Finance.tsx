import type React from "react";
import { useMemo, useRef, useState, useEffect } from "react";
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
  Upload,
  Settings,
  X,
} from "lucide-react";
import type { FinanceRecordWithDetails, Profile } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link } from "react-router-dom";
import { useAddFinanceRecord } from "@/hooks/finance/useAddFinanceRecord";
import { useUpdateFinanceRecord } from "@/hooks/finance/useEditFinanceRecord";
import { useDeleteFinanceRecord } from "@/hooks/finance/useDeleteFinanceRecord";
import {
  useFinanceCategories,
  useAddFinanceCategory,
  useDeleteFinanceCategory,
} from "@/hooks/finance/useFinanceCategories";
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
  const [ledgerType, setLedgerType] = useState<"umum" | "donasi">("umum");
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
  const [editType, setEditType] = useState<"income" | "outcome" | "donation" | "donation_outcome">("income");
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
    type: "income" as "income" | "outcome" | "donation" | "donation_outcome",
    amount: "",
    description: "",
    category: "",
    transaction_date: new Date().toISOString().split("T")[0],
  });

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isUploadLoading, setIsUploadLoading] = useState(false);
  const [selectedExcelFile, setSelectedExcelFile] = useState<File | null>(null);
  const [isConfirmUploadOpen, setIsConfirmUploadOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<"income" | "outcome" | "donation" | "donation_outcome">("income");
  
  // Update newCategoryType when ledgerType changes
  useEffect(() => {
    setNewCategoryType(ledgerType === "umum" ? "income" : "donation");
  }, [ledgerType]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManageFinance = isAdmin() || hasFinanceAccess;

  // Fetch dynamic categories
  const { data: categoriesData } = useFinanceCategories();
  const addCategory = useAddFinanceCategory();
  const deleteCategory = useDeleteFinanceCategory();
  const queryClient = useQueryClient();

  const CATEGORIES = useMemo(() => {
    if (!categoriesData) return { income: [] as string[], outcome: [] as string[], donation: [] as string[], donation_outcome: [] as string[] };
    return {
      income: categoriesData.filter((c) => c.type === "income").map((c) => c.name),
      outcome: categoriesData.filter((c) => c.type === "outcome").map((c) => c.name),
      donation: categoriesData.filter((c) => c.type === "donation").map((c) => c.name),
      donation_outcome: categoriesData.filter((c) => c.type === "donation_outcome").map((c) => c.name),
    };
  }, [categoriesData]);

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
      const isDonationRecord = r.type === "donation" || r.type === "donation_outcome";
      if (ledgerType === "umum") {
        if (isDonationRecord) return sum;
        return r.type === "income" ? sum + r.amount : sum - r.amount;
      } else {
        if (!isDonationRecord) return sum;
        return r.type === "donation" ? sum + r.amount : sum - r.amount;
      }
    }, 0) || 0;

  const filteredRecords = records?.filter((r) => {
    // Ledger Type Filter
    const isDonationRecord = r.type === "donation" || r.type === "donation_outcome";
    if (ledgerType === "umum" && isDonationRecord) return false;
    if (ledgerType === "donasi" && !isDonationRecord) return false;

    // Sub-Type Filter (Masuk/Keluar)
    let typeMatch = true;
    if (activeTab !== "all") {
      if (ledgerType === "umum") {
        typeMatch = r.type === activeTab;
      } else {
        // For donation logic, "Masuk" (activeTab=income) translates to r.type="donation"
        // and "Keluar" (activeTab=outcome) translates to r.type="donation_outcome"
        if (activeTab === "income") typeMatch = r.type === "donation";
        if (activeTab === "outcome") typeMatch = r.type === "donation_outcome";
      }
    }

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

    if (ledgerType === "donasi") {
      // In donation view, no iuran grouping. We just group by category.
      const result: FinanceRecordWithDetails[] = [];
      const donationByCategory = new Map<string, FinanceRecordWithDetails[]>();
      
      sortedFilteredRecords.forEach((r) => {
        const cat = r.category || "Lainnya";
        if (!donationByCategory.has(cat)) donationByCategory.set(cat, []);
        donationByCategory.get(cat)!.push(r);
      });

      // No need to create summary group objects because the entire view is already filtered by donation.
      // We will show them flat but sorted by date as requested. 
      // If summary rows are still desired we could add them, but standard flat list is usually better 
      // for dedicated tables. Let's keep it flat for now.
      return sortedFilteredRecords;

    } else {
      // Keuangan Umum
      const iuranRecords = sortedFilteredRecords.filter(
        (r) => r.category?.toLowerCase() === "iuran"
      );
      const otherRecords = sortedFilteredRecords.filter(
        (r) => r.category?.toLowerCase() !== "iuran"
      );

      const result: FinanceRecordWithDetails[] = [];

      // Group iuran
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
    }
  })();

  // Export to PDF
  const exportToPDF = () => {
    const periodText =
      filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS[Number.parseInt(filterMonth) - 1]} ${filterYear}`;

    const doc = new jsPDF();
    doc.setFontSize(18);
    const title = ledgerType === "umum" ? "Laporan Keuangan paguyuban" : "Laporan Donasi paguyuban";
    doc.text(title, 14, 22);
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
    if (ledgerType === "umum") {
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
      doc.text(`Saldo Umum: Rp ${totalBalance.toLocaleString("id-ID")}`, 14, 68);
    } else {
      doc.text(
        `Total Donasi Masuk: Rp ${sortedFilteredRecords
          .filter((r) => r.type === "donation")
          .reduce((sum, r) => sum + r.amount, 0)
          .toLocaleString("id-ID")}`,
        14,
        52
      );
      doc.text(
        `Total Pengeluaran Donasi: Rp ${sortedFilteredRecords
          .filter((r) => r.type === "donation_outcome")
          .reduce((sum, r) => sum + r.amount, 0)
          .toLocaleString("id-ID")}`,
        14,
        60
      );
      doc.text(`Sisa Saldo Donasi: Rp ${totalBalance.toLocaleString("id-ID")}`, 14, 68);
    }

    // Table
    const tableData =
      sortedFilteredRecords?.map((r) => {
        let jenisText = "Masuk";
        if (r.type === "outcome") jenisText = "Keluar";
        if (r.type === "donation") jenisText = "Donasi";
        return [
          format(new Date(r.transaction_date), "dd/MM/yyyy"),
          jenisText,
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

    const filenamePrefix = ledgerType === "umum" ? "laporan-keuangan" : "laporan-donasi";
    doc.save(
      `${filenamePrefix}-${filterYear}-${
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
          let typeLabel = "Pemasukan";
          if (r.type === "outcome") typeLabel = "Pengeluaran";
          if (r.type === "donation") typeLabel = "Donasi";
          return {
            Tanggal: format(new Date(r.transaction_date), "dd/MM/yyyy"),
            Jenis: typeLabel,
            Kategori:
              r.category?.charAt(0).toUpperCase() + r.category?.slice(1),
            Deskripsi: r.description,
            Jumlah: r.amount,
            "Dicatat Oleh": "-",
          };
        }
        let typeLabel = "Pemasukan";
        if (r.type === "outcome") typeLabel = "Pengeluaran";
        if (r.type === "donation") typeLabel = "Donasi";
        return {
          Tanggal: format(new Date(r.transaction_date), "dd/MM/yyyy"),
          Jenis: typeLabel,
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
      Deskripsi: ledgerType === "umum" ? "Total Pemasukan" : "Total Donasi Masuk",
      Jumlah: sortedFilteredRecords
        .filter((r) => ledgerType === "umum" ? r.type === "income" : r.type === "donation")
        .reduce((sum, r) => sum + r.amount, 0),
      "Dicatat Oleh": "",
    });
    data.push({
      Tanggal: "",
      Jenis: "",
      Kategori: "",
      Deskripsi: ledgerType === "umum" ? "Total Pengeluaran" : "Total Pengeluaran Donasi",
      Jumlah: sortedFilteredRecords
        .filter((r) => ledgerType === "umum" ? r.type === "outcome" : r.type === "donation_outcome")
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
    const sheetName = ledgerType === "umum" ? "Laporan Keuangan" : "Laporan Donasi";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    
    const filenamePrefix = ledgerType === "umum" ? "laporan-keuangan" : "laporan-donasi";
    XLSX.writeFile(
      wb,
      `${filenamePrefix}-${filterYear}-${
        filterMonth === "all" ? "tahunan" : filterMonth
      }.xlsx`
    );
    toast.success("Laporan Excel berhasil diunduh");
  };

  // Download Excel template for bulk upload (using exceljs for data validation)
  const downloadTemplate = async () => {
    try {
      // Lazy load exceljs to avoid inflating the main bundle if not needed often
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Community Hub";
      workbook.created = new Date();

      const ws = workbook.addWorksheet("Data", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      const catWs = workbook.addWorksheet("Referensi Kategori");
      
      const activeCategories = ledgerType === "umum" 
        ? [...(CATEGORIES.income || []), ...(CATEGORIES.outcome || [])]
        : [...(CATEGORIES.donation || []), ...(CATEGORIES.donation_outcome || [])];

      // Setup Details Sheet Headers
      ws.columns = [
        { header: "Jenis", key: "jenis", width: 15 },
        { header: "Jumlah", key: "jumlah", width: 20 },
        { header: "Kategori", key: "kategori", width: 30 },
        { header: "Deskripsi", key: "deskripsi", width: 45 },
        { header: "Tanggal (YYYY-MM-DD)", key: "tanggal", width: 22, style: { numFmt: "yyyy-mm-dd" } },
      ];

      // Styling Headers
      ws.getRow(1).font = { bold: true };
      ws.getRow(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" }
      };

      // Setup Reference Sheet
      catWs.columns = [
        { header: "Kategori", key: "kategori", width: 30 },
        { header: "Jenis", key: "jenis", width: 15 }
      ];

      activeCategories.forEach((cat) => {
        let type = "unknown";
        if (CATEGORIES.income.includes(cat)) type = "income";
        else if (CATEGORIES.outcome.includes(cat)) type = "outcome";
        else if (CATEGORIES.donation.includes(cat) || CATEGORIES.donation_outcome.includes(cat)) {
           // For donation cats, we will accept both in validation later, but here is reference
           type = CATEGORIES.donation.includes(cat) ? "donation" : "donation_outcome";
        }
        catWs.addRow({ kategori: cat, jenis: type });
      });

      // Protect Reference Sheet (Optional)
      await catWs.protect("-", { selectLockedCells: true, selectUnlockedCells: true });

      // Add Data Validation for Jenis
      for (let i = 2; i <= 1000; i++) {
        ws.getCell(`A${i}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [ledgerType === "umum" ? '"income,outcome"' : '"donation,donation_outcome"'],
          showErrorMessage: true,
          errorTitle: "Jenis tidak valid",
          error: "Pilih salah satu dari dropdown list",
        };
      }

      // Add Data Validation for Kategori
      // The formula references the Kategori column in the Referensi Kategori sheet.
      const catCount = activeCategories.length > 0 ? activeCategories.length : 1;
      for (let i = 2; i <= 1000; i++) {
        ws.getCell(`C${i}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`'Referensi Kategori'!$A$2:$A$${catCount + 1}`],
          showErrorMessage: true,
          errorTitle: "Kategori tidak valid",
          error: "Pilih kategori yang tersedia di list",
        };
      }

      // Write to browser
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = ledgerType === "umum" ? "template-upload-keuangan.xlsx" : "template-upload-donasi.xlsx";
      link.click();
      toast.success("Template berhasil diunduh");

    } catch (error) {
      console.error("Error generating template:", error);
      toast.error("Gagal men-generate template Excel");
    }
  };

  // Process Excel file upload
  const processExcelUpload = async () => {
    if (!selectedExcelFile) return;

    setIsUploadLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const data = await selectedExcelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      if (rows.length === 0) {
        toast.error("File Excel kosong");
        return;
      }

      const validTypes = ledgerType === "umum" ? ["income", "outcome"] : ["donation", "donation_outcome"];
      const activeCategories = ledgerType === "umum" 
        ? [...(CATEGORIES.income || []), ...(CATEGORIES.outcome || [])]
        : [...(CATEGORIES.donation || []), ...(CATEGORIES.donation_outcome || [])];
      const errors: string[] = [];
      const records: Array<{
        type: string;
        amount: number;
        category: string;
        description: string;
        transaction_date: string;
        recorded_by: string;
      }> = [];

      rows.forEach((row, idx) => {
        const rowNum = idx + 2; // Excel row (header is row 1)
        const type = (row["Jenis"] || "").toString().toLowerCase().trim();
        const amount = Number(row["Jumlah"]);
        const category = (row["Kategori"] || "").toString().trim();
        const description = (row["Deskripsi"] || "").toString().trim();
        const dateStr = (row["Tanggal (YYYY-MM-DD)"] || "").toString().trim();

        if (!validTypes.includes(type)) {
          errors.push(`Baris ${rowNum}: Jenis harus 'income', 'outcome', atau 'donation'`);
          return;
        }
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Baris ${rowNum}: Jumlah harus angka positif`);
          return;
        }
        if (!category) {
          errors.push(`Baris ${rowNum}: Kategori tidak boleh kosong`);
          return;
        }
        if (!description) {
          errors.push(`Baris ${rowNum}: Deskripsi tidak boleh kosong`);
          return;
        }

        // Parse date - handle Excel serial numbers
        let finalDate = dateStr;
        if (!dateStr || dateStr === "undefined") {
          finalDate = format(new Date(), "yyyy-MM-dd");
        } else if (!isNaN(Number(dateStr))) {
          // Excel serial date number
          const excelDate = new Date((Number(dateStr) - 25569) * 86400 * 1000);
          finalDate = format(excelDate, "yyyy-MM-dd");
        }

        records.push({
          type,
          amount,
          category,
          description,
          transaction_date: finalDate,
          recorded_by: user.id,
        });
      });

      if (errors.length > 0) {
        toast.error(`Ada ${errors.length} kesalahan:\n${errors.slice(0, 3).join("\n")}`);
        return;
      }

      // Fetch existing records to deduplicate
      const { data: existingRecords } = await supabase
        .from("finance_records")
        .select("type, amount, category, description, transaction_date");

      const existingSet = new Set(
        (existingRecords || []).map((r) =>
          `${r.type}|${Number(r.amount)}|${r.category || ""}|${r.description}|${r.transaction_date}`
        )
      );

      const newRecords = records.filter(
        (r) =>
          !existingSet.has(
            `${r.type}|${r.amount}|${r.category}|${r.description}|${r.transaction_date}`
          )
      );

      if (newRecords.length === 0) {
        toast.info("Semua data sudah ada, tidak ada data baru untuk diupload");
        return;
      }

      const skipped = records.length - newRecords.length;

      // Bulk insert only new records
      const { error } = await supabase.from("finance_records").insert(newRecords);
      if (error) throw error;

      toast.success(`${records.length} catatan berhasil diupload`);
      queryClient.invalidateQueries({ queryKey: ["finance-records"] });
      setIsUploadOpen(false);
      setIsConfirmUploadOpen(false);
      setSelectedExcelFile(null);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Gagal mengupload file");
    } finally {
      setIsUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
        type: formEditData.get("type") as "income" | "outcome" | "donation" | "donation_outcome",
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

      if (record.isGroup && record.groupRecords) {
        const isExpanded = record.id === "iuran-summary" ? isIuranExpanded : false;

        if (isExpanded) {
          record.groupRecords.forEach((child) => {
            flattened.push({ ...child, isChild: true });
          });
        }
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
            onClick={() => {
              if (isGroup && row.id === "iuran-summary") {
                setIsIuranExpanded(!isIuranExpanded);
              }
            }}
          >
            {isGroup &&
              ((() => {
                const isExpanded = row.id === "iuran-summary" ? isIuranExpanded : false;
                return isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                );
              })())}
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
          variant={row.type === "outcome" ? "destructive" : "default"}
          className={`${row.isChild ? "scale-90 opacity-80" : ""} ${
            row.type === "income"
              ? "bg-emerald-500/10 hover:bg-emerald-500/10 text-emerald-600 border-none"
              : row.type === "donation"
              ? "bg-blue-500/10 hover:bg-blue-500/10 text-blue-600 border-none"
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
      render: (_, row) => {
        const isPositive = row.isGroup
          ? row.type !== "outcome"
          : row.type === "income" || row.type === "donation";
        return (
          <span
            className={`font-mono font-bold ${
              row.type === "donation"
                ? "text-blue-600"
                : isPositive
                ? "text-emerald-600"
                : "text-red-600"
            }`}
          >
            {row.type === "outcome" ? "-" : "+"} Rp{" "}
            {row.amount.toLocaleString("id-ID")}
          </span>
        );
      },
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

          <div className="flex flex-wrap gap-2">
            {canManageFinance && (
              <>
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
                    <DropdownMenuItem onClick={downloadTemplate}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Download Template Upload
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
              </>
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
                {ledgerType === "umum" 
                  ? [...(CATEGORIES.income || []), ...(CATEGORIES.outcome || [])].map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </SelectItem>
                    ))
                  : [...(CATEGORIES.donation || []), ...(CATEGORIES.donation_outcome || [])].map((cat) => (
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
                Rp{" "}
                {sortedFilteredRecords
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
                Rp{" "}
                {sortedFilteredRecords
                  .filter((r) => ledgerType === "umum" ? r.type === "outcome" : r.type === "donation_outcome")
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
              <CardTitle className="text-sm font-medium">
                {ledgerType === "umum" ? "Saldo Umum" : "Sisa Saldo Donasi"}
              </CardTitle>
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
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            if (open) {
              setFormData({
                ...formData,
                type: ledgerType === "umum" ? "income" : "donation",
                category: "",
                amount: "",
                description: "",
              });
            }
            setIsAddOpen(open);
          }}>
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
                    onValueChange={(v: "income" | "outcome" | "donation" | "donation_outcome") =>
                      setFormData({ ...formData, type: v, category: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ledgerType === "umum" ? (
                        <>
                          <SelectItem value="income">Pemasukan</SelectItem>
                          <SelectItem value="outcome">Pengeluaran</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="donation">Uang Masuk Donasi</SelectItem>
                          <SelectItem value="donation_outcome">Pengeluaran Donasi</SelectItem>
                        </>
                      )}
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
                    !formData.category ||
                    addRecord.isPending
                  }
                  className="w-full"
                >
                  {addRecord.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {addRecord.isPending ? "Menyimpan..." : "Tambah Catatan"}
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
                <TabsList className="flex h-auto w-full flex-wrap md:w-auto">
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
                    onValueChange={(value: "income" | "outcome" | "donation" | "donation_outcome") => {
                      setEditType(value);
                    }}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {ledgerType === "umum" ? (
                          <>
                            <SelectItem value="income">Pemasukan</SelectItem>
                            <SelectItem value="outcome">Pengeluaran</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="donation">Uang Masuk Donasi</SelectItem>
                            <SelectItem value="donation_outcome">Pengeluaran Donasi</SelectItem>
                          </>
                        )}
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
        {/* Upload Excel Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={(open) => {
          setIsUploadOpen(open);
          if (!open) {
            setSelectedExcelFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {ledgerType === "umum" ? "Upload Data Keuangan dari Excel" : "Upload Data Donasi dari Excel"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Upload file Excel dengan format sesuai template.
              </p>
              
              <div className="p-3 bg-muted rounded-md text-sm">
                Data akan diupload ke: <strong>{ledgerType === "umum" ? "Laporan Keuangan Umum" : "Laporan Donasi"}</strong>
              </div>

              <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <div className="space-y-2">
                <Label>Pilih File Excel</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setSelectedExcelFile(file);
                  }}
                  disabled={isUploadLoading}
                />
              </div>

              {selectedExcelFile && (
                <Button 
                   className="w-full" 
                   onClick={() => setIsConfirmUploadOpen(true)}
                   disabled={isUploadLoading}
                >
                   Lanjutkan Upload
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Confirmation Modal for Excel Upload */}
        <AlertDialog open={isConfirmUploadOpen} onOpenChange={setIsConfirmUploadOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Upload Excel</AlertDialogTitle>
              <AlertDialogDescription>
                Anda akan mengupload file <strong>{selectedExcelFile?.name}</strong> ke{" "}
                <strong>{ledgerType === "umum" ? "Laporan Keuangan Umum" : "Laporan Donasi"}</strong>.
                Apakah Anda yakin?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUploadLoading}>Batal</AlertDialogCancel>
              <Button onClick={processExcelUpload} disabled={isUploadLoading}>
                {isUploadLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload Sekarang
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Category Management Dialog */}
        <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Kelola Kategori Keuangan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Add new category */}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nama Kategori</Label>
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nama kategori baru"
                  />
                </div>
                <div className="w-[180px] space-y-1">
                  <Label className="text-xs">Jenis</Label>
                  <Select value={newCategoryType} onValueChange={(v: "income" | "outcome" | "donation" | "donation_outcome") => setNewCategoryType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ledgerType === "umum" ? (
                        <>
                          <SelectItem value="income">Pemasukan</SelectItem>
                          <SelectItem value="outcome">Pengeluaran</SelectItem>
                        </>
                      ) : (
                        <>
                          <SelectItem value="donation">Uang Masuk Donasi</SelectItem>
                          <SelectItem value="donation_outcome">Pengeluaran Donasi</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!newCategoryName.trim()) return;
                    addCategory.mutate(
                      { name: newCategoryName.trim(), type: newCategoryType },
                      { onSuccess: () => setNewCategoryName("") }
                    );
                  }}
                  disabled={!newCategoryName.trim() || addCategory.isPending}
                >
                  {addCategory.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>

              {/* Income categories */}
              {ledgerType === "umum" && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-emerald-600">Pemasukan</h4>
                  <div className="space-y-1">
                    {categoriesData
                      ?.filter((c) => c.type === "income")
                      .map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <span className="text-sm capitalize">{cat.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteCategory.mutate(cat.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Outcome categories */}
              {ledgerType === "umum" && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-red-600">Pengeluaran</h4>
                  <div className="space-y-1">
                    {categoriesData
                      ?.filter((c) => c.type === "outcome")
                      .map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <span className="text-sm capitalize">{cat.name}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteCategory.mutate(cat.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Donation categories */}
              {ledgerType === "donasi" && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-blue-600">Kategori Donasi</h4>
                  <div className="space-y-1">
                    {categoriesData
                      ?.filter((c) => c.type === "donation" || c.type === "donation_outcome")
                      .map((cat) => (
                        <div key={cat.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <span className="text-sm capitalize">{cat.name} - {cat.type === "donation" ? "Uang Masuk" : "Pengeluaran"}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteCategory.mutate(cat.id)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
