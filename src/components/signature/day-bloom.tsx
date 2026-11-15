// Day bloom: one petal per time slot today; a petal fills when its slot is done. Decorative only;
// callers always render the same progress as text beside it.

type Size = "sm" | "md" | "lg" | "xl";
const pixels: Record<Size, number> = { sm: 32, md: 96, lg: 180, xl: 320 };

type Props = {
  total: number;
  done: number;
  size?: Size;
  tone?: "light" | "dark";
  breathing?: boolean;
  className?: string;
};

/** Petal path pointing up from the centre; `hw` is the half-width of the petal. */
function petalPath(hw: number): string {
  return `M0 -6 C ${hw} -22, ${hw * 1.05} -80, 0 -96 C ${-hw * 1.05} -80, ${-hw} -22, 0 -6 Z`;
}

export function DayBloom({
  total,
  done,
  size = "md",
  tone = "light",
  breathing = false,
  className = "",
}: Props) {
  const n = Math.max(0, Math.min(total, 12));
  const filled = Math.max(0, Math.min(done, n));
  const whole = n > 0 && filled === n;
  const hw = n <= 1 ? 52 : Math.min(52, 200 / n);
  const px = pixels[size];
  const gid = `bloom-${size}-${tone}`;
  const emptyFill = tone === "dark" ? "rgb(219 239 144 / 0.12)" : "rgb(238 247 200 / 0.75)";
  const emptyStroke = tone === "dark" ? "rgb(219 239 144 / 0.45)" : "rgb(36 49 0 / 0.35)";

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width={px}
      height={px}
      viewBox="-100 -100 200 200"
      className={`${breathing ? "motion-safe:animate-breathe" : ""} shrink-0 overflow-visible ${className}`}
    >
      <defs>
        <radialGradient id={gid} cx="0" cy="0" r="95" gradientUnits="userSpaceOnUse">
          <stop offset="0.12" stopColor="#7E9A2A" />
          <stop offset="0.55" stopColor="#C4DE6E" />
          <stop offset="1" stopColor="#DBEF90" />
        </radialGradient>
      </defs>
      {whole ? (
        <circle r="98" fill="none" stroke={emptyStroke} strokeWidth="1" strokeDasharray="2 5" />
      ) : null}
      {n === 0 ? (
        <circle r="34" fill={emptyFill} stroke={emptyStroke} strokeWidth="1.5" />
      ) : (
        Array.from({ length: n }, (_, i) => {
          const isFilled = i < filled;
          return (
            <path
              key={i}
              d={petalPath(hw)}
              transform={`rotate(${(360 / n) * i})`}
              fill={isFilled ? `url(#${gid})` : emptyFill}
              fillOpacity={isFilled ? 0.92 : 1}
              stroke={isFilled ? "none" : emptyStroke}
              strokeWidth={size === "sm" ? 4 : 1.5}
              className="transition-[fill] duration-200"
            />
          );
        })
      )}
      <circle
        r={size === "sm" ? 18 : 12}
        fill={whole ? "#DBEF90" : tone === "dark" ? "#DBEF90" : "#243100"}
      />
    </svg>
  );
}
