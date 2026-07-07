import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Users, Trash2, Edit2, Crown, Sparkles, Shuffle, Loader2, Pencil, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { EventCompetitionWithDetails, CompetitionTeamWithMembers } from "@/types/competition";
import { useDeleteTeam, useUpdateTeamGroup } from "@/hooks/useCompetitions";
import { useToast } from "@/hooks/use-toast";
import { getInitials } from "@/lib/utils";
import { getKidsBracket, AGE_GROUP_LABELS, findBracket, formatBracket, type AgeCategory, type AgeBracket } from "@/lib/age-groups";
import { GROUP_LETTERS, distributeTeamsToGroups } from "@/lib/liga-group";
import { SpinWheelDialog } from "./SpinWheelDialog";
import { EditTeamDialog } from "./EditTeamDialog";
import { SpinWheelGroupTeamsDialog } from "./SpinWheelGroupTeamsDialog";
import { AssignIndividualsDialog } from "./AssignIndividualsDialog";
import { getTeamFlag, extractFlagAndName } from "@/lib/countries";
import { TeamFlag } from "./TeamFlag";

const parseMemberName = (rawName: string | null | undefined) => {
  if (!rawName) return { name: "", avatarUrl: "" };
  const parts = rawName.split("||");
  return {
    name: parts[0] || "",
    avatarUrl: parts[1] || ""
  };
};

const serializeMemberName = (name: string, avatarUrl: string) => {
  const trimmedName = name.trim();
  const trimmedAvatar = avatarUrl.trim();
  if (!trimmedAvatar) return trimmedName;
  return `${trimmedName}||${trimmedAvatar}`;
};

const getMemberAvatar = (
  member: { name: string | null; user_id?: string | null; profile?: { avatar_url?: string | null } },
  teamLogoUrl?: string | null
) => {
  const parsed = parseMemberName(member.name);
  if (parsed.avatarUrl) return parsed.avatarUrl;
  if (member.profile?.avatar_url) return member.profile.avatar_url;
  if (teamLogoUrl) return teamLogoUrl;
  return "";
};

