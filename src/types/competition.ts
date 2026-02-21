import type { Profile, House } from './database';

export type CompetitionFormat = 'knockout' | 'round_robin' | 'league' | 'swiss' | 'custom';
export type MatchType = '1v1' | '2v2' | '3v3' | '5v5' | '11v11' | 'custom';
export type ParticipantType = 'user' | 'house' | 'team';
export type CompetitionStatus = 'registration' | 'ongoing' | 'completed' | 'cancelled';
export type MatchStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled';

export interface EventCompetition {
  id: string;
  event_id: string | null;
  sport_name: string;
  format: CompetitionFormat;
  match_type: MatchType;
  participant_type: ParticipantType;
  rules: string | null;
  max_participants: number | null;
  registration_deadline: string | null;
  status: CompetitionStatus;
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
  created_at: string;
  house?: House;
}

export interface CompetitionTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  is_captain: boolean;
  created_at: string;
  profile?: Profile;
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
  created_at: string;
  updated_at: string;
}

export interface CompetitionReferee {
  id: string;
  competition_id: string;
  user_id: string;
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
}

export interface EventCompetitionWithDetails extends EventCompetition {
  teams?: CompetitionTeamWithMembers[];
  matches?: CompetitionMatchWithTeams[];
  referees?: CompetitionReferee[];
}

// Labels for UI display
export const FORMAT_LABELS: Record<CompetitionFormat, string> = {
  knockout: 'Sistem Gugur',
  round_robin: 'Round Robin',
  league: 'Liga',
  swiss: 'Swiss System',
  custom: 'Custom',
};

export const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  '1v1': '1 vs 1',
  '2v2': '2 vs 2',
  '3v3': '3 vs 3',
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
