"use client";

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
  Menu,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";
import { EmergencyContactsCard } from "@/components/EmergencyContactsCard";
import { getInitials } from "@/lib/utils";

type LandingSettings = Record<string, string | null>;

export default function Index() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  const { user, isInitialized, profile } = useAuth();
  const settings = settingsData || {};
  const showStats = settings.show_stats !== "false";
  const showGallery = settings.show_gallery !== "false";
  const showEvents = settings.show_events !== "false";
  const showAnnouncements = settings.show_announcements !== "false";

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-xl">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                <Home className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-lg bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {settings.community_name || "Perumahan"}
              </span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex gap-6 items-center">
              {isInitialized && user ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={profile?.avatar_url || ""}
                        alt={profile?.full_name || "User"}
                      />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-xs font-bold">
                        {getInitials(profile?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-semibold text-emerald-900">
                      {profile?.full_name || "User"}
                    </span>
                  </div>
                  <Link to="/dashboard">
                    <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all">
                      Dashboard
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button
                      variant="ghost"
                      className="font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    >
                      Masuk
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all">
                      Daftar
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="md:hidden pb-4 border-t border-border/40"
            >
              <div className="flex flex-col gap-3 pt-4">
                {isInitialized && user ? (
                  <>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={profile?.avatar_url || ""}
                          alt={profile?.full_name || "User"}
                        />
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white text-xs font-bold">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-semibold text-emerald-900">
                        {profile?.full_name || "User"}
                      </span>
                    </div>
                    <Link to="/dashboard" className="w-full">
                      <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold">
                        Dashboard
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="w-full">
                      <Button
                        variant="ghost"
                        className="w-full font-semibold text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        Masuk
                      </Button>
                    </Link>
                    <Link to="/register" className="w-full">
                      <Button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold">
                        Daftar
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </nav>

      {/* Add padding to account for fixed navbar */}
      <div className="pt-20"></div>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {settings.hero_image ? (
          <div className="absolute inset-0">
            <img
              src={settings.hero_image || "/placeholder.svg"}
              alt="Hero"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-background to-teal-50/30" />
        )}
        <div className="relative container mx-auto px-4 py-32 md:py-48 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="space-y-6"
          >
            <div className="inline-block">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-sm md:text-base font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-2 w-fit mx-auto"
              >
                Selamat Datang ke Komunitas Kami
              </motion.div>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 text-balance leading-tight bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 bg-clip-text text-transparent">
              {settings.hero_title || "Perumahan Impian Anda"}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto text-balance leading-relaxed font-light">
              {settings.hero_subtitle ||
                "Komunitas yang nyaman, aman, dan asri untuk keluarga Indonesia"}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login">
                <Button
                  size="lg"
                  className="px-8 py-6 text-base font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-2xl transition-all"
                >
                  Masuk Portal
                </Button>
              </Link>
              <Link to="/register">
                <Button
                  variant="outline"
                  size="lg"
                  className="px-8 py-6 text-base font-bold border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 transition-all bg-transparent"
                >
                  Daftar Sekarang
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      {showStats && stats && (
        <section className="py-16 md:py-24 bg-gradient-to-b from-emerald-50/50 to-background border-y border-emerald-200/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-black text-emerald-900 mb-2">
                Statistik Komunitas
              </h2>
              <p className="text-muted-foreground text-lg">
                Perkembangan perumahan kami
              </p>
            </motion.div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-8">
              {[
                { icon: Home, label: "Unit Rumah", value: stats.totalHouses },
                {
                  icon: Users,
                  label: "Warga Terdaftar",
                  value: stats.totalResidents,
                },
                {
                  icon: Calendar,
                  label: "Acara Mendatang",
                  value: stats.upcomingEvents,
                },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group"
                >
                  <div className="relative p-8 rounded-2xl border border-emerald-200/50 bg-gradient-to-br from-white to-emerald-50/30 hover:border-emerald-300 hover:shadow-xl transition-all">
                    <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                      <stat.icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-4xl md:text-5xl font-black text-emerald-700 mb-2 text-center">
                      {stat.value}
                    </div>
                    <div className="text-base text-muted-foreground font-semibold text-center">
                      {stat.label}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* About Section */}
      {settings.about_text && (
        <section className="py-16 md:py-24">
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
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-black mb-2">
                Galeri Perumahan
              </h2>
              <p className="text-muted-foreground text-lg">
                Suasana dan kegiatan di lingkungan kami
              </p>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
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
                    src={image.image_url || "/placeholder.svg"}
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
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Calendar className="w-8 h-8 text-emerald-600" />
                  Acara Mendatang
                </h2>
                <p className="text-muted-foreground mt-1">
                  Jangan lewatkan kegiatan komunitas
                </p>
              </div>
              <Link
                to="/login"
                className="text-emerald-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
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
                          src={event.image_url || "/placeholder.svg"}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-3 left-3 bg-emerald-600 text-white rounded-lg px-3 py-1 text-sm font-semibold">
                          {format(new Date(event.event_date), "d MMM", {
                            locale: idLocale,
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="h-24 bg-emerald-50/20 flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-emerald-600">
                            {format(new Date(event.event_date), "d")}
                          </div>
                          <div className="text-xs text-emerald-600 uppercase">
                            {format(new Date(event.event_date), "MMM", {
                              locale: idLocale,
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4 md:p-6">
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
        <section className="py-16 md:py-24 bg-muted/30">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex justify-between items-center mb-8"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                  <Bell className="w-8 h-8 text-emerald-600" />
                  Pengumuman Terbaru
                </h2>
                <p className="text-muted-foreground mt-1">
                  Informasi penting dari pengurus
                </p>
              </div>
              <Link
                to="/login"
                className="text-emerald-600 font-semibold flex items-center gap-1 hover:gap-2 transition-all"
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
                              src={announcement.image_url || "/placeholder.svg"}
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

      {/* Emergency Contacts Section */}
      <EmergencyContactsCard variant="landing" className="bg-red-50/30" />

      {/* Contact Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-black text-emerald-900 mb-2">
              Hubungi Kami
            </h2>
            <p className="text-muted-foreground text-lg">
              Kami siap membantu Anda
            </p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {settings.address && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
              >
                <Card className="text-center p-8 h-full border-emerald-200/50 hover:border-emerald-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-emerald-50/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-emerald-900">
                    Alamat
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
                <Card className="text-center p-8 h-full border-emerald-200/50 hover:border-emerald-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-emerald-50/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Phone className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-emerald-900">
                    Telepon
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
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
                <Card className="text-center p-8 h-full border-emerald-200/50 hover:border-emerald-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-emerald-50/20">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Mail className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-emerald-900">
                    Email
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {settings.email}
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-gradient-to-r from-emerald-600 to-teal-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        <div className="relative container mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Bergabung dengan Komunitas Kami
            </h2>
            <p className="text-lg mb-8 opacity-95 max-w-2xl mx-auto leading-relaxed">
              Daftar sekarang untuk mengakses semua fitur, informasi komunitas,
              dan terhubung dengan sesama warga
            </p>
            <Link to="/register">
              <Button
                size="lg"
                className="px-10 py-6 text-base font-bold bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg hover:shadow-xl transition-all"
              >
                Daftar Sekarang
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 border-t border-gray-800 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <span className="font-black text-white">
                  {settings.community_name || "Perumahan"}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Komunitas perumahan yang nyaman dan asri
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Menu</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/login"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Portal Masuk
                  </Link>
                </li>
                <li>
                  <Link
                    to="/register"
                    className="hover:text-emerald-400 transition-colors"
                  >
                    Daftar
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Kontak</h4>
              <ul className="space-y-2 text-sm">
                {settings.email && <li>{settings.email}</li>}
                {settings.phone && <li>{settings.phone}</li>}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4">Informasi</h4>
              <p className="text-sm text-gray-500">
                {settings.address || "Alamat perumahan"}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            <p>
              &copy; {new Date().getFullYear()}{" "}
              {settings.community_name || "Perumahan"}. Semua hak dilindungi.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
