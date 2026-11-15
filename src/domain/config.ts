// Single source of timing rules: reminder ladder, due and missed windows, session and lockout limits.

export const MINUTE_MS = 60_000;

export const reminderLadder = {
  /** First email to the elder, minutes relative to the slot time. */
  dueOffsetMin: -10,
  /** Second nudge to the elder. */
  missedElderOffsetMin: 30,
  /** Escalation to opted-in circle members. */
  missedCircleOffsetMin: 60,
  /** Slots older than this are ignored by the cron tick. */
  ignoreOlderThanMin: 6 * 60,
  /** Appointment reminders, minutes before the appointment. */
  appointmentLeadMin: [24 * 60, 2 * 60],
} as const;

/** A slot is shown as due from this many minutes before its time. */
export const DUE_LEAD_MIN = 60;

/** A slot with no log becomes missed this many minutes after its time. */
export const MISSED_AFTER_MIN = reminderLadder.missedCircleOffsetMin;

/** Right-medicine check: a slot within this window of now counts as "due now". */
export const LABEL_DUE_WINDOW = { beforeMin: 60, afterMin: 120 } as const;

export const auth = {
  maxFailures: 5,
  lockoutMin: 15,
  sessionHours: 12,
} as const;

export const demo = { ttlHours: 24 } as const;

/** Signed email links stay valid this long after the slot they refer to. */
export const LINK_TTL_AFTER_SLOT_HOURS = 12;

export const limits = {
  aiPerCircleDay: 40,
  mailPerCircleDay: 60,
  maxItems: 40,
  maxMembers: 12,
  maxTimesPerItem: 6,
} as const;
