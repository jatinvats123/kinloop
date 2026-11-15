// Repository contract: every read and write is scoped to one circle code. Implemented by the
// Firestore repository (production) and the in-memory repository (tests and local runs).
import type {
  ActivityEntry,
  Appointment,
  BriefDraft,
  Circle,
  DoseLog,
  FollowUp,
  Item,
  Member,
  Notification,
  Proposal,
  ProposalStatus,
} from "@/domain/types";

export interface CircleSeed {
  circle: Circle;
  members: Member[];
  items?: Item[];
  logs?: DoseLog[];
  appointments?: Appointment[];
  activity?: ActivityEntry[];
  proposals?: Proposal[];
}

export interface Repository {
  /** Creates a circle and its initial records atomically; returns false if the code is taken. */
  createCircle(seed: CircleSeed): Promise<boolean>;
  getCircle(code: string): Promise<Circle | null>;
  updateCircle(code: string, patch: Partial<Omit<Circle, "code">>): Promise<void>;
  /**
   * Reads the circle, applies `fn` and writes the returned patch in one transaction; `fn` returning
   * null leaves the circle untouched. Returns the circle as it was read.
   */
  transactCircle(
    code: string,
    fn: (circle: Circle) => Partial<Omit<Circle, "code">> | null,
  ): Promise<Circle | null>;
  /** Deletes a circle and every record under it. */
  deleteCircle(code: string): Promise<void>;
  /** Codes of demo circles whose expiry is before `nowIso`, at most `limit`. */
  listExpiredDemoCircles(nowIso: string, limit: number): Promise<string[]>;

  /** Codes of circles where at least one member has an email (the cron tick's work list). */
  listMailEnabledCircles(limit: number): Promise<string[]>;

  listMembers(code: string): Promise<Member[]>;
  getMember(code: string, id: string): Promise<Member | null>;
  putMember(code: string, member: Member): Promise<void>;
  deleteMember(code: string, id: string): Promise<void>;

  listItems(code: string): Promise<Item[]>;
  getItem(code: string, id: string): Promise<Item | null>;
  putItem(code: string, item: Item): Promise<void>;
  deleteItem(code: string, id: string): Promise<void>;

  /** Logs whose slot time is in [fromIso, toIso]. */
  listLogs(code: string, fromIso: string, toIso: string): Promise<DoseLog[]>;
  /** Writes logs by their deterministic IDs in one batch (idempotent). */
  putLogs(code: string, logs: DoseLog[]): Promise<void>;
  deleteLog(code: string, id: string): Promise<void>;

  /** Appointments at or after `fromIso`, soonest first, at most `limit`. */
  listAppointments(code: string, fromIso: string, limit: number): Promise<Appointment[]>;
  getAppointment(code: string, id: string): Promise<Appointment | null>;
  putAppointment(code: string, appointment: Appointment): Promise<void>;
  deleteAppointment(code: string, id: string): Promise<void>;

  addActivity(code: string, entry: ActivityEntry): Promise<void>;
  /** Most recent activity first, at most `limit`. */
  listActivity(code: string, limit: number): Promise<ActivityEntry[]>;

  /** Creates the notification only if its ID is new; returns false when it was already claimed. */
  claimNotification(code: string, notification: Notification): Promise<boolean>;
  /** Releases a claim so a failed send can be retried on the next tick. */
  releaseNotification(code: string, id: string): Promise<void>;
  /** Notifications sent at or after `sinceIso`, newest first, at most `limit`. */
  listNotifications(code: string, sinceIso: string, limit: number): Promise<Notification[]>;

  /**
   * Records `followUp` for its slot unless someone already did; returns whichever follow-up holds
   * the slot afterwards (the first responder wins).
   */
  claimFollowUp(code: string, followUp: FollowUp): Promise<FollowUp>;
  /** Follow-ups for slots at or after `sinceIso`. */
  listFollowUps(code: string, sinceIso: string): Promise<FollowUp[]>;

  putProposal(code: string, proposal: Proposal): Promise<void>;
  getProposal(code: string, id: string): Promise<Proposal | null>;
  /** Proposals with `status`, newest first, at most `limit`. */
  listProposals(code: string, status: ProposalStatus, limit: number): Promise<Proposal[]>;
  /**
   * Moves a pending proposal to `status` in one transaction; returns the proposal as it was if it
   * was pending, or null when it was missing or already decided.
   */
  decideProposal(
    code: string,
    id: string,
    status: Exclude<ProposalStatus, "pending">,
    decidedAt: string,
  ): Promise<Proposal | null>;

  /** The cached AI draft for an appointment's visit brief, if any. */
  getBriefDraft(code: string, appointmentId: string): Promise<BriefDraft | null>;
  putBriefDraft(code: string, draft: BriefDraft): Promise<void>;

  /**
   * Fixed-window rate limit: records a hit for `key` and returns whether it is within `max` hits
   * per `windowMs`.
   */
  hitRateLimit(key: string, max: number, windowMs: number, now: Date): Promise<boolean>;
}
