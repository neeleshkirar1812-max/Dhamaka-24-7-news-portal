"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  ExternalLink,
  FileText,
  FolderTree,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Radio,
  Settings,
  Tags,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/articles", label: "Articles", icon: FileText },
  { href: "/admin/articles/trash", label: "Trash", icon: Trash2 },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/tags", label: "Tags", icon: Tags },
  { href: "/admin/ticker", label: "Breaking Ticker", icon: Radio },
  { href: "/admin/media", label: "Media Library", icon: ImageIcon },
  { href: "/admin/ads", label: "Ads & Revenue", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({
  children,
  adminEmail,
}: {
  children: React.ReactNode;
  adminEmail?: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex bg-slate-100 text-slate-900">
      <aside className="w-64 bg-slate-900 text-slate-100 flex-shrink-0 hidden md:flex flex-col">
        <div className="h-14 px-4 flex items-center gap-2 border-b border-slate-800">
          <Megaphone className="w-5 h-5 text-red-500" />
          <span className="font-bold tracking-tight">Newsroom CMS</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition",
                  active
                    ? "bg-red-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-800 space-y-2">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:bg-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Public Site
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-300 hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-sm text-slate-700 md:hidden">Newsroom CMS</span>
            <Link
              href="/admin/articles/new"
              className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-md transition"
            >
              + New Article
            </Link>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            {adminEmail && <span className="hidden sm:inline">{adminEmail}</span>}
            <button
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="md:hidden text-red-700 font-medium cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
