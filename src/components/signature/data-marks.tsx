// Thin hand-drawn data marks (tick bar, dot row, thin curve). Each draws an SVG hidden from
// assistive tech and carries its own text equivalent.

export type Mark = "taken" | "skipped" | "missed" | "none";

const tickColor: Record<Mark, string> = {
  taken: "#243100",
  skipped: "#4A4F45",
  missed: "#E0707F",
  none: "#DCDFD4",
};

/** Tick bar: one vertical tick per dose, tall for taken, short for missed or skipped. */
export function TickBar({
  marks,
  label,
  tone = "light",
}: {
  marks: Mark[];
  label: string;
  tone?: "light" | "dark";
}) {
  const w = Math.max(marks.length * 6, 6);
  return (
    <figure className="m-0 flex flex-col gap-1">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${w} 28`}
        preserveAspectRatio="none"
        className="h-7 w-full"
      >
        {marks.map((m, i) => {
          const h = m === "taken" ? 26 : m === "none" ? 6 : 13;
          const color = tone === "dark" && m === "taken" ? "#DBEF90" : tickColor[m];
          return (
            <rect
              key={i}
              x={i * 6 + 1.5}
              y={28 - h}
              width="2.5"
              height={h}
              rx="1.25"
              fill={color}
            />
          );
        })}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** Dot row: filled dot for done, hollow ring for not done; good for a slot across many days. */
export function DotRow({ marks, label }: { marks: Mark[]; label: string }) {
  return (
    <figure className="m-0">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${marks.length * 14} 14`}
        className="h-3.5"
        style={{ width: `${marks.length * 14}px`, maxWidth: "100%" }}
      >
        {marks.map((m, i) =>
          m === "taken" ? (
            <circle key={i} cx={i * 14 + 7} cy="7" r="5" fill="#243100" />
          ) : m === "missed" ? (
            <circle
              key={i}
              cx={i * 14 + 7}
              cy="7"
              r="4.25"
              fill="#F4B8C1"
              stroke="#111408"
              strokeWidth="1.5"
            />
          ) : (
            <circle
              key={i}
              cx={i * 14 + 7}
              cy="7"
              r="4.25"
              fill="none"
              stroke="#4A4F45"
              strokeWidth="1.5"
            />
          ),
        )}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** Thin curve: a smoothed line through 0–100 values, with a soft fill beneath. */
export function ThinCurve({
  values,
  label,
  tone = "light",
}: {
  values: number[];
  label: string;
  tone?: "light" | "dark";
}) {
  const w = 240;
  const h = 64;
  const pts = values.map((v, i) => [
    values.length === 1 ? w / 2 : (i / (values.length - 1)) * w,
    h - 6 - (Math.max(0, Math.min(100, v)) / 100) * (h - 12),
  ]) as Array<[number, number]>;
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1] as [number, number];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const stroke = tone === "dark" ? "#DBEF90" : "#243100";
  const last = pts[pts.length - 1];
  return (
    <figure className="m-0">
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox={`0 0 ${w} ${h}`}
        className="h-16 w-full"
        preserveAspectRatio="none"
      >
        {pts.length > 1 ? (
          <path d={`${d} L${w},${h} L0,${h} Z`} fill={stroke} opacity="0.08" />
        ) : null}
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {last ? <circle cx={last[0]} cy={last[1]} r="3.5" fill={stroke} /> : null}
      </svg>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}
