// NFL data source, isolated behind a clean interface so it can be swapped
// later (e.g. SportsDataIO) without touching the rest of the app. Today it
// reads ESPN's public scoreboard endpoint (no API key required).

export type NormalizedStatus = "scheduled" | "in_progress" | "final" | "postponed";

export interface NormalizedGame {
  externalId: string;
  kickoff: string; // ISO timestamp
  status: NormalizedStatus;
  homeAbbr: string;
  awayAbbr: string;
  homeScore: number | null;
  awayScore: number | null;
  winnerAbbr: string | null; // null until final; stays null on a tie
}

export interface Scoreboard {
  season: number;
  weekNumber: number;
  phase: "regular" | "playoffs";
  games: NormalizedGame[];
}

const ESPN_SCOREBOARD =
  "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

function mapStatus(state?: string, name?: string, completed?: boolean): NormalizedStatus {
  if (name === "STATUS_POSTPONED" || name === "STATUS_CANCELED") return "postponed";
  if (state === "post" || completed) return "final";
  if (state === "in") return "in_progress";
  return "scheduled";
}

function toInt(v: unknown): number | null {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function normalizeEvent(e: any): NormalizedGame | null {
  const comp = e?.competitions?.[0] ?? {};
  const st = comp?.status?.type ?? e?.status?.type ?? {};
  const status = mapStatus(st?.state, st?.name, st?.completed);
  const competitors: any[] = comp?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home?.team?.abbreviation || !away?.team?.abbreviation) return null;

  let winnerAbbr: string | null = null;
  if (status === "final") {
    if (home.winner) winnerAbbr = home.team.abbreviation;
    else if (away.winner) winnerAbbr = away.team.abbreviation;
    else winnerAbbr = null; // tie
  }

  return {
    externalId: String(e.id),
    kickoff: e.date,
    status,
    homeAbbr: home.team.abbreviation,
    awayAbbr: away.team.abbreviation,
    homeScore: toInt(home.score),
    awayScore: toInt(away.score),
    winnerAbbr,
  };
}

// Fetch a scoreboard. With no options, ESPN returns the current week.
export async function fetchScoreboard(opts?: {
  season?: number;
  week?: number;
  seasonType?: number; // 1 pre, 2 regular, 3 post
  dates?: string; // ESPN `dates` filter, e.g. "20260904-20260909" or "20260908"
}): Promise<Scoreboard> {
  const params = new URLSearchParams();
  if (opts?.dates) params.set("dates", opts.dates);
  else if (opts?.season) params.set("dates", String(opts.season));
  if (opts?.seasonType) params.set("seasontype", String(opts.seasonType));
  if (opts?.week) params.set("week", String(opts.week));
  params.set("limit", "100");
  const url = `${ESPN_SCOREBOARD}?${params}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`ESPN scoreboard request failed: ${res.status}`);
  const data = await res.json();

  const season: number = data?.season?.year ?? new Date().getFullYear();
  const seasonType: number = data?.season?.type ?? 2;
  const weekNumber: number = data?.week?.number ?? 1;
  const phase = seasonType === 3 ? "playoffs" : "regular";

  const games = ((data?.events ?? []) as unknown[])
    .map(normalizeEvent)
    .filter((g): g is NormalizedGame => g !== null);

  return { season, weekNumber, phase, games };
}
