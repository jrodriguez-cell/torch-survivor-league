// Shared TypeScript types mirroring the NFL survivor-pool schema.

export type MemberStatus = "active" | "eliminated";
export type Phase = "regular" | "playoffs";
export type GameStatus = "scheduled" | "in_progress" | "final" | "postponed";
export type PickResult = "pending" | "win" | "loss" | "tie" | "missed";

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  name: string;
  commish_id: string;
  strike_limit: number;
  is_public: boolean;
  invite_code: string;
  season: number;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  display_name: string | null;
  status: MemberStatus;
  strikes_used: number;
  eliminated_week_id: string | null;
  joined_at: string;
}

export interface Team {
  id: string;
  abbreviation: string;
  name: string;
  logo_url: string | null;
}

export interface Week {
  id: string;
  season: number;
  week_number: number;
  phase: Phase;
  pick_deadline: string;
  picks_required: number;
}

export interface NflGame {
  id: string;
  week_id: string;
  home_team_id: string;
  away_team_id: string;
  kickoff_time: string;
  status: GameStatus;
  home_score: number | null;
  away_score: number | null;
  winner_team_id: string | null;
  external_id: string | null;
  updated_at: string;
}

export interface Pick {
  id: string;
  group_member_id: string;
  week_id: string;
  team_id: string;
  phase: Phase;
  result: PickResult;
  locked_at: string | null;
  created_at: string;
}

// The current NFL season the app defaults to when creating groups.
export const CURRENT_SEASON = 2026;
