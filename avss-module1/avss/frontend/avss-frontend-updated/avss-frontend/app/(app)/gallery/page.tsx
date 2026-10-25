import { Suspense } from "react";
import type { Metadata } from "next";
import GalleryView from "@/components/views/GalleryView";

export const metadata: Metadata = { title: "Gallery" };

export default function Page() {
  return (
    <Suspense>
      <GalleryView />
    </Suspense>
  );
}
