"use client";
// Role-aware navigation: centred pill tabs on desktop, a bottom tab bar on phones.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, HeartPulse, Home, Pill, Users } from "lucide-react";

const ICONS = {
  today: HeartPulse,
  overview: Home,
  medicines: Pill,
  appointments: CalendarDays,
  circle: Users,
  activity: Activity,
};

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavTabs({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Main" className="hidden md:block">
        <ul className="flex items-center gap-1 rounded-full bg-card p-1.5 shadow-card">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold transition-colors duration-200 ${active ? "bg-ink text-card" : "text-ink hover:bg-stage"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <nav
        aria-label="Main menu"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-card/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul
          className="grid"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.icon];
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold"
                >
                  <span
                    className={`grid h-8 w-12 place-items-center rounded-full ${active ? "bg-ink text-card" : "text-ink"}`}
                  >
                    <Icon aria-hidden="true" size={20} strokeWidth={2} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
