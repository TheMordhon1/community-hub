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
  CompetitionMatchParticipant,
} from "@/types/competition";
import type { Profile } from "@/types/database";
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
      return data as unknown as EventCompetition[];
    },
    enabled: !!eventId,
  });
}
// Fetch all competitions
export function useAllCompetitions() {
  return useQuery({
    queryKey: ["all-competitions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_competitions")
        .select(
          `
          *,
          events (
            title,
            status,
            event_date,
            end_date
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as (EventCompetition & {
        events: { title: string; status: string; event_date: string; end_date: string | null } | null;
      })[];
    },
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
        .select("*, events(*)")
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

      // Fetch houses referenced by teams
      const houseIds = Array.from(new Set((teams || []).map((t) => t.house_id).filter(Boolean) as string[]));
      const houseMap = new Map<string, { id: string; block: string; number: string }>();
      if (houseIds.length > 0) {
        const { data: housesData } = await supabase
          .from("houses")
          .select("id, block, number")
          .in("id", houseIds);
        (housesData || []).forEach((h) => houseMap.set(h.id, h as { id: string; block: string; number: string }));
      }


      // Fetch team members
      const teamIds = teams?.map((t) => t.id) || [];
      let members: CompetitionTeamMember[] = [];
      if (teamIds.length > 0) {
        const { data: membersData, error: membersError } = await supabase
          .from("competition_team_members")
          .select("*")
          .in("team_id", teamIds);

        if (membersError) throw membersError;

        // Fetch member profiles (only for members with a linked user_id)
        const userIds = (membersData || []).map((m) => m.user_id).filter(Boolean) as string[];
        let profileMap = new Map<string, Profile>();
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        }

        members =
          (membersData || []).map((m) => ({
            ...m,
            profile: m.user_id ? profileMap.get(m.user_id) : undefined,
          }));
      }

      // Fetch matches
      const { data: matches, error: matchesError } = await supabase
        .from("competition_matches")
        .select("*")
        .eq("competition_id", competitionId)
        .order("round_number", { ascending: true })
        .order("match_number", { ascending: true });

      if (matchesError) throw matchesError;
      
      // Fetch match participants
      const matchIds = matches?.map((m) => m.id) || [];
      let matchParticipants: CompetitionMatchParticipant[] = [];
      if (matchIds.length > 0) {
        const { data: participantsData, error: participantsError } = await supabase
          .from("competition_match_participants")
          .select("*")
          .in("match_id", matchIds);

        if (participantsError) throw participantsError;
        matchParticipants = participantsData || [];
      }

      // Fetch referees
      const { data: referees, error: refError } = await supabase
        .from("competition_referees")
        .select("*")
        .eq("competition_id", competitionId);

      if (refError) throw refError;

      // Fetch referee profiles
      const refUserIds = referees?.map((r) => r.user_id) || [];
      let refereesWithProfiles: CompetitionReferee[] = [];
      if (refUserIds.length > 0) {
        const { data: refProfiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", refUserIds);

        const refProfileMap = new Map(refProfiles?.map((p) => [p.id, p]) || []);
        refereesWithProfiles =
          referees?.map((r) => ({
            ...r,
            profile: refProfileMap.get(r.user_id),
          })) || [];
      }

      // Map members & houses to teams
      const teamsWithMembers =
        teams?.map((team) => ({
          ...team,
          members: members.filter((m) => m.team_id === team.id),
          house: team.house_id ? (houseMap.get(team.house_id) as unknown as import("@/types/database").House | undefined) : undefined,
        })) || [];


      // Map teams to matches
      const teamMap = new Map(teamsWithMembers.map((t) => [t.id, t]));
      const matchesWithTeams: CompetitionMatchWithTeams[] =
        matches?.map((match) => {
          const participants = matchParticipants
            .filter((p) => p.match_id === match.id)
            .map((p) => ({
              ...p,
              team: teamMap.get(p.team_id),
            }));

          return {
            ...match,
            status: match.status as MatchStatus,
            stage: (match as unknown as { stage: string | null }).stage as CompetitionMatch["stage"],
            is_point: (match as unknown as CompetitionMatch).is_point ?? true,
            is_final: (match as unknown as CompetitionMatch).is_final ?? false,
            team1: match.team1_id ? teamMap.get(match.team1_id) : undefined,
            team2: match.team2_id ? teamMap.get(match.team2_id) : undefined,
            winner: match.winner_id ? teamMap.get(match.winner_id) : undefined,
            participants,
          } as unknown as CompetitionMatchWithTeams;
        }) || [];

      return {
        ...(competition as unknown as EventCompetition),
        is_point: (competition as unknown as EventCompetition).is_point ?? true,
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
      event_id?: string;
      sport_name: string;
      format: CompetitionFormat;
      match_type: MatchType;
      custom_match_label?: string | null;
      participant_type: ParticipantType;
      rules?: string;
      max_participants?: number;
      registration_deadline?: string;
      is_point?: boolean;
      age_category?: string;
      gender_category?: string;
      kids_brackets?: { min: number; max: number; label?: string }[] | null;
      group_count?: number | null;
      sets_per_match?: number | null;
      advance_per_group?: number | null;
    }) => {
      const { error } = await supabase.from("event_competitions").insert(data as never);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      if (variables.event_id) {
        queryClient.invalidateQueries({
          queryKey: ["event-competitions", variables.event_id],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["all-competitions"] });
      toast({ title: "Berhasil", description: "Kompetisi berhasil dibuat" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal membuat kompetisi",
      });
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
      custom_match_label?: string | null;
      participant_type?: ParticipantType;
      rules?: string | null;
      max_participants?: number | null;
      registration_deadline?: string | null;
      status?: CompetitionStatus;
      is_point?: boolean;
      age_category?: string;
      gender_category?: string;
      kids_brackets?: { min: number; max: number; label?: string }[] | null;
      group_count?: number | null;
      sets_per_match?: number | null;
      advance_per_group?: number | null;
    }) => {
      const { id, event_id, ...updateData } = data;
      const { error } = await supabase
        .from("event_competitions")
        .update(updateData as never)
        .eq("id", id);

      if (error) throw error;
      return { event_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["event-competitions", result.event_id],
      });
      queryClient.invalidateQueries({ queryKey: ["competition-details"] });
      toast({
        title: "Berhasil",
        description: "Kompetisi berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui kompetisi",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["event-competitions", result.event_id],
      });
      toast({ title: "Berhasil", description: "Kompetisi berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus kompetisi",
      });
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
      participant_name?: string | null;
      user_id?: string | null;
      age?: number | null;
      age_group?: string | null;
      gender?: string | null;
      group_name?: string | null;
      is_individual?: boolean | null;
    }) => {
      const { data: team, error } = await supabase
        .from("competition_teams")
        .insert(data as never)
        .select()
        .single();

      if (error) throw error;
      return team;
    },
    onSuccess: (team) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", team.competition_id],
      });
      toast({ title: "Berhasil", description: "Tim berhasil ditambahkan" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menambahkan tim",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Tim berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus tim",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Anggota berhasil ditambahkan" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menambahkan anggota",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Anggota berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus anggota",
      });
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
      team1_id?: string;
      team2_id?: string;
      team_ids?: string[];
      match_datetime?: string;
      location?: string;
      max_participants?: number | null;
      age_bracket_min?: number | null;
      age_bracket_max?: number | null;
      age_bracket_label?: string | null;
      stage?: string | null;
      phase_label?: string | null;
      group_name?: string | null;
    }) => {
      const { team_ids, ...matchData } = data;
      const { data: match, error } = await supabase
        .from("competition_matches")
        .insert(matchData)
        .select()
        .single();

      if (error) throw error;

      // Create participant records for ALL formats to ensure consistency for ranks/scores
      const finalTeamIds = [...(team_ids || [])];
      if (!team_ids || team_ids.length === 0) {
        if (data.team1_id && data.team1_id !== "none") finalTeamIds.push(data.team1_id);
        if (data.team2_id && data.team2_id !== "none") finalTeamIds.push(data.team2_id);
      }

      if (finalTeamIds.length > 0) {
        const participants = finalTeamIds.map((teamId) => ({
          match_id: match.id,
          team_id: teamId,
        }));

        const { error: partError } = await supabase
          .from("competition_match_participants")
          .insert(participants);

        if (partError) throw partError;
      }

      return { competition_id: data.competition_id, match_id: match.id as string };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Pertandingan berhasil dibuat" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal membuat pertandingan",
      });
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
      phase_label?: string | null;
      is_point?: boolean;
      is_final?: boolean;
      sets_data?: { team1_score: number; team2_score: number }[] | null;
      participant_scores?: { id?: string; team_id?: string; score: string | null; is_winner?: boolean; winner_rank?: number | null }[];
      stage?: string | null;
      group_name?: string | null;
      round_number?: number;
      match_number?: number;
      team1_id?: string | null;
      team2_id?: string | null;
      team_ids?: string[];
    }) => {
      const { id, competition_id, participant_scores, team_ids, ...updateData } = data;

      const { error } = await supabase
          .from("competition_matches")
          .update(updateData)
          .eq("id", id);

      if (error) throw error;

      if (team_ids) {
        // Replace participants set
        const { error: delErr } = await supabase
          .from("competition_match_participants")
          .delete()
          .eq("match_id", id);
        if (delErr) throw delErr;

        if (team_ids.length > 0) {
          const rows = team_ids.map((team_id) => ({ match_id: id, team_id }));
          const { error: insErr } = await supabase
            .from("competition_match_participants")
            .insert(rows);
          if (insErr) throw insErr;
        }
      }

      if (participant_scores && participant_scores.length > 0) {
        for (const ps of participant_scores) {
          const upsertData: {
            id?: string;
            match_id: string;
            team_id: string | undefined;
            score: string | null;
            is_winner: boolean;
            winner_rank: number | null;
          } = {
            match_id: id,
            team_id: ps.team_id,
            score: ps.score,
            is_winner: ps.is_winner ?? false,
            winner_rank: ps.winner_rank ?? null,
          };
          
          if (ps.id) upsertData.id = ps.id;

          const { error: partError } = await supabase
            .from("competition_match_participants")
            .upsert(upsertData, { onConflict: 'match_id, team_id' });
          
          if (partError) throw partError;
        }
      }

      return { competition_id };
    },
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", variables.competition_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["live-matches"],
      });
      
      // Handle progression if match is completed with a winner
      if (variables.status === "completed" && variables.winner_id && variables.id) {
        try {
          // Fetch current match to get next_match_id
          const { data: match, error } = await supabase
            .from("competition_matches")
            .select("next_match_id, match_number")
            .eq("id", variables.id)
            .single();
            
          if (error) throw error;
          
          if (match?.next_match_id) {
            // Determine if team1 or team2 in the next match
            // Match M goes to match ceil(M/2) in the next round.
            // If M is odd, it's team1. If M is even, it's team2.
            const isTeam1 = match.match_number % 2 !== 0;
            const updateData = isTeam1 
              ? { team1_id: variables.winner_id } 
              : { team2_id: variables.winner_id };
              
            const { error: nextError } = await supabase
              .from("competition_matches")
              .update(updateData)
              .eq("id", match.next_match_id);
              
            if (nextError) throw nextError;
            
            queryClient.invalidateQueries({
              queryKey: ["competition-details", variables.competition_id],
            });
          }
        } catch (err) {
          console.error("Error progressing winner:", err);
        }
      }
      
      toast({
        title: "Berhasil",
        description: "Pertandingan berhasil diperbarui",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui pertandingan",
      });
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
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({
        title: "Berhasil",
        description: "Pertandingan berhasil dihapus",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus pertandingan",
      });
    },
  });
}

// Generate knockout bracket matches
export function useGenerateBracket() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      competition_id: string;
      teams: CompetitionTeam[];
    }) => {
      const { competition_id, teams } = data;

      // Fetch competition details to get event location and date
      const { data: competition_details, error: detailsError } = await supabase
        .from("event_competitions")
        .select("*, events(*)")
        .eq("id", competition_id)
        .single();

      if (detailsError) throw detailsError;

      // Sort teams by seed number
      const sortedTeams = [...teams].sort(
        (a, b) => (a.seed_number || 999) - (b.seed_number || 999),
      );
      const teamCount = sortedTeams.length;

      if (teamCount < 2) {
        throw new Error("Minimal 2 tim diperlukan");
      }

      // Calculate rounds needed
      const rounds = Math.ceil(Math.log2(teamCount));
      const totalSlots = Math.pow(2, rounds);

      // Create matches for each round with pre-generated IDs for linking
      const matchMap = new Map<string, string>(); // key: "round-matchNum", value: id
      const matches: Partial<CompetitionMatch>[] = [];

      // Generate all match records with IDs
      for (let round = 1; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let m = 1; m <= matchesInRound; m++) {
          const id = crypto.randomUUID();
          matchMap.set(`${round}-${m}`, id);
        }
      }

      // Link matches and set initial teams
      for (let round = 1; round <= rounds; round++) {
        const matchesInRound = Math.pow(2, rounds - round);
        for (let m = 1; m <= matchesInRound; m++) {
          const id = matchMap.get(`${round}-${m}`)!;
          const nextMatchId = round < rounds ? matchMap.get(`${round + 1}-${Math.ceil(m / 2)}`) : null;
          
          let team1_id = null;
          let team2_id = null;
          let match_datetime = null;
          const location = competition_details?.events?.location || null;

          if (competition_details?.events?.event_date) {
            const dateStr = competition_details.events.event_date;
            const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
            const timePart = competition_details.events.event_time || "08:00";
            match_datetime = `${datePart}T${timePart}`;
          }

          if (round === 1) {
            // Standard tournament seeding (1 vs 8, 4 vs 5, etc.)
            // But we'll use a simpler one for now: 1 vs 2, 3 vs 4...
            // or we can use the serpentine one the user had partially
            const t1Idx = (m - 1) * 2;
            const t2Idx = (m - 1) * 2 + 1;
            
            team1_id = sortedTeams[t1Idx]?.id || null;
            team2_id = sortedTeams[t2Idx]?.id || null;
          }

          matches.push({
            id,
            competition_id,
            round_number: round,
            match_number: m,
            next_match_id: nextMatchId,
            team1_id,
            team2_id,
            status: "scheduled",
            match_datetime,
            location,
          });
        }
      }

      // Delete existing matches first
      const { error: delError } = await supabase
        .from("competition_matches")
        .delete()
        .eq("competition_id", competition_id);

      if (delError) throw delError;

      // Insert new matches
      const { error } = await supabase
        .from("competition_matches")
        .insert(matches as CompetitionMatch[]);

      if (error) throw error;
      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Bracket berhasil dibuat" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal membuat bracket",
      });
    },
  });
}

// Generate matches for 17an format (simple split)
export function useGenerate17an() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      competition_id: string;
      teams: CompetitionTeam[];
      teams_per_match: number;
      phase_label?: string;
      is_final?: boolean;
    }) => {
      const { competition_id, teams, teams_per_match, phase_label, is_final } = data;

      // Fetch competition details for default location/time
      const { data: competition_details, error: detailsError } = await supabase
        .from("event_competitions")
        .select("*, events(*)")
        .eq("id", competition_id)
        .single();

      if (detailsError) throw detailsError;

      const teamCount = teams.length;
      if (teamCount < 1) {
        throw new Error("Minimal 1 peserta diperlukan");
      }

      const eventDateStr = competition_details?.events?.event_date;
      const datePart = eventDateStr ? (eventDateStr.includes("T") ? eventDateStr.split("T")[0] : eventDateStr) : null;
      const match_datetime = datePart 
        ? `${datePart}T${competition_details.events.event_time || "08:00"}`
        : null;
      const location = competition_details?.events?.location || null;

      // Delete existing matches first (this will cascade delete participants)
      const { error: delError } = await supabase
        .from("competition_matches")
        .delete()
        .eq("competition_id", competition_id);

      if (delError) throw delError;

      // Shuffle teams randomly
      const shuffledTeams = [...teams].sort(() => Math.random() - 0.5);

      // Create matches by grouping teams
      for (let i = 0; i < shuffledTeams.length; i += teams_per_match) {
        const groupTeams = shuffledTeams.slice(i, i + teams_per_match);
        const matchNumber = Math.floor(i / teams_per_match) + 1;

        // Insert match
        const { data: match, error: matchError } = await supabase
          .from("competition_matches")
          .insert({
            competition_id,
            round_number: 1,
            match_number: matchNumber,
            status: "scheduled",
            match_datetime,
            location,
            phase_label,
            is_final: is_final || false,
          })
          .select()
          .single();

        if (matchError) throw matchError;

        // Insert participants
        const participants = groupTeams.map((team) => ({
          match_id: match.id,
          team_id: team.id,
        }));

        const { error: partError } = await supabase
          .from("competition_match_participants")
          .insert(participants);

        if (partError) throw partError;
      }

      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Jadwal lomba berhasil dibuat" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message || "Gagal membuat jadwal",
      });
    },
  });
}

// Assign referee to competition
export function useAssignReferee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { competition_id: string; user_id: string }) => {
      const { error } = await supabase.from("competition_referees").insert(data);
      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Wasit berhasil ditambahkan" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menambahkan wasit",
      });
    },
  });
}

// Remove referee from competition
export function useRemoveReferee() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; competition_id: string }) => {
      const { error } = await supabase
        .from("competition_referees")
        .delete()
        .eq("id", data.id);
      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Wasit berhasil dihapus" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menghapus wasit",
      });
    },
  });
}

// Advance winners to the next round for 17an format
export function useAdvance17anRound() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { competition_id: string; phase_label?: string; is_final?: boolean }) => {
      const { competition_id, phase_label, is_final } = data;

      // 1. Get competition details and matches
      const { data: competition, error: compError } = await supabase
        .from("event_competitions")
        .select("*, competition_matches(*, competition_match_participants(*))")
        .eq("id", competition_id)
        .single();

      if (compError) throw compError;

      // 2. Find winners of the highest round
      const matches = competition.competition_matches || [];
      if (matches.length === 0) throw new Error("Belum ada pertandingan");

      const highestRound = Math.max(...matches.map((m) => m.round_number));
      const winners = matches
        .filter((m) => m.round_number === highestRound)
        .flatMap((m) => m.competition_match_participants || [])
        .filter((p) => p.is_winner)
        .map((p) => p.team_id);

      if (winners.length === 0) {
        throw new Error("Belum ada pemenang yang ditentukan di babak ini");
      }

      // 3. Create a new match in the next round for all winners
      const nextRound = highestRound + 1;
      const nextMatchNum = Math.max(...matches.filter(m => m.round_number === nextRound).map(m => m.match_number), 0) + 1;

      // Use default datetime/location from event
      const { data: eventDetails } = await supabase
        .from("events")
        .select("*")
        .eq("id", competition.event_id)
        .single();

      const eventDateStr = eventDetails?.event_date;
      const datePart = eventDateStr ? (eventDateStr.includes("T") ? eventDateStr.split("T")[0] : eventDateStr) : null;
      const match_datetime = datePart 
        ? `${datePart}T${eventDetails?.event_time || "08:00"}`
        : null;

      const { data: newMatch, error: matchError } = await supabase
        .from("competition_matches")
        .insert({
          competition_id,
          round_number: nextRound,
          match_number: nextMatchNum,
          status: "scheduled",
          match_datetime,
          location: eventDetails?.location || null,
          phase_label: phase_label || `Babak ${nextRound}`,
          is_final: is_final || false,
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // 4. Link winners to the new match
      const participants = winners.map((teamId) => ({
        match_id: newMatch.id,
        team_id: teamId,
      }));

      const { error: partError } = await supabase
        .from("competition_match_participants")
        .insert(participants);

      if (partError) throw partError;

      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Pemenang dilanjutkan ke babak berikutnya" });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.message,
      });
    },
  });
}

// Reset a match
export function useResetMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { id: string; competition_id: string }) => {
      // 1. Reset match status and scores
      const { error: matchError } = await supabase
        .from("competition_matches")
        .update({
          status: "scheduled",
          score1: null,
          score2: null,
          winner_id: null,
        })
        .eq("id", data.id);

      if (matchError) throw matchError;

      // 2. Reset participant scores and winners
      const { error: partError } = await supabase
        .from("competition_match_participants")
        .update({
          score: null,
          is_winner: false,
          winner_rank: null,
        })
        .eq("match_id", data.id);

      if (partError) throw partError;

      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Pertandingan berhasil di-reset" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal me-reset pertandingan",
      });
    },
  });
}

// Reset all matches in competition
export function useResetAllMatches() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { competition_id: string }) => {
      // 1. Reset all matches
      const { error: matchError } = await supabase
        .from("competition_matches")
        .update({
          status: "scheduled",
          score1: null,
          score2: null,
          winner_id: null,
        })
        .eq("competition_id", data.competition_id);

      if (matchError) throw matchError;

      // 2. Get all match IDs to reset participants
      const { data: matches } = await supabase
        .from("competition_matches")
        .select("id")
        .eq("competition_id", data.competition_id);
      
      if (matches && matches.length > 0) {
        const matchIds = matches.map(m => m.id);
        const { error: partError } = await supabase
          .from("competition_match_participants")
          .update({
            score: null,
            is_winner: false,
            winner_rank: null,
          })
          .in("match_id", matchIds);
        
        if (partError) throw partError;
      }

      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({ title: "Berhasil", description: "Semua pertandingan berhasil di-reset" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal me-reset pertandingan",
      });
    },
  });
}

// Assign teams to a match (used by Spin Wheel per-match)
export function useAssignMatchTeams() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      match_id: string;
      competition_id: string;
      team_ids: string[];
      use_team_slots: boolean; // when true, also writes team1_id/team2_id (max 2)
    }) => {
      const { match_id, team_ids, use_team_slots } = data;

      if (use_team_slots) {
        const update: { team1_id: string | null; team2_id: string | null } = {
          team1_id: team_ids[0] ?? null,
          team2_id: team_ids[1] ?? null,
        };
        const { error: mErr } = await supabase
          .from("competition_matches")
          .update(update)
          .eq("id", match_id);
        if (mErr) throw mErr;
      }

      // Replace participants set
      const { error: delErr } = await supabase
        .from("competition_match_participants")
        .delete()
        .eq("match_id", match_id);
      if (delErr) throw delErr;

      if (team_ids.length > 0) {
        const rows = team_ids.map((team_id) => ({ match_id, team_id }));
        const { error: insErr } = await supabase
          .from("competition_match_participants")
          .insert(rows);
        if (insErr) throw insErr;
      }

      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({
        title: "Berhasil",
        description: "Peserta pertandingan diperbarui",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal menetapkan peserta pertandingan",
      });
    },
  });
}

// ============================================================================
// Liga Grup + Gugur helpers
// ============================================================================

// Update team group assignment (Grup A, B, C…)
export function useUpdateTeamGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      competition_id: string;
      group_name: string | null;
    }) => {
      const { error } = await supabase
        .from("competition_teams")
        .update({ group_name: data.group_name } as never)
        .eq("id", data.id);
      if (error) throw error;
      return { competition_id: data.competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: "Gagal memperbarui grup peserta",
      });
    },
  });
}

// Generate round-robin group-stage schedule.
// Deletes any prior group-stage matches, then creates one match per pair
// inside each group. score1/score2 = number of sets won.
export function useGenerateGroupSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { competition_id: string }) => {
      const { competition_id } = data;

      const { data: comp, error: cErr } = await supabase
        .from("event_competitions")
        .select("*, events(*)")
        .eq("id", competition_id)
        .single();
      if (cErr) throw cErr;

      const { data: teams, error: tErr } = await supabase
        .from("competition_teams")
        .select("id, group_name")
        .eq("competition_id", competition_id);
      if (tErr) throw tErr;

      const grouped = new Map<string, string[]>();
      (teams || []).forEach((t) => {
        const g = (t as { group_name: string | null }).group_name;
        if (!g) return;
        if (!grouped.has(g)) grouped.set(g, []);
        grouped.get(g)!.push(t.id);
      });

      if (grouped.size === 0) {
        throw new Error("Belum ada peserta yang di-assign ke grup");
      }

      // Delete existing group-stage matches
      await supabase
        .from("competition_matches")
        .delete()
        .eq("competition_id", competition_id)
        .eq("stage", "group");

      const eventDateStr = (comp as { events?: { event_date?: string; event_time?: string; location?: string } })?.events?.event_date;
      const datePart = eventDateStr
        ? eventDateStr.includes("T")
          ? eventDateStr.split("T")[0]
          : eventDateStr
        : null;
      const eventTime = (comp as { events?: { event_time?: string } })?.events?.event_time || "08:00";
      const match_datetime = datePart ? `${datePart}T${eventTime}` : null;
      const location = (comp as { events?: { location?: string } })?.events?.location || null;

      let matchCounter = 0;
      for (const [groupName, teamIds] of Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b))) {
        for (let i = 0; i < teamIds.length; i++) {
          for (let j = i + 1; j < teamIds.length; j++) {
            matchCounter += 1;
            const { data: newMatch, error: mErr } = await supabase
              .from("competition_matches")
              .insert({
                competition_id,
                round_number: 1,
                match_number: matchCounter,
                team1_id: teamIds[i],
                team2_id: teamIds[j],
                status: "scheduled",
                match_datetime,
                location,
                phase_label: `Fase Grup — Grup ${groupName}`,
                group_name: groupName,
                stage: "group",
              } as never)
              .select()
              .single();
            if (mErr) throw mErr;

            const { error: pErr } = await supabase
              .from("competition_match_participants")
              .insert([
                { match_id: newMatch.id, team_id: teamIds[i] },
                { match_id: newMatch.id, team_id: teamIds[j] },
              ]);
            if (pErr) throw pErr;
          }
        }
      }

      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({
        title: "Berhasil",
        description: "Jadwal fase grup berhasil dibuat",
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.message || "Gagal membuat jadwal grup",
      });
    },
  });
}

// Generate knockout bracket seeded from group standings.
// Advances top-N per group per competition.advance_per_group setting.
export function useGenerateKnockoutFromGroups() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      competition_id: string;
      pairs: { team1_id: string; team2_id: string; label: string }[];
      match_datetime?: string | null;
      location?: string | null;
    }) => {
      const { competition_id, pairs, match_datetime, location } = data;
      if (pairs.length === 0) throw new Error("Tidak ada tim yang lolos");

      // Delete previous knockout matches
      await supabase
        .from("competition_matches")
        .delete()
        .eq("competition_id", competition_id)
        .eq("stage", "knockout");

      // Determine rounds needed (round-up to power of 2)
      const rounds = Math.max(1, Math.ceil(Math.log2(pairs.length * 2)));
      const matchMap = new Map<string, string>();
      for (let r = 1; r <= rounds; r++) {
        const count = Math.pow(2, rounds - r);
        for (let m = 1; m <= count; m++) matchMap.set(`${r}-${m}`, crypto.randomUUID());
      }

      const roundLabel = (r: number) => {
        const fromEnd = rounds - r + 1;
        if (fromEnd === 1) return "Final";
        if (fromEnd === 2) return "Semi Final";
        if (fromEnd === 3) return "Perempat Final";
        return `Babak Gugur ${r}`;
      };

      const rows: Record<string, unknown>[] = [];
      for (let r = 1; r <= rounds; r++) {
        const count = Math.pow(2, rounds - r);
        for (let m = 1; m <= count; m++) {
          const id = matchMap.get(`${r}-${m}`)!;
          const next = r < rounds ? matchMap.get(`${r + 1}-${Math.ceil(m / 2)}`) : null;
          let team1_id: string | null = null;
          let team2_id: string | null = null;
          let phase_label: string | null = roundLabel(r);
          if (r === 1) {
            const pair = pairs[m - 1];
            if (pair) {
              team1_id = pair.team1_id;
              team2_id = pair.team2_id;
              phase_label = `${roundLabel(r)} — ${pair.label}`;
            }
          }
          rows.push({
            id,
            competition_id,
            round_number: r,
            match_number: m,
            next_match_id: next,
            team1_id,
            team2_id,
            status: "scheduled",
            match_datetime: match_datetime ?? null,
            location: location ?? null,
            phase_label,
            stage: "knockout",
            is_final: r === rounds,
          });
        }
      }

      // Add a 3rd-place playoff if there is a semi-final round
      if (rounds >= 2) {
        rows.push({
          id: crypto.randomUUID(),
          competition_id,
          round_number: rounds,
          match_number: 99,
          next_match_id: null,
          team1_id: null,
          team2_id: null,
          status: "scheduled",
          match_datetime: match_datetime ?? null,
          location: location ?? null,
          phase_label: "Perebutan Juara 3",
          stage: "knockout",
          is_final: false,
        });
      }

      const { error: insErr } = await supabase
        .from("competition_matches")
        .insert(rows as never);
      if (insErr) throw insErr;

      // Create participant records for round-1 matches
      const round1 = rows.filter((r) => r.round_number === 1 && r.team1_id && r.team2_id);
      const partRows: { match_id: string; team_id: string }[] = [];
      round1.forEach((r) => {
        partRows.push({ match_id: r.id as string, team_id: r.team1_id as string });
        partRows.push({ match_id: r.id as string, team_id: r.team2_id as string });
      });
      if (partRows.length > 0) {
        const { error: pErr } = await supabase
          .from("competition_match_participants")
          .insert(partRows);
        if (pErr) throw pErr;
      }

      return { competition_id };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: ["competition-details", result.competition_id],
      });
      toast({
        title: "Berhasil",
        description: "Babak gugur berhasil dibuat dari juara & runner-up grup",
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.message || "Gagal membuat babak gugur",
      });
    },
  });
}

