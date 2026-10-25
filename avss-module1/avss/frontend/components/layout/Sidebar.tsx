"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Search, Video, Images, Bell, Settings,
  Users, Camera, ClipboardList, LogOut, Menu, X,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAlerts } from "./AlertsProvider";
import { useAuth } from "@/hooks/useAuth";

const USER_NAV = [
  { href: "/dashboard", label: "Dashboard",       icon: LayoutDashboard },
  { href: "/search",    label: "Search",           icon: Search },
  { href: "/live",      label: "Live Monitoring",  icon: Video },
  { href: "/gallery",   label: "Gallery",          icon: Images },
  { href: "/alerts",    label: "Alerts",           icon: Bell },
  { href: "/settings",  label: "Settings",         icon: Settings },
];

const ADMIN_NAV = [
  { href: "/admin/dashboard", label: "Dashboard",  icon: LayoutDashboard },
  { href: "/search",          label: "Search",     icon: Search },
  { href: "/live",            label: "Live",        icon: Video },
  { href: "/gallery",         label: "Gallery",    icon: Images },
  { href: "/alerts",          label: "Alerts",     icon: Bell },
  { href: "/admin/cameras",   label: "Cameras",    icon: Camera },
  { href: "/admin/users",     label: "Users",      icon: Users },
  { href: "/admin/jobs",      label: "Jobs",       icon: ClipboardList },
  { href: "/settings",        label: "Settings",   icon: Settings },
];

function isActive(path: string, href: string) {
  return path === href || (href !== "/" && path.startsWith(href));
}

export function Sidebar() {
  const { user, isAdmin, clearToken } = useAuth();
  const pathname = usePathname();
  const { unread } = useAlerts();
  const [open, setOpen] = useState(false);

  const nav = isAdmin ? ADMIN_NAV : USER_NAV;

  const initials = (user?.full_name || "?")
    .split(" ").map(x => x[0]).join("").slice(0, 2).toUpperCase();

  const SidebarContent = () => (
    <>
      {/* Brand */}
      <div className="px-2 py-3">
        <Logo />
      </div>
      {isAdmin && (
        <span className="mx-2 mb-2 block rounded-lg bg-warn/15 px-2 py-1 text-center text-xs font-semibold text-warn">
          Admin
        </span>
      )}

      {/* Nav */}
      <nav className="mt-2 flex flex-1 flex-col gap-0.5" aria-label="Main">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href}
              onClick={() => setOpen(false)}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent/20 text-white ring-1 ring-accent/60"
                  : "text-mute hover:bg-panel-2 hover:text-white"
              }`}>
              <Icon className="size-4" aria-hidden />
              {label}
              {href === "/alerts" && unread > 0 && (
                <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div className="mt-3 border-t border-edge/50 pt-3">
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/20 text-sm font-bold text-accent">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.full_name || "User"}</p>
            <p className="text-xs text-mute">{isAdmin ? "Administrator" : "Operator"}</p>
          </div>
        </div>
        <button onClick={clearToken}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-mute hover:bg-panel-2 hover:text-white transition-colors">
          <LogOut className="size-4" aria-hidden /> Log out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between glass px-4 py-2.5 mb-4 lg:hidden">
        <Logo />
        <button onClick={() => setOpen(v => !v)} aria-label="Toggle menu"
          className="btn-ghost px-2 py-1.5">
          {open ? <X className="size-5"/> : <Menu className="size-5"/>}
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}/>
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-panel p-3 overflow-y-auto">
            <SidebarContent/>
          </aside>
        </>
      )}

      {/* Desktop sidebar */}
      <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col p-3 lg:flex overflow-y-auto">
        <SidebarContent/>
      </aside>
    </>
  );
}
