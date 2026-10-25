import type { Metadata } from "next";
import AuthCard from "@/components/AuthCard";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-7xl p-6">
      <AuthCard mode="signup" />
    </div>
  );
}
