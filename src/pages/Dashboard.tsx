import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Users, FileText, Calendar, MessageSquare, Vote, LogOut } from 'lucide-react';

export default function Dashboard() {
  const { profile, role, signOut } = useAuth();

  const getRoleLabel = () => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'pengurus': return 'Pengurus';
      case 'warga': return 'Warga';
      default: return 'User';
    }
  };

  const stats = [
    { label: 'Pengumuman', value: '5', icon: FileText, color: 'text-primary' },
    { label: 'Acara', value: '3', icon: Calendar, color: 'text-accent' },
    { label: 'Pengaduan', value: '2', icon: MessageSquare, color: 'text-warning' },
    { label: 'Polling', value: '1', icon: Vote, color: 'text-info' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Home className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold">Perumahan Kita</h1>
              <p className="text-muted-foreground">
                Selamat datang, <span className="font-medium text-foreground">{profile?.full_name || 'User'}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
              {getRoleLabel()}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
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
                  <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
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
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <FileText className="w-6 h-6 text-primary" />
              <span>Pengumuman</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Calendar className="w-6 h-6 text-accent" />
              <span>Acara</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <MessageSquare className="w-6 h-6 text-warning" />
              <span>Pengaduan</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Vote className="w-6 h-6 text-info" />
              <span>Polling</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Home className="w-6 h-6 text-success" />
              <span>Peta Rumah</span>
            </Button>
            {(role === 'admin' || role === 'pengurus') && (
              <Button variant="outline" className="h-auto py-4 flex-col gap-2">
                <Users className="w-6 h-6 text-secondary" />
                <span>Kelola Warga</span>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
