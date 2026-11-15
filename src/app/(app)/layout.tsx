// Signed-in shell: dark canvas, the light stage holding the page, role-aware navigation and demo controls.
import { cookies } from "next/headers";
import { LogOut } from "lucide-react";
import { signOutAction, switchRoleAction } from "@/app/actions/auth";
import { setTourHiddenAction } from "@/app/actions/prefs";
import { DemoPanel } from "@/components/shell/demo-panel";
import { TourPanel } from "@/components/shell/tour-panel";
import { tourProgress, tourSteps } from "@/domain/tour";
import { Logo } from "@/components/shell/logo";
import { NavTabs, type NavItem } from "@/components/shell/nav-tabs";
import { homeFor, requireSession } from "@/server/auth/session";

const elderNav: NavItem[] = [
  { href: "/today", label: "Today", icon: "today" },
  { href: "/medicines", label: "Medicines", icon: "medicines" },
  { href: "/appointments", label: "Visits", icon: "appointments" },
  { href: "/circle", label: "Circle", icon: "circle" },
];

const circleNav: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "overview" },
  { href: "/today", label: "Today", icon: "today" },
  { href: "/medicines", label: "Medicines", icon: "medicines" },
  { href: "/appointments", label: "Visits", icon: "appointments" },
  { href: "/circle", label: "Circle", icon: "circle" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession();
  const demo = ctx.circle.isDemo;
  const tourHidden = (await cookies()).get("kl_tour")?.value === "hidden";
  const [members, activity, nextAppts] = demo
    ? await Promise.all([
        ctx.repo.listMembers(ctx.circle.code),
        tourHidden ? Promise.resolve([]) : ctx.repo.listActivity(ctx.circle.code, 60),
        tourHidden
          ? Promise.resolve([])
          : ctx.repo.listAppointments(ctx.circle.code, ctx.now.toISOString(), 1),
      ])
    : [[], [], []];
  const steps = tourSteps(
    nextAppts[0] ? `/appointments/${nextAppts[0].id}/brief` : "/appointments",
  );
  const nav = ctx.member.role === "elder" ? elderNav : circleNav;

  return (
    <div className="dot-grid min-h-dvh md:p-5">
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col overflow-hidden bg-stage pb-24 md:min-h-[calc(100dvh-2.5rem)] md:rounded-[2rem] md:pb-0">
        <div className="glow -right-32 -top-40 size-[28rem] opacity-70" aria-hidden="true" />
        <header className="relative flex print:hidden items-center justify-between gap-4 px-4 pt-4 sm:px-8 sm:pt-6">
          <Logo href={homeFor(ctx.member)} />
          <NavTabs items={nav} />
          <form action={signOutAction} className="flex items-center gap-3">
            <span className="hidden text-sm font-semibold lg:inline">{ctx.member.name}</span>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-ink/20 hover:ring-ink/50"
            >
              <LogOut aria-hidden="true" size={18} />
              Sign out
            </button>
          </form>
        </header>
        {demo ? (
          <div className="relative px-4 pt-4 sm:px-8 print:hidden">
            <DemoPanel
              circle={ctx.circle}
              members={members}
              current={ctx.member}
              switchAction={switchRoleAction}
            />
            <div className="mt-3">
              {tourHidden ? (
                <form action={setTourHiddenAction}>
                  <input type="hidden" name="hidden" value="0" />
                  <button
                    type="submit"
                    className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ring-1 ring-inset ring-ink/20 hover:ring-ink/50"
                  >
                    Show the two-minute tour
                  </button>
                </form>
              ) : (
                <TourPanel
                  steps={steps}
                  done={tourProgress(activity, members, ctx.circle.createdAt)}
                  current={ctx.member}
                  members={members}
                  switchAction={switchRoleAction}
                  hideAction={setTourHiddenAction}
                />
              )}
            </div>
          </div>
        ) : null}
        <main id="main" className="relative flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
