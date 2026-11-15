// White card on the light stage; the only elevated container (cards never nest).
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  as?: "section" | "article" | "div" | "li";
  tone?: "white" | "lime" | "blush";
};

const tones = {
  white: "bg-card",
  lime: "bg-lime",
  blush: "bg-blush-soft",
};

export function Card({ as: Tag = "section", tone = "white", className = "", ...rest }: Props) {
  return (
    <Tag className={`${tones[tone]} rounded-card p-5 shadow-card sm:p-6 ${className}`} {...rest} />
  );
}

/** Card heading row: title plus an optional trailing link or control. */
export function CardHeader({
  title,
  action,
  id,
}: {
  title: string;
  action?: React.ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {action}
    </div>
  );
}
