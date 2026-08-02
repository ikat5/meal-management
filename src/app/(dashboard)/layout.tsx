import Nav from "@/components/Nav";

/**
 * DASHBOARD LAYOUT (server component) — sidebar on desktop (Nav renders
 * both the sidebar and the mobile top bar), content offset to the right.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen md:pl-56">
      <Nav />
      <main className="mx-auto max-w-5xl p-4 pb-16 sm:p-6">{children}</main>
    </div>
  );
}
