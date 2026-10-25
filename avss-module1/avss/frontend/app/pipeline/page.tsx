"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** /pipeline is now /search — redirect for backward compatibility */
export default function PipelineRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/search"); }, [router]);
  return null;
}
