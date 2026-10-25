"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import { useAlerts } from "@/components/AlertsProvider";
import { nav, isActive } from "@/lib/nav";

export default function Sidebar() {
  const path = usePathname();
  const { unread } = useAlerts();
  return (
    <aside className="glass sticky top-4 hidden h-[calc(100vh-2rem)] w-56 shrink-0 flex-col p-3 lg:flex">
      <div className="px-2 py-3"><Logo /></div>
      <nav className="mt-4 flex flex-1 flex-col gap-1" aria-label="Main">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-accent/20 text-white ring-1 ring-accent/60" : "text-mute hover:bg-panel-2 hover:text-white"}`}>
              <Icon className="size-4" aria-hidden /> {label}
              {href === "/alerts" && unread > 0 && (
                <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[11px] font-semibold text-white" aria-label={`${unread} unread`}>{unread}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <Link href="/" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-mute hover:bg-panel-2 hover:text-white">
        <LogOut className="size-4" aria-hidden /> Logout
      </Link>
    </aside>
  );
}
