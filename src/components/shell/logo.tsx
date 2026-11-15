// Kinloop wordmark with a small bloom mark.
import Link from "next/link";
import { DayBloom } from "@/components/signature/day-bloom";

export function Logo({ href = "/", tone = "light" }: { href?: string; tone?: "light" | "dark" }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full pr-2 text-xl font-semibold tracking-tight ${tone === "dark" ? "on-dark text-stage" : "text-ink"}`}
    >
      <DayBloom total={4} done={3} size="sm" tone={tone} />
      Kinloop
    </Link>
  );
}
