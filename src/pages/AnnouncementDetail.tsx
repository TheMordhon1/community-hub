import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
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
import { ArrowLeft, Megaphone, Loader2, Share2, Search,
  ExternalLink,
  Link as LinkIcon,
  Copy,
  Check,
} from "lucide-react";
import type { Announcement, Profile } from "@/types/database";
import { ShareDialog } from "@/components/ShareDialog";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";

interface AnnouncementWithAuthor extends Announcement {
  author?: Profile;
  title_display_name?: string;
}

export default function AnnouncementDetail() {
  const { id } = useParams();
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setIsCopied(true);
      toast.success("Link berhasil disalin");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast.error("Gagal menyalin link");
    }
  };

  const { data: announcement, isLoading } = useQuery({
    queryKey: ["announcement", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      // Fetch author if exists
      if (data.author_id) {
        const { data: authorData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.author_id)
          .single();

        let titleDisplayName: string | undefined;
        if (authorData) {
          const { data: userRole } = await supabase
            .from("user_roles")
            .select("title_id")
            .eq("user_id", data.author_id)
            .single();

          if (userRole?.title_id) {
            const { data: titleData } = await supabase
              .from("pengurus_titles")
              .select("display_name")
              .eq("id", userRole.title_id)
              .single();

            if (titleData) {
              titleDisplayName = titleData.display_name;
            }
          }
        }

        return {
          ...data,
          author: authorData,
          title_display_name: titleDisplayName,
        } as AnnouncementWithAuthor;
      }

      return data as AnnouncementWithAuthor;
    },
    enabled: !!id,
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

  if (!announcement) {
    return (
      <section className="min-h-screen bg-background p-6">
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Pengumuman Tidak Ditemukan
            </h3>
            <Button asChild className="mt-4">
              <Link to="/announcements">Kembali ke Pengumuman</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    );
  }

  const shareText = `📢 ${announcement.title}\n\n${announcement.content}`;
  const shareUrl = `${window.location.origin}/announcements/${id}`;

  return (
    <section className="min-h-screen bg-background p-6 overflow-x-hidden">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Link to="/announcements">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <h1 className="font-display text-xl md:text-2xl font-bold">
              Detail Pengumuman
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

        {/* Announcement Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card>
            {announcement.image_url && (
              <div className="w-full h-64 overflow-hidden rounded-t-lg">
                <img
                  src={announcement.image_url || "/placeholder.svg"}
                  alt={announcement.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardHeader>
              <div className="space-y-2">
                <Badge
                  variant={announcement.is_published ? "default" : "secondary"}
                  className={
                    announcement.is_published
                      ? "bg-primary/10 text-primary"
                      : ""
                  }
                >
                  {announcement.is_published ? "Publik" : "Draft"}
                </Badge>
                <CardTitle className="text-3xl break-words whitespace-pre-wrap">
                  {announcement.title}
                </CardTitle>
                <CardDescription className="text-base">
                  {announcement.published_at &&
                    format(
                      new Date(announcement.published_at),
                      "d MMMM yyyy, HH:mm",
                      { locale: idLocale }
                    )}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                <p className="whitespace-pre-wrap text-foreground break-words overflow-wrap-anywhere">
                  {announcement.content}
                </p>
              </div>

              {announcement.related_url && (
                <div className="mt-4 pt-4 border-t border-dashed">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <LinkIcon className="w-4 h-4 text-primary" />
                    Link Terkait
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={announcement.related_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 rounded-lg transition-colors group max-w-full"
                    >
                      <span className="line-clamp-1 break-all">
                        {announcement.related_url}
                      </span>
                      <ExternalLink className="w-4 h-4 shrink-0 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </a>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-[42px] px-3 gap-2"
                      onClick={() => handleCopyLink(announcement.related_url!)}
                    >
                      {isCopied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      <span>Salin Link</span>
                    </Button>
                  </div>
                </div>
              )}

              {announcement.author && (
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar>
                    <AvatarImage src={announcement.author.avatar_url || ""} />
                    <AvatarFallback>
                      {getInitials(announcement.author.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {announcement.author.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {announcement.title_display_name || "Penulis"}
                    </p>
                  </div>
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
        title={announcement.title}
        description="Bagikan pengumuman ini ke warga lain"
        url={shareUrl}
        shareText={shareText}
      />
    </section>
  );
}
