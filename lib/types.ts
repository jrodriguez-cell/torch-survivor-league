// Shared TypeScript types mirroring the database schema.

export type Role = "member" | "commissioner";

export interface Profile {
  id: string;
  display_name: string;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  season_name: string;
  commissioner_id: string;
  invite_code: string;
  roster_size: number;
  created_at: string;
}

export interface LeagueMember {
  league_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
}

export interface Castaway {
  id: string;
  league_id: string;
  name: string;
  tribe: string | null;
  image_url: string | null;
  is_eliminated: boolean;
  eliminated_week: number | null;
  created_at: string;
}

export interface Episode {
  id: string;
  league_id: string;
  week_number: number;
  title: string | null;
  air_date: string | null;
  picks_lock_at: string | null;
  is_scored: boolean;
  created_at: string;
}

export interface ScoringEvent {
  id: string;
  league_id: string;
  episode_id: string;
  castaway_id: string;
  event_type: string;
  points: number;
  created_at: string;
}

export type QuestionType = "castaway" | "text";

export interface PickemQuestion {
  id: string;
  episode_id: string;
  league_id: string;
  prompt: string;
  question_type: QuestionType;
  points: number;
  correct_castaway_id: string | null;
  correct_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface PickemAnswer {
  id: string;
  question_id: string;
  user_id: string;
  answer_castaway_id: string | null;
  answer_text: string | null;
}

export interface StandingRow {
  league_id: string;
  user_id: string;
  display_name: string;
  total_points: number;
}

// Default fantasy scoring template offered to new commissioners.
export const DEFAULT_SCORING: { event_type: string; label: string; points: number }[] = [
  { event_type: "survived", label: "Survived the episode", points: 1 },
  { event_type: "immunity_win", label: "Won individual immunity", points: 3 },
  { event_type: "reward_win", label: "Won a reward", points: 1 },
  { event_type: "found_idol", label: "Found a hidden immunity idol", points: 2 },
  { event_type: "played_idol", label: "Successfully played an idol", points: 2 },
  { event_type: "made_merge", label: "Made the merge", points: 3 },
  { event_type: "made_fire", label: "Won a fire-making challenge", points: 2 },
  { event_type: "voted_out", label: "Voted out", points: -1 },
];
