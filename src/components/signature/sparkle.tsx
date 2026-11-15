// Sparkle glyph (four-point star): marks anything the AI read or drafted, and nothing else.

export function Sparkle({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
    >
      <path
        d="M12 1.5c.6 4.9 2.6 8 7 9.4l3.5 1.1-3.5 1.1c-4.4 1.4-6.4 4.5-7 9.4-.6-4.9-2.6-8-7-9.4L1.5 12 5 10.9c4.4-1.4 6.4-4.5 7-9.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Inline label for AI-drafted content: sparkle plus visible text. */
export function AiLabel({ children = "AI-drafted" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime px-3 py-1 text-xs font-semibold text-ink">
      <Sparkle size={14} />
      {children}
    </span>
  );
}
