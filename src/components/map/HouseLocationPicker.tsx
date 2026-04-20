import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Save, Loader2, Crosshair, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Fix default marker icons (vite/leaflet bundling issue)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [14, 24],
  iconAnchor: [7, 24],
  popupAnchor: [0, -24],
  shadowSize: [24, 24],
  shadowAnchor: [7, 24]
});

interface Props {
  houseId: string;
  initialLocation: GeoJSON.Point | null;
  houseLabel: string;
}

const DEFAULT_CENTER: [number, number] = [-6.4716656, 106.7561462]; // Pesona Kenari Townhouse

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() < 15 ? 17 : map.getZoom());
  }, [center, map]);
  return null;
}

export function HouseLocationPicker({ houseId, initialLocation, houseLabel }: Props) {
  const queryClient = useQueryClient();
  const [point, setPoint] = useState<[number, number] | null>(
    initialLocation ? [initialLocation.coordinates[1], initialLocation.coordinates[0]] : null
  );
  const [center, setCenter] = useState<[number, number]>(point || DEFAULT_CENTER);
  const mapRef = useRef<L.Map | null>(null);

  const saveMutation = useMutation({
    mutationFn: async (coords: [number, number] | null) => {
      const geo = coords
        ? { type: "Point", coordinates: [coords[1], coords[0]] }
        : null;
      const { error } = await supabase
        .from("houses")
        .update({ location: geo })
        .eq("id", houseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lokasi rumah berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: ["user-house"] });
      queryClient.invalidateQueries({ queryKey: ["map-houses"] });
    },
    onError: (e: Error) => toast.error(e.message || "Gagal menyimpan lokasi"),
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation tidak tersedia");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPoint(next);
        setCenter(next);
      },
      () => toast.error("Tidak dapat mengakses lokasi"),
      { enableHighAccuracy: true }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Lokasi Rumah di Peta
        </CardTitle>
        <CardDescription className="text-xs">
          Klik pada peta untuk menentukan posisi {houseLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-64 sm:h-80 w-full rounded-md overflow-hidden border">
          <MapContainer
            center={center}
            zoom={point ? 18 : 18}
            style={{ height: "100%", width: "100%" }}
            ref={(m) => {
              if (m) mapRef.current = m;
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ClickHandler onPick={(lat, lng) => setPoint([lat, lng])} />
            <Recenter center={center} />
            {point && <Marker position={point} />}
          </MapContainer>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={useMyLocation}>
            <Crosshair className="w-4 h-4 mr-1" /> Gunakan Lokasi Saya
          </Button>
          {point && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPoint(null)}
            >
              <Trash2 className="w-4 h-4 mr-1" /> Hapus Pin
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="ml-auto"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(point)}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1" />
            )}
            Simpan Lokasi
          </Button>
        </div>
        {point && (
          <p className="text-xs text-muted-foreground">
            Koordinat: {point[0].toFixed(6)}, {point[1].toFixed(6)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
