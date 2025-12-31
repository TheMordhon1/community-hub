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
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Upload,
  Check,
  X,
  Eye,
  Loader2,
  Plus,
  Receipt,
  CreditCard,
} from "lucide-react";
import type { House, Profile } from "@/types/database";

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
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
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
  const { user, isAdmin, canManageContent, pengurusTitle } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitOpen, setIsSubmitOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    amount: "",
    description: "",
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
      let query = supabase
        .from("payments")
        .select(`
          *,
          houses!payments_house_id_fkey(id, block, number)
        `)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profiles for submitter and verifier
      const userIds = new Set<string>();
      data?.forEach((p) => {
        if (p.submitted_by) userIds.add(p.submitted_by);
        if (p.verified_by) userIds.add(p.verified_by);
      });

      let profiles: Record<string, any> = {};
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

  // Submit payment mutation
  const submitPayment = useMutation({
    mutationFn: async () => {
      if (!userHouse || !proofFile || !user) {
        throw new Error("Data tidak lengkap");
      }

      setIsUploading(true);

      // Upload proof image
      const fileExt = proofFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(fileName, proofFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(fileName);

      // Insert payment record
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
    mutationFn: async ({ paymentId, approved }: { paymentId: string; approved: boolean }) => {
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

      // If approved, create finance record
      if (approved) {
        const payment = payments?.find((p) => p.id === paymentId);
        if (payment) {
          await supabase.from("finance_records").insert({
            type: "income",
            amount: payment.amount,
            description: `Iuran ${MONTHS[payment.month - 1]} ${payment.year} - Rumah ${payment.house?.block}${payment.house?.number}`,
            category: "iuran",
            recorded_by: user?.id,
            payment_id: paymentId,
            transaction_date: new Date().toISOString().split("T")[0],
          });
        }
      }
    },
    onSuccess: (_, { approved }) => {
      toast.success(approved ? "Pembayaran diverifikasi" : "Pembayaran ditolak");
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedPayment(null);
    },
    onError: () => {
      toast.error("Gagal memperbarui status pembayaran");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Pembayaran Iuran</h1>
          <p className="text-muted-foreground">
            Kelola pembayaran iuran bulanan
          </p>
        </div>

        {userHouse && (
          <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="w-4 h-4 mr-2" />
                Upload Bukti Bayar
              </Button>
            </DialogTrigger>
            <DialogContent>
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
                      setFormData({ ...formData, description: e.target.value })
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pending</CardTitle>
            <Receipt className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments?.filter((p) => p.status === "pending").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Menunggu verifikasi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Terverifikasi</CardTitle>
            <Check className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {payments?.filter((p) => p.status === "paid").length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Bulan ini</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Iuran</CardTitle>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              Rp{" "}
              {(
                payments
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
        <CardHeader>
          <CardTitle>Daftar Pembayaran</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : payments && payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rumah</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Jumlah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-medium">
                      {payment.house?.block}
                      {payment.house?.number}
                    </TableCell>
                    <TableCell>
                      {MONTHS[payment.month - 1]} {payment.year}
                    </TableCell>
                    <TableCell>
                      Rp {payment.amount.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[payment.status]}>
                        {STATUS_LABELS[payment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(payment.created_at), "dd MMM yyyy", {
                        locale: localeId,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {payment.proof_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPayment(payment)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                        {canVerify && payment.status === "pending" && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() =>
                                verifyPayment.mutate({
                                  paymentId: payment.id,
                                  approved: true,
                                })
                              }
                            >
                              <Check className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() =>
                                verifyPayment.mutate({
                                  paymentId: payment.id,
                                  approved: false,
                                })
                              }
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Belum ada data pembayaran
            </div>
          )}
        </CardContent>
      </Card>

      {/* Proof Preview Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bukti Pembayaran</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Rumah:</span>{" "}
                  <span className="font-medium">
                    {selectedPayment.house?.block}
                    {selectedPayment.house?.number}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Periode:</span>{" "}
                  <span className="font-medium">
                    {MONTHS[selectedPayment.month - 1]} {selectedPayment.year}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Jumlah:</span>{" "}
                  <span className="font-medium">
                    Rp {selectedPayment.amount.toLocaleString("id-ID")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{" "}
                  <Badge className={STATUS_COLORS[selectedPayment.status]}>
                    {STATUS_LABELS[selectedPayment.status]}
                  </Badge>
                </div>
                {selectedPayment.description && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Keterangan:</span>{" "}
                    <span>{selectedPayment.description}</span>
                  </div>
                )}
              </div>

              {selectedPayment.proof_url && (
                <div className="border rounded-lg overflow-hidden">
                  <img
                    src={selectedPayment.proof_url}
                    alt="Bukti Pembayaran"
                    className="w-full max-h-96 object-contain bg-muted"
                  />
                </div>
              )}

              {canVerify && selectedPayment.status === "pending" && (
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    className="text-red-600"
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
  );
}