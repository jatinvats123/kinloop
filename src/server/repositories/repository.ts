// Repository contract: every read and write is scoped to one circle code. Implemented by the
// Firestore repository (production) and the in-memory repository (tests and local runs).
import type { ActivityEntry, Appointment, Circle, DoseLog, Item, Member } from "@/domain/types";

export interface CircleSeed {
  circle: Circle;
  members: Member[];
  items?: Item[];
  logs?: DoseLog[];
  appointments?: Appointment[];
  activity?: ActivityEntry[];
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

  /**
   * Fixed-window rate limit: records a hit for `key` and returns whether it is within `max` hits
   * per `windowMs`.
   */
  hitRateLimit(key: string, max: number, windowMs: number, now: Date): Promise<boolean>;
}
