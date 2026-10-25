import { Suspense } from "react";
import type { Metadata } from "next";
import LiveView from "@/components/views/LiveView";

export const metadata: Metadata = { title: "Live Monitoring" };

export default function Page() {
  return (
    <Suspense>
      <LiveView />
    </Suspense>
  );
}
