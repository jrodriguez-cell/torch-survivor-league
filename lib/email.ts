// Transactional email via Resend. Entirely optional: with no RESEND_API_KEY
// set, every send is a no-op that returns false, so the app runs fine without
// email configured. Swap this file to change providers.

import { APP_NAME, APP_EMOJI } from "@/lib/branding";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  // Resend's test sender works without domain verification (delivers only to
  // the account owner in test mode). Set EMAIL_FROM to your verified sender.
  return process.env.EMAIL_FROM || `${APP_NAME} <onboarding@resend.dev>`;
}

async function send(to: string | string[], subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const recipients = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];
  if (!key || recipients.length === 0) return false;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: recipients, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Send a pre-built HTML body (wrapped in the shared shell) to one or more
// recipients. Returns false if email isn't configured.
export async function sendHtmlEmail(
  to: string | string[],
  subject: string,
  bodyHtml: string
): Promise<boolean> {
  return send(to, subject, shell(bodyHtml));
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1c1917">
    <div style="font-size:22px;font-weight:800">${APP_EMOJI} ${APP_NAME}</div>
    <div style="margin-top:12px;font-size:15px;line-height:1.5">${body}</div>
    <div style="margin-top:24px;font-size:12px;color:#a8a29e">You're getting this because you're in a ${APP_NAME} pool.</div>
  </div>`;
}

export async function sendEliminationEmail(to: string, groupName: string): Promise<boolean> {
  return send(
    to,
    `You've been eliminated in ${groupName}`,
    shell(
      `<p>Tough break — your run in <strong>${groupName}</strong> is over.</p>
       <p>You've hit the strike limit, so you can't submit more picks, but you can still watch how the rest of the pool shakes out.</p>`
    )
  );
}

export async function sendReminderEmail(
  to: string,
  groupName: string,
  deadlineIso: string
): Promise<boolean> {
  const when = new Date(deadlineIso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return send(
    to,
    `⏰ Don't forget your pick in ${groupName}`,
    shell(
      `<p>You haven't made your pick yet in <strong>${groupName}</strong>.</p>
       <p>Picks lock <strong>${when}</strong>. Miss it and it's an automatic strike.</p>`
    )
  );
}
