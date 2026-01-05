import { useState } from "react";
import { PollWithVotesProps } from "@/pages/Polls";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { CheckCircle2, Loader2, Trash2, Home, User, Share2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { ShareDialog } from "./ShareDialog";

export const PollCard = ({
  poll,
  index,
  canVote,
  isPollExpired,
  canManage,
  voteBlockReason,
  onVote,
  onToggleActive,
  onDelete,
  isVoting,
}: {
  poll: PollWithVotesProps;
  index?: number;
  canVote: boolean;
  isPollExpired: boolean;
  canManage: boolean;
  voteBlockReason?: string | null;
  onVote: (optionIndex: number) => void;
  onToggleActive: () => void;
  onDelete: () => void;
  isVoting: boolean;
}) => {
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const totalVotes = poll.votes.length;
  const hasVoted = !!poll?.userVote;
  const showResults = hasVoted || !poll.is_active || isPollExpired || poll.houseHasVoted;

  const shareUrl = `${window.location.origin}/polls/${poll.id}`;
  const shareText = `🗳️ ${poll.title}\n\n${poll.description || ""}\n\n📊 ${totalVotes} suara sudah masuk${poll.ends_at ? `\n⏰ Berakhir: ${format(new Date(poll.ends_at), "d MMMM yyyy", { locale: idLocale })}` : ""}`;

  const getVoteCount = (optionIndex: number) => {
    return poll.votes.filter((v) => v.option_index === optionIndex).length;
  };

  const getVotePercentage = (optionIndex: number) => {
    if (totalVotes === 0) return 0;
    return Math.round((getVoteCount(optionIndex) / totalVotes) * 100);
  };

  const getWinningIndex = () => {
    let maxVotes = -1;
    let winningIndex = -1;
    poll.options.forEach((_, index) => {
      const count = getVoteCount(index);
      if (count > maxVotes) {
        maxVotes = count;
        winningIndex = index;
      }
    });
    return winningIndex;
  };

  const navigate = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index ? index * 0.05 : 0 }}
    >
      <Card className={!poll.is_active ? "opacity-70" : ""}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {poll.is_active ? (
                  isPollExpired ? (
                    <Badge variant="secondary">Kadaluarsa</Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success">Aktif</Badge>
                  )
                ) : (
                  <Badge variant="secondary">Ditutup</Badge>
                )}
                {poll.vote_type === "per_house" ? (
                  <Badge variant="outline" className="text-info border-info">
                    <Home className="w-3 h-3 mr-1" />1 Rumah 1 Suara
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    <User className="w-3 h-3 mr-1" />1 Akun 1 Suara
                  </Badge>
                )}
                {hasVoted && (
                  <Badge
                    variant="outline"
                    className="text-primary border-primary"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Sudah Voting
                  </Badge>
                )}
                {poll.houseHasVoted && !hasVoted && (
                  <Badge
                    variant="outline"
                    className="text-warning border-warning"
                  >
                    <Home className="w-3 h-3 mr-1" />
                    Rumah Sudah Voting
                  </Badge>
                )}
              </div>
              <CardTitle
                className="text-lg block w-full hover:underline cursor-pointer"
                onClick={() => navigate(`/polls/${poll.id}`)}
              >
                {poll.title}
              </CardTitle>
              {poll.description && (
                <CardDescription className="mt-1">
                  {poll.description}
                </CardDescription>
              )}
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span>{totalVotes} suara</span>
                {poll.ends_at && (
                  <span>
                    Berakhir{" "}
                    {format(new Date(poll.ends_at), "d MMM yyyy", {
                      locale: idLocale,
                    })}
                  </span>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => setIsShareOpen(true)}>
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={onToggleActive}>
                  {poll.is_active ? "Tutup" : "Buka"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            )}
            {!canManage && (
              <Button variant="ghost" size="icon" onClick={() => setIsShareOpen(true)}>
                <Share2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {voteBlockReason && !hasVoted && poll.is_active && !isPollExpired && (
            <p className="text-sm text-warning bg-warning/10 p-2 rounded-md">
              {voteBlockReason}
            </p>
          )}
          {poll.options.map((option, optionIndex) => {
            const isUserChoice = poll.userVote?.option_index === optionIndex;
            const isWinning =
              showResults &&
              getWinningIndex() === optionIndex &&
              totalVotes > 0;
            const percentage = getVotePercentage(optionIndex);

            return (
              <div key={optionIndex} className="space-y-1">
                {canVote ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4"
                    onClick={() => onVote(optionIndex)}
                    disabled={isVoting}
                  >
                    {isVoting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <div className="w-4 h-4 mr-2 rounded-full border-2 border-primary" />
                    )}
                    {option}
                  </Button>
                ) : (
                  <div
                    className={cn(
                      "relative rounded-lg border p-3 overflow-hidden",
                      isUserChoice && "border-primary bg-primary/5",
                      isWinning && "border-success"
                    )}
                  >
                    <div
                      className={cn(
                        "absolute inset-0 transition-all",
                        isWinning ? "bg-success/10" : "bg-muted"
                      )}
                      style={{ width: `${percentage}%` }}
                    />
                    <div className="relative flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {isUserChoice && (
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                        )}
                        <span
                          className={cn(
                            "font-medium",
                            isWinning && "text-success"
                          )}
                        >
                          {option}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {getVoteCount(optionIndex)} suara
                        </span>
                        <span
                          className={cn(
                            "text-sm font-semibold",
                            isWinning && "text-success"
                          )}
                        >
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Polling?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus polling "{poll.title}"? Semua suara akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete();
                setIsDeleteOpen(false);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <ShareDialog
        open={isShareOpen}
        onOpenChange={setIsShareOpen}
        title={poll.title}
        description="Bagikan polling ini ke warga lain"
        url={shareUrl}
        shareText={shareText}
      />
    </motion.div>
  );
};
