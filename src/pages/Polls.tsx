import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Vote,
  Loader2,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Poll, PollVote, PollVoteType } from "@/types/database";
import { PollCard } from "@/components/PollCard";

export interface PollWithVotesProps extends Poll {
  votes: PollVote[];
  userVote?: PollVote;
  houseHasVoted?: boolean;
}

export default function Polls() {
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [endsAt, setEndsAt] = useState<Date>();
  const [isActive, setIsActive] = useState(true);
  const [voteType, setVoteType] = useState<PollVoteType>("per_account");

  // Get user's house
  const { data: userHouse } = useQuery({
    queryKey: ["user-house", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("house_residents")
        .select("house_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data?.house_id as string | null;
    },
    enabled: !!user?.id,
  });

  const { data: polls, isLoading } = useQuery({
    queryKey: ["polls"],
    queryFn: async () => {
      const { data: pollsData, error: pollsError } = await supabase
        .from("polls")
        .select("*")
        .order("created_at", { ascending: false });

      if (pollsError) throw pollsError;

      const { data: votesData, error: votesError } = await supabase
        .from("poll_votes")
        .select("*");

      if (votesError) throw votesError;

      // Get house residents to check house votes
      const { data: residentsData } = await supabase
        .from("house_residents")
        .select("user_id, house_id");

      const pollsWithVotes: PollWithVotesProps[] = pollsData.map((poll) => {
        const pollVotes = votesData?.filter((v) => v.poll_id === poll.id) || [];
        const userVote = pollVotes.find((v) => v.user_id === user?.id);

        // Check if user's house has already voted (for per_house polls)
        let houseHasVoted = false;
        if (poll.vote_type === "per_house" && userHouse) {
          const houseResidentIds =
            residentsData
              ?.filter((r) => r.house_id === userHouse)
              .map((r) => r.user_id) || [];
          houseHasVoted = pollVotes.some((v) =>
            houseResidentIds.includes(v.user_id)
          );
        }

        return {
          ...poll,
          options: poll.options as string[],
          vote_type: poll.vote_type as PollVoteType,
          votes: pollVotes,
          userVote,
          houseHasVoted,
        };
      });

      return pollsWithVotes;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description: string;
      options: string[];
      ends_at: string | null;
      is_active: boolean;
      vote_type: PollVoteType;
    }) => {
      const { error } = await supabase.from("polls").insert({
        title: data.title,
        description: data.description,
        options: data.options,
        ends_at: data.ends_at,
        is_active: data.is_active,
        vote_type: data.vote_type,
        author_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast({ title: "Berhasil", description: "Polling berhasil dibuat" });
      resetForm();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal membuat polling",
      });
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({
      pollId,
      optionIndex,
    }: {
      pollId: string;
      optionIndex: number;
    }) => {
      const { error } = await supabase.from("poll_votes").insert({
        poll_id: pollId,
        user_id: user?.id,
        option_index: optionIndex,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast({ title: "Berhasil", description: "Suara Anda berhasil dicatat" });
    },
    onError: (error: Error) => {
      if (error.message.includes("duplicate")) {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Anda sudah memberikan suara",
        });
      } else {
        toast({
          variant: "destructive",
          title: "Gagal",
          description: "Gagal memberikan suara",
        });
      }
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("polls")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("polls").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["polls"] });
      toast({ title: "Berhasil", description: "Polling berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus polling",
      });
    },
  });

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOptions(["", ""]);
    setEndsAt(undefined);
    setIsActive(true);
    setVoteType("per_account");
    setIsCreateOpen(false);
  };

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
    }
  };

  const updateOption = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleSubmit = () => {
    const validOptions = options.filter((o) => o.trim());
    if (!title.trim() || validOptions.length < 2) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Judul dan minimal 2 pilihan wajib diisi",
      });
      return;
    }
    createMutation.mutate({
      title,
      description,
      options: validOptions,
      ends_at: endsAt?.toISOString() || null,
      is_active: isActive,
      vote_type: voteType,
    });
  };

  const activePolls = polls?.filter((p) => p.is_active) || [];
  const closedPolls = polls?.filter((p) => !p.is_active) || [];

  const isPollExpired = (poll: PollWithVotesProps) => {
    if (!poll.ends_at) return false;
    return new Date(poll.ends_at) < new Date();
  };

  const canVote = (poll: PollWithVotesProps) => {
    if (!poll.is_active || poll.userVote || isPollExpired(poll)) return false;

    // For per_house voting, check if user's house has voted
    if (poll.vote_type === "per_house") {
      if (!userHouse) {
        // User has no house assigned, cannot vote
        return false;
      }
      if (poll.houseHasVoted) {
        return false;
      }
    }

    return true;
  };

  const getVoteBlockReason = (poll: PollWithVotesProps) => {
    if (poll.userVote) return "Anda sudah voting";
    if (poll.vote_type === "per_house" && poll.houseHasVoted)
      return "Rumah Anda sudah voting";
    if (poll.vote_type === "per_house" && !userHouse)
      return "Anda belum terdaftar di rumah manapun";
    return null;
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold">Polling</h1>
            <p className="text-muted-foreground">
              Berikan suara untuk keputusan komunitas
            </p>
          </div>

          {canManageContent() && (
            <Dialog
              open={isCreateOpen}
              onOpenChange={(open) => {
                setIsCreateOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Buat Polling
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Buat Polling Baru</DialogTitle>
                  <DialogDescription>
                    Buat polling untuk mengumpulkan suara warga
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Polling</Label>
                    <Input
                      id="title"
                      placeholder="Contoh: Pemilihan Ketua RT"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Deskripsi (opsional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Jelaskan tujuan polling..."
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Metode Voting</Label>
                    <RadioGroup
                      value={voteType}
                      onValueChange={(v) => setVoteType(v as PollVoteType)}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div>
                        <RadioGroupItem
                          value="per_account"
                          id="per_account"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="per_account"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <span className="font-medium">1 Akun 1 Suara</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            Setiap pengguna bisa voting
                          </span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem
                          value="per_house"
                          id="per_house"
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor="per_house"
                          className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <span className="font-medium">1 Rumah 1 Suara</span>
                          <span className="text-xs text-muted-foreground mt-1">
                            Satu suara per rumah
                          </span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <Label>Pilihan</Label>
                    <div className="space-y-2">
                      {options.map((option, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder={`Pilihan ${index + 1}`}
                            value={option}
                            onChange={(e) =>
                              updateOption(index, e.target.value)
                            }
                          />
                          {options.length > 2 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOption(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                    {options.length < 6 && (
                      <Button variant="outline" size="sm" onClick={addOption}>
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah Pilihan
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Batas Waktu (opsional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !endsAt && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {endsAt
                            ? format(endsAt, "d MMMM yyyy", {
                                locale: idLocale,
                              })
                            : "Tidak ada batas waktu"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-popover"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={endsAt}
                          onSelect={setEndsAt}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Aktifkan Sekarang</Label>
                      <p className="text-sm text-muted-foreground">
                        Polling akan langsung terlihat oleh warga
                      </p>
                    </div>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
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
                    Buat
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Polls List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : polls?.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Vote className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum Ada Polling</h3>
              <p className="text-muted-foreground">
                Polling untuk keputusan komunitas akan muncul di sini
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Active Polls */}
            {activePolls.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Polling Aktif
                </h2>
                {activePolls.map((poll, index) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    index={index}
                    canVote={canVote(poll)}
                    isPollExpired={isPollExpired(poll)}
                    canManage={canManageContent()}
                    voteBlockReason={getVoteBlockReason(poll)}
                    onVote={(optionIndex) =>
                      voteMutation.mutate({ pollId: poll.id, optionIndex })
                    }
                    onToggleActive={() =>
                      toggleActiveMutation.mutate({
                        id: poll.id,
                        isActive: false,
                      })
                    }
                    onDelete={() => deleteMutation.mutate(poll.id)}
                    isVoting={voteMutation.isPending}
                  />
                ))}
              </div>
            )}

            {/* Closed Polls */}
            {closedPolls.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Polling Selesai
                </h2>
                {closedPolls.map((poll, index) => (
                  <PollCard
                    key={poll.id}
                    poll={poll}
                    index={index}
                    canVote={false}
                    isPollExpired={true}
                    canManage={canManageContent()}
                    onVote={() => {}}
                    onToggleActive={() =>
                      toggleActiveMutation.mutate({
                        id: poll.id,
                        isActive: true,
                      })
                    }
                    onDelete={() => deleteMutation.mutate(poll.id)}
                    isVoting={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