const capitalizeName = (name: string | null | undefined): string => {
  if (!name) return "";
  return name
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

interface TeamListProps {
  competition: EventCompetitionWithDetails;
  canManage: boolean;
  onAddTeam: () => void;
}

export function TeamList({ competition, canManage, onAddTeam }: TeamListProps) {
  const [deletingTeam, setDeletingTeam] = useState<CompetitionTeamWithMembers | null>(null);
  const [editingTeam, setEditingTeam] = useState<CompetitionTeamWithMembers | null>(null);
  const [isSpinOpen, setIsSpinOpen] = useState(false);
  const [isGroupSpinOpen, setIsGroupSpinOpen] = useState(false);
  const [isManualAssignOpen, setIsManualAssignOpen] = useState(false);
  // Inline member name editing
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const deleteTeamMutation = useDeleteTeam();
  const updateTeamGroup = useUpdateTeamGroup();

  const handleSaveMemberName = async (memberId: string, teamId: string, oldRawName: string | null) => {
    const newName = editingMemberName.trim();
    if (!newName) return;
    setSavingMemberId(memberId);
    const parsed = parseMemberName(oldRawName);
    const serializedName = serializeMemberName(newName, parsed.avatarUrl);
    const { error } = await supabase
      .from("competition_team_members")
      .update({ name: serializedName })
      .eq("id", memberId);
    setSavingMemberId(null);
    if (error) {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menyimpan nama anggota." });
    } else {
      setEditingMemberId(null);
      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
    }
  };
  const isLigaGrup = competition.format === "liga_grup";
  const groupCount = competition.group_count ?? 3;
  const groupOptions = GROUP_LETTERS.slice(0, groupCount);

  const teams = competition.teams || [];
  const formedTeams = useMemo(() => teams.filter((t) => !t.is_individual), [teams]);
  const individualRegistrants = useMemo(() => teams.filter((t) => t.is_individual), [teams]);

  const handleDeleteTeam = () => {
    if (!deletingTeam) return;
    deleteTeamMutation.mutate({
      id: deletingTeam.id,
      competition_id: competition.id,
    });
    setDeletingTeam(null);
  };

  const handleAutoGroupIndividuals = async () => {
    const teamSize = (() => {
      switch (competition.match_type) {
        case "1v1": return 1;
        case "2v2": return 2;
        case "3v3": return 3;
        case "5v5": return 5;
        case "11v11": return 11;
        default: return 1;
      }
    })();
    if (individualRegistrants.length < teamSize) {
      toast({ variant: "destructive", title: "Tidak Cukup", description: `Butuh minimal ${teamSize} peserta individu.` });
      return;
    }
    const shuffled = [...individualRegistrants].sort(() => Math.random() - 0.5);
    const existingSeeds = teams.map((t) => t.seed_number || 0);
    let nextSeed = existingSeeds.length > 0 ? Math.max(...existingSeeds) + 1 : 1;
    let created = 0;
    try {
      for (let i = 0; i + teamSize <= shuffled.length; i += teamSize) {
        const chunk = shuffled.slice(i, i + teamSize);
        const name = chunk.map((p) => p.name).join(" & ");
        const { data: newTeam, error: teamError } = await supabase
          .from("competition_teams")
          .insert({ competition_id: competition.id, name, participant_name: name, is_individual: false, seed_number: nextSeed++ })
          .select().single();
        if (teamError) throw teamError;
        const memberInserts = chunk.map((p, idx) => ({ team_id: newTeam.id, user_id: p.user_id || null, name: p.user_id ? null : p.name, is_captain: idx === 0 }));
        const { error: mErr } = await supabase.from("competition_team_members").insert(memberInserts);
        if (mErr) throw mErr;
        const { error: dErr } = await supabase.from("competition_teams").delete().in("id", chunk.map((p) => p.id));
        if (dErr) throw dErr;
        created++;
      }
      toast({ title: "Berhasil!", description: `${created} tim berhasil dibentuk secara acak.` });
      queryClient.invalidateQueries({ queryKey: ["competition-details", competition.id] });
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Gagal", description: "Terjadi kesalahan saat membagi tim secara acak." });
    }
  };

  const handleAutoAssignGroups = () => {
    const assignment = distributeTeamsToGroups(formedTeams.map((t) => t.id), groupCount);
    Object.entries(assignment).forEach(([g, ids]) => {
      ids.forEach((id) => {
        updateTeamGroup.mutate({ id, competition_id: competition.id, group_name: g });
      });
    });
  };

  const ageCategory = (competition.age_category as AgeCategory) || "mixed";
  const customBrackets: AgeBracket[] | null = Array.isArray(competition.kids_brackets)
    ? (competition.kids_brackets as AgeBracket[])
    : null;

  // Group kids by custom or auto-computed age bracket for fair display.
  const groupedTeams = useMemo(() => {
    const groups = new Map<string, CompetitionTeamWithMembers[]>();
    for (const t of formedTeams) {
      let key = "Lainnya";
      const isKid =
        ageCategory === "kids" || (ageCategory === "mixed" && t.age_group === "kids");
      if (isKid) {
        if (t.age != null) {
          const ageNum = Number(t.age);
          if (customBrackets && customBrackets.length > 0) {
            const match = findBracket(ageNum, customBrackets);
            key = match
              ? `Anak-anak · ${formatBracket(match)}`
              : `Anak-anak · Di luar grup (${ageNum} thn)`;
          } else {
            key = `Anak-anak · ${getKidsBracket(ageNum)}`;
          }
        } else {
          key = "Anak-anak · (umur belum diisi)";
        }
      } else if (t.age_group) {
        key = AGE_GROUP_LABELS[t.age_group as keyof typeof AGE_GROUP_LABELS] || "Lainnya";
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [formedTeams, ageCategory, customBrackets]);

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Users className="w-12 h-12 text-muted-foreground mb-2 opacity-50" />
          <p className="text-muted-foreground">Belum ada peserta terdaftar</p>
          {canManage && (
            <Button variant="outline" size="sm" className="mt-4" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Peserta
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          {isLigaGrup && canManage && formedTeams.length >= groupCount && (
            <Button size="sm" variant="outline" onClick={handleAutoAssignGroups}>
              <Shuffle className="w-4 h-4 mr-1" />
              Bagi Grup Otomatis
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSpinOpen(true)}
            disabled={teams.length < 2}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            Spin Wheel
          </Button>
          {canManage && (
            <Button size="sm" onClick={onAddTeam}>
              <Plus className="w-4 h-4 mr-1" />
              Tambah Peserta
            </Button>
          )}
        </div>

        {groupedTeams.map(([groupLabel, groupTeams]) => (
          <div key={groupLabel} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {groupLabel}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {groupTeams.length}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {groupTeams.map((team, index) => (
                <Card key={team.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {team.seed_number || index + 1}
                        </div>
                        <div>
                          <h4 className="font-semibold flex items-center gap-1.5">
                            <TeamFlag team={team} className="w-5 h-3.5 object-cover rounded shadow-sm inline-block select-none border border-border/20 shrink-0 text-base" />
                            <span>{extractFlagAndName(team.name).name}</span>
                          </h4>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            {team.house && (
                              <Badge variant="outline" className="text-xs">
                                Blok {team.house.block} No. {team.house.number}
                              </Badge>
                            )}
                            {team.age != null && (
                              <Badge variant="outline" className="text-xs">
                                {Number(team.age)} thn
                              </Badge>
                            )}
                            {team.age_group && (
                              <Badge variant="secondary" className="text-xs">
                                {AGE_GROUP_LABELS[team.age_group as keyof typeof AGE_GROUP_LABELS]}
                              </Badge>
                            )}
                            {team.group_name && (
                              <Badge className="text-xs bg-primary/15 text-primary hover:bg-primary/20">
                                Grup {team.group_name}
                              </Badge>
                            )}
                            {team.is_eliminated && (
                              <Badge variant="destructive" className="text-xs">
                                Tereliminasi
                              </Badge>
                            )}
                          </div>
                          {isLigaGrup && canManage && (
                            <div className="mt-2">
                              <Select
                                value={team.group_name || "none"}
                                onValueChange={(v) =>
                                  updateTeamGroup.mutate({
                                    id: team.id,
                                    competition_id: competition.id,
                                    group_name: v === "none" ? null : v,
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 text-xs w-32">
                                  <SelectValue placeholder="Pilih grup" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Belum di-assign —</SelectItem>
                                  {groupOptions.map((g) => (
                                    <SelectItem key={g} value={g}>Grup {g}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                      {canManage && (
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingTeam(team)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/80"
                            onClick={() => setDeletingTeam(team)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {team.members && team.members.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground uppercase">Anggota</p>
                        <div className="space-y-1">
                          {team.members.map((member) => {
                            const isManual = !member.user_id;
                            const parsedName = parseMemberName(member.name);
                            const displayName = capitalizeName(parsedName.name || member.profile?.full_name || "(tanpa nama)");
                            const avatarUrl = getMemberAvatar(member, team.logo_url);
                            const memberHouse = (member.profile as (typeof member.profile & { house?: { block: string; number: string } }) | undefined)?.house;
                            const isEditing = editingMemberId === member.id;
                            const isSaving = savingMemberId === member.id;

                            return (
                              <div key={member.id} className="flex items-center gap-2">
                                <Avatar className="w-6 h-6 shrink-0">
                                  <AvatarImage src={avatarUrl || ""} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(displayName)}
                                  </AvatarFallback>
                                </Avatar>

                                {isEditing ? (
                                  <div className="flex items-center gap-1 flex-1">
                                    <Input
                                      className="h-6 text-xs px-2 py-0 flex-1"
                                      value={editingMemberName}
                                      autoFocus
                                      onChange={(e) => setEditingMemberName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") handleSaveMemberName(member.id, team.id, member.name);
                                        if (e.key === "Escape") setEditingMemberId(null);
                                      }}
                                    />
                                    <button
                                      className="text-primary hover:text-primary/80 disabled:opacity-50"
                                      disabled={isSaving || !editingMemberName.trim()}
                                      onClick={() => handleSaveMemberName(member.id, team.id, member.name)}
                                    >
                                      {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                    </button>
                                    <button
                                      className="text-muted-foreground hover:text-foreground"
                                      onClick={() => setEditingMemberId(null)}
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                    <span className="text-sm line-clamp-1">{displayName}</span>
                                    {memberHouse && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
                                        {memberHouse.block}.{memberHouse.number}
                                      </Badge>
                                    )}
                                    {member.is_captain && (
                                      <Crown className="w-3 h-3 text-yellow-500 shrink-0" />
                                    )}
                                    {canManage && isManual && (
                                      <button
                                        className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
                                        onClick={() => {
                                          setEditingMemberId(member.id);
                                          setEditingMemberName(parsedName.name);
                                        }}
                                      >
                                        <Pencil className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}

        {individualRegistrants.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Pendaftar Individu (Belum Masuk Tim)
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {individualRegistrants.length}
                </Badge>
              </div>
              {canManage && individualRegistrants.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsManualAssignOpen(true)}
                    className="gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Manual
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsGroupSpinOpen(true)}
                    className="gap-1.5"
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                    Spin Wheel
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAutoGroupIndividuals}
                    className="gap-1.5"
                  >
                    <Shuffle className="w-4 h-4" />
                    Acak Otomatis
                  </Button>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {individualRegistrants.map((team, index) => (
                <Card key={team.id}>
                  <CardContent className="p-4 flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{team.name}</h4>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {ageCategory === "kids" && team.age != null && (
                          <Badge variant="outline" className="text-xs">
                            {Number(team.age)} thn
                          </Badge>
                        )}
                        {ageCategory === "kids" && team.gender && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {team.gender === "male" ? "Laki-laki" : "Perempuan"}
                          </Badge>
                        )}
                        {team.age_group && (
                          <Badge variant="secondary" className="text-xs">
                            {AGE_GROUP_LABELS[team.age_group as keyof typeof AGE_GROUP_LABELS]}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingTeam(team)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80"
                          onClick={() => setDeletingTeam(team)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Tim</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus tim/peserta "{deletingTeam?.name}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTeam}
              className="bg-destructive hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SpinWheelDialog
        open={isSpinOpen}
        onOpenChange={setIsSpinOpen}
        teams={teams}
      />

      <SpinWheelGroupTeamsDialog
        open={isGroupSpinOpen}
        onOpenChange={setIsGroupSpinOpen}
        competition={competition}
      />

      <AssignIndividualsDialog
        open={isManualAssignOpen}
        onOpenChange={setIsManualAssignOpen}
        competition={competition}
      />

      <EditTeamDialog
        open={!!editingTeam}
        onOpenChange={(open) => !open && setEditingTeam(null)}
        team={editingTeam}
        competition={competition}
      />
    </>
  );
}
