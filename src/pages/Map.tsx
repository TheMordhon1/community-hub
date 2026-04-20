import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, Crown, Users, Crosshair, Save, Trash2, Pencil, Home } from "lucide-react";
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

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
const FALLBACK_ZOOM = 18;

function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap();
  useMemo(() => {
    map.setView(center, zoom ?? map.getZoom());
  }, [center, zoom, map]);
  return null;
}

export default function MapPage() {
  const { isAdmin, isPengurus } = useAuth();
  const queryClient = useQueryClient();
  const canManageAny = isAdmin || isPengurus;

  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [pickerHouseId, setPickerHouseId] = useState<string | null>(null);

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

  const center = useMemo<[number, number]>(() => {
    if (pinned.length === 0) return FALLBACK_CENTER;
    const lats = pinned.map((h) => h.location!.coordinates[1]);
    const lngs = pinned.map((h) => h.location!.coordinates[0]);
    return [
      lats.reduce((a, b) => a + b, 0) / lats.length,
      lngs.reduce((a, b) => a + b, 0) / lngs.length,
    ];
  }, [pinned]);

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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {pinned.length} rumah terpasang di peta
          </CardTitle>
          <CardDescription className="text-xs">
            {canManageAny
              ? "Sebagai Admin/Pengurus, Anda dapat mengatur lokasi rumah mana pun."
              : "Atur lokasi rumah Anda di halaman Profil."}
          </CardDescription>
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
                zoom={pinned.length > 0 ? 18 : FALLBACK_ZOOM}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {pinned.map((h) => {
                  const [lng, lat] = h.location!.coordinates;
                  return (
                    <Marker
                      key={h.id}
                      position={[lat, lng]}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
              {houses.map((h) => (
                <Button
                  key={h.id}
                  variant="outline"
                  size="sm"
                  className="justify-between"
                  onClick={() => openPicker(h)}
                >
                  <span className="truncate">
                    Blok {h.block}/{h.number}
                  </span>
                  {h.location ? (
                    <MapPin className="w-3 h-3 text-primary shrink-0" />
                  ) : (
                    <Pencil className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* House detail dialog */}
      <Dialog
        open={!!selectedHouseId}
        onOpenChange={(o) => !o && setSelectedHouseId(null)}
      >
        <DialogContent className="max-w-md">
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
              zoom={pickerPoint ? 18 : 17}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <PickerClickHandler onPick={(lat, lng) => setPickerPoint([lat, lng])} />
              {pickerPoint && (
                <>
                  <Recenter center={pickerPoint} zoom={18} />
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

          <DialogFooter>
            <Button variant="outline" onClick={closePicker}>
              Batal
            </Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
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
