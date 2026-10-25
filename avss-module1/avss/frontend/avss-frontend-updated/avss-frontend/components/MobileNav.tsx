"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav, isActive } from "@/lib/nav";

// Replaces the sidebar below the lg breakpoint.
export default function MobileNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="glass fixed inset-x-2 bottom-2 z-20 grid grid-cols-6 p-1 lg:hidden">
      {nav.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] ${active ? "bg-accent/20 text-white" : "text-mute"}`}>
            <Icon className="size-5" aria-hidden />
            <span className="max-w-full truncate">{label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}
