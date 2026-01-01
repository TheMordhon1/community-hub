import { useRef, useState, useEffect, useCallback } from "react";
import { Stage, Layer, Rect, Text, Group } from "react-konva";
import Konva from "konva";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import type { House } from "@/types/database";

interface HouseMapProps {
  editable?: boolean;
}

export function HouseMap({ editable = false }: HouseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hasChanges, setHasChanges] = useState(false);
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

  const handleDragEnd = useCallback(
    (houseId: string, e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target;
      setPositions((prev) => ({
        ...prev,
        [houseId]: { x: node.x(), y: node.y() },
      }));
      setHasChanges(true);
    },
    []
  );

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
        <div
          ref={containerRef}
          className="border rounded-lg overflow-hidden bg-muted/20"
        >
          <Stage
            ref={stageRef}
            width={stageSize.width}
            height={stageSize.height}
            scaleX={scale}
            scaleY={scale}
          >
            <Layer>
              {houses?.map((house) => {
                const pos = positions[house.id] || { x: 50, y: 50 };
                const houseWidth = house.width || 60;
                const houseHeight = house.height || 60;

                return (
                  <Group
                    key={house.id}
                    x={pos.x}
                    y={pos.y}
                    draggable={isEditable}
                    onDragEnd={(e) => handleDragEnd(house.id, e)}
                  >
                    <Rect
                      width={houseWidth}
                      height={houseHeight}
                      fill={getHouseColor(house)}
                      cornerRadius={4}
                      shadowColor="black"
                      shadowBlur={4}
                      shadowOpacity={0.2}
                      shadowOffsetY={2}
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
            Seret rumah untuk mengatur posisi di peta
          </p>
        )}
      </CardContent>
    </Card>
  );
}
