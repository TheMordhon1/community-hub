import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home,
  Crown,
  Users,
  ArrowLeft,
  Filter,
  Calendar,
  Info,
  ShieldCheck,
  UserCheck,
  Search,
  User,
  Pencil,
  Loader2,
  Store,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { House, MemberType, MEMBER_TYPE_LABELS } from "@/types/database";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { DatePicker } from "@/components/ui/date-picker";

interface HouseResident {
  id: string;
  user_id: string | null;
  is_head: boolean;
  member_type: string | null;
  full_name: string;
  move_in_date: string | null;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  } | null;
  store_id?: string;
}

interface HouseWithResidents {
  id: string;
  block: string;
  number: string;
  is_occupied: boolean;
  occupancy_status?: "occupied" | "empty";
  vacancy_reason?: string | null;
  estimated_return_date?: string | null;
  residents: HouseResident[];
  hasStore?: boolean;
}

type HouseType = "all" | "registered" | "unregistered";
type OccupancyFilter = "all" | "occupied" | "empty";
type StoreFilter = "all" | "has_store" | "no_store";

export default function Residents() {
  const { canManageContent } = useAuth();
  const queryClient = useQueryClient();
  const { naturalSort } = useNaturalSort();
  const [searchQuery, setSearchQuery] = useState("");
  const MEMBER_SORT_PRIORITY: Record<string, number> = {
    suami: 1,
    istri: 2,
    anak: 3,
    orang_tua: 4,
    saudara: 5,
    asisten: 6,
    single: 7,
  };
  const [selectedHouse, setSelectedHouse] = useState<HouseWithResidents | null>(
    null
  );
  const [filterType, setFilterType] = useState<HouseType>("all");
  const [occupancyFilter, setOccupancyFilter] = useState<OccupancyFilter>("all");
  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [editOccupancy, setEditOccupancy] = useState<"occupied" | "empty">("occupied");
  const [editVacancyReason, setEditVacancyReason] = useState("");
  const [editReturnDate, setEditReturnDate] = useState("");

  const updateHouseStatus = useMutation({
    mutationFn: async ({ houseId, occupancy_status, vacancy_reason, estimated_return_date }: {
      houseId: string;
      occupancy_status: string;
      vacancy_reason: string | null;
      estimated_return_date: string | null;
    }) => {
      const { error } = await supabase
        .from("houses")
        .update({
          occupancy_status,
          vacancy_reason: occupancy_status === "empty" ? vacancy_reason : null,
          estimated_return_date: occupancy_status === "empty" ? estimated_return_date : null,
        })
        .eq("id", houseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status rumah berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["houses-with-residents"] });
      setIsEditingStatus(false);
      if (selectedHouse) {
        // Update local state
        setSelectedHouse({
          ...selectedHouse,
          occupancy_status: editOccupancy,
          vacancy_reason: editOccupancy === "empty" ? editVacancyReason || null : null,
          estimated_return_date: editOccupancy === "empty" ? editReturnDate || null : null,
        });
      }
    },
    onError: () => {
      toast.error("Gagal memperbarui status rumah");
    },
  });

  const { data: houses, isLoading } = useQuery({
    queryKey: ["houses-with-residents"],
    queryFn: async () => {
      // Auto-update houses with passed estimated_return_date
      await supabase.rpc("auto_update_house_status");

      // Fetch all houses
      const { data: housesData, error: housesError } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (housesError) throw housesError;

      // Fetch all house members
      const { data: membersData, error: membersError } = await supabase
        .from("house_members")
        .select("id, user_id, house_id, is_head, member_type, full_name, move_in_date");

      if (membersError) throw membersError;

      // Fetch stores to know which houses have stores
      const { data: storesData, error: storesError } = await supabase
        .from("stores")
        .select("id, house_id, created_by")
        .eq("status", "approved");

      if (storesError) throw storesError;

      const houseIdsWithStore = new Set((storesData || []).map(s => s.house_id));
      const userIdsWithStore = new Map((storesData || []).filter(s => s.created_by).map(s => [s.created_by, s.id]));

      // Fetch profiles for registered residents
      const userIds = [...new Set((membersData || []).filter(m => m.user_id).map((r) => r.user_id as string))];
      let profilesMap = new Map();

      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, avatar_url")
          .in("id", userIds);

        if (profilesError) throw profilesError;
        profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));
      }

      const typedHousesData = (housesData || []) as House[];

      // Map residents to houses
      const housesWithResidents: HouseWithResidents[] = typedHousesData.map(
        (house) => ({
          ...house,
          occupancy_status: house.occupancy_status || "occupied",
          vacancy_reason: house.vacancy_reason || null,
          estimated_return_date: house.estimated_return_date || null,
          hasStore: houseIdsWithStore.has(house.id),
          residents: (membersData || [])
            .filter((r) => r.house_id === house.id)
            .map((r) => ({
              ...r,
              profiles: r.user_id ? profilesMap.get(r.user_id) : null,
              store_id: r.user_id ? userIdsWithStore.get(r.user_id) : undefined,
            })),
        })
      );

      return housesWithResidents;
    },
  });

  const filteredHouses = houses
    ?.filter((house) => {
      const searchLower = searchQuery.toLowerCase();
      const houseLabel = `${house.block}${house.number}`.toLowerCase();
      const residentNames = house.residents
        .map((r) => (r.profiles?.full_name || r.full_name || "").toLowerCase())
        .join(" ");

      const matchesSearch =
        houseLabel.includes(searchLower) || residentNames.includes(searchLower);

      let matchesFilter = true;
      if (filterType === "registered") {
        matchesFilter = house.residents.length > 0;
      } else if (filterType === "unregistered") {
        matchesFilter = house.residents.length === 0;
      }

      let matchesOccupancy = true;
      if (occupancyFilter === "occupied") {
        matchesOccupancy = house.occupancy_status === "occupied";
      } else if (occupancyFilter === "empty") {
        matchesOccupancy = house.occupancy_status === "empty";
      }

      let matchesStore = true;
      if (storeFilter === "has_store") {
        matchesStore = !!house.hasStore;
      } else if (storeFilter === "no_store") {
        matchesStore = !house.hasStore;
      }

      return matchesSearch && matchesFilter && matchesOccupancy && matchesStore;
    })
    .sort((a, b) => {
      const blockSort = naturalSort(a.block, b.block);
      if (blockSort !== 0) return blockSort;
      return naturalSort(a.number, b.number);
    });

  const totalHouses = houses?.length || 0;
  const registeredHouses =
    houses?.filter((h) => h.residents.length > 0).length || 0;
  const totalUsers =
    houses?.reduce((sum, h) => sum + h.residents.length, 0) || 0;
  const storeHouses =
    houses?.filter((h) => h.hasStore).length || 0;



  const exportToExcel = () => {
    if (!filteredHouses) return;

    const data = filteredHouses.map((house) => {
      // Priority: 1) KK (is_head), 2) suami, 3) any member with linked account
      const head = house.residents.find((r) => r.is_head);
      const husband = !head ? house.residents.find((r) => r.member_type === "suami") : null;
      const linkedMember = !head && !husband ? house.residents.find((r) => r.user_id != null) : null;
      const representative = head || husband || linkedMember;
      const repName = representative ? (representative.profiles?.full_name || representative.full_name) : "-";
      
      const otherMembers = house.residents
        .filter(r => r.id !== representative?.id)
        .map(r => r.profiles?.full_name || r.full_name)
        .join(", ");

      return {
        Blok: house.block,
        Nomor: house.number,
        Status: house.occupancy_status === "empty" ? "Kosong" : "Terisi",
        "Kepala Keluarga": repName,
        "Anggota Keluarga": otherMembers || "-",
        "Total Penghuni": house.residents.length,
        "Alasan Kosong": house.vacancy_reason || "-",
        "Estimasi Kembali": house.estimated_return_date 
          ? format(new Date(house.estimated_return_date), "dd/MM/yyyy") 
          : "-",
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Penghuni");
    XLSX.writeFile(wb, `daftar-penghuni-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("Daftar penghuni berhasil diunduh sebagai Excel");
  };

  const exportToPDF = () => {
    if (!filteredHouses) return;

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Warga PKT ", 14, 20);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${format(new Date(), "dd MMMM yyyy HH:mm", { locale: idLocale })}`, 14, 28);

    const tableData = filteredHouses.map((house) => {
      // Priority: 1) KK (is_head), 2) suami, 3) any member with linked account
      const head = house.residents.find((r) => r.is_head);
      const husband = !head ? house.residents.find((r) => r.member_type === "suami") : null;
      const linkedMember = !head && !husband ? house.residents.find((r) => r.user_id != null) : null;
      const representative = head || husband || linkedMember;
      const repName = representative ? (representative.profiles?.full_name || representative.full_name) : "-";
      const repPhone = representative?.profiles?.phone || "-";

      const otherMembers = house.residents
        .filter(r => r.id !== representative?.id)
        .map(r => r.profiles?.full_name || r.full_name)
        .join(", ");

      return [
        `${house.block}-${house.number}`,
        house.occupancy_status === "empty" ? "Kosong" : "Terisi",
        repName,
        otherMembers || "-",
        repPhone,
        house.vacancy_reason || "-",
        house.estimated_return_date
          ? format(new Date(house.estimated_return_date), "dd/MM/yyyy")
          : "-",
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [["Rumah", "Status", "Kepala Keluarga", "Anggota Keluarga", "No. HP", "Keterangan", "Est. Kembali"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 7 },
      columnStyles: {
        3: { cellWidth: 40 }, // "Anggota Keluarga"
      }
    });

    doc.save(`daftar-penghuni-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("Daftar penghuni berhasil diunduh sebagai PDF");
  };

  if (isLoading) {
    return (
      <div className="mx-auto py-6 px-4 space-y-6">
        <div className="flex items-center gap-3">
          <Home className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Daftar Rumah & Penghuni</h1>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(12)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="py-6 px-4 space-y-6">
      {/* Header & Toolbar */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full shadow-sm">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Daftar Rumah & Penghuni</h1>
              <p className="text-sm sm:text-base text-muted-foreground font-medium">
                Kelola data hunian dan informasi warga PKT
              </p>
            </div>
          </div>
          <div className="hidden lg:block">
            <ExportDropdown onExcel={exportToExcel} onPDF={exportToPDF} />
          </div>
        </div>

        <div className="bg-background/50 backdrop-blur-md border rounded-2xl p-4 shadow-sm space-y-4 lg:space-y-0 lg:flex lg:items-center lg:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari rumah, blok, atau nama penghuni..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white/50 border-muted-foreground/20 focus:ring-primary/20 rounded-xl"
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Select value={filterType} onValueChange={(value: HouseType) => setFilterType(value)}>
                <SelectTrigger className="h-11 w-full sm:w-[180px] bg-white/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <SelectValue className="w-full block line-clamp-1" placeholder="Semua Warga" />
                  </div>
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">Semua Warga</SelectItem>
                  <SelectItem value="registered">Terdaftar</SelectItem>
                  <SelectItem value="unregistered">Belum Terdaftar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Select value={occupancyFilter} onValueChange={(value: OccupancyFilter) => setOccupancyFilter(value)}>
                <SelectTrigger className="h-11 w-full sm:w-[150px] bg-white/50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <SelectValue className="line-clamp-1" placeholder="Semua Status" />
                  </div>
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="occupied">Terisi</SelectItem>
                  <SelectItem value="empty">Kosong</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 flex-1 sm:flex-none">
              <Select value={storeFilter} onValueChange={(value: StoreFilter) => setStoreFilter(value)}>
                <SelectTrigger className="h-11 w-full sm:w-[150px] bg-white/50 rounded-xl border-emerald-200 focus:ring-emerald-500/20">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Store className="w-4 h-4" />
                    <SelectValue placeholder="Semua Toko" />
                  </div>
                </SelectTrigger>
                <SelectContent rounded-xl>
                  <SelectItem value="all">Semua Toko</SelectItem>
                  <SelectItem value="has_store">Punya Toko</SelectItem>
                  <SelectItem value="no_store">Tanpa Toko</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:hidden w-full pt-2 border-t">
              <ExportDropdown onExcel={exportToExcel} onPDF={exportToPDF} fullWidth />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Rumah", value: totalHouses, icon: Home, color: "text-blue-600", bg: "from-blue-50 to-blue-100", border: "border-blue-200", iconBg: "text-blue-200" },
          { label: "Terisi", value: registeredHouses, icon: UserCheck, color: "text-emerald-600", bg: "from-emerald-50 to-emerald-100", border: "border-emerald-200", iconBg: "text-emerald-200" },
          { label: "Total Penghuni", value: totalUsers, icon: Users, color: "text-purple-600", bg: "from-purple-50 to-purple-100", border: "border-purple-200", iconBg: "text-purple-200" },
          { label: "Total Toko", value: storeHouses, icon: Store, color: "text-amber-600", bg: "from-amber-50 to-amber-100", border: "border-amber-200", iconBg: "text-amber-200" },
        ].map((stat, i) => (
          <Card key={stat.label} className={cn("bg-gradient-to-br shadow-sm transition-transform hover:scale-[1.02] cursor-default overflow-hidden relative", stat.bg, stat.border)}>
            <CardContent className="p-5 flex items-center justify-between">
              <div className="z-10">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80 mb-1">{stat.label}</p>
                <p className={cn("text-3xl font-black tracking-tighter", stat.color)}>
                  {stat.value}
                </p>
              </div>
              <stat.icon className={cn("h-12 w-12 opacity-50 shrink-0", stat.iconBg)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
        {filteredHouses?.map((house, index) => (
          <motion.div
            key={house.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.01 }}
          >
            <Card
              className={cn(
                "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative aspect-square flex items-center justify-center",
                house.residents.length > 0
                  ? "border-primary/20 bg-gradient-to-br from-white to-primary/5 hover:border-primary/50"
                  : "border-muted bg-muted/20 grayscale opacity-70 hover:opacity-100 hover:grayscale-0"
              )}
              onClick={() => setSelectedHouse(house)}
            >
              <CardContent className="p-3 sm:p-4 text-center flex flex-col items-center justify-center w-full h-full relative z-10">
                {house.occupancy_status === "empty" && (
                  <div className="absolute top-0 right-0 p-1">
                    <Badge variant="destructive" className="h-4 sm:h-5 text-[8px] sm:text-[9px] px-1 sm:px-1.5 uppercase font-bold tracking-tighter">
                      Kosong
                    </Badge>
                  </div>
                )}
                {house.hasStore && (
                  <div className="absolute top-0 left-0 p-1">
                    <Badge className="h-4 sm:h-5 text-[8px] sm:text-[9px] px-1 sm:px-1.5 bg-emerald-500 font-bold tracking-tighter">
                      <Store className="w-2.5 h-2.5 mr-0.5" />
                      Toko
                    </Badge>
                  </div>
                )}
                
                <div className="text-xl sm:text-2xl font-black text-primary tracking-tighter group-hover:scale-110 transition-transform">
                  {house.block}<span className="text-primary/40 font-normal mx-0.5">-</span>{house.number}
                </div>
                
                <div className="flex items-center gap-1 mt-1.5 sm:mt-2 py-0.5 px-2 rounded-full bg-background/50 border border-border/50 backdrop-blur-sm shadow-sm transition-all group-hover:bg-primary/10">
                  <Users className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-muted-foreground" />
                  <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {house.residents.length > 0
                      ? `${house.residents.length}`
                      : "0"}
                  </span>
                </div>
              </CardContent>
              
              {/* Subtle background decoration */}
              <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                <Home className="h-16 w-16 sm:h-20 sm:w-20" />
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* House Detail Dialog */}
      <Dialog
        open={!!selectedHouse}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedHouse(null);
            setIsEditingStatus(false);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Rumah {selectedHouse?.block} - {selectedHouse?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status Section */}
            {!isEditingStatus ? (
              <div className="space-y-2">
                {selectedHouse?.occupancy_status === "empty" && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                      <Info className="h-4 w-4" />
                      Status: Rumah Kosong
                    </div>
                    {selectedHouse.vacancy_reason && (
                      <p className="text-sm">
                        <span className="font-medium">Alasan:</span> {selectedHouse.vacancy_reason}
                      </p>
                    )}
                    {selectedHouse.estimated_return_date && (
                      <p className="text-sm">
                        <span className="font-medium">Estimasi Kembali:</span>{" "}
                        {format(new Date(selectedHouse.estimated_return_date), "dd MMMM yyyy", { locale: idLocale })}
                      </p>
                    )}
                  </div>
                )}
                {canManageContent() && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setEditOccupancy((selectedHouse?.occupancy_status as "occupied" | "empty") || "occupied");
                      setEditVacancyReason(selectedHouse?.vacancy_reason || "");
                      setEditReturnDate(selectedHouse?.estimated_return_date || "");
                      setIsEditingStatus(true);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-2" />
                    Ubah Status Rumah
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3 border rounded-lg p-3">
                <div className="space-y-2">
                  <Label className="text-sm">Status Hunian</Label>
                  <Select value={editOccupancy} onValueChange={(v) => setEditOccupancy(v as "occupied" | "empty")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="occupied">Terisi</SelectItem>
                      <SelectItem value="empty">Kosong</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editOccupancy === "empty" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-sm">Alasan Kosong</Label>
                      <Textarea
                        value={editVacancyReason}
                        onChange={(e) => setEditVacancyReason(e.target.value)}
                        placeholder="Contoh: Renovasi, pindah sementara..."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Estimasi Kembali</Label>
                      <DatePicker
                        date={editReturnDate ? new Date(editReturnDate) : undefined}
                        setDate={(date) => setEditReturnDate(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder="Estimasi tanggal kembali"
                      />
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setIsEditingStatus(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={updateHouseStatus.isPending}
                    onClick={() => {
                      if (!selectedHouse) return;
                      updateHouseStatus.mutate({
                        houseId: selectedHouse.id,
                        occupancy_status: editOccupancy,
                        vacancy_reason: editVacancyReason || null,
                        estimated_return_date: editReturnDate || null,
                      });
                    }}
                  >
                    {updateHouseStatus.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                    ) : null}
                    Simpan
                  </Button>
                </div>
              </div>
            )}
            
            {selectedHouse?.residents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada penghuni terdaftar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...(selectedHouse?.residents || [])]
                  .sort((a, b) => {
                    if (a.is_head !== b.is_head) return b.is_head ? 1 : -1;
                    const priorityA = MEMBER_SORT_PRIORITY[a.member_type || ""] || 99;
                    const priorityB = MEMBER_SORT_PRIORITY[b.member_type || ""] || 99;
                    if (priorityA !== priorityB) return priorityA - priorityB;
                    return (a.full_name || "").localeCompare(b.full_name || "");
                  })
                  .map((resident) => (
                  <div
                    key={resident.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                  <Avatar className="h-10 w-10">
                      <AvatarImage src={resident.profiles?.avatar_url || ""} />
                      <AvatarFallback>
                        {getInitials(resident.profiles?.full_name || resident.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-sm sm:text-base line-clamp-1">
                          {resident.profiles?.full_name || resident.full_name}
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {resident.is_head && (
                               <Badge variant="secondary" className="px-1.5 h-4 text-[8px] bg-amber-500/10 text-amber-600 border-amber-200/50 font-bold uppercase tracking-wider shadow-sm ring-1 ring-amber-500/20">
                                <Crown className="w-2 h-2 mr-1" />
                                KK
                              </Badge>
                            )}
                            {resident.member_type && (
                              <Badge variant="outline" className="px-1.5 h-4 text-[8px] font-bold uppercase tracking-wider shadow-sm">
                                {MEMBER_TYPE_LABELS[resident.member_type as MemberType]}
                              </Badge>
                            )}
                           
                        </div>
                      </div>
                      {resident.profiles?.phone && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {resident.profiles.phone}
                        </p>
                      )}
                    </div>
                    {resident.store_id && (
                      <Link to={`/stores/${resident.store_id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 bg-white shadow-sm gap-1.5 font-bold text-[10px]"
                        >
                          <Store className="w-3.5 h-3.5" />
                          Toko
                        </Button>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ExportDropdown({ onExcel, onPDF, fullWidth }: { onExcel: () => void; onPDF: () => void; fullWidth?: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("gap-2 hover:bg-muted font-semibold", fullWidth ? "w-full" : "h-11 px-6 bg-white/50")}>
          <Download className="h-4 w-4" />
          <span>Export Data</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px] rounded-xl p-1 shadow-lg">
        <DropdownMenuItem onClick={onExcel} className="cursor-pointer gap-2 py-2 rounded-lg">
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          <span className="font-medium">Excel</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPDF} className="cursor-pointer gap-2 py-2 rounded-lg">
          <FileText className="h-4 w-4 text-rose-600" />
          <span className="font-medium">PDF Document</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

