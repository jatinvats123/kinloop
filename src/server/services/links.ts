// Email-link flows: one-tap confirm (elder marks a slot taken) and "I'll check on them" (first
// circle member to respond is shown as handling a missed slot). Reading a link never mutates;
// only the POST from the confirm page does.
import { can } from "@/domain/permissions";
import { logId, slotsForRange } from "@/domain/schedule";
import { addDays, clockLabel, zonedParts } from "@/domain/time";
import type { Circle, FollowUp, Item, Member } from "@/domain/types";
import { AppError } from "@/server/errors";
import type { Repository } from "@/server/repositories/repository";
import { verifyLink, type LinkClaims, type LinkPurpose } from "@/server/security/signed-link";
import type { Ctx } from "./context";
import { recordActivity } from "./context";
import { takeSlot } from "./doses";
import { describeItem } from "./items";

export type LinkState = "ok" | "expired" | "invalid";

export interface SlotLinkView {
  state: LinkState;
  elderName: string;
  memberName: string;
  time: string;
  /** Items in the slot with whether each is already logged. */
  items: Array<{ id: string; name: string; logged: boolean }>;
  followUp: FollowUp | null;
}

const EMPTY: Omit<SlotLinkView, "state"> = {
  elderName: "",
  memberName: "",
  time: "",
  items: [],
  followUp: null,
};

interface Resolved {
  claims: LinkClaims;
  circle: Circle;
  member: Member;
}

/** Verifies the token and loads its circle and member; throws `forbidden` if either is gone. */
async function resolve(
  repo: Repository,
  token: string,
  purpose: LinkPurpose,
  secret: string,
  now: Date,
): Promise<Resolved> {
  const claims = verifyLink(token, purpose, secret, now);
  const [circle, member] = await Promise.all([
    repo.getCircle(claims.circle),
    repo.getMember(claims.circle, claims.memberId),
  ]);
  if (!circle || !member || (circle.expiresAt && circle.expiresAt < now.toISOString())) {
    throw new AppError("forbidden", "This link isn't valid.");
  }
  return { claims, circle, member };
}

function slotItems(items: Item[], slotAt: string, zone: string): Item[] {
  const { date } = zonedParts(slotAt, zone);
  const ids = new Set(
    slotsForRange(items, addDays(date, -1), addDays(date, 1), zone)
      .filter((s) => s.at === slotAt)
      .map((s) => s.itemId),
  );
  return items.filter((i) => ids.has(i.id));
}

function stateOf(err: unknown): LinkState {
  return err instanceof AppError && err.code === "bad-request" ? "expired" : "invalid";
}

/** Read-only view of the slot a link refers to, for the confirm and follow-up pages. */
export async function readSlotLink(
  repo: Repository,
  token: string,
  purpose: LinkPurpose,
  secret: string,
  now: Date,
): Promise<SlotLinkView> {
  try {
    const { claims, circle, member } = await resolve(repo, token, purpose, secret, now);
    const [items, logs, followUps] = await Promise.all([
      repo.listItems(circle.code),
      repo.listLogs(circle.code, claims.slotAt, claims.slotAt),
      repo.listFollowUps(circle.code, claims.slotAt),
    ]);
    const logged = new Set(logs.map((l) => l.id));
    return {
      state: "ok",
      elderName: circle.elderName,
      memberName: member.name,
      time: clockLabel(claims.slotAt, circle.timezone),
      items: slotItems(items, claims.slotAt, circle.timezone).map((i) => ({
        id: i.id,
        name: describeItem(i),
        logged: logged.has(logId(i.id, claims.slotAt)),
      })),
      followUp: followUps.find((f) => f.slotAt === claims.slotAt) ?? null,
    };
  } catch (err) {
    return { state: stateOf(err), ...EMPTY };
  }
}

/** POST from the confirm page: marks every still-open item in the slot as taken by the link's member. */
export async function confirmFromLink(
  repo: Repository,
  token: string,
  secret: string,
  now: Date,
): Promise<{ marked: number }> {
  const { claims, circle, member } = await resolve(repo, token, "confirm", secret, now);
  const items = slotItems(await repo.listItems(circle.code), claims.slotAt, circle.timezone);
  if (items.length === 0) return { marked: 0 };
  const ctx: Ctx = { repo, circle, member, now };
  const marked = await takeSlot(ctx, { slotAt: claims.slotAt, itemIds: items.map((i) => i.id) });
  return { marked };
}

/**
 * POST from the follow-up page: records the member as handling the missed slot unless someone
 * already is. Returns who holds it and whether that is the caller.
 */
export async function followUpFromLink(
  repo: Repository,
  token: string,
  secret: string,
  now: Date,
): Promise<{ mine: boolean; holder: FollowUp }> {
  const { claims, circle, member } = await resolve(repo, token, "follow-up", secret, now);
  if (!can(member, "follow-up", circle)) throw new AppError("forbidden", "This link isn't valid.");
  const holder = await repo.claimFollowUp(circle.code, {
    slotAt: claims.slotAt,
    memberId: member.id,
    memberName: member.name,
    at: now.toISOString(),
  });
  const mine = holder.memberId === member.id;
  if (mine && holder.at === now.toISOString()) {
    await recordActivity(
      { repo, circle, member, now },
      "follow-up.claimed",
      `Is checking on ${circle.elderName} about the ${clockLabel(claims.slotAt, circle.timezone)} medicines`,
    );
  }
  return { mine, holder };
}
