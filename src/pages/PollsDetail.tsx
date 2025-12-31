import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PollWithVotesProps } from "@/pages/Polls";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { Poll, PollVote } from "@/types/database";
import { PollCard } from "@/components/PollCard";

interface PollsWithVotes extends Poll {
  votes: PollVote[];
  userVote?: PollVote;
}

export default function PollsDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: poll,
    isLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["poll", id],
    queryFn: async () => {
      // 1. Fetch the poll
      const { data: pollData, error: pollError } = await supabase
        .from("polls")
        .select("*")
        .eq("id", id)
        .single();

      if (pollError) throw pollError;

      // 2. Fetch votes for this poll
      const { data: votesData, error: votesError } = await supabase
        .from("poll_votes")
        .select("*")
        .eq("poll_id", id);

      if (votesError) throw votesError;

      const userVote = votesData?.find((v) => v.user_id === user?.id);

      return {
        ...pollData,
        options: pollData.options as string[],
        votes: votesData || [],
        userVote,
      } as PollsWithVotes;
    },
    enabled: !!id && !!user,
  });

  const isPollExpired = (poll: PollWithVotesProps) => {
    if (!poll.ends_at) return false;
    return new Date(poll.ends_at) < new Date();
  };

  const canVote = (poll: PollWithVotesProps) => {
    return poll.is_active && !poll.userVote && !isPollExpired(poll);
  };

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
      refetch();
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
      refetch();
      toast({
        variant: "default",
        title: "Active",
        description: "Polling status diubah",
      });
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
      navigate("/polls");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus polling",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !poll) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Polling tidak ditemukan.</p>
        <Button asChild>
          <Link to="/polls">Kembali ke Daftar</Link>
        </Button>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="mx-auto space-y-6">
        <Button variant="link" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Kembali
        </Button>

        <PollCard
          poll={poll}
          canVote={canVote(poll)}
          isPollExpired={isPollExpired(poll)}
          canManage={canManageContent()}
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
      </div>
    </section>
  );
}
