import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { FinanceRecordWithDetails } from "@/types/database";

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

interface ExportParams {
  ledgerType: "umum" | "donasi";
  filterMonth: string;
  filterYear: string;
  totalBalance: number;
  sortedFilteredRecords: FinanceRecordWithDetails[];
  groupedRecords: FinanceRecordWithDetails[];
}

interface TemplateParams {
  ledgerType: "umum" | "donasi";
  CATEGORIES: {
    income: string[];
    outcome: string[];
    donation: string[];
    donation_outcome: string[];
  };
}

export function useFinanceExport() {
  const exportToPDF = ({
    ledgerType,
    filterMonth,
    filterYear,
    totalBalance,
    sortedFilteredRecords,
  }: ExportParams) => {
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

  const exportToExcel = ({
    ledgerType,
    filterMonth,
    filterYear,
    totalBalance,
    sortedFilteredRecords,
    groupedRecords,
  }: ExportParams) => {
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

  const downloadTemplate = async ({ ledgerType, CATEGORIES }: TemplateParams) => {
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

  return {
    exportToPDF,
    exportToExcel,
    downloadTemplate,
  };
}
