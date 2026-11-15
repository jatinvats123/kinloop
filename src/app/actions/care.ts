"use server";
// Server actions for the care loop: doses, medicines and routines, appointments, members and profile.
// Each one is a thin adapter: session guard, FormData to plain object, service call, revalidate.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toActionError, type ActionResult } from "@/server/errors";
import { requireSession } from "@/server/auth/session";
import {
  createAppointment,
  deleteAppointment,
  updateAppointment,
} from "@/server/services/appointments";
import { skipItem, takeSlot, undoLog } from "@/server/services/doses";
import { createItem, deleteItem, setItemActive, updateItem } from "@/server/services/items";
import {
  addMember,
  regeneratePasscode,
  removeMember,
  updateMember,
  updateProfile,
} from "@/server/services/members";
import { decideProposal, isProposal, setApprovalRequired } from "@/server/services/proposals";
import { formToObject } from "@/server/validation";

const id = (fd: FormData, key = "id") => String(fd.get(key) ?? "");

function refresh(): void {
  revalidatePath("/", "layout");
}

/* Doses */

export async function takeSlotAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    const readings: Record<string, string> = {};
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("reading:") && typeof v === "string") readings[k.slice(8)] = v;
    }
    const n = await takeSlot(ctx, formToObject(fd, ["itemIds"]), readings);
    refresh();
    return { ok: true, message: n > 0 ? "Marked as taken." : "Already marked as taken." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function skipItemAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    await skipItem(ctx, formToObject(fd));
    refresh();
    return { ok: true, message: "Skipped. Your circle can see why." };
  } catch (err) {
    return toActionError(err);
  }
}

export async function undoLogAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  for (const itemId of fd.getAll("itemIds")) {
    await undoLog(ctx, String(itemId), id(fd, "slotAt"));
  }
  refresh();
}

/* Medicines and routines */

export async function saveItemAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  let proposed = false;
  try {
    const ctx = await requireSession();
    const input = formToObject(fd, ["times", "daysOfWeek"]);
    const result = id(fd) ? await updateItem(ctx, id(fd), input) : await createItem(ctx, input);
    proposed = isProposal(result);
    refresh();
  } catch (err) {
    return toActionError(err);
  }
  redirect(proposed ? "/medicines?proposed=1" : "/medicines?saved=1");
}

export async function toggleItemAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  const proposal = await setItemActive(ctx, id(fd), fd.get("active") === "true");
  refresh();
  if (proposal) redirect("/medicines?proposed=1");
}

export async function deleteItemAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  const proposal = await deleteItem(ctx, id(fd));
  refresh();
  redirect(proposal ? "/medicines?proposed=1" : "/medicines");
}

/* Ask me first */

export async function decideProposalAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  const decision = fd.get("decision") === "approved" ? "approved" : "declined";
  await decideProposal(ctx, id(fd), decision);
  refresh();
}

export async function setApprovalAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  await setApprovalRequired(ctx, fd.get("on") === "true");
  refresh();
}

/* Appointments */

export async function saveAppointmentAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    if (id(fd)) await updateAppointment(ctx, id(fd), formToObject(fd));
    else await createAppointment(ctx, formToObject(fd));
    refresh();
  } catch (err) {
    return toActionError(err);
  }
  redirect("/appointments?saved=1");
}

export async function deleteAppointmentAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  await deleteAppointment(ctx, id(fd));
  refresh();
  redirect("/appointments");
}

/* Members and profile */

export async function addMemberAction(
  _prev: ActionResult<{ name: string; passcode: string }>,
  fd: FormData,
): Promise<ActionResult<{ name: string; passcode: string }>> {
  try {
    const ctx = await requireSession();
    const { member, passcode } = await addMember(ctx, formToObject(fd));
    refresh();
    return { ok: true, data: { name: member.name, passcode } };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateMemberAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    await updateMember(ctx, id(fd), formToObject(fd));
    refresh();
  } catch (err) {
    return toActionError(err);
  }
  redirect("/circle?saved=1");
}

export async function removeMemberAction(fd: FormData): Promise<void> {
  const ctx = await requireSession();
  await removeMember(ctx, id(fd));
  refresh();
  redirect("/circle");
}

export async function regeneratePasscodeAction(
  _prev: ActionResult<{ name: string; passcode: string }>,
  fd: FormData,
): Promise<ActionResult<{ name: string; passcode: string }>> {
  try {
    const ctx = await requireSession();
    const result = await regeneratePasscode(ctx, id(fd));
    refresh();
    return { ok: true, data: result };
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateProfileAction(
  _prev: ActionResult,
  fd: FormData,
): Promise<ActionResult> {
  try {
    const ctx = await requireSession();
    await updateProfile(ctx, formToObject(fd));
    refresh();
  } catch (err) {
    return toActionError(err);
  }
  redirect("/circle?saved=1");
}
