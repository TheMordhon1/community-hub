import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { 
  EventCompetition, 
  CompetitionTeam, 
  CompetitionTeamMember, 
  CompetitionMatch, 
  CompetitionReferee,
  EventCompetitionWithDetails,
  CompetitionMatchWithTeams,
  CompetitionFormat,
  MatchType,
  ParticipantType,
  CompetitionStatus,
  MatchStatus,
} from "@/types/competition";
import { useToast } from "@/hooks/use-toast";

// Fetch competitions for an event
export function useEventCompetitions(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event-competitions", eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from("event_competitions")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as EventCompetition[];
    },
    enabled: !!eventId,
  });
}

// Fetch single competition with all details
export function useCompetitionDetails(competitionId: string | undefined) {
  return useQuery({
    queryKey: ["competition-details", competitionId],
    queryFn: async () => {
      if (!competitionId) return null;

      // Fetch competition
      const { data: competition, error: compError } = await supabase
        .from("event_competitions")
        .select("*")
        .eq("id", competitionId)
        .single();

      if (compError) throw compError;

      // Fetch teams
      const { data: teams, error: teamsError } = await supabase
        .from("competition_teams")
        .select("*")
        .eq("competition_id", competitionId)
        .order("seed_number", { ascending: true });

      if (teamsError) throw teamsError;

      // Fetch team members
      const teamIds = teams?.map(t => t.id) || [];
      let members: CompetitionTeamMember[] = [];
      if (teamIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("competition_team_members")
          .select("*")
          .in("team_id", teamIds);

        if (membersError) throw membersError;
        
        // Fetch member profiles
        const userIds = membersData?.map(m => m.user_id) || [];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);

          const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
          members = membersData?.map(m => ({
            ...m,
            profile: profileMap.get(m.user_id),
          })) || [];
        }
      }

      // Fetch matches
      const { data: matches, error: matchesError } = await supabase
        .from("competition_matches")
        .select("*")
        .eq("competition_id", competitionId)
        .order("round_number", { ascending: true })
        .order("match_number", { ascending: true });

      if (matchesError) throw matchesError;

      // Fetch referees
      const { data: referees, error: refError } = await supabase
        .from("competition_referees")
        .select("*")
        .eq("competition_id", competitionId);

      if (refError) throw refError;

      // Fetch referee profiles
      const refUserIds = referees?.map(r => r.user_id) || [];
      let refereesWithProfiles: CompetitionReferee[] = [];
      if (refUserIds.length > 0) {
        const { data: refProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", refUserIds);

        const refProfileMap = new Map(refProfiles?.map(p => [p.id, p]) || []);
        refereesWithProfiles = referees?.map(r => ({
          ...r,
          profile: refProfileMap.get(r.user_id),
        })) || [];
      }

      // Map members to teams
      const teamsWithMembers = teams?.map(team => ({
        ...team,
        members: members.filter(m => m.team_id === team.id),
      })) || [];

      // Map teams to matches
      const teamMap = new Map(teamsWithMembers.map(t => [t.id, t]));
      const matchesWithTeams: CompetitionMatchWithTeams[] = matches?.map(match => ({
        ...match,
        status: match.status as MatchStatus,
        team1: match.team1_id ? teamMap.get(match.team1_id) : undefined,
        team2: match.team2_id ? teamMap.get(match.team2_id) : undefined,
        winner: match.winner_id ? teamMap.get(match.winner_id) : undefined,
      })) || [];

      return {
        ...competition,
        teams: teamsWithMembers,
        matches: matchesWithTeams,
        referees: refereesWithProfiles,
      } as EventCompetitionWithDetails;
    },
    enabled: !!competitionId,
  });
}

// Create competition
export function useCreateCompetition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      event_id: string;
      sport_name: string;
      format: CompetitionFormat;
      match_type: MatchType;
      participant_type: ParticipantType;
      rules?: string;
      max_participants?: number;
      registration_deadline?: string;
    }) => {
      const { error } = await supabase
        .from("event_competitions")
        .insert(data);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["event-competitions", variables.event_id] });
      toast({ title: "Berhasil", description: "Kompetisi berhasil dibuat" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membuat kompetisi" });
    },
  });
}

// Update competition
export function useUpdateCompetition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      event_id: string;
      sport_name?: string;
      format?: CompetitionFormat;
      match_type?: MatchType;
      participant_type?: ParticipantType;
      rules?: string | null;
      max_participants?: number | null;
      registration_deadline?: string | null;
      status?: CompetitionStatus;
    }) => {
      const { id, event_id, ...updateData } = data;
      const { error } = await supabase
        .from("event_competitions")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
      return { event_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["event-competitions", result.event_id] });
      queryClient.invalidateQueries({ queryKey: ["competition-details"] });
      toast({ title: "Berhasil", description: "Kompetisi berhasil diperbarui" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui kompetisi" });
    },
  });
}

