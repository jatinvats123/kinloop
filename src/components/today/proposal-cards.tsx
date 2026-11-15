// "Ask me first" on Today: the elder approves or declines each pending change with one large button;
// everyone else sees what is waiting for the elder's decision.
import { Hourglass } from "lucide-react";
import { SubmitButton } from "@/components/common/submit-button";
import { t } from "@/domain/messages";
import type { Proposal } from "@/domain/types";

type FormAction = (fd: FormData) => Promise<void>;

function sentence(summary: string): string {
  return summary.charAt(0).toUpperCase() + summary.slice(1);
}

export function ProposalCards({
  proposals,
  canDecide,
  elderFirstName,
  action,
}: {
  proposals: Proposal[];
  canDecide: boolean;
  elderFirstName: string;
  action: FormAction;
}) {
  if (proposals.length === 0) return null;
  const title = canDecide
    ? t("proposal.title")
    : t("proposal.waitingTitle", { name: elderFirstName });
  return (
    <section aria-labelledby="proposals-h" className="rounded-card bg-blush-soft p-5 sm:p-6">
      <h2 id="proposals-h" className="mb-4 flex items-center gap-2 text-2xl font-semibold">
        <Hourglass aria-hidden="true" size={24} />
        {title}
      </h2>
      <ul className="flex flex-col gap-5">
        {proposals.map((p) => (
          <li key={p.id} className="flex flex-col gap-3">
            <p className="text-xl">
              <span className="font-semibold">
                {t("proposal.from", { name: p.proposedByName })}
              </span>{" "}
              {sentence(p.summary)}
            </p>
            {canDecide ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <form action={action}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="approved" />
                  <SubmitButton
                    size="lg"
                    pendingText={t("proposal.approving")}
                    className="min-h-14 w-full text-xl"
                  >
                    {t("proposal.approve")}
                    <span className="sr-only">: {p.summary}</span>
                  </SubmitButton>
                </form>
                <form action={action}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="decision" value="declined" />
                  <SubmitButton
                    size="lg"
                    variant="secondary"
                    pendingText={t("proposal.declining")}
                    className="min-h-14 w-full text-xl"
                  >
                    {t("proposal.decline")}
                    <span className="sr-only">: {p.summary}</span>
                  </SubmitButton>
                </form>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
