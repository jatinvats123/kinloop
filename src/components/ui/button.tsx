// Pill button primitive and a class helper so links can look like buttons.
import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "onDark" | "lime" | "attention" | "quiet";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[background-color,transform,box-shadow] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 select-none";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-olive text-card hover:bg-olive-hover",
  secondary: "bg-card text-ink ring-1 ring-inset ring-ink/20 hover:ring-ink/50",
  onDark: "bg-card text-ink hover:bg-lime on-dark",
  lime: "bg-lime text-ink hover:bg-lime-soft ring-1 ring-inset ring-olive/20",
  attention: "bg-blush text-ink hover:bg-blush-soft",
  quiet: "text-olive underline underline-offset-4 decoration-2 hover:decoration-olive/40",
};

const sizes: Record<ButtonSize, string> = {
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-14 px-7 text-lg",
};

/** Returns the class list for a pill button; use on `<Link>` or `<a>` that act as buttons. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  const sizing = variant === "quiet" ? "min-h-11 px-1 text-sm" : sizes[size];
  return `${base} ${variants[variant]} ${sizing} ${extra}`.trim();
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...rest
}: Props) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}
