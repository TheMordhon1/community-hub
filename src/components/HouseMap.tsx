import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import Konva from "konva";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, ZoomIn, ZoomOut, Grid3X3 } from "lucide-react";
import type { House } from "@/types/database";

interface HouseMapProps {
  editable?: boolean;
}

interface Resident {
  id: string;
  full_name: string;
  is_owner: boolean;
}

interface HouseWithResidents extends House {
  residents?: Resident[];
}

const GRID_SIZE = 20;

export function HouseMap({ editable = false }: HouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [hoveredHouse, setHoveredHouse] = useState<string | null>(null);
  const [selectedHouse, setSelectedHouse] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const { canManageContent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: houses, isLoading } = useQuery({
    queryKey: ["houses-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (error) throw error;
      return data as House[];
    },
  });

  const { data: residents } = useQuery({
    queryKey: ["house-residents-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("house_residents")
        .select("house_id, is_owner, user_id");

      if (error) throw error;
      
      // Get profiles for each resident
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        
        return data.map(r => ({
          house_id: r.house_id,
          is_owner: r.is_owner,
          user_id: r.user_id,
          full_name: profiles?.find(p => p.id === r.user_id)?.full_name || 'Unknown'
        }));
      }
      
      return [];
    },
  });

  // Map residents to houses
  const housesWithResidents: HouseWithResidents[] = houses?.map(house => ({
    ...house,
    residents: residents
      ?.filter(r => r.house_id === house.id)
      .map(r => ({
        id: r.user_id || '',
        full_name: r.full_name,
        is_owner: r.is_owner || false
      })) || []
  })) || [];

  // Initialize positions from houses data
  useEffect(() => {
    if (houses) {
      const initialPositions: Record<string, { x: number; y: number }> = {};
      houses.forEach((house) => {
        initialPositions[house.id] = {
          x: house.x_position || 50,
          y: house.y_position || 50,
        };
      });
      setPositions(initialPositions);
    }
  }, [houses]);

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        setStageSize({ width, height: 500 });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = Object.entries(positions).map(([id, pos]) => ({
        id,
        x_position: pos.x,
        y_position: pos.y,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("houses")
          .update({
            x_position: update.x_position,
            y_position: update.y_position,
          })
          .eq("id", update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["houses-map"] });
      toast({ title: "Berhasil", description: "Posisi rumah berhasil disimpan" });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menyimpan posisi rumah",
      });
    },
  });

  const snapToGridValue = (value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  };

  const handleDragEnd = useCallback(
    (houseId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      let x = node.x();
      let y = node.y();

      if (snapToGrid) {
        x = snapToGridValue(x);
        y = snapToGridValue(y);
        node.x(x);
        node.y(y);
      }

      setPositions((prev) => ({
        ...prev,
        [houseId]: { x, y },
      }));
      setHasChanges(true);
    },
    [snapToGrid]
  );

  const handleHouseMouseEnter = (houseId: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    setHoveredHouse(houseId);
    const stage = e.target.getStage();
    if (stage) {
      const pointer = stage.getPointerPosition();
      if (pointer) {
        setTooltipPos({ x: pointer.x, y: pointer.y });
      }
    }
  };

  const handleHouseMouseLeave = () => {
    setHoveredHouse(null);
  };

  const handleHouseClick = (houseId: string) => {
    setSelectedHouse(selectedHouse === houseId ? null : houseId);
  };

  const handleReset = () => {
    if (houses) {
      const initialPositions: Record<string, { x: number; y: number }> = {};
      houses.forEach((house) => {
        initialPositions[house.id] = {
          x: house.x_position || 50,
          y: house.y_position || 50,
        };
      });
      setPositions(initialPositions);
      setHasChanges(false);
    }
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.2, 2));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.2, 0.5));

  const getHouseColor = (house: House) => {
    return house.is_occupied ? "#22c55e" : "#94a3b8";
  };

  const getActiveHouse = () => {
    const activeId = selectedHouse || hoveredHouse;
    return housesWithResidents.find(h => h.id === activeId);
  };

  // Generate grid lines
  const gridLines = [];
  if (snapToGrid) {
    const gridWidth = stageSize.width / scale;
    const gridHeight = stageSize.height / scale;
    
    for (let i = 0; i <= gridWidth; i += GRID_SIZE) {
      gridLines.push(
        <Line
          key={`v-${i}`}
          points={[i, 0, i, gridHeight]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }
    for (let i = 0; i <= gridHeight; i += GRID_SIZE) {
      gridLines.push(
        <Line
          key={`h-${i}`}
          points={[0, i, gridWidth, i]}
          stroke="#e2e8f0"
          strokeWidth={0.5}
          opacity={0.5}
        />
      );
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const isEditable = editable && canManageContent();
  const activeHouse = getActiveHouse();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Peta Rumah</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          {isEditable && (
            <>
              <Button
                variant={snapToGrid ? "default" : "outline"}
                size="icon"
                onClick={() => setSnapToGrid(!snapToGrid)}
                title="Grid Snapping"
              >
                <Grid3X3 className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={!hasChanges}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={!hasChanges || saveMutation.isPending}
              >
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500" />
            <span className="text-sm text-muted-foreground">Dihuni</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-slate-400" />
            <span className="text-sm text-muted-foreground">Kosong</span>
          </div>
        </div>

        {/* Resident info panel */}
        {activeHouse && (
          <div className="mb-4 p-3 bg-muted rounded-lg border">
            <div className="font-semibold text-sm mb-1">
              Blok {activeHouse.block}{activeHouse.number}
            </div>
            {activeHouse.residents && activeHouse.residents.length > 0 ? (
              <div className="space-y-1">
                {activeHouse.residents.map((resident) => (
                  <div key={resident.id} className="text-sm flex items-center gap-2">
                    <span>{resident.full_name}</span>
                    {resident.is_owner && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        Pemilik
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Tidak ada penghuni</span>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          className="border rounded-lg overflow-hidden bg-muted/20 relative"
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={scale}
            scaleY={scale}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedHouse(null);
              }
            }}
          >
            <Layer>
              {gridLines}
              {housesWithResidents?.map((house) => {
                const pos = positions[house.id] || { x: 50, y: 50 };
                const houseWidth = house.width || 60;
                const houseHeight = house.height || 60;
                const isActive = house.id === selectedHouse || house.id === hoveredHouse;

                return (
                  <Group
                    key={house.id}
                    x={pos.x}
                    y={pos.y}
                    draggable={isEditable}
                    onDragEnd={(e) => handleDragEnd(house.id, e)}
                    onMouseEnter={(e) => handleHouseMouseEnter(house.id, e)}
                    onMouseLeave={handleHouseMouseLeave}
                    onClick={() => handleHouseClick(house.id)}
                    onTap={() => handleHouseClick(house.id)}
                  >
                    <Rect
                      width={houseWidth}
                      height={houseHeight}
                      fill={getHouseColor(house)}
                      cornerRadius={4}
                      shadowColor="black"
                      shadowBlur={isActive ? 8 : 4}
                      shadowOpacity={isActive ? 0.4 : 0.2}
                      shadowOffsetY={2}
                      stroke={isActive ? "#3b82f6" : undefined}
                      strokeWidth={isActive ? 2 : 0}
                    />
                    <Text
                      text={`${house.block}${house.number}`}
                      width={houseWidth}
                      height={houseHeight}
                      align="center"
                      verticalAlign="middle"
                      fill="white"
                      fontSize={12}
                      fontStyle="bold"
                    />
                  </Group>
                );
              })}
            </Layer>
          </Stage>
        </div>
        {isEditable && (
          <p className="text-sm text-muted-foreground mt-2">
            Seret rumah untuk mengatur posisi di peta. {snapToGrid && "Grid snapping aktif."}
          </p>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          Klik atau arahkan kursor ke rumah untuk melihat penghuni
        </p>
      </CardContent>
    </Card>
  );
}