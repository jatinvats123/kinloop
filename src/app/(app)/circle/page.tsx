// The care circle: health profile, members with their access and alerts, and your own passcode.
import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Eye, PencilLine, ShieldCheck, UserPlus } from "lucide-react";
import { regeneratePasscodeAction } from "@/app/actions/care";
import { PageHeader, SavedNotice } from "@/components/common/page-header";
import { RegeneratePasscodeForm } from "@/components/care/member-forms";
import { buttonClass } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { formatCircleCode } from "@/domain/codes";
import { can, canManageMember } from "@/domain/permissions";
import { requireSession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Care circle" };

const roleName = { elder: "Elder", family: "Family", caretaker: "Caretaker" } as const;

export default async function CirclePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const ctx = await requireSession();
  const { circle, member } = ctx;
  const members = (await ctx.repo.listMembers(circle.code)).sort((a, b) =>
    a.role === "elder" ? -1 : b.role === "elder" ? 1 : a.name.localeCompare(b.name),
  );
  const p = circle.profile;
  const profileRows: Array<[string, string]> = [
    ["Conditions", p.conditions.join(", ") || "None recorded"],
    ["Allergies", p.allergies.join(", ") || "None recorded"],
    ["Blood group", p.bloodGroup || "Not known"],
    ["Primary doctor", p.primaryDoctor || "Not set"],
    [
      "Emergency contact",
      [p.emergencyContact.name, p.emergencyContact.phone].filter(Boolean).join(", ") || "Not set",
    ],
  ];

  return (
    <div>
      <PageHeader
        title={`${circle.elderName}'s circle`}
        intro={`Circle code ${formatCircleCode(circle.code)}. Each person signs in with this code and their own passcode.`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/reminders" className={buttonClass("secondary")}>
              Email reminders
            </Link>
            <Link href="/activity" className={buttonClass("secondary")}>
              Activity
            </Link>
          </div>
        }
      />
      <SavedNotice show={(await searchParams).saved === "1"} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card aria-labelledby="profile-h">
          <CardHeader
            id="profile-h"
            title="Health profile"
            action={
              can(member, "edit-profile") ? (
                <Link href="/circle/profile" className={buttonClass("secondary")}>
                  <PencilLine aria-hidden="true" size={16} />
                  Edit<span className="sr-only"> health profile</span>
                </Link>
              ) : undefined
            }
          />
          <dl className="flex flex-col gap-3">
            {profileRows.map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm font-semibold text-muted">{k}</dt>
                <dd className="text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card aria-labelledby="members-h">
          <CardHeader
            id="members-h"
            title="Members"
            action={
              can(member, "manage-members") ? (
                <Link href="/circle/members/new" className={buttonClass("primary")}>
                  <UserPlus aria-hidden="true" size={16} />
                  Add
                </Link>
              ) : undefined
            }
          />
          <ul className="flex flex-col divide-y divide-ink/10">
            {members.map((m) => {
              const editable = m.id === member.id || canManageMember(member, m);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {m.name}
                      {m.id === member.id ? (
                        <span className="font-medium text-muted"> (you)</span>
                      ) : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span>{roleName[m.role]}</span>
                      <span className="inline-flex items-center gap-1">
                        {m.role === "elder" || m.access === "edit" ? (
                          <ShieldCheck aria-hidden="true" size={14} />
                        ) : (
                          <Eye aria-hidden="true" size={14} />
                        )}
                        {m.role === "elder"
                          ? "Full control"
                          : m.access === "edit"
                            ? "Can edit"
                            : "View only"}
                        {m.isOrganiser && m.role !== "elder" ? ", organiser" : ""}
                      </span>
                      {m.alerts.missed || m.alerts.appointments ? (
                        <span className="inline-flex items-center gap-1">
                          <BellRing aria-hidden="true" size={14} />
                          {[
                            m.alerts.missed ? "missed doses" : "",
                            m.alerts.appointments ? "visits" : "",
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {editable ? (
                    <Link href={`/circle/members/${m.id}`} className={buttonClass("secondary")}>
                      {m.id === member.id ? "Settings" : "Edit"}
                      <span className="sr-only"> {m.name}</span>
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        <Card aria-labelledby="passcode-h">
          <CardHeader id="passcode-h" title="Your passcode" />
          <p className="mb-4 text-base text-muted">
            Lost it, or think someone else knows it? Issue a new one. Your other devices will need
            to sign in again.
          </p>
          <RegeneratePasscodeForm
            action={regeneratePasscodeAction}
            memberId={member.id}
            label="Issue me a new passcode"
          />
        </Card>
      </div>
    </div>
  );
}
