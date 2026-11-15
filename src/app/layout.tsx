// Root layout: Urbanist font, global styles, language and a skip link to the main content.
import type { Metadata, Viewport } from "next";
import { Urbanist } from "next/font/google";
import { cookies, headers } from "next/headers";
import "./globals.css";

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Kinloop — the care circle where the elder stays in charge",
    template: "%s · Kinloop",
  },
  description:
    "Medicines, routines, appointments and email reminders that always get an answer, shared by an elder and the people who care for them.",
};

export const viewport: Viewport = { themeColor: "#0B0C0A", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the nonce makes every page render per request, so Next.js stamps it on its scripts.
  await headers();
  const textSize = (await cookies()).get("kl_text")?.value;
  return (
    <html
      lang="en"
      className={urbanist.variable}
      data-text-size={textSize === "large" || textSize === "larger" ? textSize : undefined}
    >
      <body>
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
