"use client";
// Error state for signed-in pages: plain words and a way to retry, never technical details.
import { buttonClass } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-xl rounded-card bg-card p-6 shadow-card">
      <h1 className="text-2xl font-semibold">That didn&apos;t work</h1>
      <p className="mt-2 text-lg text-muted">
        You may not have permission for that, or the connection dropped. Nothing was lost.
      </p>
      <button type="button" onClick={reset} className={buttonClass("primary", "lg", "mt-5")}>
        Try again
      </button>
    </div>
  );
}
