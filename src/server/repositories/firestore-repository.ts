// Firestore (Native mode) repository. Server-side only; authenticated with a service-account key
// from FIREBASE_SERVICE_ACCOUNT (base64 JSON). Queries are bounded and use single-field indexes only.
import { Firestore, type DocumentReference } from "@google-cloud/firestore";
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
import type { CircleSeed, Repository } from "./repository";

type Sub =
  | "members"
  | "items"
  | "logs"
  | "appointments"
  | "activity"
  | "notifications"
  | "followUps"
  | "proposals"
  | "briefs";

const ALREADY_EXISTS = 6;
const isAlreadyExists = (err: unknown) => (err as { code?: number }).code === ALREADY_EXISTS;

/** Decodes the base64 service-account JSON into Firestore client settings. */
export function firestoreSettings(serviceAccountB64: string) {
  const json = JSON.parse(Buffer.from(serviceAccountB64, "base64").toString("utf8")) as {
    project_id: string;
    client_email: string;
    private_key: string;
  };
  return {
    projectId: json.project_id,
    credentials: { client_email: json.client_email, private_key: json.private_key },
    ignoreUndefinedProperties: true,
  };
}

export class FirestoreRepository implements Repository {
  constructor(private readonly db: Firestore) {}

  private circleRef(code: string) {
    return this.db.collection("circles").doc(code);
  }

  private sub(code: string, name: Sub) {
    return this.circleRef(code).collection(name);
  }

  private async getDoc<T>(ref: DocumentReference): Promise<T | null> {
    const snap = await ref.get();
    return snap.exists ? (snap.data() as T) : null;
  }

  async createCircle(seed: CircleSeed): Promise<boolean> {
    const code = seed.circle.code;
    try {
      await this.circleRef(code).create(seed.circle);
    } catch (err) {
      if (isAlreadyExists(err)) return false;
      throw err;
    }
    const writer = this.db.bulkWriter();
    const put = (name: Sub, list: Array<{ id: string }> = []) => {
      for (const x of list) void writer.set(this.sub(code, name).doc(x.id), x);
    };
    put("members", seed.members);
    put("items", seed.items);
    put("logs", seed.logs);
    put("appointments", seed.appointments);
    put("activity", seed.activity);
    put("proposals", seed.proposals);
    await writer.close();
    return true;
  }

  getCircle(code: string) {
    return this.getDoc<Circle>(this.circleRef(code));
  }

  async updateCircle(code: string, patch: Partial<Omit<Circle, "code">>) {
    await this.circleRef(code).set(patch, { merge: true });
  }

