"use server";
// Server actions behind the email-link pages. The token is the only credential: it is verified on
// every POST, and nothing happens on GET.
import { revalidatePath } from "next/cache";
import { t } from "@/domain/messages";
import { env } from "@/server/env";
import { AppError, toActionError, type ActionResult } from "@/server/errors";
import { getRepository } from "@/server/repositories";
import { confirmFromLink, followUpFromLink } from "@/server/services/links";

const token = (fd: FormData) => String(fd.get("t") ?? "").slice(0, 700);

function linkError(err: unknown): ActionResult {
  if (err instanceof AppError && err.code === "bad-request") {
    return { ok: false, error: t("confirm.expired") };
  }
  if (err instanceof AppError && err.code === "forbidden") {
    return { ok: false, error: t("confirm.invalid") };
  }
  return toActionError(err);
}

export async function confirmLinkAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { marked } = await confirmFromLink(
      await getRepository(),
      token(fd),
      env().LINK_SECRET,
      new Date(),
    );
    revalidatePath("/", "layout");
    return { ok: true, message: marked > 0 ? t("confirm.done") : t("confirm.alreadyDone") };
  } catch (err) {
    return linkError(err);
  }
}

export async function followUpLinkAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const { mine, holder } = await followUpFromLink(
      await getRepository(),
      token(fd),
      env().LINK_SECRET,
      new Date(),
    );
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: mine
        ? "Thank you. Everyone in the circle can now see that you are checking."
        : `${holder.memberName} is already checking. You don't need to do anything.`,
    };
  } catch (err) {
    return linkError(err);
  }
}
