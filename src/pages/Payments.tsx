"use client";

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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  Check,
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
  ArrowLeft,
  CalendarIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import type { House, Profile } from "@/types/database";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { Link, useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SortingFinance } from "@/types/finance";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";

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
  const { user, isAdmin, hasFinanceAccess } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const [sortBy, setSortBy] = useState<
    "date-newest" | "date-oldest" | "amount-asc" | "amount-desc"
  >("date-newest");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [uploadMode, setUploadMode] = useState<"self" | "other">("self");
  const [selectedHouseId, setSelectedHouseId] = useState<string>("");
  const [formData, setFormData] = useState({
    paymentDate: new Date(),
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
  const [bendaharaTab, setBendaharaTab] = useState<"all" | "mine">("all");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentItem | null>(
    null
  );
  const [editFormData, setEditFormData] = useState({
    paymentDate: new Date(),
    amount: "",
    description: "",
  });
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);

  // Only admin or users with finance access (bendahara) can verify
  const canVerify = isAdmin() || hasFinanceAccess;

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

  // Get all houses for finance users to upload for others
  const { data: allHouses } = useQuery({
    queryKey: ["all-houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("id, block, number")
        .order("block")
        .order("number");
      if (error) throw error;
      return data;
    },
    enabled: canVerify,
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
    const statusMatch = filterStatus === "all" || p.status === filterStatus;
    return monthMatch && yearMatch && statusMatch;
  });

  // Add sorting logic
  const sortedPayments = (() => {
    if (!filteredPayments) return [];

    const sorted = [...filteredPayments];

    switch (sortBy) {
      case "date-newest":
        sorted.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        break;
      case "date-oldest":
        sorted.sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
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

  const displayPayments =
    canVerify && bendaharaTab === "mine"
      ? sortedPayments?.filter((p) => p.house_id === userHouse?.id)
      : sortedPayments;

  // Submit payment mutation
  const submitPayment = useMutation({
    mutationFn: async () => {
      const targetHouseId =
        canVerify && uploadMode === "other" ? selectedHouseId : userHouse?.id;

      if (!targetHouseId || !proofFile || !user) {
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
        house_id: targetHouseId,
        amount: Number.parseFloat(formData.amount),
        month: formData.paymentDate.getMonth() + 1,
        year: formData.paymentDate.getFullYear(),
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
      setUploadMode("self");
      setSelectedHouseId("");
      setFormData({
        paymentDate: new Date(),
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
            } - Rumah ${payment.house?.block} - ${payment.house?.number}`,
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

  // Edit payment mutation
  const editPayment = useMutation({
    mutationFn: async () => {
      if (!editingPayment || !user) {
        throw new Error("Data tidak lengkap");
      }

      let proofUrl = editingPayment.proof_url;

      // Upload new proof if provided
      if (editProofFile) {
        setIsUploading(true);
        const fileExt = editProofFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("payment-proofs")
          .upload(fileName, editProofFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("payment-proofs")
          .getPublicUrl(fileName);

        proofUrl = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("payments")
        .update({
          amount: Number.parseFloat(editFormData.amount),
          month: editFormData.paymentDate.getMonth() + 1,
          year: editFormData.paymentDate.getFullYear(),
          description: editFormData.description,
          proof_url: proofUrl,
        })
        .eq("id", editingPayment.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pembayaran berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setIsEditOpen(false);
      setEditingPayment(null);
      setEditProofFile(null);
      setEditFormData({
        paymentDate: new Date(),
        amount: "",
        description: "",
      });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Gagal memperbarui pembayaran");
    },
    onSettled: () => {
      setIsUploading(false);
    },
  });

  // Delete payment mutation
  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pembayaran berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setDeletePaymentId(null);
    },
    onError: () => {
      toast.error("Gagal menghapus pembayaran");
    },
  });

  // Check if user can edit/delete a payment (own pending payments or admin for any pending)
  const canEditPayment = (payment: PaymentItem) => {
    if (payment.status !== "pending") return false;
    return payment.submitted_by === user?.id || isAdmin();
  };

  // Open edit dialog with payment data
  const openEditDialog = (payment: PaymentItem) => {
    setEditingPayment(payment);
    setEditFormData({
      paymentDate: new Date(payment.year, payment.month - 1, 1),
      amount: payment.amount.toString(),
      description: payment.description || "",
    });
    setIsEditOpen(true);
  };

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
💰 Nominal: *Rp ${Number.parseInt(reminderData.amount).toLocaleString("id-ID")}*
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
        : `${MONTHS[Number.parseInt(filterMonth) - 1]} ${filterYear}`;

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
      displayPayments
        ?.filter((p) => p.status === "paid")
        .reduce((sum, p) => sum + p.amount, 0) || 0;
    const totalPending =
      displayPayments?.filter((p) => p.status === "pending").length || 0;

    doc.setFontSize(11);
    doc.text(`Total Terbayar: Rp ${totalPaid.toLocaleString("id-ID")}`, 14, 52);
    doc.text(`Menunggu Verifikasi: ${totalPending} pembayaran`, 14, 60);

    const tableData =
      displayPayments?.map((p) => [
        `${p.house?.block} - ${p.house?.number}`,
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
      displayPayments?.map((p) => ({
        Rumah: `${p.house?.block} - ${p.house?.number}`,
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

  const columns: DataTableColumn<PaymentItem>[] = [
    {
      key: "house",
      label: "Rumah",
      className: "min-w-[160px] whitespace-nowrap",
      render: (_, row) => `${row.house?.block} - ${row.house?.number}`,
    },
    {
      key: "month",
      label: "Periode",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value, row) => `${MONTHS[(value as number) - 1]} ${row.year}`,
    },
    {
      key: "amount",
      label: "Jumlah",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value) => `Rp ${(value as number).toLocaleString("id-ID")}`,
    },
    {
      key: "status",
      label: "Status",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value) => (
        <Badge
          className={cn(
            "border-none",
            STATUS_COLORS[value as keyof typeof STATUS_COLORS]
          )}
        >
          {STATUS_LABELS[value as keyof typeof STATUS_LABELS]}
        </Badge>
      ),
    },
    {
      key: "created_at",
      label: "Tanggal",
      className: "min-w-[160px] whitespace-nowrap",
      render: (value) => format(new Date(value as string), "dd/MM/yyyy"),
    },
    {
      key: "id",
      label: "Aksi",
      className: "text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigate(`/payments/${row.id}`)}
            title="Lihat Detail & Verifikasi"
          >
            <Eye className="w-4 h-4 text-muted-foreground" />
          </Button>

          {/* EDIT & DELETE: Visible only for owner/admin if status is pending */}
          {canEditPayment(row) && (
            <div className="flex gap-1 border-l pl-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                onClick={(e) => {
                  e.stopPropagation();
                  openEditDialog(row);
                }}
              >
                <Pencil className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletePaymentId(row.id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ),
    },
  ];
  return (
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold">
                Pembayaran Iuran
              </h1>
              <p className="text-sm text-muted-foreground">
                Kelola pembayaran iuran bulanan
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canVerify && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 sm:mr-2" />
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

                <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <MessageCircle className="w-4 h-4 sm:mr-2" />
                      <span className="inline">Pengingat</span>
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
                                month: Number.parseInt(v),
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
                                year: Number.parseInt(v),
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
                          className="flex-1 bg-transparent"
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
                {[2024, 2025, 2026].map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="pending">Menunggu Verifikasi</SelectItem>
                <SelectItem value="paid">Terverifikasi</SelectItem>
                <SelectItem value="overdue">Belum Bayar</SelectItem>
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
                {displayPayments?.filter((p) => p.status === "pending")
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
                {displayPayments?.filter((p) => p.status === "paid").length ||
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
                  displayPayments
                    ?.filter((p) => p.status === "paid")
                    .reduce((sum, p) => sum + p.amount, 0) || 0
                ).toLocaleString("id-ID")}
              </div>
              <p className="text-xs text-muted-foreground">Total terkumpul</p>
            </CardContent>
          </Card>
        </div>

        {(userHouse || canVerify) && (
          <Dialog
            open={isSubmitOpen}
            onOpenChange={(open) => {
              setIsSubmitOpen(open);
              if (!open) {
                setUploadMode("self");
                setSelectedHouseId("");
              }
            }}
          >
            <div className="flex justify-end">
              <DialogTrigger asChild>
                <Button size="sm">
                  <Upload className="w-4 h-4" />
                  <span className="inline">Upload Bukti</span>
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Bukti Pembayaran</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Tab for finance users to choose self or other house */}
                {canVerify && (
                  <Tabs
                    value={uploadMode}
                    onValueChange={(v) => setUploadMode(v as "self" | "other")}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="self">Untuk Saya</TabsTrigger>
                      <TabsTrigger value="other">Untuk Rumah Lain</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}

                {/* House selector when uploading for others */}
                {canVerify && uploadMode === "other" && (
                  <div className="space-y-2">
                    <Label>Pilih Rumah</Label>
                    <Select
                      value={selectedHouseId}
                      onValueChange={setSelectedHouseId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih rumah..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allHouses?.map((house) => (
                          <SelectItem key={house.id} value={house.id}>
                            {house.block} - {house.number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Tanggal Pembayaran</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !formData.paymentDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.paymentDate ? (
                          format(formData.paymentDate, "dd MMMM yyyy", {
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
                        selected={formData.paymentDate}
                        onSelect={(date) =>
                          setFormData({
                            ...formData,
                            paymentDate: date || new Date(),
                          })
                        }
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
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
                    onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                  />
                  {proofFile && (
                    <p className="text-sm text-muted-foreground">
                      File: {proofFile.name}
                    </p>
                  )}
                </div>

                <Button
                  onClick={() => submitPayment.mutate()}
                  disabled={
                    !proofFile ||
                    !formData.amount ||
                    isUploading ||
                    (uploadMode === "self" && !userHouse) ||
                    (uploadMode === "other" && !selectedHouseId)
                  }
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

        {/* Payments Table */}
        {(userHouse || canVerify) && (
          <Card>
            <CardHeader className="pb-3 flex md:flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg">
                Daftar Pembayaran
              </CardTitle>

              {canVerify && (
                <Tabs
                  value={bendaharaTab}
                  onValueChange={(v) => setBendaharaTab(v as "all" | "mine")}
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="all">Kelola Semua IPL</TabsTrigger>
                    <TabsTrigger value="mine">IPL Saya</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            </CardHeader>{" "}
            <DataTable
              columns={columns}
              data={displayPayments || []}
              pageSize={10}
              isLoading={isLoading}
            />
          </Card>
        )}

        {/* Proof Preview Dialog - Removed as it's now handled in DataTable */}

        {/* Edit Payment Dialog */}
        <Dialog
          open={isEditOpen}
          onOpenChange={(open) => {
            setIsEditOpen(open);
            if (!open) {
              setEditingPayment(null);
              setEditProofFile(null);
            }
          }}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Pembayaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tanggal Pembayaran</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !editFormData.paymentDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {editFormData.paymentDate ? (
                        format(editFormData.paymentDate, "dd MMMM yyyy", {
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
                      selected={editFormData.paymentDate}
                      onSelect={(date) =>
                        setEditFormData({
                          ...editFormData,
                          paymentDate: date || new Date(),
                        })
                      }
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Jumlah (Rp)</Label>
                <Input
                  type="number"
                  value={editFormData.amount}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, amount: e.target.value })
                  }
                  placeholder="Contoh: 100000"
                />
              </div>

              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Textarea
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      description: e.target.value,
                    })
                  }
                  placeholder="Keterangan pembayaran (opsional)"
                />
              </div>

              <div className="space-y-2">
                <Label>Bukti Pembayaran (Opsional)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    setEditProofFile(e.target.files?.[0] || null)
                  }
                />
                {editingPayment?.proof_url && !editProofFile && (
                  <p className="text-xs text-muted-foreground">
                    Biarkan kosong jika tidak ingin mengubah bukti pembayaran
                  </p>
                )}
              </div>

              <Button
                onClick={() => editPayment.mutate()}
                disabled={!editFormData.amount || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengupload...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deletePaymentId}
          onOpenChange={() => setDeletePaymentId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Pembayaran</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus pembayaran ini? Tindakan ini
                tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={() => {
                  if (deletePaymentId) {
                    deletePayment.mutate(deletePaymentId);
                  }
                }}
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
