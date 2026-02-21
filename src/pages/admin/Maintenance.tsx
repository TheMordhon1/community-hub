import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  Database, 
  Trash2, 
  AlertTriangle, 
  FileCheck, 
  HardDrive, 
  Loader2, 
  ArrowLeft,
  Search
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const CATEGORIES = [
  { id: "payment-proofs", name: "Bukti Pembayaran (Payment Proofs)", bucket: "payment-proofs", table: "payments", column: "proof_url" },
];

interface StorageItem {
  id: string;
  [key: string]: string | number | boolean | null;
}

export default function Maintenance() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [month, setMonth] = useState<string>(new Date().getMonth().toString()); // Default to last month or so
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [isSearching, setIsSearching] = useState(false);
  const [foundItems, setFoundItems] = useState<StorageItem[]>([]);

  // Years for selection
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const selectedCategory = CATEGORIES.find(c => c.id === category)!;

  const searchFiles = async () => {
    setIsSearching(true);
    setFoundItems([]);
    try {
      // Direct query with cast to bypass generic string issues
      const { data, error } = await (supabase
        .from(selectedCategory.table as "payments")
        .select(`id, ${selectedCategory.column}`)
        .eq("month", parseInt(month) + 1)
        .eq("year", parseInt(year))
        .not(selectedCategory.column, "is", null) as unknown as Promise<{ data: StorageItem[] | null; error: Error | null }>);

      if (error) throw error;
      setFoundItems(data || []);
      
      if (data?.length === 0) {
        toast.info("Tidak ada file ditemukan untuk kriteria tersebut");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Gagal mencari file: " + message);
    } finally {
      setIsSearching(false);
    }
  };

  const clearStorage = useMutation({
    mutationFn: async () => {
      if (foundItems.length === 0) return;

      const pathsToDelete = foundItems
        .map(item => {
          const url = item[selectedCategory.column] as string | null;
          if (!url) return null;
          // Extract path from public URL
          try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${selectedCategory.bucket}/`);
            return pathParts.length > 1 ? decodeURIComponent(pathParts[1]) : null;
          } catch (e) {
            return null;
          }
        })
        .filter((p): p is string => p !== null);

      if (pathsToDelete.length === 0) return;

      // 1. Delete from Storage
      const { error: storageError } = await supabase.storage
        .from(selectedCategory.bucket)
        .remove(pathsToDelete);

      if (storageError) throw storageError;

      // 2. Update Database Records to NULL
      const { error: dbError } = await supabase
        .from(selectedCategory.table as "payments")
        .update({ [selectedCategory.column]: null } as unknown as never)
        .in("id", foundItems.map(i => i.id));

      if (dbError) throw dbError;

      return pathsToDelete.length;
    },
    onSuccess: (count) => {
      toast.success(`Berhasil menghapus ${count} file dari storage`);
      setFoundItems([]);
      queryClient.invalidateQueries();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error("Gagal membersihkan storage: " + message);
    }
  });

  if (!isAdmin()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Akses Ditolak</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Hanya administrator yang dapat mengakses halaman pemeliharaan sistem.
        </p>
        <Button asChild variant="outline">
          <Link to="/dashboard">Kembali ke Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Database className="w-6 h-6 text-primary" />
            Pemeliharaan Sistem
          </h1>
          <p className="text-sm text-muted-foreground">Kelola kapasitas storage dan optimasi database</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <HardDrive className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-primary" />
              Pembersihan Storage
            </CardTitle>
            <CardDescription>
              Hapus file-file lama dari storage cloud untuk menghemat ruang. 
              Tindakan ini hanya menghapus file fisik, data catatan di database akan tetap ada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Kategori Data</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={searchFiles} 
              className="w-full sm:w-auto gap-2"
              disabled={isSearching}
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Cek Data Tersedia
            </Button>

            {foundItems.length > 0 && (
              <div className="p-6 border rounded-2xl bg-background shadow-inner space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-green-500" />
                      Data Ditemukan
                    </p>
                    <p className="text-2xl font-black">
                      {foundItems.length} <span className="text-sm font-normal text-muted-foreground">file gambar ditemukan</span>
                    </p>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 uppercase tracking-tighter text-[10px]">
                      {MONTHS[parseInt(month)]} {year}
                    </Badge>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2 h-12 px-8 font-bold uppercase tracking-widest text-xs shadow-lg shadow-destructive/20 active:scale-95 transition-all">
                        <Trash2 className="w-4 h-4" />
                        Hapus Semua File
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl border-destructive/20">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="w-6 h-6" />
                          Konfirmasi Penghapusan
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-foreground pt-2">
                          Anda akan menghapus secara permanen <strong className="text-destructive">{foundItems.length} file fisik</strong> dari storage untuk periode <strong>{MONTHS[parseInt(month)]} {year}</strong>.
                          <br /><br />
                          Data transaksi di database <strong>TIDAK</strong> akan dihapus, namun bukti gambar akan hilang selamanya.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Batal</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => clearStorage.mutate()}
                          className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
                          disabled={clearStorage.isPending}
                        >
                          {clearStorage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ya, Hapus Sekarang"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <div className="bg-destructive/5 p-4 rounded-xl border border-destructive/10 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-xs text-destructive leading-relaxed">
                    <strong>Peringatan Keamanan:</strong> Pembersihan storage adalah tindakan destruktif yang tidak dapat dibatalkan. Pastikan Anda telah mengunduh laporan penting sebelum melakukan pembersihan berkala.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 opacity-50 pointer-events-none">
           <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Optimasi DB</CardTitle>
            </CardHeader>
           </Card>
           <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-sm">Log Sistem</CardTitle>
            </CardHeader>
           </Card>
        </div>
      </div>
    </div>
  );
}
