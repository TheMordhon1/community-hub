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
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Upload,
  Check,
  X,
  Eye,
  Loader2,
  Receipt,
  CreditCard,
  Download,
  FileText,
  FileSpreadsheet,
  MessageCircle,
  Copy,
  Send,
} from "lucide-react";
import type { House, Profile } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface PaymentItem {
  id: string;
  house_id: string;
  amount: number;
  month: number;
  year: number;
  status: "pending" | "paid" | "overdue";
  proof_url: string | null;
  description: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  created_at: string;
  house: { id: string; block: string; number: string } | null;
  submitter: Profile | null;
  verifier: Profile | null;
}

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

const STATUS_COLORS = {
  pending: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  paid: "bg-green-500/20 text-green-700 border-green-500/30",
  overdue: "bg-red-500/20 text-red-700 border-red-500/30",
};

const STATUS_LABELS = {
  pending: "Menunggu Verifikasi",
  paid: "Terverifikasi",
  overdue: "Belum Bayar",
};

export default function Payments() {
  const { user, isAdmin, pengurusTitle } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(
    null
  );
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(
    new Date().getFullYear().toString()
  );
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: "",
    description: "",
  });
  const [reminderData, setReminderData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: "100000",
    deadline: format(
      new Date(new Date().setDate(new Date().getDate() + 7)),
      "yyyy-MM-dd"
    ),
    bankAccount: "BSI 7263306915 a/n Bendahara",
  });

  const isBendahara = pengurusTitle === "bendahara";
  const canVerify = isAdmin() || isBendahara;

  // Get user's house
  const { data: userHouse } = useQuery({
    queryKey: ["user-house", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("house_residents")
        .select("house_id, houses(*)")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data?.houses as House;
    },
    enabled: !!user?.id,
  });

  // Fetch payments
  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(
          `
          *,
          houses!payments_house_id_fkey(id, block, number)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = new Set<string>();
      data?.forEach((p) => {
        if (p.submitted_by) userIds.add(p.submitted_by);
        if (p.verified_by) userIds.add(p.verified_by);
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

      return data?.map((p) => ({
        ...p,
        house: p.houses as { id: string; block: string; number: string } | null,
        submitter: p.submitted_by ? profiles[p.submitted_by] : null,
        verifier: p.verified_by ? profiles[p.verified_by] : null,
      }));
    },
  });

  // Filter payments
  const filteredPayments = payments?.filter((p) => {
    const monthMatch =
      filterMonth === "all" || p.month.toString() === filterMonth;
    const yearMatch = p.year.toString() === filterYear;
    return monthMatch && yearMatch;
  });

  // Submit payment mutation
  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!userHouse || !proofFile || !user) {
        throw new Error("Data tidak lengkap");
      }

      setIsUploading(true);

      const fileExt = proofFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(fileName);

      const { error } = await supabase.from("payments").insert({
        house_id: userHouse.id,
        amount: parseFloat(formData.amount),
        month: formData.month,
        year: formData.year,
        description: formData.description,
        proof_url: urlData.publicUrl,
        submitted_by: user.id,
        status: "pending",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bukti pembayaran berhasil dikirim");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIsSubmitOpen(false);
      setProofFile(null);
      setFormData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        amount: "",
        description: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Gagal mengirim bukti pembayaran");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Verify payment mutation
  const verifyPayment = useMutation({
    mutationFn: async ({
      paymentId,
      approved,
    }: {
      paymentId: string;
      approved: boolean;
    }) => {
      const { error } = await supabase
        .from("payments")
        .update({
          status: approved ? "paid" : "overdue",
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          paid_at: approved ? new Date().toISOString() : null,
        })
        .eq("id", paymentId);

      if (error) throw error;

      if (approved) {
        const payment = payments?.find((p) => p.id === paymentId);
        if (payment) {
          await supabase.from("finance_records").insert({
            type: "income",
            amount: payment.amount,
            description: `Iuran ${MONTHS[payment.month - 1]} ${
              payment.year
            } - Rumah ${payment.house?.block}${payment.house?.number}`,
            category: "iuran",
            recorded_by: user?.id,
            payment_id: paymentId,
            transaction_date: new Date().toISOString().split("T")[0],
          });
        }
      }
    },
    onSuccess: (_, { approved }) => {
      toast.success(
        approved ? "Pembayaran diverifikasi" : "Pembayaran ditolak"
      );
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedPayment(null);
    },
    onError: () => {
      toast.error("Gagal memperbarui status pembayaran");
    },
  });

  // Generate reminder message
  const generateReminderMessage = () => {
    const deadlineFormatted = format(
      new Date(reminderData.deadline),
      "dd MMMM yyyy",
      { locale: localeId }
    );
    return `🏠 *PENGINGAT IURAN BULANAN*

Assalamualaikum Wr. Wb.

Bapak/Ibu Warga PKT yang terhormat,

Dengan hormat, kami ingatkan untuk pembayaran *Iuran Bulanan* periode *${
      MONTHS[reminderData.month - 1]
    } ${reminderData.year}*.

📋 *Detail Pembayaran:*
💰 Nominal: *Rp ${parseInt(reminderData.amount).toLocaleString("id-ID")}*
📅 Batas Waktu: *${deadlineFormatted}*
🏦 Transfer ke: *${reminderData.bankAccount}*

📌 *Langkah Pembayaran:*
1. Transfer ke rekening di atas
2. Simpan bukti transfer
3. Upload bukti pembayaran melalui aplikasi Warga PKT

Mohon kerjasamanya bapak ibu yang terhormat.

Terima kasih atas perhatian dan kerjasamanya. 🙏

Wassalamualaikum Wr. Wb.

_Bendahara_
_Paguyuban Nijuuroku_`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generateReminderMessage());
    toast.success("Pesan berhasil disalin ke clipboard");
  };

  const shareToWhatsApp = () => {
    const message = encodeURIComponent(generateReminderMessage());
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const periodText =
      filterMonth === "all"
        ? `Tahun ${filterYear}`
        : `${MONTHS[parseInt(filterMonth) - 1]} ${filterYear}`;

    doc.setFontSize(18);
    doc.text("Laporan Pembayaran Iuran", 14, 22);
    doc.setFontSize(12);
    doc.text(`Periode: ${periodText}`, 14, 32);
    doc.text(
      `Tanggal Cetak: ${format(new Date(), "dd MMMM yyyy", {
        locale: localeId,
      })}`,
      14,
      40
    );

    const totalPaid =
      filteredPayments
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalPending =
      filteredPayments?.filter((p) => p.status === "pending").length || 0;

    doc.setFontSize(11);
    doc.text(`Total Terbayar: Rp ${totalPaid.toLocaleString("id-ID")}`, 14, 52);
    doc.text(`Menunggu Verifikasi: ${totalPending} pembayaran`, 14, 60);

    const tableData =
      filteredPayments?.map((p) => [
        `${p.house?.block}${p.house?.number}`,
        `${MONTHS[p.month - 1]} ${p.year}`,
        `Rp ${p.amount.toLocaleString("id-ID")}`,
        STATUS_LABELS[p.status],
        format(new Date(p.created_at), "dd/MM/yyyy"),
      ]) || [];

    autoTable(doc, {
      startY: 70,
      head: [["Rumah", "Periode", "Jumlah", "Status", "Tanggal"]],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(
      `laporan-iuran-${filterYear}-${
        filterMonth === "all" ? "tahunan" : filterMonth
      }.pdf`
    );
    toast.success("Laporan PDF berhasil diunduh");
  };

  // Export to Excel
  const exportToExcel = () => {
    const data =
      filteredPayments?.map((p) => ({
        Rumah: `${p.house?.block}${p.house?.number}`,
        Periode: `${MONTHS[p.month - 1]} ${p.year}`,
        Jumlah: p.amount,
        Status: STATUS_LABELS[p.status],
        Tanggal: format(new Date(p.created_at), "dd/MM/yyyy"),
      })) || [];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Iuran");
    XLSX.writeFile(
      wb,
      `laporan-iuran-${filterYear}-${
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
          <div>
            <h1 className="text-xl sm:text-2xl font-display font-bold">
              Pembayaran Iuran
            </h1>
            <p className="text-sm text-muted-foreground">
              Kelola pembayaran iuran bulanan
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canVerify && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 sm:mr-2" />
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

                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="w-4 h-4 sm:mr-2" />
                      <span className="hidden sm:inline">Pengingat</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Template Pengingat Iuran</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-xs">Bulan</Label>
                          <Select
                            value={reminderData.month.toString()}
                            onValueChange={(v) =>
                              setReminderData({
                                ...reminderData,
                                month: parseInt(v),
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map((m, i) => (
                                <SelectItem key={i} value={(i + 1).toString()}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Tahun</Label>
                          <Select
                            value={reminderData.year.toString()}
                            onValueChange={(v) =>
                              setReminderData({
                                ...reminderData,
                                year: parseInt(v),
                              })
                            }
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue />
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
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Nominal Iuran (Rp)</Label>
                        <Input
                          type="number"
                          value={reminderData.amount}
                          onChange={(e) =>
                            setReminderData({
                              ...reminderData,
                              amount: e.target.value,
                            })
                          }
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">
                          Batas Waktu Pembayaran
                        </Label>
                        <Input
                          type="date"
                          value={reminderData.deadline}
                          onChange={(e) =>
                            setReminderData({
                              ...reminderData,
                              deadline: e.target.value,
                            })
                          }
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Rekening Tujuan</Label>
                        <Input
                          value={reminderData.bankAccount}
                          onChange={(e) =>
                            setReminderData({
                              ...reminderData,
                              bankAccount: e.target.value,
                            })
                          }
                          placeholder="BCA 1234567890 a/n Nama"
                          className="h-9"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs">Preview Pesan</Label>
                        <div className="bg-muted p-3 rounded-lg text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {generateReminderMessage()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={copyToClipboard}
                          className="flex-1"
                          size="sm"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Salin
                        </Button>
                        <Button
                          onClick={shareToWhatsApp}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                          size="sm"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}

            {userHouse && (
              <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Upload className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Upload Bukti</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Bulan</Label>
                        <Select
                          value={formData.month.toString()}
                          onValueChange={(v) =>
                            setFormData({ ...formData, month: parseInt(v) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MONTHS.map((m, i) => (
                              <SelectItem key={i} value={(i + 1).toString()}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Tahun</Label>
                        <Select
                          value={formData.year.toString()}
                          onValueChange={(v) =>
                            setFormData({ ...formData, year: parseInt(v) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
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
                    </div>

                    <div className="space-y-2">
                      <Label>Jumlah (Rp)</Label>
                      <Input
                        type="number"
                        value={formData.amount}
                        onChange={(e) =>
                          setFormData({ ...formData, amount: e.target.value })
                        }
                        placeholder="Contoh: 100000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Keterangan</Label>
                      <Textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Keterangan pembayaran (opsional)"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Bukti Pembayaran</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) =>
                          setProofFile(e.target.files?.[0] || null)
                        }
                      />
                      {proofFile && (
                        <p className="text-sm text-muted-foreground">
                          File: {proofFile.name}
                        </p>
                      )}
                    </div>

                    <Button
                      onClick={() => submitPayment.mutate()}
                      disabled={!proofFile || !formData.amount || isUploading}
                      className="w-full"
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Mengunggah...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Kirim Bukti Pembayaran
                        </>
                      )}
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

        {/* Stats Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Pending
              </CardTitle>
              <Receipt className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">
                {filteredPayments?.filter((p) => p.status === "pending")
                  .length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Menunggu verifikasi
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Terverifikasi
              </CardTitle>
              <Check className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">
                {filteredPayments?.filter((p) => p.status === "paid").length ||
                  0}
              </div>
              <p className="text-xs text-muted-foreground">Pembayaran</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Iuran</CardTitle>
              <CreditCard className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-lg sm:text-2xl font-bold">
                Rp{" "}
                {(
                  filteredPayments
                    ?.filter((p) => p.status === "paid")
                    .reduce((sum, p) => sum + p.amount, 0) || 0
                ).toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-muted-foreground">Total terkumpul</p>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg">
              Daftar Pembayaran
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : filteredPayments && filteredPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Rumah</TableHead>
                      <TableHead className="text-xs">Periode</TableHead>
                      <TableHead className="text-xs hidden sm:table-cell">
                        Jumlah
                      </TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium text-xs sm:text-sm py-2">
                          {payment.house?.block}
                          {payment.house?.number}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm py-2">
                          <span className="hidden sm:inline">
                            {MONTHS[payment.month - 1]}
                          </span>
                          <span className="sm:hidden">
                            {MONTHS[payment.month - 1].slice(0, 3)}
                          </span>{" "}
                          {payment.year}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          Rp {payment.amount.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            className={`${
                              STATUS_COLORS[payment.status]
                            } text-xs`}
                          >
                            <span className="hidden sm:inline">
                              {STATUS_LABELS[payment.status]}
                            </span>
                            <span className="sm:hidden">
                              {payment.status === "pending"
                                ? "Pending"
                                : payment.status === "paid"
                                ? "Lunas"
                                : "Belum"}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <div className="flex justify-end gap-1">
                            {payment.proof_url && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => setSelectedPayment(payment)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            )}
                            {canVerify && payment.status === "pending" && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-green-600 hover:bg-green-50"
                                  onClick={() =>
                                    verifyPayment.mutate({
                                      paymentId: payment.id,
                                      approved: true,
                                    })
                                  }
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                  onClick={() =>
                                    verifyPayment.mutate({
                                      paymentId: payment.id,
                                      approved: false,
                                    })
                                  }
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Belum ada data pembayaran
              </div>
            )}
          </CardContent>
        </Card>

        {/* Proof Preview Dialog */}
        <Dialog
          open={!!selectedPayment}
          onOpenChange={() => setSelectedPayment(null)}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Bukti Pembayaran</DialogTitle>
            </DialogHeader>
            {selectedPayment && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Rumah:
                    </span>{" "}
                    <span className="font-medium">
                      {selectedPayment.house?.block}
                      {selectedPayment.house?.number}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Periode:
                    </span>{" "}
                    <span className="font-medium">
                      {MONTHS[selectedPayment.month - 1]} {selectedPayment.year}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Jumlah:
                    </span>{" "}
                    <span className="font-medium">
                      Rp {selectedPayment.amount.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">
                      Status:
                    </span>{" "}
                    <Badge className={STATUS_COLORS[selectedPayment.status]}>
                      {STATUS_LABELS[selectedPayment.status]}
                    </Badge>
                  </div>
                  {selectedPayment.description && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground text-xs">
                        Keterangan:
                      </span>{" "}
                      <span className="text-sm">
                        {selectedPayment.description}
                      </span>
                    </div>
                  )}
                </div>

                {selectedPayment.proof_url && (
                  <div className="border rounded-lg overflow-hidden">
                    <img
                      src={selectedPayment.proof_url}
                      alt="Bukti Pembayaran"
                      className="w-full max-h-80 object-contain bg-muted"
                    />
                  </div>
                )}

                {canVerify && selectedPayment.status === "pending" && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      className="text-red-600"
                      size="sm"
                      onClick={() =>
                        verifyPayment.mutate({
                          paymentId: selectedPayment.id,
                          approved: false,
                        })
                      }
                    >
                      <X className="w-4 h-4 mr-2" />
                      Tolak
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                      onClick={() =>
                        verifyPayment.mutate({
                          paymentId: selectedPayment.id,
                          approved: true,
                        })
                      }
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Verifikasi
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
