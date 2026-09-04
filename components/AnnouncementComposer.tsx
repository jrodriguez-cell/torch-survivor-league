"use client";

import { useState, useTransition } from "react";
import { sendAnnouncement } from "@/app/groups/[groupId]/settings/actions";

export default function AnnouncementComposer({
  groupId,
  defaultSubject,
  defaultBody,
}: {
  groupId: string;
  defaultSubject: string;
  defaultBody: string;
}) {
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function send(testOnly: boolean) {
    setMsg(null);
    if (!testOnly && !confirm("Send this to everyone in the pool?")) return;
    startTransition(async () => {
      const res = await sendAnnouncement(groupId, subject, body, testOnly);
      setMsg(res.message);
    });
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="body">Message</label>
        <textarea
          id="body" value={body} onChange={(e) => setBody(e.target.value)}
          rows={10} className="input font-normal"
        />
        <p className="mt-1 text-xs text-stone-400">
          Plain text — blank lines become paragraphs. It&apos;s wrapped in the
          app&apos;s email styling automatically.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => send(true)} disabled={pending} className="btn-ghost">
          Send test to me
        </button>
        <button onClick={() => send(false)} disabled={pending} className="btn-primary">
          Send to the league
        </button>
        {msg && <span className="text-sm text-stone-600">{msg}</span>}
      </div>
    </div>
  );
}
