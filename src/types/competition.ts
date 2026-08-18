import type { Profile, House, Event } from './database';
import type { AgeCategory, AgeBracket, GenderCategory, Gender } from '@/lib/age-groups';

export type CompetitionFormat = 'knockout' | 'round_robin' | 'league' | 'liga_grup' | 'swiss' | '17an' | 'custom';
export type MatchType = '1v1' | '2v2' | '3v3' | '4v4' | '5v5' | '11v11' | 'custom';
export type ParticipantType = 'user' | 'house' | 'team';
export type CompetitionStatus = 'registration' | 'ongoing' | 'completed' | 'cancelled';
export type MatchStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';
export type MatchStage = 'group' | 'knockout';

export interface EventCompetition {
  id: string;
  event_id: string | null;
  sport_name: string;
  format: CompetitionFormat;
  match_type: MatchType;
  custom_match_label: string | null;
  participant_type: ParticipantType;
  rules: string | null;
  max_participants: number | null;
  registration_deadline: string | null;
  status: CompetitionStatus;
  is_point: boolean;
  age_category: AgeCategory;
  gender_category: GenderCategory;
  kids_brackets: AgeBracket[] | null;
  group_count: number | null;
  sets_per_match: number | null;
  advance_per_group: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionTeam {
  id: string;
  competition_id: string;
  name: string;
  house_id: string | null;
  logo_url: string | null;
  seed_number: number | null;
  is_eliminated: boolean;
  participant_name: string | null;
  user_id: string | null;
  age: number | null;
  age_group: string | null;
  gender: Gender | string | null;
  group_name: string | null;
  next_stage_type: string | null;
  next_stage_label: string | null;
  is_individual: boolean | null;
  created_at: string;
  house?: House;
}

export interface CompetitionTeamMember {
  id: string;
  team_id: string;
  user_id: string | null;
  is_captain: boolean | null;
  name: string | null;
  created_at: string;
  profile?: Profile;
  house_block?: string | null;
  house_number?: string | null;
}

export interface CompetitionStage {
  id: string;
  competition_id: string;
  name: string;
  order_number: number;
  created_at: string;
}

export interface CompetitionMatchParticipant {
  id: string;
  match_id: string;
  team_id: string;
  score: string | null;
  is_winner: boolean;
  winner_rank: number | null;
  created_at: string;
  team?: CompetitionTeam;
}

export interface CompetitionMatch {
  id: string;
  competition_id: string;
  round_number: number;
  match_number: number;
  group_name: string | null;
  team1_id: string | null;
  team2_id: string | null;
  score1: string | null;
  score2: string | null;
  winner_id: string | null;
  status: MatchStatus;
  match_datetime: string | null;
  location: string | null;
  notes: string | null;
  next_match_id: string | null;
  phase_label: string | null;
  is_point: boolean;
  is_final: boolean;
  max_participants: number | null;
  age_bracket_min: number | null;
  age_bracket_max: number | null;
  age_bracket_label: string | null;
  stage: MatchStage | null;
  sets_data: { team1_score: number; team2_score: number }[] | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitionReferee {
  id: string;
  competition_id: string;
  user_id: string | null;
  manual_name: string | null;
  created_at: string;
  profile?: Profile;
}

// Extended types with relations
export interface CompetitionTeamWithMembers extends CompetitionTeam {
  members?: CompetitionTeamMember[];
}

export interface CompetitionMatchWithTeams extends CompetitionMatch {
  team1?: CompetitionTeam;
  team2?: CompetitionTeam;
  winner?: CompetitionTeam;
  participants?: CompetitionMatchParticipant[];
}

export interface EventCompetitionWithDetails extends EventCompetition {
  teams?: CompetitionTeamWithMembers[];
  matches?: CompetitionMatchWithTeams[];
  referees?: CompetitionReferee[];
  events?: Event;
  stages?: CompetitionStage[];
}

// Labels for UI display
export const FORMAT_LABELS: Record<CompetitionFormat, string> = {
  knockout: 'Sistem Gugur',
  round_robin: 'Round Robin',
  league: 'Liga',
  liga_grup: 'Liga Grup + Gugur',
  swiss: 'Swiss System',
  '17an': 'Lomba 17an',
  custom: 'Custom',
};

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  '1v1': '1 vs 1',
  '2v2': '2 vs 2',
  '3v3': '3 vs 3',
  '4v4': '4 vs 4',
  '5v5': '5 vs 5',
  '11v11': '11 vs 11',
  'custom': 'Custom',
};

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  user: 'Individu',
  house: 'Per Rumah',
  team: 'Tim Campuran',
};

export const STATUS_LABELS: Record<CompetitionStatus, string> = {
  registration: 'Pendaftaran',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  scheduled: 'Terjadwal',
  ongoing: 'Berlangsung',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};
