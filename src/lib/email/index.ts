/**
 * Email adapter: Resend when RESEND_API_KEY is set, console fallback
 * otherwise — the rest of the app never knows the difference.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface EmailSender {
  name: string;
  send(msg: EmailMessage): Promise<{ ok: boolean; error?: string }>;
}

class ResendSender implements EmailSender {
  name = "resend";
  constructor(private apiKey: string) {}

  async send(msg: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Sightline <onboarding@resend.dev>",
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
      }),
    });
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
    return { ok: true };
  }
}

class ConsoleSender implements EmailSender {
  name = "console";
  async send(msg: EmailMessage) {
    console.log(`[email:console] to=${msg.to} subject="${msg.subject}" (set RESEND_API_KEY to actually send)`);
    return { ok: true };
  }
}

export function getEmailSender(): EmailSender {
  return process.env.RESEND_API_KEY
    ? new ResendSender(process.env.RESEND_API_KEY)
    : new ConsoleSender();
}
