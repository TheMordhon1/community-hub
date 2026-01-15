import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home,
  Search,
  User,
  Crown,
  Users,
  ArrowLeft,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNaturalSort } from "@/hooks/useNaturalSort";
import { getInitials } from "@/lib/utils";

interface HouseResident {
  id: string;
  user_id: string;
  is_owner: boolean;
  move_in_date: string | null;
  profiles: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
  };
}

interface HouseWithResidents {
  id: string;
  block: string;
  number: string;
  is_occupied: boolean;
  residents: HouseResident[];
}

type HouseType = "all" | "registered" | "unregistered";

export default function Residents() {
  const { naturalSort } = useNaturalSort();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHouse, setSelectedHouse] = useState<HouseWithResidents | null>(
    null
  );
  const [filterType, setFilterType] = useState<HouseType>("all");

  const { data: houses, isLoading } = useQuery({
    queryKey: ["houses-with-residents"],
    queryFn: async () => {
      // Fetch all houses
      const { data: housesData, error: housesError } = await supabase
        .from("houses")
        .select("*")
        .order("block")
        .order("number");

      if (housesError) throw housesError;

      // Fetch all residents
      const { data: residentsData, error: residentsError } = await supabase
        .from("house_residents")
        .select("id, user_id, house_id, is_owner, move_in_date");

      if (residentsError) throw residentsError;

      // Fetch profiles for all residents
      const userIds = [...new Set((residentsData || []).map((r) => r.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

      // Map residents to houses
      const housesWithResidents: HouseWithResidents[] = housesData.map(
        (house) => ({
          ...house,
          residents: (residentsData || [])
            .filter((r) => r.house_id === house.id)
            .map((r) => ({
              id: r.id,
              user_id: r.user_id,
              is_owner: r.is_owner || false,
              move_in_date: r.move_in_date,
              profiles: profilesMap.get(r.user_id) as HouseResident["profiles"],
            }))
            .filter((r) => r.profiles),
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
        .map((r) => r.profiles?.full_name?.toLowerCase() || "")
        .join(" ");

      const matchesSearch =
        houseLabel.includes(searchLower) || residentNames.includes(searchLower);

      let matchesFilter = true;
      if (filterType === "registered") {
        matchesFilter = house.residents.length > 0;
      } else if (filterType === "unregistered") {
        matchesFilter = house.residents.length === 0;
      }
      // filterType === "all" matches everything

      return matchesSearch && matchesFilter;
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 space-y-6">
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
    <div className="container mx-auto py-6 px-4 space-y-6">
      <div className="flex w-full flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Daftar Rumah & Penghuni</h1>
            <p className="text-muted-foreground">
              Lihat nomer rumah dan penghuni PKT
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 justify-between">
          <div className="relative flex-1 w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari rumah atau penghuni..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-1 items-center">
            <Select
              value={filterType}
              onValueChange={(value: HouseType) => setFilterType(value)}
            >
              <SelectTrigger className="w-full text-left">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-full">
                <SelectItem value="all">Semua Rumah</SelectItem>
                <SelectItem value="registered">Penghuni Terdaftar</SelectItem>
                <SelectItem value="unregistered">
                  Penghuni Belum Terdaftar
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Rumah</p>
                <p className="text-3xl font-bold text-blue-600">
                  {totalHouses}
                </p>
              </div>
              <Home className="h-10 w-10 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Rumah Sudah Berpenghuni
                </p>
                <p className="text-3xl font-bold text-green-600">
                  {registeredHouses}
                </p>
              </div>
              <Home className="h-10 w-10 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Penghuni</p>
                <p className="text-3xl font-bold text-purple-600">
                  {totalUsers}
                </p>
              </div>
              <Users className="h-10 w-10 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredHouses?.map((house) => (
          <Card
            key={house.id}
            className={`cursor-pointer transition-all hover:shadow-md hover:scale-105 ${
              house.residents.length > 0
                ? "border-primary/50 bg-primary/5"
                : "border-muted bg-muted/30 opacity-50 hover:opacity-100"
            }`}
            onClick={() => setSelectedHouse(house)}
          >
            <CardContent className="p-4 text-center">
              <div className="text-lg font-bold text-primary">
                {house.block} - {house.number}
              </div>
              <div className="flex items-center justify-center gap-1 mt-2 text-sm text-muted-foreground">
                <Users className="h-3 w-3" />
                <span>
                  {house.residents.length > 0
                    ? `${house.residents.length} penghuni`
                    : "Kosong"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* House Detail Dialog */}
      <Dialog
        open={!!selectedHouse}
        onOpenChange={() => setSelectedHouse(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Rumah {selectedHouse?.block} - {selectedHouse?.number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedHouse?.residents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Belum ada penghuni terdaftar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedHouse?.residents.map((resident) => (
                  <div
                    key={resident.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={resident.profiles?.avatar_url || ""} />
                      <AvatarFallback>
                        {getInitials(resident.profiles?.full_name || "?")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {resident.profiles?.full_name}
                        </span>
                        {resident.is_owner && (
                          <Badge variant="secondary" className="text-xs">
                            <Crown className="h-3 w-3 mr-1" />
                            Pemilik
                          </Badge>
                        )}
                      </div>
                      {resident.profiles?.phone && (
                        <p className="text-sm text-muted-foreground truncate">
                          {resident.profiles.phone}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
