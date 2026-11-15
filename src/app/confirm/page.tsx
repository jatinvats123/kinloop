// One-tap confirm from a reminder email. Opening the link only shows the slot (mail scanners
// prefetch links); the button POSTs the signed token to mark the medicines taken.
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { confirmLinkAction } from "@/app/actions/links";
import { LinkActionForm } from "@/components/links/link-action-form";
import { PublicFrame } from "@/components/shell/public-frame";
import { buttonClass } from "@/components/ui/button";
import { t } from "@/domain/messages";
import { env } from "@/server/env";
import { getRepository } from "@/server/repositories";
import { readSlotLink } from "@/server/services/links";

export const metadata: Metadata = { title: "Confirm medicines", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const raw = (await searchParams).t;
  const token = typeof raw === "string" ? raw : "";
  const view = await readSlotLink(
    await getRepository(),
    token,
    "confirm",
    env().LINK_SECRET,
    new Date(),
  );

  if (view.state !== "ok") {
    return (
      <PublicFrame
        title={t("confirm.unusable")}
        intro={view.state === "expired" ? t("confirm.expired") : t("confirm.invalid")}
      >
        <Link href="/sign-in" className={buttonClass("primary", "lg", "w-full")}>
          {t("confirm.openApp")}
        </Link>
      </PublicFrame>
    );
  }

  const open = view.items.filter((i) => !i.logged);
  return (
    <PublicFrame title={t("confirm.title", { time: view.time })} intro={t("email.dueIntro")}>
      <ul className="mb-6 flex flex-col gap-3" aria-label={t("confirm.listLabel")}>
        {view.items.map((i) => (
          <li
            key={i.id}
            className="flex min-h-14 items-center gap-3 rounded-3xl bg-card px-5 text-xl font-semibold"
          >
            {i.logged && <CheckCircle2 aria-hidden="true" className="size-6 shrink-0 text-olive" />}
            <span>{i.name}</span>
            {i.logged && <span className="ml-auto text-base text-muted">{t("status.taken")}</span>}
          </li>
        ))}
      </ul>
      <LinkActionForm
        action={confirmLinkAction}
        token={token}
        label={t("confirm.button")}
        pendingText={t("confirm.saving")}
        doneText={open.length === 0 ? t("confirm.alreadyDone") : undefined}
      />
    </PublicFrame>
  );
}
