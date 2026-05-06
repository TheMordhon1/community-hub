import { Polyline, Popup, Tooltip, Marker } from "react-leaflet";
import { Home } from "lucide-react";
import L from "leaflet";

export interface StreetDef {
  name: string;
  // Polyline path [lat, lng][] or multi-segment [lat, lng][][]
  path: [number, number][] | [number, number][][];
  color: string;
}

// Approximate paths around Pesona Kenari Townhouse (-6.4716656, 106.7561462)
// These are rough local roads — admin can refine later via DB.
// Real road geometry from OpenStreetMap (Pesona Kenari Townhouse area)
// 4 parallel internal residential streets that go diagonally from SW → NE
export const STREETS: StreetDef[] = [
  {
    name: "Jln. Sakura 1",
    color: "#FFFFFF",
    path: [
      [-6.4715144, 106.7564048],
      [-6.4716751, 106.7560504],
      [-6.4718782, 106.7556618],
    ],
  },
  {
    name: "Jln. Sakura 2",
    color: "#FFFFFF",
    path: [
      [-6.4717520, 106.7565311],
      [-6.4719200, 106.7561606],
      [-6.4720676, 106.7558585],
    ],
  },
  {
    name: "Jln. Lotus 1",
    color: "#FFFFFF",
    path: [
      [-6.4719667, 106.7566317],
      [-6.4721362, 106.7562782],
      [-6.4722513, 106.7560427],
    ],
  },
  {
    name: "Jln. Lotus 2",
    color: "#FFFFFF",
    path: [
      [-6.4721738, 106.7567203],
      [-6.4721953, 106.7566878],
      [-6.4723073, 106.7564665],
      [-6.4723243, 106.7564221],
      [-6.4723099, 106.7563941],
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
    const paths = Array.isArray(s.path[0][0])
      ? (s.path as [number, number][][])
      : [s.path as [number, number][]];

    for (const p of paths) {
      for (let i = 0; i < p.length - 1; i++) {
        const d = distToSegment([lat, lng], p[i], p[i + 1]);
        if (d <= NEARBY_THRESHOLD_M && (!best || d < best.d)) {
          best = { name: s.name, d };
        }
      }
    }
  }
  return best?.name ?? null;
}

export function StreetsLayer({ houses, onHouseClick }: Props) {
  // Assign each house to its single nearest street (same logic as filter)
  const housesByStreet = (() => {
    const map = new Map<string, NearbyHouse[]>();
    STREETS.forEach((s) => map.set(s.name, []));
    houses.forEach((h) => {
      const street = getStreetForPoint(h.lat, h.lng);
      if (street && map.has(street)) {
        map.get(street)!.push(h);
      }
    });
    return map;
  })();

  return (
    <>
      {STREETS.map((s, index) => {
        const nearby = housesByStreet.get(s.name) || [];
        const paths = Array.isArray(s.path[0][0])
          ? (s.path as [number, number][][])
          : [s.path as [number, number][]];

        // Place label on the longest segment
        let labelPath = paths[0];
        let maxD = 0;
        paths.forEach((p) => {
          const d = distMeters(p[0], p[p.length - 1]);
          if (d > maxD) {
            maxD = d;
            labelPath = p;
          }
        });
        const labelPos = labelPath[Math.floor(labelPath.length / 1.9)];

        return (
          <div key={`${s.name}-${index}`}>
            {paths.map((p, idx) => (
              <Polyline
                key={`${s.name}-p-${idx}`}
                positions={p}
                pathOptions={{
                  color: s.color,
                  weight: 8,
                  opacity: 0.7,
                  lineCap: "round",
                  interactive: false,
                }}
              />
            ))}
            <Marker
              position={labelPos}
              icon={L.divIcon({
                className: "street-label-icon",
                html: `<div class="leaflet-tooltip street-label permanent" style="cursor: pointer; transform: rotate(-23deg);">${s.name}</div>`,
                iconSize: [80, 24],
                iconAnchor: [40, 12],
              })}
            >
              <Popup offset={[0, -10]}>
                <div className="min-w-[180px]">
                  <div className="font-bold text-base mb-1 text-foreground">{s.name}</div>
                  <div className="text-xs text-muted-foreground mb-3">
                    {nearby.length} rumah di sekitar
                  </div>
                  {nearby.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">
                      Belum ada rumah terpasang
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                      {nearby.map((h) => (
                        <button
                          key={h.id}
                          onClick={() => onHouseClick?.(h.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-[12px] font-bold text-foreground"
                        >
                          <Home className="w-3.5 h-3.5 text-primary" />
                          {h.block}-{h.number}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </>
  );
}
