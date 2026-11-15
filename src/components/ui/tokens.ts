// Colour tokens mirrored from globals.css so the contrast test can verify every text pair.

export const colors = {
  canvas: "#0B0C0A",
  canvasRaised: "#171914",
  stage: "#F5F5F8",
  card: "#FFFFFF",
  ink: "#111408",
  olive: "#243100",
  lime: "#DBEF90",
  limeSoft: "#EEF7C8",
  blush: "#F4B8C1",
  blushSoft: "#FBE3E7",
  muted: "#4A4F45",
  mutedDark: "#B9BEB0",
  danger: "#8A1C2B",
} as const;

export type ColorToken = keyof typeof colors;

/** Every foreground/background pair the UI uses, with the minimum ratio it must meet. */
export const textPairs: ReadonlyArray<{
  fg: ColorToken;
  bg: ColorToken;
  min: number;
  where: string;
}> = [
  { fg: "ink", bg: "stage", min: 7, where: "elder screens, body text" },
  { fg: "ink", bg: "card", min: 7, where: "cards" },
  { fg: "ink", bg: "lime", min: 7, where: "due-now slot card, lime fills" },
  { fg: "ink", bg: "limeSoft", min: 7, where: "taken rows" },
  { fg: "ink", bg: "blush", min: 7, where: "needs-attention panels" },
  { fg: "ink", bg: "blushSoft", min: 7, where: "needs-attention chips" },
  { fg: "olive", bg: "stage", min: 7, where: "links and headings on the stage" },
  { fg: "olive", bg: "card", min: 7, where: "links on cards" },
  { fg: "olive", bg: "lime", min: 7, where: "accents on lime" },
  { fg: "card", bg: "olive", min: 7, where: "primary button label" },
  { fg: "card", bg: "ink", min: 7, where: "active tab pill" },
  { fg: "muted", bg: "stage", min: 7, where: "secondary text on elder screens" },
  { fg: "muted", bg: "card", min: 7, where: "secondary text on cards" },
  { fg: "muted", bg: "lime", min: 4.5, where: "secondary text on the due card" },
  { fg: "stage", bg: "canvas", min: 7, where: "headlines on the dark canvas" },
  { fg: "lime", bg: "canvas", min: 7, where: "accents on the dark canvas" },
  { fg: "mutedDark", bg: "canvas", min: 7, where: "secondary text on the dark canvas" },
  { fg: "mutedDark", bg: "canvasRaised", min: 4.5, where: "secondary text on dark cards" },
  { fg: "ink", bg: "card", min: 7, where: "white pill button on dark" },
  { fg: "danger", bg: "card", min: 7, where: "form error text" },
  { fg: "danger", bg: "stage", min: 7, where: "form error text on the stage" },
];

function channel(hex: string, offset: number): number {
  const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance of a `#RRGGBB` colour. */
export function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

/** WCAG 2.x contrast ratio between two `#RRGGBB` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
