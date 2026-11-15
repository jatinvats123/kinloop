// Dose status shown as icon + text (never colour alone).
import { Check, Clock, AlertCircle, MinusCircle, BellRing } from "lucide-react";
import type { SlotStatus } from "@/domain/types";

const config: Record<SlotStatus, { label: string; Icon: typeof Check; cls: string }> = {
  taken: { label: "Taken", Icon: Check, cls: "bg-lime-soft text-ink" },
  skipped: {
    label: "Skipped",
    Icon: MinusCircle,
    cls: "bg-stage text-ink ring-1 ring-inset ring-ink/20",
  },
  missed: { label: "Missed", Icon: AlertCircle, cls: "bg-blush text-ink" },
  due: { label: "Due now", Icon: BellRing, cls: "bg-ink text-card" },
  upcoming: {
    label: "Not yet",
    Icon: Clock,
    cls: "bg-stage text-ink ring-1 ring-inset ring-ink/15",
  },
};

export function StatusLabel({ status, label }: { status: SlotStatus; label?: string }) {
  const { label: fallback, Icon, cls } = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${cls}`}
    >
      <Icon aria-hidden="true" size={16} strokeWidth={2.25} />
      {label ?? fallback}
    </span>
  );
}
