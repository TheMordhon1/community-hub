import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Megaphone, Loader2, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Announcement } from '@/types/database';

export default function Announcements() {
  const { user, canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Announcement[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; content: string; is_published: boolean }) => {
      const { error } = await supabase.from('announcements').insert({
        title: data.title,
        content: data.content,
        is_published: data.is_published,
        published_at: data.is_published ? new Date().toISOString() : null,
        author_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Berhasil', description: 'Pengumuman berhasil dibuat' });
      resetForm();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal membuat pengumuman' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; title: string; content: string; is_published: boolean }) => {
      const { error } = await supabase
        .from('announcements')
        .update({
          title: data.title,
          content: data.content,
          is_published: data.is_published,
          published_at: data.is_published ? new Date().toISOString() : null,
        })
        .eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Berhasil', description: 'Pengumuman berhasil diperbarui' });
      resetForm();
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal memperbarui pengumuman' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Berhasil', description: 'Pengumuman berhasil dihapus' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Gagal', description: 'Gagal menghapus pengumuman' });
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setIsPublished(false);
    setIsCreateOpen(false);
    setEditingAnnouncement(null);
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setTitle(announcement.title);
    setContent(announcement.content);
    setIsPublished(announcement.is_published);
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Judul dan isi wajib diisi' });
      return;
    }

    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, title, content, is_published: isPublished });
    } else {
      createMutation.mutate({ title, content, is_published: isPublished });
    }
  };

  const publishedAnnouncements = announcements?.filter(a => a.is_published) || [];
  const draftAnnouncements = announcements?.filter(a => !a.is_published) || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="font-display text-2xl font-bold">Pengumuman</h1>
              <p className="text-muted-foreground">Informasi terbaru dari pengurus</p>
            </div>
          </div>

          {canManageContent() && (
            <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Buat Pengumuman
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingAnnouncement ? 'Edit Pengumuman' : 'Buat Pengumuman Baru'}</DialogTitle>
                  <DialogDescription>Isi informasi pengumuman di bawah ini</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul</Label>
                    <Input
                      id="title"
                      placeholder="Judul pengumuman"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="content">Isi Pengumuman</Label>
                    <Textarea
                      id="content"
                      placeholder="Tulis isi pengumuman..."
                      rows={5}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Publikasikan</Label>
                      <p className="text-sm text-muted-foreground">Pengumuman akan terlihat oleh semua warga</p>
                    </div>
                    <Switch checked={isPublished} onCheckedChange={setIsPublished} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetForm}>Batal</Button>
                  <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingAnnouncement ? 'Simpan' : 'Buat'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </motion.div>

        {/* Announcements List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : publishedAnnouncements.length === 0 && (!canManageContent() || draftAnnouncements.length === 0) ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <Megaphone className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Belum Ada Pengumuman</h3>
              <p className="text-muted-foreground">Pengumuman dari pengurus akan muncul di sini</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Drafts (only for managers) */}
            {canManageContent() && draftAnnouncements.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Draft</h2>
                {draftAnnouncements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-dashed">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              <EyeOff className="w-3 h-3 mr-1" />
                              Draft
                            </Badge>
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(announcement)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(announcement.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-muted-foreground whitespace-pre-wrap">{announcement.content}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Published */}
            {publishedAnnouncements.length > 0 && (
              <div className="space-y-3">
                {canManageContent() && draftAnnouncements.length > 0 && (
                  <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Dipublikasikan</h2>
                )}
                {publishedAnnouncements.map((announcement, index) => (
                  <motion.div
                    key={announcement.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className="bg-primary/10 text-primary">
                                <Eye className="w-3 h-3 mr-1" />
                                Publik
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                            <CardDescription>
                              {announcement.published_at &&
                                format(new Date(announcement.published_at), 'd MMMM yyyy, HH:mm', { locale: idLocale })}
                            </CardDescription>
                          </div>
                          {canManageContent() && (
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(announcement)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteMutation.mutate(announcement.id)}
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
