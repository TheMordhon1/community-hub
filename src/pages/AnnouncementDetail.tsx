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
import { ArrowLeft, Megaphone, Loader2, Share2 } from "lucide-react";
import type { Announcement, Profile } from "@/types/database";
import { ShareDialog } from "@/components/ShareDialog";

interface AnnouncementWithAuthor extends Announcement {
  author?: Profile;
}

export default function AnnouncementDetail() {
  const { id } = useParams();
  const [isShareOpen, setIsShareOpen] = useState(false);

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

        return { ...data, author: authorData } as AnnouncementWithAuthor;
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
    <section className="min-h-screen bg-background p-6">
      <div className="space-y-6">
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
                  src={announcement.image_url}
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
                <CardTitle className="text-3xl">{announcement.title}</CardTitle>
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
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="whitespace-pre-wrap text-foreground">
                  {announcement.content}
                </p>
              </div>

              {announcement.author && (
                <div className="flex items-center gap-3 pt-4 border-t">
                  <Avatar>
                    <AvatarImage src={announcement.author.avatar_url || ""} />
                    <AvatarFallback>
                      {announcement.author.full_name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {announcement.author.full_name}
                    </p>
                    <p className="text-sm text-muted-foreground">Penulis</p>
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
