// "I'll check on them" from an escalation email. Opening the link only shows who is handling the
// missed slot; the button POSTs the signed token, and the first member to press it wins.
import type { Metadata } from "next";
import Link from "next/link";
import { followUpLinkAction } from "@/app/actions/links";
import { LinkActionForm } from "@/components/links/link-action-form";
import { PublicFrame } from "@/components/shell/public-frame";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/domain/messages";
import { env } from "@/server/env";
import { getRepository } from "@/server/repositories";
import { readSlotLink } from "@/server/services/links";

export const metadata: Metadata = { title: "Check on your family", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function CheckOnPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : "";
  const view = await readSlotLink(
    await getRepository(),
    token,
    "follow-up",
    env().LINK_SECRET,
    new Date(),
  );

  if (view.state !== "ok") {
    return (
      <PublicFrame
        title="This link can't be used"
        intro={
          view.state === "expired"
            ? "This link has expired. Open Kinloop to see the latest."
            : "This link isn't valid. Open Kinloop to see the latest."
        }
      >
        <Link href="/sign-in" className={buttonClass("primary", "lg", "w-full")}>
          {t("confirm.openApp")}
        </Link>
      </PublicFrame>
    );
  }

  const open = view.items.filter((i) => !i.logged);
  const holder = view.followUp;
  return (
    <PublicFrame
      title={`${view.elderName}'s ${view.time} medicines`}
      intro={
        open.length === 0
          ? "These are marked now. Nothing more to do."
          : `Not marked yet: ${open.map((i) => i.name).join(", ")}.`
      }
    >
      {holder ? (
        <p role="status" className="rounded-3xl bg-lime p-5 text-xl font-semibold text-ink">
          {holder.memberName === view.memberName
            ? "You are checking on this. The circle can see it."
            : `${holder.memberName} is already checking. You don't need to do anything.`}
        </p>
      ) : open.length > 0 ? (
        <LinkActionForm
          action={followUpLinkAction}
          token={token}
          label={t("email.circleCta", { elder: view.elderName })}
          pendingText="Letting everyone know…"
        />
      ) : null}
      <p className="mt-6 text-base text-muted">
        Pressing the button tells everyone in the circle that you are handling it, so nobody worries
        twice.
      </p>
    </PublicFrame>
  );
}
