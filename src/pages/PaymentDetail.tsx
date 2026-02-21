import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  ArrowLeft,
  Receipt,
  Loader2,
  Share2,
  Home,
  Calendar,
  User,
  Check,
  X,
  ImageIcon,
  Info,
} from "lucide-react";
import type { Profile, House } from "@/types/database";
import { ShareDialog } from "@/components/ShareDialog";
import { getInitials } from "@/lib/utils";

interface PaymentWithDetails {
  id: string;
  house_id: string;
  amount: number;
  month: number;
  year: number;
  status: "pending" | "paid" | "overdue";
  proof_url: string | null;
  description: string | null;
  notes: string | null;
  submitted_by: string | null;
  verified_by: string | null;
  paid_at: string | null;
  verified_at: string | null;
  created_at: string;
  house?: House;
  submitter?: Profile;
  verifier?: Profile;
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
  pending:
    "bg-yellow-500/20 hover:bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  paid: "bg-green-500/20 hover:bg-green-500/20 text-green-700 border-green-500/30",
  overdue: "bg-red-500/20 hover:bg-red-500/20 text-red-700 border-red-500/30",
};

const STATUS_LABELS = {
  pending: "Menunggu Verifikasi",
  paid: "Terverifikasi",
  overdue: "Belum Bayar",
};

export default function PaymentDetail() {
  const { id } = useParams();
  const { user, isAdmin, hasFinanceAccess } = useAuth();
  const queryClient = useQueryClient();
  const [isShareOpen, setIsShareOpen] = useState(false);

  const canVerify = isAdmin() || hasFinanceAccess;

  const { data: payment, isLoading } = useQuery({
    queryKey: ["payment", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*, houses!payments_house_id_fkey(*)")
        .eq("id", id)
        .single();

      if (error) throw error;

      const result: PaymentWithDetails = {
        ...data,
        house: data.houses as House,
      };

      // Fetch submitter profile
      if (data.submitted_by) {
        const { data: submitter } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.submitted_by)
          .single();
        result.submitter = submitter as Profile;
      }

      // Fetch verifier profile
      if (data.verified_by) {
        const { data: verifier } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.verified_by)
          .single();
        result.verifier = verifier as Profile;
      }

      return result;
    },
    enabled: !!id,
  });

  const verifyMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const { error } = await supabase
        .from("payments")
        .update({
          status: approved ? "paid" : "overdue",
          verified_by: user?.id,
          verified_at: new Date().toISOString(),
          paid_at: approved ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) throw error;

      if (approved && payment) {
        await supabase.from("finance_records").insert({
          type: "income",
          amount: payment.amount,
          description: `Iuran ${MONTHS[payment.month - 1]} ${
            payment.year
          } - Rumah ${payment.house?.block}${payment.house?.number}`,
          category: "iuran",
          recorded_by: user?.id,
          payment_id: id,
          transaction_date: new Date().toISOString().split("T")[0],
        });
      }
    },
    onSuccess: (_, approved) => {
      toast.success(
        approved ? "Pembayaran diverifikasi" : "Pembayaran ditolak"
      );
      queryClient.invalidateQueries({ queryKey: ["payment", id] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: () => {
      toast.error("Gagal memperbarui status pembayaran");
    },
  });

  if (isLoading) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (!payment) {
    return (
      <section className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl">
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Receipt className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                Pembayaran Tidak Ditemukan
              </h3>
              <Button asChild className="mt-4">
                <Link to="/payments">Kembali ke Pembayaran</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  const shareText = `💰 Pembayaran Iuran\n\n🏠 Rumah: ${payment.house?.block}${
    payment.house?.number
  }\n📅 Periode: ${MONTHS[payment.month - 1]} ${
    payment.year
  }\n💵 Jumlah: Rp ${payment.amount.toLocaleString("id-ID")}\n📊 Status: ${
    STATUS_LABELS[payment.status]
  }`;
  const shareUrl = `${window.location.origin}/payments/${id}`;

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Link to="/payments">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <h1 className="font-display text-xl md:text-2xl font-bold">
              Detail IPL
            </h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsShareOpen(true)}
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </motion.div>

        {/* Payment Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Badge className={STATUS_COLORS[payment.status]}>
                    {STATUS_LABELS[payment.status]}
                  </Badge>
                  <CardTitle className="text-2xl">
                    Iuran {MONTHS[payment.month - 1]} {payment.year}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Rp {payment.amount.toLocaleString("id-ID")}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* House Info */}
              <div className="flex items-start gap-3">
                <Home className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Rumah</p>
                  <p className="text-muted-foreground">
                    Blok {payment.house?.block} No. {payment.house?.number}
                  </p>
                </div>
              </div>

              {/* Date Info */}
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Tanggal Pengajuan</p>
                  <p className="text-muted-foreground">
                    {format(
                      new Date(payment.created_at),
                      "d MMMM yyyy, HH:mm",
                      {
                        locale: idLocale,
                      }
                    )}
                  </p>
                </div>
              </div>

              {/* Submitter */}
              {payment.submitter && (
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Diajukan oleh</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={payment.submitter.avatar_url || ""} />
                        <AvatarFallback className="text-xs">
                          {getInitials(payment.submitter.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground">
                        {payment.submitter.full_name}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {payment.description && (
                <div className="space-y-2">
                  <p className="font-medium">Deskripsi</p>
                  <p className="text-muted-foreground">{payment.description}</p>
                </div>
              )}

              {/* Proof Image */}
              {payment.proof_url && (
                <div className="space-y-2">
                  <p className="font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Bukti Pembayaran
                  </p>
                  <div className="rounded-lg overflow-hidden border">
                    <img
                      src={payment.proof_url}
                      alt="Bukti pembayaran"
                      className="w-full max-h-96 object-contain bg-muted"
                    />
                  </div>
                  <div className="flex items-start gap-2 text-[10px] text-blue-700 bg-blue-50 p-2 rounded border border-blue-100 border-dashed">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <p>
                      Guna mengoptimalkan kapasitas penyimpanan cloud, file bukti pembayaran hanya tersedia selama 1 bulan sejak iuran dibayarkan.
                    </p>
                  </div>
                </div>
              )}

              {/* Verification Info */}
              {payment.verified_by && payment.verifier && (
                <div className="flex items-start gap-3 pt-4 border-t">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Diverifikasi oleh</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={payment.verifier.avatar_url || ""} />
                        <AvatarFallback className="text-xs">
                          {getInitials(payment.verifier.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground">
                        {payment.verifier.full_name}
                      </span>
                    </div>
                    {payment.verified_at && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {format(
                          new Date(payment.verified_at),
                          "d MMMM yyyy, HH:mm",
                          { locale: idLocale }
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons for Verification */}
              {canVerify && payment.status === "pending" && (
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    className="flex-1"
                    onClick={() => verifyMutation.mutate(true)}
                    disabled={verifyMutation.isPending}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4 mr-2" />
                    )}
                    Verifikasi
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => verifyMutation.mutate(false)}
                    disabled={verifyMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Tolak
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title={`Iuran ${MONTHS[payment.month - 1]} ${payment.year}`}
        description="Bagikan informasi pembayaran ini"
        url={shareUrl}
        shareText={shareText}
      />
    </section>
  );
}
