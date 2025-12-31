import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  MessageSquare,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Complaint, ComplaintStatus, Profile } from "@/types/database";

interface ComplaintWithProfile extends Complaint {
  profile?: Profile;
}

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: "Menunggu",
    color: "bg-warning/10 text-warning",
    icon: Clock,
  },
  in_progress: {
    label: "Diproses",
    color: "bg-info/10 text-info",
    icon: AlertCircle,
  },
  resolved: {
    label: "Selesai",
    color: "bg-success/10 text-success",
    icon: CheckCircle,
  },
};

export default function Complaints() {
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] =
    useState<ComplaintWithProfile | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [response, setResponse] = useState("");
  const [newStatus, setNewStatus] = useState<ComplaintStatus>("pending");

  const { data: complaints, isLoading } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const { data: complaintsData, error } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for each complaint
      const userIds = [...new Set(complaintsData.map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      const complaintsWithProfiles: ComplaintWithProfile[] = complaintsData.map(
        (complaint) => ({
          ...complaint,
          profile: profiles?.find((p) => p.id === complaint.user_id),
        })
      );

      return complaintsWithProfiles;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; description: string }) => {
      const { error } = await supabase.from("complaints").insert({
        title: data.title,
        description: data.description,
        user_id: user?.id,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast({ title: "Berhasil", description: "Pengaduan berhasil dikirim" });
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal mengirim pengaduan",
      });
    },
  });

  const respondMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      status: ComplaintStatus;
      response: string;
    }) => {
      const { error } = await supabase
        .from("complaints")
        .update({
          status: data.status,
          response: data.response,
          responded_by: user?.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      toast({ title: "Berhasil", description: "Tanggapan berhasil disimpan" });
      setSelectedComplaint(null);
      setResponse("");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menyimpan tanggapan",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setIsCreateOpen(false);
  };

  const handleSubmit = () => {
    if (!title.trim() || !description.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Judul dan deskripsi wajib diisi",
      });
      return;
    }
    createMutation.mutate({ title, description });
  };

  const handleRespond = () => {
    if (!selectedComplaint) return;
    respondMutation.mutate({
      id: selectedComplaint.id,
      status: newStatus,
      response,
    });
  };

  const myComplaints = complaints?.filter((c) => c.user_id === user?.id) || [];
  const allComplaints = complaints || [];

  const getStatusBadge = (status: ComplaintStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge variant="secondary" className={config.color}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">Pengaduan</h1>
              <p className="text-muted-foreground">
                Sampaikan keluhan atau saran Anda
              </p>
            </div>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Buat Pengaduan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Buat Pengaduan Baru</DialogTitle>
                <DialogDescription>
                  Sampaikan keluhan atau saran Anda kepada pengurus
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Judul</Label>
                  <Input
                    id="title"
                    placeholder="Ringkasan pengaduan"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Deskripsi</Label>
                  <Textarea
                    id="description"
                    placeholder="Jelaskan pengaduan Anda secara detail..."
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetForm}>
                  Batal
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  <Send className="w-4 h-4 mr-2" />
                  Kirim
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </motion.div>

        {/* Complaints */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs
            defaultValue={canManageContent() ? "all" : "my"}
            className="space-y-4"
          >
            <TabsList>
              <TabsTrigger value="my">
                Pengaduan Saya ({myComplaints.length})
              </TabsTrigger>
              {canManageContent() && (
                <TabsTrigger value="all">
                  Semua Pengaduan ({allComplaints.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="my" className="space-y-4">
              {myComplaints.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center justify-center text-center">
                    <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">
                      Belum Ada Pengaduan
                    </h3>
                    <p className="text-muted-foreground">
                      Anda belum membuat pengaduan
                    </p>
                  </CardContent>
                </Card>
              ) : (
                myComplaints.map((complaint, index) => (
                  <ComplaintCard
                    key={complaint.id}
                    complaint={complaint}
                    index={index}
                    showUser={false}
                    getStatusBadge={getStatusBadge}
                  />
                ))
              )}
            </TabsContent>

            {canManageContent() && (
              <TabsContent value="all" className="space-y-4">
                {allComplaints.length === 0 ? (
                  <Card className="py-12">
                    <CardContent className="flex flex-col items-center justify-center text-center">
                      <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">
                        Belum Ada Pengaduan
                      </h3>
                      <p className="text-muted-foreground">
                        Belum ada pengaduan dari warga
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  allComplaints.map((complaint, index) => (
                    <ComplaintCard
                      key={complaint.id}
                      complaint={complaint}
                      index={index}
                      showUser={true}
                      getStatusBadge={getStatusBadge}
                      onRespond={() => {
                        setSelectedComplaint(complaint);
                        setNewStatus(complaint.status);
                        setResponse(complaint.response || "");
                      }}
                    />
                  ))
                )}
              </TabsContent>
            )}
          </Tabs>
        )}

        {/* Respond Dialog */}
        <Dialog
          open={!!selectedComplaint}
          onOpenChange={(open) => !open && setSelectedComplaint(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tanggapi Pengaduan</DialogTitle>
              <DialogDescription>{selectedComplaint?.title}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-1">
                  Pengaduan dari {selectedComplaint?.profile?.full_name}:
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedComplaint?.description}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as ComplaintStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    <SelectItem value="pending">Menunggu</SelectItem>
                    <SelectItem value="in_progress">Diproses</SelectItem>
                    <SelectItem value="resolved">Selesai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="response">Tanggapan</Label>
                <Textarea
                  id="response"
                  placeholder="Tulis tanggapan..."
                  rows={4}
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedComplaint(null)}
              >
                Batal
              </Button>
              <Button
                onClick={handleRespond}
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}

function ComplaintCard({
  complaint,
  index,
  showUser,
  getStatusBadge,
  onRespond,
}: {
  complaint: ComplaintWithProfile;
  index: number;
  showUser: boolean;
  getStatusBadge: (status: ComplaintStatus) => React.ReactNode;
  onRespond?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              {getStatusBadge(complaint.status)}
              <CardTitle className="text-lg mt-2">{complaint.title}</CardTitle>
              <CardDescription>
                {showUser &&
                  complaint.profile &&
                  `${complaint.profile.full_name} • `}
                {format(new Date(complaint.created_at), "d MMMM yyyy, HH:mm", {
                  locale: idLocale,
                })}
              </CardDescription>
            </div>
            {onRespond && (
              <Button variant="outline" size="sm" onClick={onRespond}>
                Tanggapi
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-foreground">{complaint.description}</p>
          {complaint.response && (
            <div className="p-3 bg-primary/5 rounded-lg border-l-4 border-primary">
              <p className="text-sm font-medium text-primary mb-1">
                Tanggapan Pengurus:
              </p>
              <p className="text-sm">{complaint.response}</p>
              {complaint.responded_at && (
                <p className="text-xs text-muted-foreground mt-2">
                  {format(
                    new Date(complaint.responded_at),
                    "d MMMM yyyy, HH:mm",
                    { locale: idLocale }
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
