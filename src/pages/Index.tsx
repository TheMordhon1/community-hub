import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  Bell,
  Users,
  Home,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type LandingSettings = Record<string, string | null>;

export default function Index() {
  // Fetch landing settings
  const { data: settingsData } = useQuery({
    queryKey: ["landing-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("landing_settings")
        .select("key, value");
      if (error) throw error;
      const settings: LandingSettings = {};
      data?.forEach((item) => {
        settings[item.key] = item.value;
      });
      return settings;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["landing-stats"],
    queryFn: async () => {
      const [housesRes, residentsRes, eventsRes] = await Promise.all([
        supabase.from("houses").select("id", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase
          .from("events")
          .select("id", { count: "exact" })
          .gte("event_date", new Date().toISOString()),
      ]);
      return {
        totalHouses: housesRes.count || 0,
        totalResidents: residentsRes.count || 0,
        upcomingEvents: eventsRes.count || 0,
      };
    },
  });

  // Fetch gallery images
  const { data: galleryImages } = useQuery({
    queryKey: ["landing-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  // Fetch upcoming events
  const { data: upcomingEvents } = useQuery({
    queryKey: ["landing-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .gte("event_date", new Date().toISOString())
        .order("event_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  // Fetch latest announcements
  const { data: announcements } = useQuery({
    queryKey: ["landing-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const settings = settingsData || {};
  const showStats = settings.show_stats !== "false";
  const showGallery = settings.show_gallery !== "false";
  const showEvents = settings.show_events !== "false";
  const showAnnouncements = settings.show_announcements !== "false";

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <Home className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">
              {settings.community_name || "Perumahan"}
            </span>
          </div>
          <div className="flex gap-2">
            <Link to="/login">
              <Button variant="ghost">Masuk</Button>
            </Link>
            <Link to="/register">
              <Button>Daftar</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {settings.hero_image ? (
          <div className="absolute inset-0">
            <img
              src={settings.hero_image}
              alt="Hero"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10" />
        )}
        <div className="relative container mx-auto px-4 py-24 md:py-40 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
              {settings.hero_title || "Selamat Datang di Perumahan Kami"}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
              {settings.hero_subtitle ||
                "Komunitas yang nyaman, aman, dan asri untuk keluarga Anda"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button size="lg" className="px-8">
                  Masuk Portal
                </Button>
              </Link>
              <Link to="/register">
                <Button variant="outline" size="lg" className="px-8">
                  Daftar Sekarang
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      {showStats && stats && (
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Home className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="text-2xl md:text-4xl font-bold text-primary">
                  {stats.totalHouses}
                </div>
                <div className="text-sm md:text-base text-muted-foreground">
                  Unit Rumah
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="text-2xl md:text-4xl font-bold text-primary">
                  {stats.totalResidents}
                </div>
                <div className="text-sm md:text-base text-muted-foreground">
                  Warga Terdaftar
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-center"
              >
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                </div>
                <div className="text-2xl md:text-4xl font-bold text-primary">
                  {stats.upcomingEvents}
                </div>
                <div className="text-sm md:text-base text-muted-foreground">
                  Acara Mendatang
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      {settings.about_text && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="max-w-3xl mx-auto text-center"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-6">
                Tentang Kami
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                {settings.about_text}
              </p>
            </motion.div>
          </div>
        </section>
      )}

      {/* Gallery Section */}
      {showGallery && galleryImages && galleryImages.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                Galeri Perumahan
              </h2>
              <p className="text-muted-foreground">
                Suasana dan kegiatan di lingkungan kami
              </p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {galleryImages.map((image, index) => (
                <motion.div
                  key={image.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="relative aspect-square rounded-xl overflow-hidden group"
                >
                  <img
                    src={image.image_url}
                    alt={image.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-medium">{image.title}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Events Section */}
      {showEvents && upcomingEvents && upcomingEvents.length > 0 && (
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-primary" />
                  Acara Mendatang
                </h2>
                <p className="text-muted-foreground mt-1">
                  Jangan lewatkan kegiatan komunitas
                </p>
              </div>
              <Link
                to="/login"
                className="text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
              >
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <div className="grid md:grid-cols-3 gap-6">
              {upcomingEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full">
                    {event.image_url ? (
                      <div className="h-40 overflow-hidden relative">
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-primary text-primary-foreground rounded-lg px-3 py-1 text-sm font-semibold">
                          {format(new Date(event.event_date), "d MMM", {
                            locale: idLocale,
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 bg-primary/10 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary">
                            {format(new Date(event.event_date), "d")}
                          </div>
                          <div className="text-xs text-primary uppercase">
                            {format(new Date(event.event_date), "MMM", {
                              locale: idLocale,
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg mb-2 line-clamp-1">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                          {event.description}
                        </p>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Announcements Section */}
      {showAnnouncements && announcements && announcements.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Bell className="w-8 h-8 text-primary" />
                  Pengumuman Terbaru
                </h2>
                <p className="text-muted-foreground mt-1">
                  Informasi penting dari pengurus
                </p>
              </div>
              <Link
                to="/login"
                className="text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
              >
                Lihat Semua <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <div className="space-y-4">
              {announcements.map((announcement, index) => (
                <motion.div
                  key={announcement.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4 md:p-6">
                      <div className="flex gap-4">
                        {announcement.image_url && (
                          <div className="hidden md:block w-24 h-24 rounded-lg overflow-hidden shrink-0">
                            <img
                              src={announcement.image_url}
                              alt={announcement.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1 line-clamp-1">
                            {announcement.title}
                          </h3>
                          {announcement.published_at && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {format(
                                new Date(announcement.published_at),
                                "d MMMM yyyy",
                                { locale: idLocale }
                              )}
                            </p>
                          )}
                          <p className="text-muted-foreground line-clamp-2">
                            {announcement.content}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              Hubungi Kami
            </h2>
            <p className="text-muted-foreground">
              Informasi kontak perumahan
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            {settings.address && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Card className="text-center p-6 h-full">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Alamat</h3>
                  <p className="text-muted-foreground text-sm">
                    {settings.address}
                  </p>
                </Card>
              </motion.div>
            )}
            {settings.phone && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <Card className="text-center p-6 h-full">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Telepon</h3>
                  <p className="text-muted-foreground text-sm">
                    {settings.phone}
                  </p>
                </Card>
              </motion.div>
            )}
            {settings.email && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <Card className="text-center p-6 h-full">
                  <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">Email</h3>
                  <p className="text-muted-foreground text-sm">
                    {settings.email}
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-4">
              Bergabung dengan Komunitas Kami
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-xl mx-auto">
              Daftar sekarang untuk mengakses semua fitur dan informasi komunitas
            </p>
            <Link to="/register">
              <Button size="lg" variant="secondary" className="px-8">
                Daftar Sekarang
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            {settings.community_name || "Perumahan"}. Semua hak dilindungi.
          </p>
        </div>
      </footer>
    </main>
  );
}