// Delete competition
export function useDeleteCompetition() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; event_id: string }) => {
      const { error } = await supabase
        .from("event_competitions")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
      return { event_id: data.event_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["event-competitions", result.event_id] });
      toast({ title: "Berhasil", description: "Kompetisi berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus kompetisi" });
    },
  });
}

// Create team
export function useCreateTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      competition_id: string;
      name: string;
      house_id?: string;
      logo_url?: string;
      seed_number?: number;
    }) => {
      const { data: team, error } = await supabase
        .from("competition_teams")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", team.competition_id] });
      toast({ title: "Berhasil", description: "Tim berhasil ditambahkan" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menambahkan tim" });
    },
  });
}

// Delete team
export function useDeleteTeam() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; competition_id: string }) => {
      const { error } = await supabase
        .from("competition_teams")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Tim berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus tim" });
    },
  });
}

// Add team member
export function useAddTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      team_id: string;
      user_id: string;
      is_captain?: boolean;
      competition_id: string;
    }) => {
      const { competition_id, ...insertData } = data;
      const { error } = await supabase
        .from("competition_team_members")
        .insert(insertData);

      if (error) throw error;
      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Anggota berhasil ditambahkan" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menambahkan anggota" });
    },
  });
}

// Remove team member
export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; competition_id: string }) => {
      const { error } = await supabase
        .from("competition_team_members")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Anggota berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus anggota" });
    },
  });
}

// Create match
export function useCreateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      competition_id: string;
      round_number: number;
      match_number: number;
      group_name?: string;
      team1_id?: string;
      team2_id?: string;
      match_datetime?: string;
      location?: string;
    }) => {
      const { error } = await supabase
        .from("competition_matches")
        .insert(data);

      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Pertandingan berhasil dibuat" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal membuat pertandingan" });
    },
  });
}

// Update match (score, status, winner)
export function useUpdateMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      competition_id: string;
      score1?: string;
      score2?: string;
      winner_id?: string | null;
      status?: MatchStatus;
      match_datetime?: string | null;
      location?: string | null;
      notes?: string | null;
    }) => {
      const { id, competition_id, ...updateData } = data;
      const { error } = await supabase
        .from("competition_matches")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Pertandingan berhasil diperbarui" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal memperbarui pertandingan" });
    },
  });
}

// Delete match
export function useDeleteMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; competition_id: string }) => {
      const { error } = await supabase
        .from("competition_matches")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Pertandingan berhasil dihapus" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Gagal", description: "Gagal menghapus pertandingan" });
    },
  });
}

// Generate knockout bracket matches
export function useGenerateBracket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { competition_id: string; teams: CompetitionTeam[] }) => {
      const { competition_id, teams } = data;
      
      // Sort teams by seed number
      const sortedTeams = [...teams].sort((a, b) => (a.seed_number || 999) - (b.seed_number || 999));
      const teamCount = sortedTeams.length;
      
      if (teamCount < 2) {
        throw new Error("Minimal 2 tim diperlukan");
      }

      // Calculate rounds needed
      const rounds = Math.ceil(Math.log2(teamCount));
      const totalSlots = Math.pow(2, rounds);
      
      // Create matches for each round
      const matches: Array<{
        competition_id: string;
        round_number: number;
        match_number: number;
        team1_id: string | null;
        team2_id: string | null;
      }> = [];

      // First round matches
      const firstRoundMatches = totalSlots / 2;
      for (let i = 0; i < firstRoundMatches; i++) {
        const team1Index = i;
        const team2Index = totalSlots - 1 - i;
        
        matches.push({
          competition_id,
          round_number: 1,
          match_number: i + 1,
          team1_id: sortedTeams[team1Index]?.id || null,
          team2_id: sortedTeams[team2Index]?.id || null,
        });
      }

      // Create empty matches for subsequent rounds
      for (let round = 2; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            competition_id,
            round_number: round,
            match_number: i + 1,
            team1_id: null,
            team2_id: null,
          });
        }
      }

      // Delete existing matches first
      await supabase
        .from("competition_matches")
        .delete()
        .eq("competition_id", competition_id);

      // Insert new matches
      const { error } = await supabase
        .from("competition_matches")
        .insert(matches);

      if (error) throw error;
      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["competition-details", result.competition_id] });
      toast({ title: "Berhasil", description: "Bracket berhasil dibuat" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Gagal", description: error.message || "Gagal membuat bracket" });
    },
  });
}
