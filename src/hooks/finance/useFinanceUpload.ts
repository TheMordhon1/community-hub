import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

interface UploadParams {
  ledgerType: "umum" | "donasi";
  selectedExcelFile: File | null;
  CATEGORIES: {
    income: string[];
    outcome: string[];
    donation: string[];
    donation_outcome: string[];
  };
  onSuccess: () => void;
}

export function useFinanceUpload() {
  const [isUploadLoading, setIsUploadLoading] = useState(false);
  const queryClient = useQueryClient();

  const processExcelUpload = async ({
    ledgerType,
    selectedExcelFile,
    CATEGORIES,
    onSuccess,
  }: UploadParams) => {
    if (!selectedExcelFile) return;

    setIsUploadLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const data = await selectedExcelFile.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

      if (rows.length === 0) {
        toast.error("File Excel kosong");
        return;
      }

      const validTypes =
        ledgerType === "umum"
          ? ["income", "outcome"]
          : ["donation", "donation_outcome"];

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
          errors.push(
            `Baris ${rowNum}: Jenis harus ${
              ledgerType === "umum" ? "'income', 'outcome'" : "'donation', 'donation_outcome'"
            }`
          );
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
        toast.error(
          `Ada ${errors.length} kesalahan:\n${errors.slice(0, 3).join("\n")}`
        );
        return;
      }

      // Fetch existing records to deduplicate
      const { data: existingRecords } = await supabase
        .from("finance_records")
        .select("type, amount, category, description, transaction_date");

      const existingSet = new Set(
        (existingRecords || []).map(
          (r) =>
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
        toast.info(
          "Semua data sudah ada, tidak ada data baru untuk diupload"
        );
        return;
      }

      const skipped = records.length - newRecords.length;

      // Bulk insert only new records
      const { error } = await supabase.from("finance_records").insert(newRecords);
      if (error) throw error;

      const skippedMsg = skipped > 0 ? ` (${skipped} data duplikat dilewati)` : "";
      toast.success(
        `${newRecords.length} catatan berhasil diupload${skippedMsg}`
      );
      queryClient.invalidateQueries({ queryKey: ["finance-records"] });
      onSuccess();
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.message || "Gagal mengupload file");
    } finally {
      setIsUploadLoading(false);
    }
  };

  return { processExcelUpload, isUploadLoading };
}
