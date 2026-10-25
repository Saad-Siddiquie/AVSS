import { LayoutDashboard, Search, Video, Images, Bell, Settings } from "lucide-react";

export const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/search", label: "Search", icon: Search },
  { href: "/live", label: "Live Monitoring", icon: Video },
  { href: "/gallery", label: "Gallery", icon: Images },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Person detail pages belong to the Gallery section.
export const isActive = (path: string, href: string) =>
  path.startsWith(href) || (href === "/gallery" && path.startsWith("/person"));
