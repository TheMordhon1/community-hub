import { Polyline, Popup, Tooltip } from "react-leaflet";
import { Home } from "lucide-react";

export interface StreetDef {
  name: string;
  // Polyline path [lat, lng][]
  path: [number, number][];
  color: string;
}

// Approximate paths around Pesona Kenari Townhouse (-6.4716656, 106.7561462)
// These are rough local roads — admin can refine later via DB.
export const STREETS: StreetDef[] = [
  {
    name: "Jln. Sakura 1",
    color: "#22c55e",
    path: [
      [-6.47135, 106.75575],
      [-6.47150, 106.75640],
    ],
  },
  {
    name: "Jln. Sakura 2",
    color: "#22c55e",
    path: [
      [-6.47165, 106.75575],
      [-6.47180, 106.75645],
    ],
  },
  {
    name: "Jln. Lotus 1",
    color: "#16a34a",
    path: [
      [-6.47195, 106.75575],
      [-6.47210, 106.75645],
    ],
  },
  {
    name: "Jln. Lotus 2",
    color: "#16a34a",
    path: [
      [-6.47225, 106.75580],
      [-6.47240, 106.75650],
    ],
  },
];

interface NearbyHouse {
  id: string;
  block: string;
  number: string;
  lat: number;
  lng: number;
}

interface Props {
  houses: NearbyHouse[];
  onHouseClick?: (id: string) => void;
}

// Haversine distance in meters
function distMeters(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Distance from point P to segment AB (meters, approximated)
function distToSegment(
  p: [number, number],
  a: [number, number],
  b: [number, number]
) {
  // Convert to local meters using equirectangular approximation around midpoint
  const midLat = (a[0] + b[0]) / 2;
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos((midLat * Math.PI) / 180);
  const ax = a[1] * mPerDegLng;
  const ay = a[0] * mPerDegLat;
  const bx = b[1] * mPerDegLng;
  const by = b[0] * mPerDegLat;
  const px = p[1] * mPerDegLng;
  const py = p[0] * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return distMeters(p, a);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export const NEARBY_THRESHOLD_M = 30;

export function getStreetForPoint(lat: number, lng: number): string | null {
  let best: { name: string; d: number } | null = null;
  for (const s of STREETS) {
    for (let i = 0; i < s.path.length - 1; i++) {
      const d = distToSegment([lat, lng], s.path[i], s.path[i + 1]);
      if (d <= NEARBY_THRESHOLD_M && (!best || d < best.d)) {
        best = { name: s.name, d };
      }
    }
  }
  return best?.name ?? null;
}

export function StreetsLayer({ houses, onHouseClick }: Props) {
  return (
    <>
      {STREETS.map((s) => {
        // find nearby houses (within threshold of any segment)
        const nearby = houses.filter((h) => {
          for (let i = 0; i < s.path.length - 1; i++) {
            const d = distToSegment([h.lat, h.lng], s.path[i], s.path[i + 1]);
            if (d <= NEARBY_THRESHOLD_M) return true;
          }
          return false;
        });

        return (
          <Polyline
            key={s.name}
            positions={s.path}
            pathOptions={{
              color: s.color,
              weight: 8,
              opacity: 0.7,
              lineCap: "round",
            }}
          >
            <Tooltip direction="center" permanent className="street-label">
              <span className="text-xs font-bold">{s.name}</span>
            </Tooltip>
            <Popup>
              <div className="min-w-[180px]">
                <div className="font-bold text-sm mb-1.5 text-foreground">{s.name}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {nearby.length} rumah di sekitar
                </div>
                {nearby.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">
                    Belum ada rumah terpasang
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {nearby.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => onHouseClick?.(h.id)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-primary/30 bg-primary/5 hover:bg-primary/10 text-[11px] font-semibold"
                      >
                        <Home className="w-3 h-3" />
                        {h.block}-{h.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </Polyline>
        );
      })}
    </>
  );
}
