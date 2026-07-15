/**
 * EMAIL TEMPLATES — billing lifecycle.
 * Voice matches the product: warm, calm, never anxiety-inducing. Even a
 * failed-payment email is supportive. Plain helpers so they're easy to test
 * and localize later.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const wrap = (heading: string, body: string, cta?: { label: string; url: string }) => {
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;margin-top:20px;background:#ff7a1a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${cta.label}</a>`
    : "";
  return `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:520px;margin:0 auto;color:#0a1f44">
    <div style="font-weight:700;font-size:18px;margin-bottom:16px">Synapse&nbsp;Adaptive</div>
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 12px">${heading}</h1>
    <div style="font-size:15px;line-height:1.6;color:#33415c">${body}</div>
    ${button}
    <p style="font-size:12px;color:#8a97ad;margin-top:28px">
      Synapse Adaptive offers general wellness insights and education — it doesn't diagnose, treat,
      or replace your healthcare provider.
    </p>
  </div>`;
};

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

export function renewalReminderEmail(opts: { name: string; renewsOn: string; manageUrl: string }): EmailContent {
  const body = `Hi ${opts.name}, just a friendly heads-up that your Synapse Adaptive Pro plan renews on
    <strong>${opts.renewsOn}</strong> for $10. No action needed — we just never want a charge to surprise you.
    You can review or change your plan anytime.`;
  const html = wrap("Your Pro plan renews soon", body, { label: "Manage billing", url: opts.manageUrl });
  return { subject: "A quick heads-up about your upcoming renewal", html, text: strip(html) };
}

export function paymentFailedEmail(opts: { name: string; updateUrl: string }): EmailContent {
  const body = `Hi ${opts.name}, we tried to process your $10 Pro payment but the charge didn't go through —
    these things usually just mean an expired card. Your insights are safe; update your payment method
    whenever you get a moment and everything picks up right where it left off.`;
  const html = wrap("Let's sort out your payment", body, { label: "Update payment method", url: opts.updateUrl });
  return { subject: "A small hiccup with your payment", html, text: strip(html) };
}

export function receiptEmail(opts: { name: string; amount: string; date: string; manageUrl: string }): EmailContent {
  const body = `Hi ${opts.name}, thanks for being part of Synapse Adaptive Pro. This confirms your payment of
    <strong>${opts.amount}</strong> on ${opts.date}. Here's to understanding your recovery a little better
    every week.`;
  const html = wrap("Payment received — thank you", body, { label: "View billing", url: opts.manageUrl });
  return { subject: `Your Synapse Adaptive receipt (${opts.amount})`, html, text: strip(html) };
}

export function upgradeNudgeEmail(opts: { name: string; upgradeUrl: string }): EmailContent {
  const body = `Hi ${opts.name}, you've been showing up for your check-ins — that consistency is exactly what makes
    recovery insights sharper. Pro unlocks the proactive “what we noticed” insights, ask-anything chat, and a
    ready-to-go summary for your next appointment. It's $10/month and you can cancel anytime.`;
  const html = wrap("You're getting real value — here's what Pro adds", body, { label: "Explore Pro", url: opts.upgradeUrl });
  return { subject: "A little more from your recovery companion", html, text: strip(html) };
}
