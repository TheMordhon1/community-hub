import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Calendar,
  MessageSquare,
  Vote,
  Map,
  CreditCard,
  Users,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Dashboard() {
  const { profile, isAdmin, canManageContent } = useAuth();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const [ann, events, complaints, polls] = await Promise.all([
        supabase
          .from("announcements")
          .select("id", { count: "exact" })
          .eq("is_published", true),
        supabase.from("events").select("id", { count: "exact" }),
        supabase.from("complaints").select("id", { count: "exact" }),
        supabase.from("polls").select("id", { count: "exact" }),
      ]);

      if (ann.error) throw ann.error;
      if (events.error) throw events.error;
      if (complaints.error) throw complaints.error;
      if (polls.error) throw polls.error;

      return {
        announcements: ann.count ?? 0,
        events: events.count ?? 0,
        complaints: complaints.count ?? 0,
        polls: polls.count ?? 0,
      };
    },
    refetchOnWindowFocus: false,
  });

  const stats = [
    {
      label: "Pengumuman",
      value: statsLoading ? "..." : String(statsData?.announcements ?? 0),
      icon: FileText,
      color: "text-primary",
    },
    {
      label: "Acara",
      value: statsLoading ? "..." : String(statsData?.events ?? 0),
      icon: Calendar,
      color: "text-accent",
    },
    {
      label: "Pengaduan",
      value: statsLoading ? "..." : String(statsData?.complaints ?? 0),
      icon: MessageSquare,
      color: "text-warning",
    },
    {
      label: "Polling",
      value: statsLoading ? "..." : String(statsData?.polls ?? 0),
      icon: Vote,
      color: "text-info",
    },
  ];

  const quickActions = [
    {
      label: "Pengumuman",
      icon: FileText,
      color: "text-primary",
      href: "/announcements",
    },
    { label: "Acara", icon: Calendar, color: "text-accent", href: "/events" },
    {
      label: "Pengaduan",
      icon: MessageSquare,
      color: "text-warning",
      href: "/complaints",
    },
    { label: "Polling", icon: Vote, color: "text-info", href: "/polls" },
    {
      label: "Pembayaran",
      icon: CreditCard,
      color: "text-success",
      href: "/payments",
    },
    {
      label: "Peta Rumah",
      icon: Map,
      color: "text-success",
      href: "/house-map",
    },
  ];

  const adminActions = [
    {
      label: "Kelola Warga",
      icon: Users,
      color: "text-secondary",
      href: "/admin/users",
    },
    {
      label: "Pengaturan",
      icon: Settings,
      color: "text-muted-foreground",
      href: "/admin/settings",
    },
  ];

  const pengurusActions = [
    {
      label: "Kelola Iuran",
      icon: CreditCard,
      color: "text-success",
      href: "/payments",
    },
  ];

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Selamat datang kembali,{" "}
            <span className="font-medium text-foreground">
              {profile?.full_name || "User"}
            </span>
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                  <div
                    className={`w-10 h-10 rounded-lg sm:bg-muted flex items-center justify-center ${stat.color}`}
                  >
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">
                      {stat.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Menu Cepat</CardTitle>
            <CardDescription>Akses fitur-fitur utama</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:bg-muted"
                asChild
              >
                <Link to={action.href}>
                  <action.icon className={`w-6 h-6 ${action.color}`} />
                  <span>{action.label}</span>
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Pengurus Actions */}
        {canManageContent() && (
          <Card>
            <CardHeader>
              <CardTitle className="font-display">Menu Pengurus</CardTitle>
              <CardDescription>Kelola fitur khusus pengurus</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {pengurusActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-muted"
                  asChild
                >
                  <Link to={action.href}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                    <span>{action.label}</span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Admin Actions */}
        {isAdmin() && (
          <Card className="border-destructive/20">
            <CardHeader>
              <CardTitle className="font-display text-destructive">
                Menu Admin
              </CardTitle>
              <CardDescription>Kelola sistem dan pengguna</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {adminActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2 hover:bg-muted"
                  asChild
                >
                  <Link to={action.href}>
                    <action.icon className={`w-6 h-6 ${action.color}`} />
                    <span>{action.label}</span>
                  </Link>
                </Button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
