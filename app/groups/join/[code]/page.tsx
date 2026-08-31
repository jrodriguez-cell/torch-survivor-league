import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Invite-link join: /groups/join/ABCD1234
// Signed-in users are joined and redirected; signed-out users go to signup
// first, then back here.
export default async function JoinByLinkPage({
  params,
}: {
  params: { code: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const code = decodeURIComponent(params.code).toUpperCase();

  if (!user) {
    redirect(`/signup?next=${encodeURIComponent(`/groups/join/${code}`)}`);
  }

  const { data: groupId, error } = await supabase.rpc("join_group_by_code", {
    p_code: code,
  });

  if (error || !groupId) {
    redirect("/dashboard?error=badcode");
  }

  redirect(`/groups/${groupId}`);
}
