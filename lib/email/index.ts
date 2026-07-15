import "server-only";
import { env, flags } from "@/env";
import type { EmailContent } from "@/lib/email/templates";

export * from "@/lib/email/templates";

/**
 * Email service. Resend via REST (no SDK) when RESEND_API_KEY is set; otherwise
 * MOCK mode logs the email so the billing flow is fully exercisable offline.
 * This is the single seam for all transactional email.
 */
export async function sendEmail(to: string, content: EmailContent): Promise<{ sent: boolean; mock: boolean }> {
  if (!flags.emailLive) {
    console.info(`[email:mock] → ${to} :: ${content.subject}`);
    return { sent: true, mock: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.EMAIL_FROM, to, subject: content.subject, html: content.html, text: content.text }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[email] send failed: ${res.status}`);
    return { sent: false, mock: false };
  }
  return { sent: true, mock: false };
}
