import Link from "next/link";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="space-y-4">
      <EmptyState title="Person not found" text="This ID is not in the detections. Choose someone from the gallery." />
      <Link href="/gallery" className="btn-primary mx-auto w-48">Open gallery</Link>
    </div>
  );
}
