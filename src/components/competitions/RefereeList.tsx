import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, UserPlus, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { useAssignReferee, useRemoveReferee } from "@/hooks/useCompetitions";
import type { EventCompetitionWithDetails } from "@/types/competition";

interface RefereeListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
}

export function RefereeList({ competition, canManage }: RefereeListProps) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  useEffect(() => {
    if (!isAddOpen) {
      setSearchQuery("");
      setSelectedUserId("");
    }
  }, [isAddOpen]);

  const assignReferee = useAssignReferee();
  const removeReferee = useRemoveReferee();

  // Fetch all profiles for selection
  const { data: profiles, isLoading: isLoadingProfiles } = useQuery({
    queryKey: ["all-profiles-for-referee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: isAddOpen,
  });

  const referees = competition.referees || [];

  const handleAdd = () => {
    if (!selectedUserId) return;
    assignReferee.mutate(
      { competition_id: competition.id, user_id: selectedUserId },
      {
        onSuccess: () => {
          setIsAddOpen(false);
          setSelectedUserId("");
        },
      }
    );
  };

  const handleRemove = (id: string) => {
    removeReferee.mutate({ id, competition_id: competition.id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg">Wasit Pertandingan</CardTitle>
          <p className="text-sm text-muted-foreground">
            User yang ditugaskan sebagai wasit dapat memperbarui skor pertandingan.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setIsAddOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" />
            Tambah Wasit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {referees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Users className="w-12 h-12 mb-2 opacity-50" />
            <p>Belum ada wasit yang ditugaskan</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {referees.map((referee) => (
              <div
                key={referee.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-card"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={referee.profile?.avatar_url || ""} />
                    <AvatarFallback>
                      {referee.profile?.full_name?.charAt(0) || "W"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{referee.profile?.full_name || "Tanpa Nama"}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3 h-3 text-primary" />
                      Wasit
                    </div>
                  </div>
                </div>
                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemove(referee.id)}
                    disabled={removeReferee.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Wasit</DialogTitle>
            <DialogDescription>
              Pilih warga yang akan ditugaskan sebagai wasit untuk kompetisi ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Pilih Warga</label>
              <Input
                placeholder="Cari nama warga..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="border rounded-md max-h-60 overflow-y-auto mt-2">
                {isLoadingProfiles ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Memuat...</span>
                  </div>
                ) : (
                  (() => {
                    const filteredAndAvailable = profiles
                      ?.filter(p => 
                        !referees.some(r => r.user_id === p.id) &&
                        p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                      ) || [];

                    if (filteredAndAvailable.length === 0) {
                      return (
                        <div className="p-4 text-center text-muted-foreground text-sm">
                          Tidak ada warga ditemukan
                        </div>
                      );
                    }

                    return filteredAndAvailable.map((profile) => (
                      <div
                        key={profile.id}
                        className={`flex items-center gap-3 p-2 cursor-pointer hover:bg-muted/50 border-b last:border-b-0 ${
                          selectedUserId === profile.id ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedUserId(profile.id)}
                      >
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback>
                            {profile.full_name?.charAt(0) || "W"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {profile.full_name}
                        </span>
                        {selectedUserId === profile.id && (
                          <div className="ml-auto text-primary text-xs font-medium">
                            Terpilih
                          </div>
                        )}
                      </div>
                    ));
                  })()
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedUserId || assignReferee.isPending}
            >
              {assignReferee.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