  transactCircle(code: string, fn: (c: Circle) => Partial<Omit<Circle, "code">> | null) {
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(this.circleRef(code));
      if (!snap.exists) return null;
      const circle = snap.data() as Circle;
      const patch = fn(circle);
      if (patch) tx.set(this.circleRef(code), patch, { merge: true });
      return circle;
    });
  }

  async deleteCircle(code: string) {
    await this.db.recursiveDelete(this.circleRef(code));
  }

  async listExpiredDemoCircles(nowIso: string, limit: number) {
    const snap = await this.db
      .collection("circles")
      .where("expiresAt", "<", nowIso)
      .limit(limit)
      .get();
    return snap.docs.filter((d) => (d.data() as Circle).isDemo).map((d) => d.id);
  }

  async listMailEnabledCircles(limit: number) {
    const snap = await this.db
      .collection("circles")
      .where("mailEnabled", "==", true)
      .limit(limit)
      .select()
      .get();
    return snap.docs.map((d) => d.id);
  }

  async listMembers(code: string) {
    const snap = await this.sub(code, "members").limit(50).get();
    return snap.docs.map((d) => d.data() as Member);
  }

  getMember(code: string, id: string) {
    return this.getDoc<Member>(this.sub(code, "members").doc(id));
  }

  async putMember(code: string, member: Member) {
    await this.sub(code, "members").doc(member.id).set(member);
  }

  async deleteMember(code: string, id: string) {
    await this.sub(code, "members").doc(id).delete();
  }

  async listItems(code: string) {
    const snap = await this.sub(code, "items").limit(100).get();
    return snap.docs.map((d) => d.data() as Item);
  }

  getItem(code: string, id: string) {
    return this.getDoc<Item>(this.sub(code, "items").doc(id));
  }

  async putItem(code: string, item: Item) {
    await this.sub(code, "items").doc(item.id).set(item);
  }

  async deleteItem(code: string, id: string) {
    await this.sub(code, "items").doc(id).delete();
  }

  async listLogs(code: string, fromIso: string, toIso: string) {
    const snap = await this.sub(code, "logs")
      .where("scheduledAt", ">=", fromIso)
      .where("scheduledAt", "<=", toIso)
      .limit(2000)
      .get();
    return snap.docs.map((d) => d.data() as DoseLog);
  }

  async putLogs(code: string, logs: DoseLog[]) {
    const batch = this.db.batch();
    for (const l of logs) batch.set(this.sub(code, "logs").doc(l.id), l);
    await batch.commit();
  }

  async deleteLog(code: string, id: string) {
    await this.sub(code, "logs").doc(id).delete();
  }

  async listAppointments(code: string, fromIso: string, limit: number) {
    const snap = await this.sub(code, "appointments")
      .where("at", ">=", fromIso)
      .orderBy("at")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Appointment);
  }

  getAppointment(code: string, id: string) {
    return this.getDoc<Appointment>(this.sub(code, "appointments").doc(id));
  }

  async putAppointment(code: string, appointment: Appointment) {
    await this.sub(code, "appointments").doc(appointment.id).set(appointment);
  }

  async deleteAppointment(code: string, id: string) {
    await this.sub(code, "appointments").doc(id).delete();
  }

  async addActivity(code: string, entry: ActivityEntry) {
    await this.sub(code, "activity").doc(entry.id).set(entry);
  }

  async listActivity(code: string, limit: number) {
    const snap = await this.sub(code, "activity").orderBy("at", "desc").limit(limit).get();
    return snap.docs.map((d) => d.data() as ActivityEntry);
  }

  async claimNotification(code: string, n: Notification) {
    try {
      await this.sub(code, "notifications").doc(n.id).create(n);
      return true;
    } catch (err) {
      if (isAlreadyExists(err)) return false;
      throw err;
    }
  }

  async releaseNotification(code: string, id: string) {
    await this.sub(code, "notifications").doc(id).delete();
  }

  async listNotifications(code: string, sinceIso: string, limit: number) {
    const snap = await this.sub(code, "notifications")
      .where("sentAt", ">=", sinceIso)
      .orderBy("sentAt", "desc")
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data() as Notification);
  }

  async claimFollowUp(code: string, f: FollowUp) {
    const ref = this.sub(code, "followUps").doc(f.slotAt);
    try {
      await ref.create(f);
      return f;
    } catch (err) {
      if (!isAlreadyExists(err)) throw err;
      return (await this.getDoc<FollowUp>(ref)) ?? f;
    }
  }

  async listFollowUps(code: string, sinceIso: string) {
    const snap = await this.sub(code, "followUps").where("slotAt", ">=", sinceIso).limit(100).get();
    return snap.docs.map((d) => d.data() as FollowUp);
  }

  async putProposal(code: string, p: Proposal) {
    await this.sub(code, "proposals").doc(p.id).set(p);
  }

  getProposal(code: string, id: string) {
    return this.getDoc<Proposal>(this.sub(code, "proposals").doc(id));
  }

  async listProposals(code: string, status: ProposalStatus, limit: number) {
    // Equality filter only (no composite index needed); sorted here and bounded by `limit`.
    const snap = await this.sub(code, "proposals").where("status", "==", status).limit(limit).get();
    return snap.docs
      .map((d) => d.data() as Proposal)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  decideProposal(
    code: string,
    id: string,
    status: Exclude<ProposalStatus, "pending">,
    decidedAt: string,
  ) {
    const ref = this.sub(code, "proposals").doc(id);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const p = snap.data() as Proposal | undefined;
      if (!p || p.status !== "pending") return null;
      tx.update(ref, { status, decidedAt });
      return p;
    });
  }

  getBriefDraft(code: string, appointmentId: string) {
    return this.getDoc<BriefDraft>(this.sub(code, "briefs").doc(appointmentId));
  }

  async putBriefDraft(code: string, draft: BriefDraft) {
    await this.sub(code, "briefs").doc(draft.appointmentId).set(draft);
  }

  hitRateLimit(key: string, max: number, windowMs: number, now: Date) {
    const ref = this.db.collection("rateLimits").doc(key);
    return this.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const t = now.getTime();
      const cur = snap.data() as { windowStart: number; count: number } | undefined;
      if (!cur || t - cur.windowStart >= windowMs) {
        tx.set(ref, { windowStart: t, count: 1, expiresAt: new Date(t + windowMs) });
        return true;
      }
      tx.update(ref, { count: cur.count + 1 });
      return cur.count + 1 <= max;
    });
  }
}
