// Guided tour for demo circles: seven steps that tick themselves from the activity feed, so a visitor
// sees every signature feature in about two minutes. Pure: steps and progress only, no I/O.
import type { ActivityEntry, Member, Role } from "./types";

export type TourStepId =
  "take" | "check" | "change" | "approve" | "test-email" | "import" | "brief";

export interface TourStep {
  id: TourStepId;
  title: string;
  detail: string;
  /** Who to be for this step; the panel offers a one-click switch when it differs. */
  as: Role;
  href: string;
}

interface StepRule {
  actions: readonly string[];
  /** When set, only entries by a member with this role count. */
  by?: Role;
}

const RULES: Record<TourStepId, StepRule> = {
  take: { actions: ["dose.taken"], by: "elder" },
  check: { actions: ["label.checked"] },
  change: {
    actions: ["item.updated", "item.added", "item.removed", "proposal.created"],
    by: "family",
  },
  approve: { actions: ["proposal.approved"], by: "elder" },
  "test-email": { actions: ["reminder.test"] },
  import: { actions: ["prescription.read"] },
  brief: { actions: ["brief.opened"] },
};

/** The tour in order. `briefHref` is the next appointment's brief (or the visits list). */
export function tourSteps(briefHref: string): TourStep[] {
  return [
    {
      id: "take",
      title: "Take a dose as Kamla",
      detail: "Press the big button on the slot that is due now.",
      as: "elder",
      href: "/today",
    },
    {
      id: "check",
      title: "Check a sample label",
      detail: "“Is this the right one?” reads a strip and compares it with the schedule.",
      as: "elder",
      href: "/check",
    },
    {
      id: "change",
      title: "Change a medicine as Priya",
      detail: "Edit any medicine. Kamla has “Ask me first” on, so it waits for her.",
      as: "family",
      href: "/medicines",
    },
    {
      id: "approve",
      title: "Approve it as Kamla",
      detail: "Her Today screen shows the change. She decides.",
      as: "elder",
      href: "/today",
    },
    {
      id: "test-email",
      title: "Send yourself a test reminder",
      detail: "Type your email to see what the reminder looks like.",
      as: "elder",
      href: "/reminders",
    },
    {
      id: "import",
      title: "Import a prescription",
      detail: "Paste the sample, then review each AI draft. Nothing is saved until you add it.",
      as: "family",
      href: "/medicines/import",
    },
    {
      id: "brief",
      title: "Open the visit brief",
      detail: "Facts for tomorrow's doctor visit, plus AI-drafted questions.",
      as: "family",
      href: briefHref,
    },
  ];
}

/**
 * Which tour steps are done, judged from activity recorded since the demo circle was created
 * (seeded history never counts). A step done by the wrong person does not tick.
 */
export function tourProgress(
  activity: readonly ActivityEntry[],
  members: readonly Pick<Member, "id" | "role">[],
  since: string,
): Record<TourStepId, boolean> {
  const roleOf = new Map(members.map((m) => [m.id, m.role]));
  const fresh = activity.filter((a) => a.at >= since);
  const done = (rule: StepRule) =>
    fresh.some(
      (a) => rule.actions.includes(a.action) && (!rule.by || roleOf.get(a.actorId) === rule.by),
    );
  return Object.fromEntries(
    (Object.keys(RULES) as TourStepId[]).map((id) => [id, done(RULES[id])]),
  ) as Record<TourStepId, boolean>;
}
