"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

/**
 * APP NAVIGATION — a fixed sidebar on desktop, a scrollable top bar on
 * mobile. Rendered by the dashboard layout on every app page.
 */
const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/schedule", label: "Market schedule" },
  { href: "/meals", label: "Meals" },
  { href: "/expenses", label: "Expenses" },
  { href: "/reports", label: "Ledger" },
  { href: "/group", label: "Group" },
];

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 font-mono text-sm font-semibold text-white">
        L
      </span>
      <span className="text-sm font-semibold tracking-tight text-ink">L-Split</span>
    </Link>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${
      pathname.startsWith(href)
        ? "bg-brand-50 text-brand-800"
        : "text-ink-secondary hover:bg-canvas hover:text-ink"
    }`;

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-line bg-white p-4 md:flex">
        <Wordmark />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={handleLogout}
          className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ink-secondary transition hover:bg-red-50 hover:text-red-600"
        >
          Log out
        </button>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-white md:hidden">
        <div className="flex items-center justify-between px-3 py-2.5">
          <Wordmark />
          <button
            onClick={handleLogout}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-secondary transition hover:bg-red-50 hover:text-red-600"
          >
            Log out
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap ${linkClass(link.href)}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
    </>
  );
}
