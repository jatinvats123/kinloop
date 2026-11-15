// Mailer interface with a Gmail SMTP transport (Nodemailer, app password) for production and an
// in-memory outbox for tests and local runs without SMTP settings.
import "server-only";
import { env } from "@/server/env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Keeps messages in memory instead of sending them; tests read `sent` and can force failures. */
export class MemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  failNext = 0;

  async send(message: MailMessage): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new Error("mail transport failed");
    }
    this.sent.push(message);
  }
}

const SMTP_TIMEOUT_MS = 10_000;

async function gmailMailer(user: string, pass: string, from: string): Promise<Mailer> {
  const { createTransport } = await import("nodemailer");
  const transport = createTransport({
    service: "gmail",
    auth: { user, pass },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
  return {
    async send(m) {
      await transport.sendMail({ from, to: m.to, subject: m.subject, text: m.text, html: m.html });
    },
  };
}

const holder = globalThis as unknown as { __kinloopMailer?: Mailer };

/** True when SMTP credentials are configured, so real email can be sent. */
export function mailConfigured(): boolean {
  const { SMTP_USER, SMTP_PASS } = env();
  return Boolean(SMTP_USER && SMTP_PASS);
}

/** The process-wide mailer: Gmail SMTP when configured, otherwise an in-memory outbox. */
export async function getMailer(): Promise<Mailer> {
  if (holder.__kinloopMailer) return holder.__kinloopMailer;
  const { SMTP_USER, SMTP_PASS, MAIL_FROM } = env();
  holder.__kinloopMailer =
    SMTP_USER && SMTP_PASS
      ? await gmailMailer(SMTP_USER, SMTP_PASS, MAIL_FROM || `Kinloop <${SMTP_USER}>`)
      : new MemoryMailer();
  return holder.__kinloopMailer;
}

/** Test hook: replaces the process-wide mailer. */
export function setMailerForTests(mailer: Mailer): void {
  holder.__kinloopMailer = mailer;
}
