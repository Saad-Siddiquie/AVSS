import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import TopBar from "@/components/TopBar";
import ThemeSync from "@/components/ThemeSync";
import { AlertsProvider } from "@/components/AlertsProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AlertsProvider>
      <ThemeSync />
      <div className="flex gap-4 p-4">
        <Sidebar />
        <div className="min-w-0 flex-1 pb-20 lg:pb-0">
          <TopBar />
          <main>{children}</main>
        </div>
        <MobileNav />
      </div>
    </AlertsProvider>
  );
}
