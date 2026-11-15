// Landing page: dark canvas, a large headline, a live Today card in front of a breathing day bloom,
// and one button that starts an isolated demo with no sign-up.
import Link from "next/link";
import { redirect } from "next/navigation";
import { startDemoAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/common/submit-button";
import { LiveTodayCard } from "@/components/landing/live-today-card";
import { Logo } from "@/components/shell/logo";
import { homeFor, readSession } from "@/server/auth/session";

export default async function Home({ searchParams }: { searchParams: Promise<{ demo?: string }> }) {
  const session = await readSession();
  if (session) redirect(homeFor(session.member));
  const busy = (await searchParams).demo === "busy";

  return (
    <div className="on-dark dot-grid relative min-h-dvh overflow-hidden text-stage">
      <div className="glow -left-40 top-1/3 size-[36rem] opacity-40" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
        <Logo tone="dark" />
        <nav aria-label="Account">
          <ul className="flex items-center gap-2">
            <li>
              <Link
                href="/sign-in"
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-stage ring-1 ring-inset ring-stage/30 hover:ring-lime"
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href="/start"
                className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-lime underline-offset-4 hover:underline"
              >
                Create a circle
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      <main
        id="main"
        className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-6 pb-16 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-16"
      >
        <section aria-labelledby="hero" className="flex flex-col gap-7">
          <h1
            id="hero"
            className="text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-[4.25rem]"
          >
            Medicines, visits and family,{" "}
            <span className="font-semibold text-lime">in one calm circle.</span>
          </h1>
          <p className="max-w-[34ch] text-xl text-muted-dark">
            The elder stays in charge. Everyone who cares can see what&apos;s done and what&apos;s
            missed.
          </p>
          <form action={startDemoAction}>
            <SubmitButton
              variant="onDark"
              size="lg"
              pendingText="Setting up Kamla's circle…"
              className="px-8"
            >
              Start the demo, no sign-up
            </SubmitButton>
          </form>
          {busy ? (
            <p role="alert" className="text-base font-semibold text-blush">
              Lots of demos started from here recently. Please try again in a few minutes.
            </p>
          ) : null}
        </section>
        <div className="flex justify-center lg:justify-end">
          <LiveTodayCard />
        </div>
      </main>

      <section
        aria-labelledby="different"
        className="relative mx-auto max-w-6xl px-4 pb-20 sm:px-8"
      >
        <h2 id="different" className="sr-only">
          What makes Kinloop different
        </h2>
        <ul className="grid gap-6 border-t border-line-dark pt-10 text-lg md:grid-cols-[1fr_1fr_1fr]">
          <li className="max-w-[32ch]">
            <span className="font-semibold text-lime">Reminders that get an answer.</span>{" "}
            <span className="text-muted-dark">
              The elder is nudged first; the family hears only if a dose is still missed an hour
              later.
            </span>
          </li>
          <li className="max-w-[32ch]">
            <span className="font-semibold text-lime">The elder decides.</span>{" "}
            <span className="text-muted-dark">
              With &ldquo;Ask me first&rdquo;, changes to her schedule wait for her yes.
            </span>
          </li>
          <li className="max-w-[32ch]">
            <span className="font-semibold text-lime">One passcode each.</span>{" "}
            <span className="text-muted-dark">
              No accounts or apps to install, just a circle code and a 6-digit passcode.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
