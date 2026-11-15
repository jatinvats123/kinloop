// Frame for public forms (sign-in, create circle): dark canvas with a single light card.
import { Logo } from "./logo";

export function PublicFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="dot-grid relative min-h-dvh overflow-hidden">
      <div className="glow -right-32 -top-32 size-[30rem] opacity-40" aria-hidden="true" />
      <header className="relative mx-auto max-w-6xl px-4 py-5 sm:px-8">
        <Logo tone="dark" />
      </header>
      <main id="main" className="relative mx-auto max-w-lg px-4 pb-16">
        <div className="rounded-[2rem] bg-stage p-6 sm:p-8">
          <h1 className="text-3xl font-light tracking-tight">{title}</h1>
          <p className="mt-2 mb-6 text-lg text-muted">{intro}</p>
          {children}
        </div>
      </main>
    </div>
  );
}
