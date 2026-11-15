// Fixed reminder email templates (plain text + simple, large, high-contrast HTML) built from the
// message dictionary. Every user-supplied value is HTML-escaped; layout never comes from user input.
import { googleCalendarUrl } from "@/domain/calendar-link";
import { t } from "@/domain/messages";
import { clockLabel, longDate } from "@/domain/time";
import type { Appointment, NotificationType } from "@/domain/types";

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export interface EmailItem {
  name: string;
  detail: string;
}

export interface ReminderEmailInput {
  stage: Exclude<NotificationType, "test">;
  elderName: string;
  recipientName: string;
  timezone: string;
  /** Slot or appointment instant. */
  at: string;
  items: EmailItem[];
  appointment: Appointment | null;
  /** Signed confirm or follow-up link, when the stage has one. */
  actionUrl: string | null;
  appUrl: string;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for HTML element content and attribute values. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** Strips line breaks so user text can never inject extra headers or lines into a subject. */
function oneLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

interface Body {
  intro: string;
  lines: string[];
  action: { label: string; url: string; hint: string } | null;
  secondary: { label: string; url: string } | null;
}

function render(subject: string, recipient: string, elder: string, appUrl: string, b: Body) {
  const hello = t("email.hello", { name: recipient });
  const footer = t("email.footer", { elder });
  const text = [
    hello,
    "",
    b.intro,
    ...b.lines.map((l) => `- ${l}`),
    "",
    ...(b.action ? [`${b.action.label}: ${b.action.url}`, b.action.hint, ""] : []),
    ...(b.secondary ? [`${b.secondary.label}: ${b.secondary.url}`, ""] : []),
    `${t("email.openApp")}: ${appUrl}`,
    "",
    footer,
  ].join("\n");

  const e = escapeHtml;
  const button = b.action
    ? `<p style="margin:28px 0 8px"><a href="${e(b.action.url)}" style="display:inline-block;background:#243100;color:#ffffff;font-size:22px;font-weight:600;text-decoration:none;padding:16px 28px;border-radius:999px">${e(b.action.label)}</a></p><p style="margin:0 0 24px;font-size:17px;color:#4A4F45">${e(b.action.hint)}</p>`
    : "";
  const secondary = b.secondary
    ? `<p style="margin:16px 0;font-size:19px"><a href="${e(b.secondary.url)}" style="color:#243100;font-weight:600">${e(b.secondary.label)}</a></p>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${e(subject)}</title></head><body style="margin:0;background:#F5F5F8;font-family:Urbanist,Segoe UI,Helvetica,Arial,sans-serif;color:#111408"><main style="max-width:560px;margin:0 auto;padding:32px 20px"><div style="background:#ffffff;border-radius:24px;padding:28px"><p style="margin:0 0 16px;font-size:22px;font-weight:600">${e(hello)}</p><p style="margin:0 0 12px;font-size:20px">${e(b.intro)}</p>${b.lines.length > 0 ? `<ul style="margin:0;padding-left:24px;font-size:20px;line-height:1.5">${b.lines.map((l) => `<li>${e(l)}</li>`).join("")}</ul>` : ""}${button}${secondary}<p style="margin:24px 0 0;font-size:18px"><a href="${e(appUrl)}" style="color:#243100;font-weight:600">${e(t("email.openApp"))}</a></p></div><p style="margin:20px 8px 0;font-size:15px;color:#4A4F45">${e(footer)}</p></main></body></html>`;
  return { subject: oneLine(subject), text, html };
}

const itemLine = (i: EmailItem) => (i.detail ? `${i.name}: ${i.detail}` : i.name);

/** Builds the email for one reminder stage: dose due, elder nudge, circle escalation or appointment. */
export function reminderEmail(input: ReminderEmailInput): RenderedEmail {
  const time = clockLabel(input.at, input.timezone);
  const elder = input.elderName;
  const lines = input.items.map(itemLine);
  const action = (label: string, hint: string) =>
    input.actionUrl ? { label, url: input.actionUrl, hint } : null;

  switch (input.stage) {
    case "due":
    case "missed-elder": {
      const due = input.stage === "due";
      return render(
        t(due ? "email.dueSubject" : "email.missedSubject", { time }),
        input.recipientName,
        elder,
        input.appUrl,
        {
          intro: t(due ? "email.dueIntro" : "email.missedIntro"),
          lines,
          action: action(t("email.confirmCta"), t("email.confirmHint")),
          secondary: null,
        },
      );
    }
    case "missed-circle":
      return render(
        t("email.circleSubject", { elder, time }),
        input.recipientName,
        elder,
        input.appUrl,
        {
          intro: t("email.circleIntro", { elder }),
          lines,
          action: action(t("email.circleCta", { elder }), t("email.circleHint")),
          secondary: null,
        },
      );
    case "appt-24h":
    case "appt-2h": {
      const a = input.appointment;
      const doctor = a?.doctor ?? "";
      const subjectKey = input.stage === "appt-24h" ? "email.apptSubject24" : "email.apptSubject2";
      return render(t(subjectKey, { doctor, time }), input.recipientName, elder, input.appUrl, {
        intro: t("email.apptIntro", { elder }),
        lines: [
          `${doctor}${a?.specialty ? ` (${a.specialty})` : ""}`,
          `${longDate(input.at, input.timezone)}, ${time}`,
          ...(a?.location ? [a.location] : []),
          ...(a?.notes ? [a.notes] : []),
        ],
        action: null,
        secondary: a ? { label: t("email.apptCalendar"), url: googleCalendarUrl(a, elder) } : null,
      });
    }
  }
}

/** The "send a test reminder to my email" message. */
export function testEmail(elderName: string, recipientName: string, appUrl: string): RenderedEmail {
  return render(t("email.testSubject"), recipientName, elderName, appUrl, {
    intro: t("email.testIntro", { elder: elderName }),
    lines: [],
    action: null,
    secondary: null,
  });
}
