import { describe, expect, it } from "vitest";
import { escapeHtml, reminderEmail, testEmail, type ReminderEmailInput } from "./templates";

const base: ReminderEmailInput = {
  stage: "due",
  elderName: "Kamla Devi",
  recipientName: "Kamla Devi",
  timezone: "Asia/Kolkata",
  at: "2026-11-15T14:30:00.000Z",
  items: [{ name: "Metformin 500 mg", detail: "After dinner" }],
  appointment: null,
  actionUrl: "https://kinloop.test/confirm?t=abc",
  appUrl: "https://kinloop.test",
};

describe("escapeHtml", () => {
  it("escapes every HTML-significant character", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("reminderEmail", () => {
  it("writes the due email in plain words with the time and a confirm button", () => {
    const e = reminderEmail(base);
    expect(e.subject).toBe("Time for your 8:00 PM medicines");
    expect(e.text).toContain("- Metformin 500 mg: After dinner");
    expect(e.text).toContain("I've taken them: https://kinloop.test/confirm?t=abc");
    expect(e.html).toContain('lang="en"');
    expect(e.html).toContain('href="https://kinloop.test/confirm?t=abc"');
  });

  it("uses the waiting wording for the elder's second nudge", () => {
    expect(reminderEmail({ ...base, stage: "missed-elder" }).subject).toBe(
      "Your 8:00 PM medicines are still waiting",
    );
  });

  it("offers the circle a follow-up button naming the elder", () => {
    const e = reminderEmail({
      ...base,
      stage: "missed-circle",
      recipientName: "Priya",
      actionUrl: "https://kinloop.test/check-on?t=x",
    });
    expect(e.subject).toBe("Kamla Devi hasn't marked the 8:00 PM medicines");
    expect(e.text).toContain("I'll check on Kamla Devi: https://kinloop.test/check-on?t=x");
  });

  it("describes appointments with a Google Calendar link and no action button", () => {
    const appointment = {
      id: "a1",
      doctor: "Dr Mehta",
      specialty: "Cardiology",
      location: "City Clinic",
      at: base.at,
      notes: "Bring reports",
    };
    const day = reminderEmail({ ...base, stage: "appt-24h", appointment, actionUrl: null });
    expect(day.subject).toBe("Appointment tomorrow: Dr Mehta at 8:00 PM");
    expect(day.text).toContain("Dr Mehta (Cardiology)");
    expect(day.text).toContain("calendar.google.com");
    const soon = reminderEmail({ ...base, stage: "appt-2h", appointment: null, actionUrl: null });
    expect(soon.subject).toBe("Appointment in 2 hours:  at 8:00 PM");
    expect(soon.text).not.toContain("calendar.google.com");
  });

  it("keeps user text out of headers and markup", () => {
    const e = reminderEmail({
      ...base,
      stage: "appt-2h",
      appointment: {
        id: "a",
        doctor: "Dr X\r\nBcc: evil@example.com",
        specialty: "",
        location: "<img src=x onerror=alert(1)>",
        at: base.at,
        notes: "",
      },
      actionUrl: null,
    });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.html).not.toContain("<img");
    expect(e.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("omits the button when there is no signed link", () => {
    expect(reminderEmail({ ...base, actionUrl: null }).text).not.toContain("I've taken them:");
  });
});

describe("testEmail", () => {
  it("explains what the test is", () => {
    const e = testEmail("Kamla Devi", "Priya", "https://kinloop.test");
    expect(e.subject).toBe("Kinloop test reminder");
    expect(e.text).toContain("Reminders for Kamla Devi's care circle will reach you here.");
    expect(e.html).not.toContain("<ul");
  });
});
