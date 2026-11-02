import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Loader2,
  Users,
  Phone,
  Mail,
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  CalendarRange,
  UserPlus,
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  formatPeriodRange,
  getPeriodErrorMessage,
  useActivatePeriod,
  useAllProfiles,
  useCreatePeriod,
  useDeletePeriod,
  useOrganizationPeriods,
  usePengurusTitles,
  usePeriodMembers,
  useRemovePeriodMember,
  useUpdatePeriod,
  useUpsertPeriodMember,
  type OrganizationPeriod,
  type PeriodMember,
} from "@/hooks/useOrganizationPeriods";
import { PeriodFormDialog } from "@/components/organization/PeriodFormDialog";
import { PeriodMemberDialog } from "@/components/organization/PeriodMemberDialog";

type ConfirmAction =
  | { kind: "activate"; period: OrganizationPeriod }
  | { kind: "delete-period"; period: OrganizationPeriod }
  | { kind: "remove-member"; member: PeriodMember };

export default function OrganizationStructure() {
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: periods = [], isLoading: periodsLoading } = useOrganizationPeriods();
  const activePeriod = periods.find((p) => p.is_active) ?? null;
  const requestedId = searchParams.get("periode");
  const selectedPeriod =
    periods.find((p) => p.id === requestedId) ?? activePeriod ?? periods[0] ?? null;

  const { data: members = [], isLoading: membersLoading } = usePeriodMembers(selectedPeriod?.id ?? null);
  const { data: titles = [] } = usePengurusTitles();
  const { data: profiles = [] } = useAllProfiles(admin);

  const createPeriod = useCreatePeriod();
  const updatePeriod = useUpdatePeriod();
  const deletePeriod = useDeletePeriod();
  const activatePeriod = useActivatePeriod();
  const upsertMember = useUpsertPeriodMember();
  const removeMember = useRemovePeriodMember();

  const [periodDialog, setPeriodDialog] = useState<{ open: boolean; period: OrganizationPeriod | null }>({ open: false, period: null });
  const [memberDialog, setMemberDialog] = useState<{ open: boolean; member: PeriodMember | null }>({ open: false, member: null });
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  const selectPeriod = (id: string) => {
    if (activePeriod && id === activePeriod.id) setSearchParams({});
    else setSearchParams({ periode: id });
  };

  const fail = (e: unknown) =>
    toast({ variant: "destructive", title: "Gagal", description: getPeriodErrorMessage(e) });

  const existingUserIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const handlePeriodSubmit = (input: Parameters<typeof createPeriod.mutate>[0]["input"], copyFrom: string | null) => {
    if (periodDialog.period) {
      updatePeriod.mutate(
        { id: periodDialog.period.id, input },
        {
          onSuccess: () => {
            toast({ title: "Periode diperbarui" });
            setPeriodDialog({ open: false, period: null });
          },
          onError: fail,
        },
      );
    } else {
      createPeriod.mutate(
        { input, copyFromPeriodId: copyFrom },
        {
          onSuccess: (period) => {
            toast({ title: "Periode dibuat", description: "Periode belum aktif. Aktifkan saat siap digunakan." });
            setPeriodDialog({ open: false, period: null });
            setSearchParams({ periode: period.id });
          },
          onError: fail,
        },
      );
    }
  };

  const handleMemberSubmit = (userId: string, titleId: string) => {
    if (!selectedPeriod) return;
    upsertMember.mutate(
      { period_id: selectedPeriod.id, user_id: userId, title_id: titleId },
      {
        onSuccess: () => {
          toast({ title: memberDialog.member ? "Jabatan diperbarui" : "Pengurus ditambahkan" });
          setMemberDialog({ open: false, member: null });
        },
        onError: fail,
      },
    );
  };

  const runConfirm = () => {
    if (!confirm) return;
    const done = () => setConfirm(null);
    if (confirm.kind === "activate") {
      activatePeriod.mutate(confirm.period.id, {
        onSuccess: () => {
          toast({ title: "Periode diaktifkan", description: `${confirm.period.name} sekarang menjadi kepengurusan aktif.` });
          setSearchParams({});
          done();
        },
        onError: (e) => { fail(e); done(); },
      });
    } else if (confirm.kind === "delete-period") {
      deletePeriod.mutate(confirm.period.id, {
        onSuccess: () => {
          toast({ title: "Periode dihapus" });
          setSearchParams({});
          done();
        },
        onError: (e) => { fail(e); done(); },
      });
    } else {
      removeMember.mutate(confirm.member.id, {
        onSuccess: () => { toast({ title: "Pengurus dihapus dari periode" }); done(); },
        onError: (e) => { fail(e); done(); },
      });
    }
  };

  const confirmText = (() => {
    if (!confirm) return { title: "", desc: "", action: "" };
    if (confirm.kind === "activate")
      return {
        title: `Aktifkan ${confirm.period.name}?`,
        desc: "Hak akses pengurus akan dipindahkan ke anggota periode ini. Pengurus dari periode lain akan kembali menjadi warga biasa.",
        action: "Aktifkan",
      };
    if (confirm.kind === "delete-period")
      return {
        title: `Hapus ${confirm.period.name}?`,
        desc: "Periode beserta seluruh susunan pengurusnya akan dihapus permanen.",
        action: "Hapus",
      };
    return {
      title: `Hapus ${confirm.member.full_name}?`,
      desc: selectedPeriod?.is_active
        ? "Orang ini akan dihapus dari periode aktif dan kehilangan hak akses pengurus."
        : "Orang ini akan dihapus dari susunan pengurus periode ini.",
      action: "Hapus",
    };
  })();

  const isConfirmBusy = activatePeriod.isPending || deletePeriod.isPending || removeMember.isPending;

  return (
    <section className="min-h-screen bg-background p-3 sm:p-4 md:p-6">
      <div className="mx-auto space-y-4 sm:space-y-6 min-w-0">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="space-y-1">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link to="/dashboard" aria-label="Kembali" className="shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="font-display text-xl md:text-2xl font-bold">Pengurus Paguyuban</h1>
              <p className="text-sm text-muted-foreground">Susunan pengurus Paguyuban Nijuuroku per periode</p>
            </div>
          </div>
        </motion.div>

        {/* Period selector */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CalendarRange className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Periode</p>
                  {periodsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : periods.length > 0 ? (
                    <Select value={selectedPeriod?.id} onValueChange={selectPeriod}>
                      <SelectTrigger className="w-full md:w-80 h-auto min-h-10 py-2 text-left [&>span]:min-w-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {periods.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex flex-col min-w-0">
                              <span className="truncate font-medium">
                                {p.name}
                                {p.is_active ? " • Aktif" : ""}
                              </span>
                              <span className="truncate text-xs text-muted-foreground">{formatPeriodRange(p)}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm">Belum ada periode</p>
                  )}
                </div>
              </div>
              {admin && (
                <Button className="w-full md:w-auto shrink-0" onClick={() => setPeriodDialog({ open: true, period: null })}>
                  <Plus className="w-4 h-4 mr-2" />
                  Periode Baru
                </Button>
              )}
            </div>

            {selectedPeriod && (
              <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                {selectedPeriod.is_active ? (
                  <Badge className="bg-primary text-primary-foreground">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Periode Aktif
                  </Badge>
                ) : (
                  <Badge variant="secondary">Tidak Aktif</Badge>
                )}
                <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarRange className="w-3.5 h-3.5" />
                  {formatPeriodRange(selectedPeriod)}
                </span>
                <span className="text-sm text-muted-foreground">• {members.length} pengurus</span>
                {selectedPeriod.notes && (
                  <span className="text-sm text-muted-foreground break-words basis-full sm:basis-auto">{selectedPeriod.notes}</span>
                )}
                {admin && (
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto [&>button]:flex-1 sm:[&>button]:flex-none">
                    {!selectedPeriod.is_active && (
                      <Button size="sm" onClick={() => setConfirm({ kind: "activate", period: selectedPeriod })}>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Jadikan Aktif
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => setPeriodDialog({ open: true, period: selectedPeriod })}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Ubah
                    </Button>
                    {!selectedPeriod.is_active && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirm({ kind: "delete-period", period: selectedPeriod })}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Hapus
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
            {admin && selectedPeriod && !selectedPeriod.is_active && (
              <p className="text-xs text-muted-foreground">
                Hak akses pengurus hanya berlaku untuk periode aktif. Susunan di periode ini belum memberikan akses apa pun.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Pengurus List */}
        <Card>
          <CardHeader className="flex flex-row items-start sm:items-center justify-between gap-3 space-y-0 p-4 sm:p-6">
            <div className="min-w-0">
              <CardTitle className="font-display">Daftar Pengurus</CardTitle>
              {selectedPeriod && (
                <CardDescription className="break-words">
                  {selectedPeriod.name} · {formatPeriodRange(selectedPeriod)}
                </CardDescription>
              )}
            </div>
            {admin && selectedPeriod && (
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setMemberDialog({ open: true, member: null })}>
                <UserPlus className="w-4 h-4 mr-2" />
                Tambah
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            {periodsLoading || membersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : members.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {members.map((person, index) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index, 10) * 0.05 }}
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12 shrink-0">
                            {person.avatar_url ? (
                              <AvatarImage src={person.avatar_url} alt={person.full_name} />
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {getInitials(person.full_name)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold line-clamp-1">{person.full_name}</p>
                            <Badge className="mt-1 bg-accent text-accent-foreground">{person.title_display_name}</Badge>
                            {person.title_description && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{person.title_description}</p>
                            )}
                          </div>
                          {admin && (
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Ubah jabatan"
                                onClick={() => setMemberDialog({ open: true, member: person })}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                aria-label="Hapus dari periode"
                                onClick={() => setConfirm({ kind: "remove-member", member: person })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 mt-4">
                          {person.phone && (
                            <Button variant="outline" size="sm" className="flex-1" asChild>
                              <a
                                href={`https://wa.me/${person.phone.replace(/\D/g, "").replace(/^0/, "62")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Phone className="w-4 h-4 mr-2" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          <Button variant="outline" size="sm" className="flex-1" asChild>
                            <a href={`mailto:${person.email}`}>
                              <Mail className="w-4 h-4 mr-2" />
                              Email
                            </a>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Belum ada pengurus pada periode ini</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {admin && (
        <>
          <PeriodFormDialog
            open={periodDialog.open}
            onOpenChange={(open) => setPeriodDialog((s) => ({ ...s, open }))}
            period={periodDialog.period}
            periods={periods}
            defaultCopyFromId={activePeriod?.id ?? null}
            isSaving={createPeriod.isPending || updatePeriod.isPending}
            onSubmit={handlePeriodSubmit}
          />
          <PeriodMemberDialog
            open={memberDialog.open}
            onOpenChange={(open) => setMemberDialog((s) => ({ ...s, open }))}
            member={memberDialog.member}
            existingUserIds={existingUserIds}
            profiles={profiles}
            titles={titles}
            isSaving={upsertMember.isPending}
            onSubmit={handleMemberSubmit}
          />
        </>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && !isConfirmBusy && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmText.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmText.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isConfirmBusy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={isConfirmBusy}
              onClick={(e) => {
                e.preventDefault();
                runConfirm();
              }}
              className={confirm?.kind === "activate" ? undefined : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {isConfirmBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmText.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
