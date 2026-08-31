import { loadGroupContext } from "@/lib/group";
import { resolveMemberNames } from "@/lib/names";
import type { GroupMember, Pick, Team, Week } from "@/lib/types";

const RESULT_ICON: Record<string, string> = {
  win: "✅", loss: "❌", tie: "➖", missed: "🚫", pending: "•",
};

export default async function StandingsPage({
  params,
}: {
  params: { groupId: string };
}) {
  const { supabase, group } = await loadGroupContext(params.groupId);

  const { data: memberData } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", group.id);
  const members = (memberData as GroupMember[]) ?? [];
  const memberIds = members.map((m) => m.id);

  const [{ data: weekData }, { data: teamData }, names] = await Promise.all([
    supabase.from("weeks").select("*").eq("season", group.season).order("week_number"),
    supabase.from("teams").select("*"),
    resolveMemberNames(supabase, members),
  ]);

  const { data: pickData } = memberIds.length
    ? await supabase.from("picks").select("*").in("group_member_id", memberIds)
    : { data: [] as Pick[] };

  const weeks = (weekData as Week[]) ?? [];
  const teams = (teamData as Team[]) ?? [];
  const teamAbbr: Record<string, string> = {};
  teams.forEach((t) => (teamAbbr[t.id] = t.abbreviation));

  // pickMap[memberId][weekId] = pick
  const pickMap: Record<string, Record<string, Pick>> = {};
  for (const p of (pickData as Pick[]) ?? []) {
    (pickMap[p.group_member_id] ??= {})[p.week_id] = p;
  }

  const sorted = [...members].sort((a, b) => {
    if (a.status !== b.status) return a.status === "active" ? -1 : 1;
    if (a.strikes_used !== b.strikes_used) return a.strikes_used - b.strikes_used;
    return (names[a.id] ?? "").localeCompare(names[b.id] ?? "");
  });

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Standings</h2>
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="w-full min-w-[520px] text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500">
            <tr>
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-center">Strikes</th>
              {weeks.map((w) => (
                <th key={w.id} className="px-2 py-2 text-center">W{w.week_number}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((m) => (
              <tr key={m.id} className={`border-t border-stone-100 ${m.status === "eliminated" ? "opacity-50" : ""}`}>
                <td className="px-4 py-2 font-medium">
                  {names[m.id]}
                  {m.user_id === group.commish_id && (
                    <span className="ml-2 badge bg-ember-100 text-ember-700">C</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {m.status === "eliminated"
                    ? <span className="text-red-600">Out</span>
                    : <span className="text-jungle-700">Alive</span>}
                </td>
                <td className="px-4 py-2 text-center">{m.strikes_used}/{group.strike_limit}</td>
                {weeks.map((w) => {
                  const p = pickMap[m.id]?.[w.id];
                  return (
                    <td key={w.id} className="px-2 py-2 text-center">
                      {p ? (
                        <span title={`${teamAbbr[p.team_id] ?? ""} — ${p.result}`}>
                          <span className="text-[10px] text-stone-500">{teamAbbr[p.team_id] ?? ""}</span>{" "}
                          {RESULT_ICON[p.result] ?? "•"}
                        </span>
                      ) : (
                        <span className="text-stone-300">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-stone-400">
        Other players&apos; picks stay hidden until each week&apos;s deadline passes.
      </p>
    </div>
  );
}
