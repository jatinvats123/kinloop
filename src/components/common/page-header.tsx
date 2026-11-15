// Page heading with optional intro and a trailing action; every page has exactly one h1.
export function PageHeader({
  title,
  intro,
  action,
}: {
  title: string;
  intro?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-light tracking-tight sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-2 max-w-[60ch] text-lg text-muted">{intro}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Calm confirmation banner shown after a save redirect. */
export function SavedNotice({ show, text = "Saved." }: { show: boolean; text?: string }) {
  if (!show) return null;
  return (
    <p role="status" className="mb-5 rounded-2xl bg-lime-soft px-4 py-3 text-base font-semibold">
      {text}
    </p>
  );
}
