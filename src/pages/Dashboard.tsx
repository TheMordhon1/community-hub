import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Users, FileText, Calendar, MessageSquare, Vote, LogOut, Map, CreditCard, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ROLE_LABELS, PENGURUS_TITLE_LABELS } from '@/types/database';

export default function Dashboard() {
  const { profile, role, pengurusTitle, signOut, isAdmin, isPengurus, canManageContent } = useAuth();

  const getRoleDisplay = () => {
    if (!role) return 'User';
    const roleLabel = ROLE_LABELS[role];
    if (role === 'pengurus' && pengurusTitle) {
      return `${PENGURUS_TITLE_LABELS[pengurusTitle]}`;
    }
    return roleLabel;
  };

  const stats = [
    { label: 'Pengumuman', value: '5', icon: FileText, color: 'text-primary' },
    { label: 'Acara', value: '3', icon: Calendar, color: 'text-accent' },
    { label: 'Pengaduan', value: '2', icon: MessageSquare, color: 'text-warning' },
    { label: 'Polling', value: '1', icon: Vote, color: 'text-info' },
  ];

  const quickActions = [
    { label: 'Pengumuman', icon: FileText, color: 'text-primary', href: '/announcements' },
    { label: 'Acara', icon: Calendar, color: 'text-accent', href: '/events' },
    { label: 'Pengaduan', icon: MessageSquare, color: 'text-warning', href: '/complaints' },
    { label: 'Polling', icon: Vote, color: 'text-info', href: '/polls' },
    { label: 'Peta Rumah', icon: Map, color: 'text-success', href: '/house-map' },
  ];

  const adminActions = [
    { label: 'Kelola Warga', icon: Users, color: 'text-secondary', href: '/admin/users' },
    { label: 'Pengaturan', icon: Settings, color: 'text-muted-foreground', href: '/admin/settings' },
  ];

  const pengurusActions = [
    { label: 'Kelola Iuran', icon: CreditCard, color: 'text-success', href: '/payments' },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between flex-wrap gap-4"
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
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isAdmin() ? 'bg-destructive/10 text-destructive' :
              isPengurus() ? 'bg-accent/10 text-accent' :
              'bg-primary/10 text-primary'
            }`}>
              {getRoleDisplay()}
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
          <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {quickActions.map((action) => (
              <Button key={action.label} variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
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
                <Button key={action.label} variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
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
              <CardTitle className="font-display text-destructive">Menu Admin</CardTitle>
              <CardDescription>Kelola sistem dan pengguna</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {adminActions.map((action) => (
                <Button key={action.label} variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
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
