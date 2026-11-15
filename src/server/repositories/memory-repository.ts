// In-memory repository for tests and local runs without cloud access. Not shared across processes.
import type {
  ActivityEntry,
  Appointment,
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

interface CircleData {
  circle: Circle;
  members: Map<string, Member>;
  items: Map<string, Item>;
  logs: Map<string, DoseLog>;
  appointments: Map<string, Appointment>;
  activity: ActivityEntry[];
  notifications: Map<string, Notification>;
  followUps: Map<string, FollowUp>;
  proposals: Map<string, Proposal>;
}

const clone = <T>(v: T): T => structuredClone(v);
const byId = <T extends { id: string }>(list: T[] = []) =>
  new Map(list.map((x) => [x.id, clone(x)]));

export class MemoryRepository implements Repository {
  private circles = new Map<string, CircleData>();
  private limits = new Map<string, { windowStart: number; count: number }>();

  private data(code: string): CircleData | undefined {
    return this.circles.get(code);
  }

  async createCircle(seed: CircleSeed): Promise<boolean> {
    if (this.circles.has(seed.circle.code)) return false;
    this.circles.set(seed.circle.code, {
      circle: clone(seed.circle),
      members: byId(seed.members),
      items: byId(seed.items),
      logs: byId(seed.logs),
      appointments: byId(seed.appointments),
      activity: clone(seed.activity ?? []),
      notifications: new Map(),
      followUps: new Map(),
      proposals: byId(seed.proposals),
    });
    return true;
  }

  async getCircle(code: string) {
    const d = this.data(code);
    return d ? clone(d.circle) : null;
  }

  async updateCircle(code: string, patch: Partial<Omit<Circle, "code">>) {
    const d = this.data(code);
    if (d) d.circle = { ...d.circle, ...clone(patch) };
  }

  async transactCircle(code: string, fn: (c: Circle) => Partial<Omit<Circle, "code">> | null) {
    const d = this.data(code);
    if (!d) return null;
    const before = clone(d.circle);
    const patch = fn(clone(d.circle));
    if (patch) d.circle = { ...d.circle, ...clone(patch) };
    return before;
  }

  async deleteCircle(code: string) {
    this.circles.delete(code);
  }

  async listExpiredDemoCircles(nowIso: string, limit: number) {
    return [...this.circles.values()]
      .filter((d) => d.circle.isDemo && d.circle.expiresAt !== null && d.circle.expiresAt < nowIso)
      .slice(0, limit)
      .map((d) => d.circle.code);
  }

  async listMailEnabledCircles(limit: number) {
    return [...this.circles.values()]
      .filter((d) => d.circle.mailEnabled)
      .slice(0, limit)
      .map((d) => d.circle.code);
  }

  async listMembers(code: string) {
    return [...(this.data(code)?.members.values() ?? [])].map(clone);
  }

  async getMember(code: string, id: string) {
    const m = this.data(code)?.members.get(id);
    return m ? clone(m) : null;
  }

  async putMember(code: string, member: Member) {
    this.data(code)?.members.set(member.id, clone(member));
  }

  async deleteMember(code: string, id: string) {
    this.data(code)?.members.delete(id);
  }

  async listItems(code: string) {
    return [...(this.data(code)?.items.values() ?? [])].map(clone);
  }

  async getItem(code: string, id: string) {
    const i = this.data(code)?.items.get(id);
    return i ? clone(i) : null;
  }

  async putItem(code: string, item: Item) {
    this.data(code)?.items.set(item.id, clone(item));
  }

  async deleteItem(code: string, id: string) {
    this.data(code)?.items.delete(id);
  }

  async listLogs(code: string, fromIso: string, toIso: string) {
    return [...(this.data(code)?.logs.values() ?? [])]
      .filter((l) => l.scheduledAt >= fromIso && l.scheduledAt <= toIso)
      .map(clone);
  }

  async putLogs(code: string, logs: DoseLog[]) {
    const d = this.data(code);
    for (const l of logs) d?.logs.set(l.id, clone(l));
  }

  async deleteLog(code: string, id: string) {
    this.data(code)?.logs.delete(id);
  }

  async listAppointments(code: string, fromIso: string, limit: number) {
    return [...(this.data(code)?.appointments.values() ?? [])]
      .filter((a) => a.at >= fromIso)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .slice(0, limit)
      .map(clone);
  }

  async getAppointment(code: string, id: string) {
    const a = this.data(code)?.appointments.get(id);
    return a ? clone(a) : null;
  }

  async putAppointment(code: string, appointment: Appointment) {
    this.data(code)?.appointments.set(appointment.id, clone(appointment));
  }

  async deleteAppointment(code: string, id: string) {
    this.data(code)?.appointments.delete(id);
  }

  async addActivity(code: string, entry: ActivityEntry) {
    this.data(code)?.activity.push(clone(entry));
  }

  async listActivity(code: string, limit: number) {
    return [...(this.data(code)?.activity ?? [])]
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }

  async claimNotification(code: string, n: Notification) {
    const d = this.data(code);
    if (!d || d.notifications.has(n.id)) return false;
    d.notifications.set(n.id, clone(n));
    return true;
  }

  async releaseNotification(code: string, id: string) {
    this.data(code)?.notifications.delete(id);
  }

  async listNotifications(code: string, sinceIso: string, limit: number) {
    return [...(this.data(code)?.notifications.values() ?? [])]
      .filter((n) => n.sentAt >= sinceIso)
      .sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }

  async claimFollowUp(code: string, f: FollowUp) {
    const d = this.data(code);
    const held = d?.followUps.get(f.slotAt);
    if (held) return clone(held);
    d?.followUps.set(f.slotAt, clone(f));
    return clone(f);
  }

  async listFollowUps(code: string, sinceIso: string) {
    return [...(this.data(code)?.followUps.values() ?? [])]
      .filter((f) => f.slotAt >= sinceIso)
      .map(clone);
  }

  async putProposal(code: string, p: Proposal) {
    this.data(code)?.proposals.set(p.id, clone(p));
  }

  async getProposal(code: string, id: string) {
    const p = this.data(code)?.proposals.get(id);
    return p ? clone(p) : null;
  }

  async listProposals(code: string, status: ProposalStatus, limit: number) {
    return [...(this.data(code)?.proposals.values() ?? [])]
      .filter((p) => p.status === status)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map(clone);
  }

  async decideProposal(
    code: string,
    id: string,
    status: Exclude<ProposalStatus, "pending">,
    decidedAt: string,
  ) {
    const p = this.data(code)?.proposals.get(id);
    if (!p || p.status !== "pending") return null;
    const before = clone(p);
    p.status = status;
    p.decidedAt = decidedAt;
    return before;
  }

  async hitRateLimit(key: string, max: number, windowMs: number, now: Date) {
    const t = now.getTime();
    const entry = this.limits.get(key);
    if (!entry || t - entry.windowStart >= windowMs) {
      this.limits.set(key, { windowStart: t, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= max;
  }
}
