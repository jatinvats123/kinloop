// "Ask me first": when the elder turns it on, schedule changes by other members become proposals
// that only the elder can approve or decline. Approving applies the change exactly as proposed.
import type { Item, ItemDraft, Proposal, ProposalKind } from "@/domain/types";
import { AppError } from "@/server/errors";
import { newId } from "@/server/auth/passcode";
import { recordActivity, requirePermission, type Ctx } from "./context";

const MAX_PENDING = 20;

/** A proposal's payload: the item fields, plus whether it should be active (for pause/resume). */
export type ProposalPayload = ItemDraft & { active?: boolean };

/** Type guard separating a proposal from an applied item in service results. */
export function isProposal(x: Item | Proposal | null): x is Proposal {
  return x !== null && "status" in x;
}

/** Records a schedule change as a pending proposal for the elder. */
export async function propose(
  ctx: Ctx,
  kind: ProposalKind,
  itemId: string | null,
  payload: ProposalPayload | null,
  summary: string,
): Promise<Proposal> {
  requirePermission(ctx, "edit-schedule");
  const pending = await ctx.repo.listProposals(ctx.circle.code, "pending", MAX_PENDING);
  if (pending.length >= MAX_PENDING) {
    throw new AppError("conflict", "There are already many changes waiting for approval.");
  }
  const proposal: Proposal = {
    id: newId(),
    kind,
    itemId,
    payload,
    summary,
    proposedBy: ctx.member.id,
    proposedByName: ctx.member.name,
    status: "pending",
    createdAt: ctx.now.toISOString(),
    decidedAt: null,
  };
  await ctx.repo.putProposal(ctx.circle.code, proposal);
  await recordActivity(
    ctx,
    "proposal.created",
    `Proposed: ${summary} (waiting for ${ctx.circle.elderName.split(" ")[0]}'s OK)`,
  );
  return proposal;
}

/** Pending proposals, newest first. */
export function listPendingProposals(ctx: Ctx): Promise<Proposal[]> {
  return ctx.repo.listProposals(ctx.circle.code, "pending", MAX_PENDING);
}

async function apply(ctx: Ctx, p: Proposal): Promise<void> {
  const code = ctx.circle.code;
  if (p.kind === "add" && p.payload) {
    const { active, ...fields } = p.payload;
    await ctx.repo.putItem(code, {
      id: newId(),
      ...fields,
      active: active ?? true,
      createdAt: ctx.now.toISOString(),
    });
    return;
  }
  const current = p.itemId ? await ctx.repo.getItem(code, p.itemId) : null;
  if (!current)
    throw new AppError("conflict", "That item no longer exists, so the change can't be applied.");
  if (p.kind === "remove") {
    await ctx.repo.deleteItem(code, current.id);
  } else if (p.payload) {
    const { active, ...fields } = p.payload;
    await ctx.repo.putItem(code, { ...current, ...fields, active: active ?? current.active });
  }
}

/**
 * The elder approves or declines a pending proposal. Nobody else can decide, so a member can never
 * approve their own proposal. Deciding twice is refused.
 */
export async function decideProposal(
  ctx: Ctx,
  id: string,
  decision: "approved" | "declined",
): Promise<void> {
  requirePermission(ctx, "change-settings");
  if (ctx.member.role !== "elder") {
    throw new AppError("forbidden", "Only the elder can decide on changes.");
  }
  const pending = await ctx.repo.getProposal(ctx.circle.code, id);
  if (!pending || pending.status !== "pending") {
    throw new AppError("conflict", "This change has already been decided.");
  }
  if (pending.proposedBy === ctx.member.id) {
    throw new AppError("forbidden", "You can't approve your own proposal.");
  }
  // Decide first (transactional), so two quick taps can never apply the same change twice.
  const decidedAt = ctx.now.toISOString();
  const decided = await ctx.repo.decideProposal(ctx.circle.code, id, decision, decidedAt);
  if (!decided) throw new AppError("conflict", "This change has already been decided.");
  if (decision === "approved") {
    try {
      await apply(ctx, pending);
    } catch (err) {
      await ctx.repo.putProposal(ctx.circle.code, { ...pending, status: "declined", decidedAt });
      throw err;
    }
  }
  await recordActivity(
    ctx,
    decision === "approved" ? "proposal.approved" : "proposal.declined",
    `${decision === "approved" ? "Approved" : "Declined"} ${pending.proposedByName}'s change: ${pending.summary}`,
  );
}

/** The elder turns "Ask me first" on or off. */
export async function setApprovalRequired(ctx: Ctx, on: boolean): Promise<void> {
  requirePermission(ctx, "change-settings");
  await ctx.repo.updateCircle(ctx.circle.code, { approvalRequired: on });
  await recordActivity(
    ctx,
    on ? "settings.ask-first-on" : "settings.ask-first-off",
    on
      ? "Turned on Ask me first: schedule changes now need their approval"
      : "Turned off Ask me first",
  );
}
