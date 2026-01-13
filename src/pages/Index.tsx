import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Bell, Users, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Event {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  image_url: string | null;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  published_at: string | null;
}

async function getUpcomingEvents() {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5173"
      }/api/events?limit=3&status=upcoming`,
      { cache: "no-store" }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

async function getLatestAnnouncements() {
  try {
    const response = await fetch(
      `${
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:5173"
      }/api/announcements?limit=3&published=true`,
      { cache: "no-store" }
    );
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export default function Home() {
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [events, news] = await Promise.all([
          getUpcomingEvents(),
          getLatestAnnouncements(),
        ]);
        setUpcomingEvents(events);
        setAnnouncements(news);
      } catch (error) {
        console.error("Failed to fetch landing data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">
                W
              </span>
            </div>
            <span className="font-bold text-lg">Warga</span>
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
      <section className="border-b border-border bg-gradient-to-b from-card to-background">
        <div className="container mx-auto px-4 py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-balance">
            Komunitas Sehat, Warga Bahagia
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Platform manajemen komunitas yang memudahkan komunikasi, koordinasi
            acara, dan transparansi finansial di lingkungan Anda.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg">Mulai Sekarang</Button>
            </Link>
            <Button variant="outline" size="lg">
              Pelajari Lebih Lanjut
            </Button>
          </div>
        </div>
      </section>

      {/* Upcoming Events Section */}
      <section className="border-b border-border py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-2">
                <Calendar className="w-8 h-8 text-primary" />
                Acara Mendatang
              </h2>
              <p className="text-muted-foreground mt-1">
                Jangan lewatkan acara komunitas terbaru
              </p>
            </div>
            <Link
              to="#events"
              className="text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {upcomingEvents.length > 0 ? (
            <div className="grid md:grid-cols-3 gap-6">
              {upcomingEvents.slice(0, 3).map((event: Event) => (
                <Card
                  key={event.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {event.image_url && (
                    <div className="h-40 bg-muted overflow-hidden">
                      <img
                        src={event.image_url || "/placeholder.svg"}
                        alt={event.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform"
                      />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2">
                      {event.title}
                    </CardTitle>
                    <CardDescription>
                      {formatDate(event.event_date)}
                      {event.location && ` • ${event.location}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Link to={`/events/${event.id}`}>
                      <Button
                        variant="outline"
                        className="w-full bg-transparent"
                      >
                        Lihat Detail
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Belum ada acara mendatang
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Announcements Section */}
      <section className="border-b border-border py-16">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-3xl font-bold flex items-center gap-2">
                <Bell className="w-8 h-8 text-primary" />
                Pengumuman Terbaru
              </h2>
              <p className="text-muted-foreground mt-1">
                Informasi penting dari pengurus komunitas
              </p>
            </div>
            <Link
              to="#announcements"
              className="text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-all"
            >
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {announcements.length > 0 ? (
            <div className="space-y-4">
              {announcements.slice(0, 3).map((announcement: Announcement) => (
                <Card
                  key={announcement.id}
                  className="hover:shadow-md transition-shadow overflow-hidden"
                >
                  <CardHeader>
                    <CardTitle className="line-clamp-2">
                      {announcement.title}
                    </CardTitle>
                    {announcement.published_at && (
                      <CardDescription>
                        {formatDate(announcement.published_at)}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground line-clamp-2 mb-4">
                      {announcement.content}
                    </p>
                    <Link to={`/announcements/${announcement.id}`}>
                      <Button variant="outline" size="sm">
                        Baca Selengkapnya
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Belum ada pengumuman</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-card">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Fitur Utama</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <Calendar className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Manajemen Acara</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Kelola acara komunitas, undang peserta, dan pantau kehadiran
                dengan mudah.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Bell className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Pengumuman Terpusat</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Bagikan informasi penting kepada seluruh warga dengan pengumuman
                yang terstruktur.
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Users className="w-8 h-8 text-primary mb-2" />
                <CardTitle>Direktori Warga</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                Kelola data warga, unit hunian, dan hubungan dalam komunitas.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Bergabunglah dengan Komunitas Kami
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Tingkatkan kualitas komunikasi dan koordinasi di lingkungan Anda
          </p>
          <Link to="/register">
            <Button size="lg" variant="secondary">
              Daftar Sekarang
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <p>&copy; 2026 Warga. Semua hak dilindungi.</p>
        </div>
      </footer>
    </main>
  );
}
