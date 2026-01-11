import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Users, Phone, Mail, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface PengurusData {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  title_display_name: string;
  title_description: string | null;
  order_index: number;
}

export default function OrganizationStructure() {
  const { data: pengurus, isLoading } = useQuery({
    queryKey: ["organization-structure"],
    queryFn: async () => {
      // Fetch pengurus users with their titles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, title_id")
        .eq("role", "pengurus")
        .not("title_id", "is", null);

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) return [];

      // Fetch pengurus titles
      const { data: titles, error: titlesError } = await supabase
        .from("pengurus_titles")
        .select("*")
        .order("order_index", { ascending: true });

      if (titlesError) throw titlesError;

      // Fetch profiles
      const userIds = userRoles.map((ur) => ur.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Create maps for quick lookup
      const titleMap = new Map(titles.map((t) => [t.id, t]));
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      // Combine data and sort by order_index
      const pengurusData: PengurusData[] = userRoles
        .map((ur) => {
          const profile = profileMap.get(ur.user_id);
          const title = titleMap.get(ur.title_id);

          if (!profile || !title) return null;

          return {
            id: profile.id,
            full_name: profile.full_name,
            email: profile.email,
            phone: profile.phone,
            avatar_url: profile.avatar_url,
            title_display_name: title.display_name,
            title_description: title.description,
            order_index: title.order_index,
          };
        })
        .filter((p): p is PengurusData => p !== null)
        .sort((a, b) => a.order_index - b.order_index);

      return pengurusData;
    },
  });

  return (
    <section className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-1"
        >
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Link>

            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold">
                Pengurus Paguyuban
              </h1>
              <p className="text-sm text-muted-foreground">
                Susunan pengurus Paguyuban Nijuuroku
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pengurus?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Pengurus</p>
            </div>
          </CardContent>
        </Card>

        {/* Pengurus List */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Daftar Pengurus</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : pengurus && pengurus.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pengurus.map((person, index) => (
                  <motion.div
                    key={person.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <Avatar className="w-12 h-12 shrink-0">
                            {person.avatar_url ? (
                              <AvatarImage
                                src={person.avatar_url}
                                alt={person.full_name}
                              />
                            ) : (
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {person.full_name.charAt(0)}
                              </AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">
                              {person.full_name}
                            </p>
                            <Badge className="mt-1 bg-accent text-accent-foreground">
                              {person.title_display_name}
                            </Badge>
                            {person.title_description && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {person.title_description}
                              </p>
                            )}
                          </div>
                        </div>
                        {/* Contact Buttons */}
                        <div className="flex gap-2 mt-4">
                          {person.phone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              asChild
                            >
                              <a
                                href={`https://wa.me/${person.phone
                                  .replace(/\D/g, "")
                                  .replace(/^0/, "+62")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Phone className="w-4 h-4 mr-2" />
                                WhatsApp
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            asChild
                          >
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
                <p>Belum ada pengurus yang terdaftar</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
