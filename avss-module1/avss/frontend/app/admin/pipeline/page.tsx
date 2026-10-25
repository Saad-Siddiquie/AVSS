"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Admin pipeline redirects to /search (shared page) */
export default function AdminPipelineRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/search"); }, [router]);
  return null;
}
