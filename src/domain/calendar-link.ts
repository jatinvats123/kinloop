// Builds an "Add to Google Calendar" template link for an appointment (no API access needed).
import type { Appointment } from "./types";

function compact(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Google Calendar event-template URL for `appointment`, one hour long by default. */
export function googleCalendarUrl(
  appointment: Appointment,
  elderName: string,
  durationMin = 60,
): string {
  const start = new Date(appointment.at);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const title = `${elderName}: ${appointment.doctor}${appointment.specialty ? ` (${appointment.specialty})` : ""}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${compact(start.toISOString())}/${compact(end.toISOString())}`,
    details: appointment.notes
      ? `${appointment.notes}\n\nAdded from Kinloop.`
      : "Added from Kinloop.",
    location: appointment.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
