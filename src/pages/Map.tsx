import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, Crown, Users, Crosshair, Save, Trash2, Pencil, Home, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { StreetsLayer, STREETS, getStreetForPoint } from "@/components/map/StreetsLayer";

export const houseIcon = L.divIcon({
  className: "",
  html: `<div style="
    display:flex;align-items:center;justify-content:center;
    width:32px;height:32px;
    background:white;
    border:2px solid #6366f1;
    border-radius:50%;
    box-shadow:0 2px 6px rgba(0,0,0,0.25);
  ">
    <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='#6366f1' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>
      <path d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>
      <polyline points='9 22 9 12 15 12 15 22'/>
    </svg>
  </div>`,
  iconSize: [15, 15],
  iconAnchor: [16, 32],
  popupAnchor: [0, -34],
});

interface HouseRow {
  id: string;
  block: string;
  number: string;
  location: GeoJSON.Point | null;
  occupancy_status: string | null;
}

interface MemberRow {
  id: string;
  full_name: string;
  is_head: boolean | null;
  member_type: string | null;
  status: string | null;
  house_id: string;
}

const FALLBACK_CENTER: [number, number] = [-6.4716656, 106.7561462];
const FALLBACK_ZOOM = 19;

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useMemo(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const { user, isAdmin, isPengurus } = useAuth();
  const queryClient = useQueryClient();
  const { naturalSort } = useNaturalSort();
  const canManageAny = isAdmin() || isPengurus();

  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [pickerHouseId, setPickerHouseId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [streetFilter, setStreetFilter] = useState<string>("all");

  const { data: userHouseId } = useQuery({
    queryKey: ["user-house-id-map", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_members")
        .select("house_id")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data?.house_id ?? null;
    },
  });

  const { data: houses, isLoading } = useQuery({
    queryKey: ["map-houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("id, block, number, location, occupancy_status")
        .order("block")
        .order("number");
      if (error) throw error;
      return (data || []) as unknown as HouseRow[];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["map-house-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_members")
        .select("id, full_name, is_head, member_type, status, house_id")
        .eq("status", "approved");
      if (error) throw error;
      return (data || []) as MemberRow[];
    },
  });

  const membersByHouse = useMemo(() => {
    const map = new Map<string, MemberRow[]>();
    (members || []).forEach((m) => {
      const arr = map.get(m.house_id) || [];
      arr.push(m);
      map.set(m.house_id, arr);
    });
    return map;
  }, [members]);

  const pinned = useMemo(
    () =>
      (houses || []).filter(
        (h) => h.location && Array.isArray(h.location.coordinates)
      ),
    [houses]
  );

  const sortedHouses = useMemo(() => {
    return [...(houses || [])].sort((a, b) => {
      const blockSort = naturalSort(a.block, b.block);
      if (blockSort !== 0) return blockSort;
      return naturalSort(a.number, b.number);
    });
  }, [houses, naturalSort]);

  const center = useMemo<[number, number]>(() => {
    if (pinned.length === 0) return FALLBACK_CENTER;
    const lats = pinned.map((h) => h.location!.coordinates[1]);
    const lngs = pinned.map((h) => h.location!.coordinates[0]);
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [pinned]);

  // Houses with coords for street nearby calc
  const housesWithCoords = useMemo(
    () =>
      pinned.map((h) => ({
        id: h.id,
        block: h.block,
        number: h.number,
        lat: h.location!.coordinates[1],
        lng: h.location!.coordinates[0],
      })),
    [pinned]
  );

  const userHouse = useMemo(
    () => (userHouseId ? houses?.find((h) => h.id === userHouseId) ?? null : null),
    [houses, userHouseId]
  );

  // Map house id -> nearest street name
  const streetByHouseId = useMemo(() => {
    const map = new Map<string, string | null>();
    housesWithCoords.forEach((h) => {
      map.set(h.id, getStreetForPoint(h.lat, h.lng));
    });
    return map;
  }, [housesWithCoords]);

  // Apply filters: search (block, number, member name) + street
  const filteredHouseIds = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const ids = new Set<string>();
    (houses || []).forEach((h) => {
      // street filter
      if (streetFilter !== "all") {
        const s = streetByHouseId.get(h.id);
        if (s !== streetFilter) return;
      }
      if (!term) {
        ids.add(h.id);
        return;
      }
      const label = `${h.block}-${h.number}`.toLowerCase();
      if (
        h.block.toLowerCase().includes(term) ||
        h.number.toLowerCase().includes(term) ||
        label.includes(term)
      ) {
        ids.add(h.id);
        return;
      }
      const mems = membersByHouse.get(h.id) || [];
      if (mems.some((m) => m.full_name.toLowerCase().includes(term))) {
        ids.add(h.id);
      }
    });
    return ids;
  }, [houses, membersByHouse, searchTerm, streetFilter, streetByHouseId]);

  const isFiltering = searchTerm.trim() !== "" || streetFilter !== "all";

  const filteredPinned = useMemo(
    () => (isFiltering ? pinned.filter((h) => filteredHouseIds.has(h.id)) : pinned),
    [pinned, filteredHouseIds, isFiltering]
  );

  const filteredHousesWithCoords = useMemo(
    () =>
      isFiltering
        ? housesWithCoords.filter((h) => filteredHouseIds.has(h.id))
        : housesWithCoords,
    [housesWithCoords, filteredHouseIds, isFiltering]
  );

  const filteredSortedHouses = useMemo(
    () =>
      isFiltering
        ? sortedHouses.filter((h) => filteredHouseIds.has(h.id))
        : sortedHouses,
    [sortedHouses, filteredHouseIds, isFiltering]
  );

  const clearFilters = () => {
    setSearchTerm("");
    setStreetFilter("all");
  };

  const selectedHouse = houses?.find((h) => h.id === selectedHouseId) || null;
  const selectedMembers = selectedHouseId ? membersByHouse.get(selectedHouseId) || [] : [];

  // Picker state for admin/pengurus to set any house location
  const pickerHouse = houses?.find((h) => h.id === pickerHouseId) || null;
  const [pickerPoint, setPickerPoint] = useState<[number, number] | null>(null);

  const openPicker = (house: HouseRow) => {
    setPickerHouseId(house.id);
    setPickerPoint(
      house.location ? [house.location.coordinates[1], house.location.coordinates[0]] : null
    );
  };

  const closePicker = () => {
    setPickerHouseId(null);
    setPickerPoint(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!pickerHouseId) return;
      const geo = pickerPoint
        ? { type: "Point", coordinates: [pickerPoint[1], pickerPoint[0]] }
        : null;
      const { error } = await supabase
        .from("houses")
        .update({ location: geo })
        .eq("id", pickerHouseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lokasi rumah berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: ["map-houses"] });
      queryClient.invalidateQueries({ queryKey: ["user-house"] });
      closePicker();
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menyimpan lokasi"),
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation tidak tersedia");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setPickerPoint([pos.coords.latitude, pos.coords.longitude]),
      () => toast.error("Tidak dapat mengakses lokasi"),
      { enableHighAccuracy: true }
    );
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" /> Peta Warga
        </h1>
        <p className="text-sm text-muted-foreground">
          Klik marker untuk melihat anggota rumah
        </p>
      </div>

      {/* Filter card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" /> Filter Rumah
          </CardTitle>
          <CardDescription className="text-xs">
            Cari berdasarkan blok, nomor rumah, nama anggota, atau jalan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari blok, nomor rumah, atau nama anggota..."
                className="pl-8 pr-8"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <Select value={streetFilter} onValueChange={setStreetFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Semua jalan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua jalan</SelectItem>
                {STREETS.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isFiltering && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="w-4 h-4" /> Reset
              </Button>
            )}
          </div>
          {isFiltering && (
            <p className="text-xs text-muted-foreground mt-2">
              {filteredHouseIds.size} rumah cocok dengan filter
              {filteredPinned.length < filteredHouseIds.size &&
                ` (${filteredPinned.length} terpasang di peta)`}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isFiltering
              ? `${filteredPinned.length} dari ${pinned.length} rumah ditampilkan`
              : `${pinned.length} rumah terpasang di peta`}
          </CardTitle>
          <CardDescription className="text-xs">
            {canManageAny
              ? "Sebagai Admin/Pengurus, Anda dapat mengatur lokasi rumah mana pun."
              : userHouseId
                ? "Anda dapat mengatur atau memperbarui lokasi rumah Anda dari sini."
                : "Anda belum terdaftar sebagai anggota rumah."}
          </CardDescription>
          {userHouseId && userHouse && (
            <div className="pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPicker(userHouse)}
                className="gap-1.5"
              >
                {userHouse.location ? (
                  <Pencil className="w-4 h-4" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {userHouse.location
                  ? `Edit Lokasi Rumah Saya (${userHouse.block}-${userHouse.number})`
                  : `Tambahkan Lokasi Rumah Saya (${userHouse.block}-${userHouse.number})`}
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-[60vh] flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="h-[60vh] w-full rounded-md overflow-hidden border">
              <MapContainer
                center={center}
                zoom={pinned.length > 0 ? 19 : FALLBACK_ZOOM}
                maxZoom={22}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  maxNativeZoom={19}
                  maxZoom={22}
                />
                <StreetsLayer
                  houses={filteredHousesWithCoords}
                  onHouseClick={(id) => setSelectedHouseId(id)}
                />
                {filteredPinned.map((h) => {
                  const [lng, lat] = h.location!.coordinates;
                  return (
                    <Marker
                      key={h.id}
                      position={[lat, lng]}
                      icon={houseIcon}
                      eventHandlers={{
                        click: () => setSelectedHouseId(h.id),
                      }}
                    />
                  );
                })}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {canManageAny && houses && houses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kelola Lokasi Rumah</CardTitle>
            <CardDescription className="text-xs">
              Pilih rumah untuk mengatur atau memperbarui pin lokasinya
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
              {filteredSortedHouses.map((h, index) => {
                const hasPin = !!h.location;
                return (
                  <motion.div
                    key={h.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.01 }}
                  >
                    <Card
                      className={cn(
                        "group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden relative aspect-square flex items-center justify-center",
                        hasPin
                          ? "border-primary/20 bg-gradient-to-br from-white to-primary/5 hover:border-primary/50"
                          : "border-muted bg-muted/20 hover:opacity-100"
                      )}
                      onClick={() => openPicker(h)}
                    >
                      <CardContent className="p-3 sm:p-4 text-center flex flex-col items-center justify-center w-full h-full relative z-10">
                        <div className="absolute top-1 right-1">
                          {hasPin ? (
                            <MapPin className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-primary tracking-tighter group-hover:scale-110 transition-transform">
                          {h.block}
                          <span className="text-primary/40 font-normal mx-0.5">-</span>
                          {h.number}
                        </div>
                        <div className="mt-1.5 sm:mt-2 py-0.5 px-2 rounded-full bg-background/50 border border-border/50 backdrop-blur-sm shadow-sm">
                          <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            {hasPin ? "Terpasang" : "Belum"}
                          </span>
                        </div>
                      </CardContent>
                      <div className="absolute -bottom-2 -right-2 opacity-[0.04] group-hover:opacity-[0.08] transition-opacity">
                        <MapPin className="h-16 w-16 sm:h-20 sm:w-20" />
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* House detail dialog */}
      <Dialog
        open={!!selectedHouseId}
        onOpenChange={(o) => !o && setSelectedHouseId(null)}
      >
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="w-5 h-5 text-primary" />
              Blok {selectedHouse?.block} No. {selectedHouse?.number}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {selectedHouse?.occupancy_status || "-"}
              </Badge>
              <span className="text-xs">
                {selectedMembers.length} anggota terdaftar
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {selectedMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Belum ada anggota terdaftar
              </p>
            ) : (
              selectedMembers
                .sort((a, b) => (b.is_head ? 1 : 0) - (a.is_head ? 1 : 0))
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 p-2 rounded-md border bg-muted/30"
                  >
                    {m.is_head ? (
                      <Crown className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.full_name}</p>
                      {m.member_type && (
                        <p className="text-xs text-muted-foreground capitalize">
                          {m.member_type}
                        </p>
                      )}
                    </div>
                    {m.is_head && (
                      <Badge variant="secondary" className="text-xs">
                        Kepala Keluarga
                      </Badge>
                    )}
                  </div>
                ))
            )}
          </div>

          {canManageAny && selectedHouse && (
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  openPicker(selectedHouse);
                  setSelectedHouseId(null);
                }}
              >
                <Pencil className="w-4 h-4 mr-1" /> Atur Pin Lokasi
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Admin/Pengurus location picker dialog */}
      <Dialog open={!!pickerHouseId} onOpenChange={(o) => !o && closePicker()}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <MapPin className="w-5 h-5 text-primary shrink-0" />
              <span className="truncate">
                Atur Lokasi Blok {pickerHouse?.block} No. {pickerHouse?.number}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Klik pada peta untuk menentukan posisi rumah
            </DialogDescription>
          </DialogHeader>

          <div className="h-[40vh] sm:h-[50vh] w-full rounded-md overflow-hidden border relative z-0 leaflet-container-isolated">
            <MapContainer
              center={pickerPoint || center}
              zoom={pickerPoint ? 19 : 17}
              maxZoom={22}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxNativeZoom={19}
                maxZoom={22}
              />
              <PickerClickHandler onPick={(lat, lng) => setPickerPoint([lat, lng])} />
              {pickerPoint && (
                <>
                  <Recenter center={pickerPoint} zoom={19} />
                  <Marker position={pickerPoint} />
                </>
              )}
            </MapContainer>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
              <Crosshair className="w-4 h-4 mr-1" /> Lokasi Saya
            </Button>
            {pickerPoint && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPickerPoint(null)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Hapus Pin
              </Button>
            )}
            {pickerPoint && (
              <span className="text-xs text-muted-foreground">
                {pickerPoint[0].toFixed(6)}, {pickerPoint[1].toFixed(6)}
              </span>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={closePicker} className="w-full sm:w-auto">
              Batal
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="w-full sm:w-auto"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PickerClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
