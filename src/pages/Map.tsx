import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

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

const FALLBACK_CENTER: [number, number] = [-6.4716656, 106.7561462];
const FALLBACK_ZOOM = 18;

export default function MapPage() {
  const { data: houses, isLoading } = useQuery({
    queryKey: ["map-houses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("id, block, number, location, occupancy_status");
      if (error) throw error;
      return (data || []) as unknown as HouseRow[];
    },
  });

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

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MapPin className="w-6 h-6 text-primary" /> Peta Warga
        </h1>
        <p className="text-sm text-muted-foreground">
          Lokasi rumah warga yang sudah dipasang pin pada peta
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {pinned.length} rumah terpasang di peta
          </CardTitle>
          <CardDescription className="text-xs">
            Klik marker untuk melihat detail rumah. Atur lokasi rumah Anda di halaman Profil.
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
                zoom={pinned.length > 0 ? 16 : 12}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {pinned.map((h) => {
                  const [lng, lat] = h.location!.coordinates;
                  return (
                    <Marker key={h.id} position={[lat, lng]}>
                      <Popup>
                        <div className="space-y-2">
                          <div className="font-semibold">
                            Blok {h.block} No. {h.number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Status: {h.occupancy_status || "-"}
                          </div>
                          <Button asChild size="sm" variant="outline" className="h-7">
                            <Link to="/residents">Lihat Daftar Rumah</Link>
                          </Button>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
