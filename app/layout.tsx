import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Covering — Content Pipeline",
  description:
    "Discover, review, and manage permission-first creator outreach for Christian parenting & prayer content.",
};

const navItems = [
  { href: "/", label: "Review Queue" },
  { href: "/creators", label: "Creators / CRM" },
  { href: "/posts", label: "Posts" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <header className="border-b border-slate-200 bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-center gap-2">
                <span className="text-lg font-semibold text-brand">
                  ✝ The Covering
                </span>
                <span className="hidden text-sm text-slate-400 sm:inline">
                  Content Pipeline
                </span>
              </Link>
              <nav className="flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
